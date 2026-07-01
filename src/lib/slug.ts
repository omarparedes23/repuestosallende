const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DIACRITICS_RE = /[̀-ͯ]/g

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** URL slug estable para un producto: texto legible + uuid al final (garantiza unicidad). */
export function productoSlug(nombre: string, id: string): string {
  return `${slugify(nombre)}-${id}`
}

/** Extrae el uuid de un slug de producto. Devuelve null si el slug no trae uno valido. */
export function parseProductoId(slug: string): string | null {
  const match = slug.match(UUID_RE)
  return match ? match[0] : null
}
