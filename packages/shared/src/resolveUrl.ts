/**
 * Resolves ${variableName} placeholders in a URI template with user-provided values.
 * Used for display purposes so users can see the actual request URL.
 * Path params like {id} are left as-is since they're filled at request time.
 */
export function resolveUriTemplateForDisplay(
    uriTemplate: string,
    variables: Record<string, string>
): string {
    if (!uriTemplate || typeof uriTemplate !== 'string') return uriTemplate

    let url = uriTemplate

    for (const [key, val] of Object.entries(variables)) {
        const placeholder = '${' + key + '}'
        if (!url.includes(placeholder)) continue

        if (!val || val.trim() === '') {
            continue
        }

        let normalizedVal = val.trim()

        const placeholderIndex = url.indexOf(placeholder)
        const beforePlaceholder = url.substring(0, placeholderIndex)
        const hasProtocolInTemplate = /https?:\/\/$/.test(beforePlaceholder)
        if (hasProtocolInTemplate && /^https?:\/\//.test(normalizedVal)) {
            normalizedVal = normalizedVal.replace(/^https?:\/\//, '')
        }

        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        url = url.replace(new RegExp('\\$\\{' + escapedKey + '\\}', 'g'), normalizedVal)
    }

    return url
}

/**
 * Resolves ${variableName} placeholders and {pathParam} in a URI template.
 * Used for actual request routing. Throws if required variables are missing.
 */
export function resolveUrl(
    template: string,
    variables: Record<string, string>,
    params: Record<string, string> = {}
): string {
    let url = template
    const missingVariables: string[] = []

    for (const [key, val] of Object.entries(variables)) {
        const placeholder = '${' + key + '}'
        if (url.includes(placeholder)) {
            if (!val || val.trim() === '') {
                missingVariables.push(key)
            } else {
                let normalizedVal = val.trim()

                const placeholderIndex = url.indexOf(placeholder)
                const beforePlaceholder = url.substring(0, placeholderIndex)
                const hasProtocolInTemplate = /https?:\/\/$/.test(beforePlaceholder)

                if (hasProtocolInTemplate && /^https?:\/\//.test(normalizedVal)) {
                    normalizedVal = normalizedVal.replace(/^https?:\/\//, '')
                }

                const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                url = url.replace(new RegExp('\\$\\{' + escapedKey + '\\}', 'g'), normalizedVal)
            }
        }
    }

    // Check for any unresolved variables
    const unresolvedVarRegex = /\$\{([a-zA-Z0-9_.]+)\}/g
    let match
    while ((match = unresolvedVarRegex.exec(url)) !== null) {
        const varName = match[1]
        if (!missingVariables.includes(varName)) {
            missingVariables.push(varName)
        }
    }

    // Replace path params
    for (const [key, val] of Object.entries(params)) {
        url = url.replace('{' + key + '}', val || '')
    }

    if (missingVariables.length > 0) {
        throw new Error(
            `Missing or empty required variables: ${missingVariables.join(', ')}. ` +
            `Please set these variables in the Variables tab.`
        )
    }

    return url
}
