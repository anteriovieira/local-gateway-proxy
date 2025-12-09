
export interface EndpointDef {
    path: string
    method: string
    uriTemplate: string
    variableNames: string[]
}

export interface GatewayConfig {
    endpoints: EndpointDef[]
    variables: string[]
}

const VARIABLE_REGEX = /\$\{stageVariables\.([a-zA-Z0-9_]+)\}/g
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
                    if (integration && 
                        integration.type === 'http_proxy' && 
                        integration.uri &&
                        typeof integration.uri === 'string') {
                        
                        const uriTemplate = integration.uri
                        // Use matchAll more efficiently
                        let match
                        const vars: string[] = []
                        VARIABLE_REGEX.lastIndex = 0 // Reset regex
                        
                        while ((match = VARIABLE_REGEX.exec(uriTemplate)) !== null) {
                            const varName = `stageVariables.${match[1]}`
                            vars.push(varName)
                            variableSet.add(varName)
                        }

                        endpoints.push({
                            path,
                            method: method.toUpperCase(),
                            uriTemplate,
                            variableNames: vars
                        })
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
