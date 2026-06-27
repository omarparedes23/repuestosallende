import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const SYSTEM_PROMPT = `Eres el asistente virtual de Repuestos Allende, especializada en repuestos para vehículos de línea pesada y comercial, ubicada en La Victoria, Lima, Perú.

Eres directo, técnico y profesional. Solo respondes sobre repuestos automotrices, vehículos comerciales y mecánica. Si preguntan algo ajeno (política, deportes, tecnología general), declinas amablemente y rediriges.

## Cómo responder sobre productos
- Si recibes una sección "INVENTARIO CONSULTADO AHORA MISMO", SIEMPRE muestra el nombre y precio del producto encontrado, aunque el stock sea 0 o diga "Sin stock".
- "Sin stock" significa que el stock en sistema es 0, pero puede haber disponibilidad — indica el precio y sugiere confirmar por WhatsApp.
- Si NO recibes datos de inventario para un producto, entonces sí indica que consulten al WhatsApp.

Para cotizaciones por volumen, precios especiales o confirmación de stock urgente, redirige al WhatsApp: wa.me/51935034586.

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

const CODE_REGEX = /\b([A-Za-z]{1,6}[\s\-.]?\d{3,}[A-Za-z0-9.\-]*|\d{5,}[A-Za-z0-9.\-]*)\b/

function extractSearchTerm(messages: ChatMessage[]): string | null {
  const userMsgs = messages.filter((m) => m.role === 'user')
  const lastMsg = userMsgs.at(-1)?.content ?? ''
  const recentCombined = userMsgs.slice(-2).map((m) => m.content).join(' ')
  const recentLower = recentCombined.toLowerCase()

  console.log('[chat] extractSearchTerm — last msg:', JSON.stringify(lastMsg))

  // Código en el último mensaje del usuario
  const codeMatch = lastMsg.match(CODE_REGEX)
  if (codeMatch) {
    console.log('[chat] extractSearchTerm — code in last msg:', codeMatch[1].trim())
    return codeMatch[1].trim()
  }

  // Keyword de producto en los últimos 2 mensajes
  const keyword = PRODUCT_TERMS
    .filter((term) => recentLower.includes(term))
    .sort((a, b) => b.length - a.length)[0] ?? null

  if (keyword) {
    // Si el keyword ya apareció en mensajes anteriores → es un seguimiento del mismo producto
    // Si es un keyword nuevo → búsqueda de producto diferente
    const prevText = userMsgs.slice(0, -1).map((m) => m.content).join(' ').toLowerCase()
    const isFollowUp = prevText.includes(keyword)

    if (isFollowUp) {
      const lastUsedCode = [...userMsgs].reverse()
        .slice(1)
        .map((m) => m.content.match(CODE_REGEX))
        .find((m) => m != null)?.[1]

      if (lastUsedCode) {
        console.log('[chat] extractSearchTerm — follow-up, reusing last code:', lastUsedCode.trim())
        return lastUsedCode.trim()
      }
    }

    console.log('[chat] extractSearchTerm — new keyword:', keyword)
    return keyword
  }

  return null
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
      codigos_alternos: string | null
      precio_venta: number
      moneda: string | null
      stock_actual: number
      modelos: string | null
    }>).map((r, i) => {
      const simbolo = (r.moneda ?? 'USD') === 'PEN' ? 'S/' : 'USD'
      const precio = r.precio_venta ? `${simbolo} ${Number(r.precio_venta).toFixed(2)}` : 'Precio a consultar'
      const qty = Number(r.stock_actual ?? 0)
      const stock = qty > 0 ? `Stock: ${qty} unidad${qty !== 1 ? 'es' : ''}` : 'Stock a confirmar'
      const oem = r.codigo_oem ? `Código comercial: ${r.codigo_oem}` : ''
      const alternos = r.codigos_alternos ? `Códigos alternos: ${r.codigos_alternos}` : ''
      const modelos = r.modelos ? `Vehículos: ${r.modelos}` : ''
      const detalles = [oem, alternos, modelos].filter(Boolean).join(' | ')
      return `${i + 1}. ${r.nombre}\n   Precio: ${precio} | ${stock}${detalles ? `\n   ${detalles}` : ''}`
    })

    return (
      `\n\nPRODUCTOS EN INVENTARIO (${data.length} resultado${data.length > 1 ? 's' : ''}):\n` +
      lines.join('\n') +
      '\n\nPrecios en soles. Stock sujeto a confirmación.'
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

    // Inject inventory into the last user message so the model can't ignore it
    const messagesWithContext = dbContext
      ? messages.map((m, i) =>
          i === messages.length - 1 && m.role === 'user'
            ? { ...m, content: m.content + '\n\n[INVENTARIO ENCONTRADO]\n' + dbContext }
            : m
        )
      : messages

    const aiMessages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...messagesWithContext,
    ]

    console.log('[chat] calling AI model:', isOpenAI ? 'gpt-4o-mini' : 'deepseek-chat')
    const stream = await client.chat.completions.create({
      model: isOpenAI ? 'gpt-4o-mini' : 'deepseek-chat',
      messages: aiMessages,
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
