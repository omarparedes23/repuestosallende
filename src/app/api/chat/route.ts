import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const isOpenAI = process.env.AI_PROVIDER === 'openai'

const client = new OpenAI({
  apiKey: isOpenAI ? process.env.OPENAI_API_KEY : process.env.DEEPSEEK_API_KEY,
  ...(isOpenAI ? {} : { baseURL: 'https://api.deepseek.com' }),
})

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

// Palabras de productos — si aparecen en el mensaje, buscamos en la BD
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
    .map((m) => m.content.toLowerCase())

  const combined = recentUserMsgs.join(' ')

  // Devolver la palabra de producto más específica (más larga) que aparezca
  const found = PRODUCT_TERMS
    .filter((term) => combined.includes(term))
    .sort((a, b) => b.length - a.length) // más específica primero

  return found[0] ?? null
}

async function buscarProductosDB(term: string): Promise<string> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data, error } = await supabase.rpc('ra_chatbot_buscar', { q: term })

    if (error || !data || !Array.isArray(data) || data.length === 0) return ''

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
  } catch {
    return ''
  }
}

export async function POST(request: Request) {
  const { messages }: { messages: ChatMessage[] } = await request.json()

  const systemPrompt = readFileSync(
    join(process.cwd(), 'src', 'data', 'chatbot-context.md'),
    'utf-8'
  )

  // Buscar en BD si el cliente menciona algún repuesto
  const searchTerm = extractSearchTerm(messages)
  const dbContext = searchTerm ? await buscarProductosDB(searchTerm) : ''

  const stream = await client.chat.completions.create({
    model: isOpenAI ? 'gpt-4o-mini' : 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt + dbContext },
      ...messages,
    ],
    stream: true,
    max_tokens: 500,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? ''
        if (text) controller.enqueue(encoder.encode(text))
      }
      controller.close()
    },
  })

  return new NextResponse(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
