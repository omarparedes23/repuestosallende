import { z } from 'zod'

export const VentaInputSchema = z
  .object({
    tipoComprobante: z.enum(['ticket', 'boleta', 'factura']),
    clienteId: z.string().min(1).nullable().optional(),
    items: z
      .array(
        z.object({
          productoId: z.string().min(1),
          catalogoId: z.string().min(1),
          cantidad: z.number().positive(),
          descuento: z.number().min(0),
        })
      )
      .min(1, { error: 'El carrito está vacío' }),
    pagos: z
      .array(
        z.object({
          metodoPago: z.enum(['efectivo', 'yape', 'tarjeta', 'transferencia', 'credito']),
          monto: z.number().positive(),
          referencia: z.string().optional(),
        })
      )
      .min(1, { error: 'Agrega al menos un método de pago' }),
    moneda: z.enum(['PEN', 'USD']).default('PEN'),
    tipoCambio: z.number().positive().nullable(),
  })
  .refine((v) => (v.moneda === 'USD' ? v.tipoCambio != null : v.tipoCambio == null), {
    error: 'USD exige tipo de cambio > 0; PEN no lleva tipo de cambio',
  })
