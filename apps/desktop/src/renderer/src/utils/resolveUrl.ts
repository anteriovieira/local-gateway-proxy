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
            // Leave placeholder as-is when value is empty
            continue
        }

        let normalizedVal = val.trim()

        // If template has protocol before the variable and value also has protocol, strip from value
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
