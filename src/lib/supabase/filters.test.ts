import { describe, expect, it } from 'vitest'
import { ilikeAny } from './filters'

describe('ilikeAny', () => {
  it('builds one quoted ilike clause per column', () => {
    expect(ilikeAny(['nombre', 'codigo_oem'], 'filtro')).toBe(
      'nombre.ilike."%filtro%",codigo_oem.ilike."%filtro%"'
    )
  })

  it('keeps filter-grammar characters inside the quoted value', () => {
    expect(ilikeAny(['nombre'], 'a),empresa_id.neq.x')).toBe('nombre.ilike."%a),empresa_id.neq.x%"')
  })

  it('escapes quotes and backslashes so the value cannot close the quoting', () => {
    expect(ilikeAny(['nombre'], 'a"b\\c')).toBe('nombre.ilike."%a\\"b\\\\c%"')
  })
})
