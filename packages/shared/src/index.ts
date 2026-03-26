// @proxy-app/shared - shared types and utilities
export type { EndpointDef, Workspace, LogEntry, ApiLogEntry, MockDbConfig } from './types'
export { parseGatewayConfig } from './parser'
export type { GatewayConfig } from './parser'
export { resolveUriTemplateForDisplay, resolveUrl } from './resolveUrl'
export { matchPath } from './matchPath'
export { MockDatabase, handleMockDbEndpoint, applyResponseTemplate } from './mock-db'
export type { MockDbRecord, MockDbCollection, MockDbSnapshot } from './mock-db'
