import { z } from 'zod'

export const CompraItemInputSchema = z
  .object({
    catalogoId: z.string().uuid({ message: 'Identificador de catálogo inválido' }),
    cantidad: z.number().positive({ message: 'La cantidad debe ser mayor a 0' }).max(99999.999, { message: 'Cantidad fuera de rango' }),
    precioUnitario: z.number().min(0, { message: 'El precio unitario no puede ser negativo' }),
    nombreProducto: z.string().optional(),
  })
  .strict()

export const CompraAbonoInicialSchema = z
  .object({
    metodoPago: z.enum(['efectivo', 'yape', 'tarjeta', 'transferencia'], {
      message: 'Método de pago no válido para abono inicial',
    }),
    monto: z.number().positive({ message: 'El monto del abono debe ser mayor a 0' }),
    referencia: z.string().max(120, { message: 'La referencia no puede exceder 120 caracteres' }).optional(),
  })
  .strict()

export const CompraInputSchema = z
  .object({
    operationId: z.string().uuid({ message: 'Identificador de operación inválido' }),
    proveedorId: z.string().uuid({ message: 'Identificador de proveedor inválido' }),
    nroDocumento: z.string().trim().max(60).nullable().optional(),
    tipoDocumento: z.enum(['FACTURA', 'BOLETA', 'OTROS']).default('FACTURA'),
    notas: z.string().trim().max(500).nullable().optional(),
    items: z
      .array(CompraItemInputSchema)
      .min(1, { message: 'Debes agregar al menos un artículo' })
      .max(200, { message: 'Máximo 200 artículos permitidos' }),
    ordenCompraId: z.string().uuid({ message: 'Identificador de orden de compra inválido' }).nullable().optional(),
    moneda: z.enum(['PEN', 'USD']).default('PEN'),
    tipoCambio: z.number().positive({ message: 'El tipo de cambio debe ser mayor a 0' }).nullable().optional(),
    abonoInicial: CompraAbonoInicialSchema.nullable().optional(),
  })
  .strict()
  .refine((v) => (v.moneda === 'USD' ? v.tipoCambio != null && v.tipoCambio > 0 : v.tipoCambio == null), {
    message: 'USD exige tipo de cambio > 0; PEN no lleva tipo de cambio',
  })

export type CompraInput = z.infer<typeof CompraInputSchema>
export type CompraItemInput = z.infer<typeof CompraItemInputSchema>
export type CompraAbonoInicialInput = z.infer<typeof CompraAbonoInicialSchema>
