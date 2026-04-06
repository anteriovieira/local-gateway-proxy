// @proxy-app/shared - shared types and utilities
export type { EndpointDef, Workspace, LogEntry, ApiLogEntry, MockDbConfig } from './types.js'
export { parseGatewayConfig } from './parser.js'
export type { GatewayConfig } from './parser.js'
export { resolveUriTemplateForDisplay, resolveUrl } from './resolveUrl.js'
export { matchPath } from './matchPath.js'
export { MockDatabase, handleMockDbEndpoint, applyResponseTemplate } from './mock-db.js'
export type { MockDbRecord, MockDbCollection, MockDbSnapshot } from './mock-db.js'
