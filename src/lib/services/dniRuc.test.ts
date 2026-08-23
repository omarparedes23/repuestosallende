import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { consultarDni, consultarRuc } from './dniRuc'

const TOKEN = 'token-de-prueba'
const mockFetch = vi.fn()

function respuestaJson(payload: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => payload,
  } as Response
}

describe('dniRuc — consulta DNI/RUC vía APIsPerú', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('APISPERU_TOKEN', TOKEN)
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  describe('Validación de formato', () => {
    it('rechaza un DNI con menos de 8 dígitos sin llamar a fetch', async () => {
      const resultado = await consultarDni('1234567')
      expect(resultado).toEqual({ exito: false, error: 'El DNI debe tener 8 dígitos' })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('rechaza un RUC que no tenga 11 dígitos', async () => {
      const resultado = await consultarRuc('20abcd12345')
      expect(resultado.exito).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('Token', () => {
    it('retorna error si APISPERU_TOKEN no está configurado y no llama al servicio', async () => {
      vi.stubEnv('APISPERU_TOKEN', '')
      const resultado = await consultarRuc('20131312955')
      expect(resultado).toEqual({ exito: false, error: 'APISPERU_TOKEN no configurado' })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('envía el token como query param en la URL', async () => {
      mockFetch.mockResolvedValue(
        respuestaJson({ success: true, ruc: '20131312955', razonSocial: 'ACME SAC' })
      )
      await consultarRuc('20131312955')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`ruc/20131312955?token=${TOKEN}`)
      )
    })
  })

  describe('Consulta exitosa', () => {
    it('retorna los datos del RUC', async () => {
      mockFetch.mockResolvedValue(
        respuestaJson({
          ruc: '20131312955',
          razonSocial: 'REPUESOS ALLENDE SAC',
          direccion: 'AV. PRUEBA 123',
          estado: 'ACTIVO',
          condicion: 'HABIDO',
        })
      )
      const resultado = await consultarRuc('20131312955')
      expect(resultado).toEqual({
        exito: true,
        data: {
          ruc: '20131312955',
          razonSocial: 'REPUESOS ALLENDE SAC',
          direccion: 'AV. PRUEBA 123',
          estado: 'ACTIVO',
          condicion: 'HABIDO',
        },
      })
    })

    it('retorna el nombre completo del DNI', async () => {
      mockFetch.mockResolvedValue(
        respuestaJson({
          dni: '12345678',
          nombres: 'Juan',
          apellidoPaterno: 'Pérez',
          apellidoMaterno: 'Quispe',
        })
      )
      const resultado = await consultarDni('12345678')
      expect(resultado.exito).toBe(true)
      if (resultado.exito) {
        expect(resultado.data.nombres).toBe('Juan')
        expect(resultado.data.apellidoPaterno).toBe('Pérez')
      }
    })
  })

  describe('Errores de la API', () => {
    it('propaga el mensaje de la API cuando success=false', async () => {
      mockFetch.mockResolvedValue(respuestaJson({ success: false, message: 'Documento no encontrado' }))
      const resultado = await consultarDni('87654321')
      expect(resultado).toEqual({ exito: false, error: 'Documento no encontrado' })
    })

    it('usa mensaje genérico si success=false sin message', async () => {
      mockFetch.mockResolvedValue(respuestaJson({ success: false }))
      const resultado = await consultarDni('87654321')
      expect(resultado).toEqual({ exito: false, error: 'No se encontraron resultados.' })
    })

    it('reporta HTTP status cuando res.ok es falso', async () => {
      mockFetch.mockResolvedValue(respuestaJson({}, false, 500))
      const resultado = await consultarRuc('20131312955')
      expect(resultado).toEqual({ exito: false, error: 'HTTP 500' })
    })
  })

  describe('Respuesta malformada', () => {
    it('captura el fallo de parseo JSON y retorna error de red', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Unexpected token < in JSON')
        },
      } as unknown as Response)
      const resultado = await consultarRuc('20131312955')
      expect(resultado.exito).toBe(false)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('no registra el token ni la URL cuando fetch lanza un error', async () => {
      const urlSensible = `https://dniruc.apisperu.com/api/v1/ruc/20131312955?token=${TOKEN}`
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      mockFetch.mockRejectedValue(new Error(`fetch failed for ${urlSensible}`))

      const resultado = await consultarRuc('20131312955')

      expect(resultado).toEqual({ exito: false, error: 'Error de red al consultar el documento' })
      expect(consoleError).toHaveBeenCalledWith('[APIsPeru] Error de red en la consulta')
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain(TOKEN)
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain(urlSensible)
    })
  })
})
