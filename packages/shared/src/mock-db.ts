/**
 * In-memory JSON CRUD database engine for mock endpoints.
 *
 * Each "collection" is an array of objects stored in memory.
 * Supports REST semantics: list, get by id, create, update (full & partial), delete.
 *
 * Works in any JS runtime (browser, Service Worker, Node).
 */

export interface MockDbRecord {
    id: number | string
    [key: string]: unknown
}

export interface MockDbCollection {
    name: string
    data: MockDbRecord[]
    nextId: number
}

export interface MockDbSnapshot {
    [collectionName: string]: MockDbRecord[]
}

export class MockDatabase {
    private collections: Map<string, MockDbCollection> = new Map()

    /**
     * Load initial data from a JSON snapshot (like a db.json file).
     * Each top-level key becomes a collection.
     */
    load(snapshot: MockDbSnapshot): void {
        this.collections.clear()
        for (const [name, records] of Object.entries(snapshot)) {
            if (!Array.isArray(records)) continue
            let maxId = 0
            for (const record of records) {
                const numId = typeof record.id === 'number' ? record.id : parseInt(String(record.id), 10)
                if (!isNaN(numId) && numId > maxId) maxId = numId
            }
            this.collections.set(name, {
                name,
                data: structuredClone(records),
                nextId: maxId + 1,
            })
        }
    }

    /**
     * Export current state as a snapshot.
     */
    toSnapshot(): MockDbSnapshot {
        const snapshot: MockDbSnapshot = {}
        for (const [name, col] of this.collections) {
            snapshot[name] = structuredClone(col.data)
        }
        return snapshot
    }

    getCollectionNames(): string[] {
        return Array.from(this.collections.keys())
    }

    hasCollection(name: string): boolean {
        return this.collections.has(name)
    }

    // --- CRUD operations ---

    /** GET /collection — list all records */
    list(collectionName: string): MockDbRecord[] | null {
        const col = this.collections.get(collectionName)
        if (!col) return null
        return structuredClone(col.data)
    }

    /** GET /collection/:id — get one record */
    getById(collectionName: string, id: string | number): MockDbRecord | null {
        const col = this.collections.get(collectionName)
        if (!col) return null
        const record = col.data.find(r => String(r.id) === String(id))
        return record ? structuredClone(record) : null
    }

    /** POST /collection — create a new record */
    create(collectionName: string, body: Record<string, unknown>): MockDbRecord | null {
        let col = this.collections.get(collectionName)
        if (!col) {
            // Auto-create collection on first insert
            col = { name: collectionName, data: [], nextId: 1 }
            this.collections.set(collectionName, col)
        }
        const bodyId = body.id as string | number | undefined
        const record: MockDbRecord = {
            ...body,
            id: bodyId ?? col.nextId++,
        }
        // If user provided an id, bump nextId if needed
        if (typeof record.id === 'number' && record.id >= col.nextId) {
            col.nextId = record.id + 1
        }
        col.data.push(record)
        return structuredClone(record)
    }

    /** PUT /collection/:id — full replace */
    replace(collectionName: string, id: string | number, body: Record<string, unknown>): MockDbRecord | null {
        const col = this.collections.get(collectionName)
        if (!col) return null
        const index = col.data.findIndex(r => String(r.id) === String(id))
        if (index === -1) return null
        const record: MockDbRecord = { ...body, id: col.data[index].id }
        col.data[index] = record
        return structuredClone(record)
    }

    /** PATCH /collection/:id — partial update */
    update(collectionName: string, id: string | number, body: Record<string, unknown>): MockDbRecord | null {
        const col = this.collections.get(collectionName)
        if (!col) return null
        const index = col.data.findIndex(r => String(r.id) === String(id))
        if (index === -1) return null
        const record = { ...col.data[index], ...body, id: col.data[index].id }
        col.data[index] = record
        return structuredClone(record)
    }

    /** DELETE /collection/:id — remove a record */
    delete(collectionName: string, id: string | number): boolean {
        const col = this.collections.get(collectionName)
        if (!col) return false
        const index = col.data.findIndex(r => String(r.id) === String(id))
        if (index === -1) return false
        col.data.splice(index, 1)
        return true
    }
}

/**
 * Handle a mock-db endpoint request.
 *
 * The CRUD operation is inferred from the HTTP method.
 * If pathParams contains an "id" (or any single param), it's used as the record id.
 *
 * Examples:
 *   GET  /whatever/path    + collection "users" + no id param  → list all users
 *   GET  /whatever/{id}    + collection "users" + id="3"       → get user 3
 *   POST /whatever/path    + collection "users"                → create user
 *   PUT  /whatever/{id}    + collection "users" + id="3"       → replace user 3
 *   PATCH /whatever/{id}   + collection "users" + id="3"       → update user 3
 *   DELETE /whatever/{id}  + collection "users" + id="3"       → delete user 3
 */
export function handleMockDbEndpoint(
    db: MockDatabase,
    collection: string,
    method: string,
    pathParams: Record<string, string>,
    requestBody?: Record<string, unknown> | null,
): { status: number; body: unknown; headers: Record<string, string> } {
    const upperMethod = method.toUpperCase()
    const headers: Record<string, string> = {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
        'x-mock-db': 'true',
    }

    // Extract id from path params — use "id" key or first available param value
    const id = pathParams.id ?? Object.values(pathParams)[0] ?? undefined

    // LIST
    if (!id && upperMethod === 'GET') {
        const data = db.list(collection)
        if (data === null) {
            return { status: 404, body: { error: `Collection "${collection}" not found` }, headers }
        }
        return { status: 200, body: data, headers }
    }

    // CREATE
    if (!id && upperMethod === 'POST') {
        const record = db.create(collection, requestBody ?? {})
        return { status: 201, body: record, headers }
    }

    // GET BY ID
    if (id && upperMethod === 'GET') {
        const record = db.getById(collection, id)
        if (!record) {
            return { status: 404, body: { error: 'Not found' }, headers }
        }
        return { status: 200, body: record, headers }
    }

    // REPLACE
    if (id && upperMethod === 'PUT') {
        const record = db.replace(collection, id, requestBody ?? {})
        if (!record) {
            return { status: 404, body: { error: 'Not found' }, headers }
        }
        return { status: 200, body: record, headers }
    }

    // UPDATE
    if (id && upperMethod === 'PATCH') {
        const record = db.update(collection, id, requestBody ?? {})
        if (!record) {
            return { status: 404, body: { error: 'Not found' }, headers }
        }
        return { status: 200, body: record, headers }
    }

    // DELETE
    if (id && upperMethod === 'DELETE') {
        const deleted = db.delete(collection, id)
        if (!deleted) {
            return { status: 404, body: { error: 'Not found' }, headers }
        }
        return { status: 200, body: {}, headers }
    }

    return { status: 405, body: { error: 'Method not allowed' }, headers }
}
