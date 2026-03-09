import type { EndpointDef } from '../types'

export interface GatewayConfig {
    endpoints: EndpointDef[]
    variables: string[]
}

const VARIABLE_REGEX = /\$\{([a-zA-Z0-9_.]+)\}/g
const DEFAULT_INTEGRATION_PROPERTY = 'x-amazon-apigateway-integration'

export function parseGatewayConfig(
    jsonContent: string,
    integrationProperty?: string
): GatewayConfig {
    try {
        // Use a more efficient JSON parsing approach for large files
        const data = JSON.parse(jsonContent)
        const endpoints: EndpointDef[] = []
        const variableSet = new Set<string>()
        const propertyName = integrationProperty || DEFAULT_INTEGRATION_PROPERTY

        if (data.paths && typeof data.paths === 'object') {
            // Pre-allocate array if we can estimate size (optional optimization)
            const paths = data.paths
            
            // Use for...in for better performance on large objects
            for (const path in paths) {
                const methods = paths[path]
                if (!methods || typeof methods !== 'object') continue
                
                for (const method in methods) {
                    const details = methods[method]
                    if (!details || typeof details !== 'object') continue
                    
                    const integration = details[propertyName]
                    // Accept http_proxy or integrations with uri (AWS often omits type for simple proxy configs)
                    // Exclude mock integrations (e.g. CORS preflight)
                    const isProxy = integration?.uri && typeof integration.uri === 'string' &&
                        (integration?.type === 'http_proxy' || integration?.type === 'http' || integration?.type === undefined) &&
                        integration?.type !== 'mock'
                    if (integration && isProxy) {
                        
                        const uriTemplate = integration.uri
                        // Use matchAll more efficiently
                        let match
                        const vars: string[] = []
                        VARIABLE_REGEX.lastIndex = 0 // Reset regex
                        
                        while ((match = VARIABLE_REGEX.exec(uriTemplate)) !== null) {
                            // Extract the full variable name as it appears in the template
                            // (e.g., "userId" or "stageVariables.userId")
                            const varName = match[1]
                            vars.push(varName)
                            variableSet.add(varName)
                        }

                        endpoints.push({
                            path,
                            method: method.toUpperCase(),
                            uriTemplate,
                            variableNames: vars
                        })
                    } else if (integration?.type === 'mock') {
                        // Parse mock integration - extract response body from responseTemplates
                        const responses = integration.responses
                        const defaultResponse = responses?.default ?? responses?.['200']
                        const responseTemplates = defaultResponse?.responseTemplates
                        const mockBody = responseTemplates?.['application/json']
                            ?? responseTemplates?.['*/*']
                            ?? (typeof defaultResponse?.responseTemplates === 'string' ? defaultResponse.responseTemplates : null)
                        if (typeof mockBody === 'string') {
                            endpoints.push({
                                path,
                                method: method.toUpperCase(),
                                uriTemplate: '(mock)',
                                variableNames: [],
                                isMock: true,
                                mockResponse: mockBody
                            })
                        }
                    }
                }
            }
        }

        return {
            endpoints,
            variables: Array.from(variableSet)
        }
    } catch (e) {
        console.error("Failed to parse JSON", e)
        return { endpoints: [], variables: [] }
    }
}
