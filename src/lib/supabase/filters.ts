// PostgREST `.or()` takes a raw filter string, so user text must be quoted:
// inside double quotes `,` `(` `)` `.` `:` lose their grammar meaning and only `\` and `"` need escaping.
function quoteValue(value: string): string {
  return `"${value.replace(/[\\"]/g, (char) => `\\${char}`)}"`
}

export function ilikeAny(columns: readonly string[], term: string): string {
  const pattern = quoteValue(`%${term}%`)
  return columns.map((column) => `${column}.ilike.${pattern}`).join(',')
}
