/**
 * Matches a URL path against a pattern with {param} placeholders.
 * Returns extracted path parameters if matched, null otherwise.
 */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
    const patternParts = pattern.split('/')
    const pathParts = path.split('/')

    if (patternParts.length !== pathParts.length) return null

    const params: Record<string, string> = {}
    for (let i = 0; i < patternParts.length; i++) {
        const patternPart = patternParts[i]
        const pathPart = pathParts[i]

        const paramMatch = patternPart.match(/^{([a-zA-Z0-9_]+)}$/)
        if (paramMatch) {
            params[paramMatch[1]] = pathPart
        } else if (patternPart !== pathPart) {
            return null
        }
    }
    return params
}
