import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const SYSTEM_PROMPT = `Eres el asistente virtual de Repuestos Allende, especializada en repuestos para vehículos de línea pesada y comercial, ubicada en La Victoria, Lima, Perú.

Eres directo, técnico y profesional. Solo respondes sobre repuestos automotrices, vehículos comerciales y mecánica. Si preguntan algo ajeno (política, deportes, tecnología general), declinas amablemente y rediriges.

Los precios y stock los obtienes del inventario en tiempo real que se te proporciona en cada mensaje. Si no recibes datos de inventario para un producto, indica que consulten al WhatsApp para confirmar disponibilidad.

Para cotizaciones por volumen, precios especiales o confirmación de stock urgente, siempre redirige al WhatsApp: wa.me/51935034586.

## Datos de la empresa
- Dirección: Av. Manco Cápac 316, La Victoria, Lima (al lado del BBVA)
- WhatsApp: wa.me/51935034586
- Email: ventas@repuestosallende.pe
- Horarios: Lun–Vie 9:00–13:00 y 14:00–18:00 | Sáb 9:00–13:00 | Dom cerrado
- Especialidad: Mercedes Benz Sprinter (313/315/413/415/514/515/516/906/907), Peugeot, Hyundai, Renault, Iveco`

const isOpenAI = process.env.AI_PROVIDER === 'openai'

console.log('[chat] init — provider:', isOpenAI ? 'openai' : 'deepseek')
console.log('[chat] SUPABASE_URL set:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('[chat] SUPABASE_ANON_KEY set:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
console.log('[chat] AI key set:', isOpenAI ? !!process.env.OPENAI_API_KEY : !!process.env.DEEPSEEK_API_KEY)

const client = new OpenAI({
  apiKey: isOpenAI ? process.env.OPENAI_API_KEY : process.env.DEEPSEEK_API_KEY,
  ...(isOpenAI ? {} : { baseURL: 'https://api.deepseek.com' }),
})

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const PRODUCT_TERMS = [
  'amortiguador', 'filtro', 'freno', 'disco', 'bomba', 'sensor', 'radiador',
  'cremallera', 'pastilla', 'rodaje', 'rotula', 'rótula', 'trapecio', 'rack',
  'compresor', 'intercooler', 'enfriador', 'espejo', 'condensador', 'cadena',
  'distribucion', 'distribución', 'terminal', 'servo', 'torreta', 'poncho',
  'flujometro', 'flujómetro', 'bocina', 'mica', 'fuelle', 'tapa', 'inyector',
  'correa', 'embrague', 'culata', 'turbo', 'rodamiento', 'munon', 'muñon',
]

function extractSearchTerm(messages: ChatMessage[]): string | null {
  const recentUserMsgs = messages
    .filter((m) => m.role === 'user')
    .slice(-2)
    .map((m) => m.content)

  const combined = recentUserMsgs.join(' ')
  const combinedLower = combined.toLowerCase()

  // Detect product codes first (e.g. CA-56041, DB0519, LF 4054, LF4054.IMP)
  const codeMatch = combined.match(/\b([A-Za-z]{1,6}[\s\-.]?\d{3,7}[A-Za-z0-9.\-]*)\b/)
  if (codeMatch) {
    const code = codeMatch[1].trim()
    console.log('[chat] extractSearchTerm — detected code:', code)
    return code
  }

  // Fall back to keyword-based search
  const found = PRODUCT_TERMS
    .filter((term) => combinedLower.includes(term))
    .sort((a, b) => b.length - a.length)

  const result = found[0] ?? null
  console.log('[chat] extractSearchTerm — combined:', combinedLower, '→ term:', result)
  return result
}

async function buscarProductosDB(term: string): Promise<string> {
  console.log('[chat] buscarProductosDB — searching:', term)
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error } = await supabase.rpc('ra_chatbot_buscar', { q: term })

    if (error) {
      console.error('[chat] rpc error:', JSON.stringify(error))
      return ''
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.log('[chat] rpc returned empty — data:', data)
      return ''
    }

    console.log('[chat] rpc returned', data.length, 'rows')

    const lines = (data as Array<{
      nombre: string
      codigo_oem: string | null
      precio_venta: number
      tiene_stock: boolean
      modelos: string | null
    }>).map((r) => {
      const stock = r.tiene_stock ? 'En stock' : 'Sin stock'
      const modelos = r.modelos ? ` | Modelos: ${r.modelos}` : ''
      const oem = r.codigo_oem ? ` | OEM: ${r.codigo_oem}` : ''
      return `- ${r.nombre}${oem}: S/ ${r.precio_venta.toFixed(2)} — ${stock}${modelos}`
    })

    return (
      '\n\n## PRODUCTOS ENCONTRADOS EN INVENTARIO\n' +
      'Los siguientes repuestos están disponibles con precios actualizados:\n' +
      lines.join('\n') +
      '\n(Precios en soles. Stock sujeto a confirmación. Para grandes volúmenes consulta al WhatsApp.)'
    )
  } catch (err) {
    console.error('[chat] buscarProductosDB exception:', err)
    return ''
  }
}

export async function POST(request: Request) {
  console.log('[chat] POST received')
  try {
    const { messages }: { messages: ChatMessage[] } = await request.json()
    console.log('[chat] messages count:', messages.length)

    console.log('[chat] systemPrompt length:', SYSTEM_PROMPT.length)

    const searchTerm = extractSearchTerm(messages)
    const dbContext = searchTerm ? await buscarProductosDB(searchTerm) : ''
    console.log('[chat] dbContext length:', dbContext.length)

    console.log('[chat] calling AI model:', isOpenAI ? 'gpt-4o-mini' : 'deepseek-chat')
    const stream = await client.chat.completions.create({
      model: isOpenAI ? 'gpt-4o-mini' : 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + dbContext },
        ...messages,
      ],
      stream: true,
      max_tokens: 500,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        let totalChars = 0
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) {
            totalChars += text.length
            controller.enqueue(encoder.encode(text))
          }
        }
        console.log('[chat] stream complete — chars sent:', totalChars)
        controller.close()
      },
    })

    return new NextResponse(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    console.error('[chat] POST error:', err)
    return new NextResponse('Error interno', { status: 500 })
  }
}
