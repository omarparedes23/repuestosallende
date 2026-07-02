import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const SYSTEM_PROMPT = `Eres el asistente virtual de Repuestos Allende, especializada en repuestos para vehículos de línea pesada y comercial, ubicada en La Victoria, Lima, Perú.

Eres directo, técnico y profesional. Solo respondes sobre repuestos automotrices, vehículos comerciales y mecánica. Si preguntan algo ajeno (política, deportes, tecnología general), declinas amablemente y rediriges.

## Cómo responder sobre productos
- IMPORTANTE: IGNORA cualquier inventario o producto mostrado en mensajes anteriores. SOLO básate en la sección "[INVENTARIO ENCONTRADO]" que aparece en el ÚLTIMO mensaje del usuario. NUNCA mezcles o inventes repuestos basándote en el historial de chat.
- Si recibes la sección "[INVENTARIO ENCONTRADO]", SIEMPRE muestra el nombre y precio del producto encontrado, aunque el stock sea 0 o diga "Sin stock".
- SIEMPRE que el producto tenga "Código comercial" y/o "Códigos alternos", muestra TODOS los códigos disponibles, no solo uno — el cliente puede estar buscando por cualquiera de ellos.
- "Sin stock" significa que el stock en sistema es 0, pero puede haber disponibilidad — indica el precio y sugiere confirmar por WhatsApp.
- Si NO recibes la sección "[INVENTARIO ENCONTRADO]" y el usuario preguntó por un repuesto específico, indica que no lo encontraste y sugiere consultar al WhatsApp.
- Si NO recibes "[INVENTARIO ENCONTRADO]" y el usuario hace una pregunta general (horarios, dirección, marcas, etc.), responde con la información del sistema.

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

const STOP_WORDS = new Set([
  'que', 'hay', 'tienes', 'tienen', 'para', 'como', 'cual', 'cuales',
  'una', 'unos', 'unas', 'los', 'las', 'del', 'con', 'por', 'de',
  'en', 'el', 'la', 'un', 'y', 'o', 'a', 'su', 'me', 'se', 'si',
  'son', 'esta', 'ese', 'esa', 'esto', 'esos', 'esas', 'familia',
  'linea', 'marca', 'modelo', 'vehiculo', 'auto', 'carro', 'busco',
  'busca', 'necesito', 'tengo', 'quiero', 'dame', 'dime', 'ver',
  'sobre', 'del', 'repuesto', 'repuestos', 'pieza', 'piezas', 'parte', 'partes', 'producto', 'stock',
  'precio', 'costo', 'disponible', 'tienes', 'tienen', 'tengo',
])

function buildMultiQuery(text: string): string {
  const words = text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar tildes
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
  // máximo 4 palabras para no sobrerestringir
  return [...new Set(words)].slice(0, 4).join(' ')
}

// Camino rapido y barato (sin llamar al LLM): codigo exacto, o seguimiento de
// una pregunta anterior que ya tenia un codigo. Si no matchea nada de esto,
// el llamador recurre a extraerIntencion (Etapa 2, con LLM).
function extractFastPathTerm(messages: ChatMessage[]): string | null {
  const userMsgs = messages.filter((m) => m.role === 'user')
  const lastMsg = userMsgs.at(-1)?.content ?? ''

  console.log('[chat] extractFastPathTerm — last msg:', JSON.stringify(lastMsg))

  // Código en el último mensaje → búsqueda exacta
  const codeMatch = lastMsg.match(CODE_REGEX)
  if (codeMatch) {
    console.log('[chat] extractFastPathTerm — code:', codeMatch[1].trim())
    return codeMatch[1].trim()
  }

  // Detectar si hay keyword de producto en el último mensaje
  const lastLower = lastMsg.toLowerCase()
  const keyword = PRODUCT_TERMS
    .filter((t) => lastLower.includes(t))
    .sort((a, b) => b.length - a.length)[0] ?? null

  if (keyword) {
    // Seguimiento del mismo producto si el keyword ya estaba en mensajes anteriores
    const prevText = userMsgs.slice(0, -1).map((m) => m.content).join(' ').toLowerCase()
    if (prevText.includes(keyword)) {
      const lastUsedCode = [...userMsgs].reverse()
        .slice(1)
        .map((m) => m.content.match(CODE_REGEX))
        .find((m) => m != null)?.[1]
      if (lastUsedCode) {
        console.log('[chat] extractFastPathTerm — follow-up, reusing code:', lastUsedCode.trim())
        return lastUsedCode.trim()
      }
    }
  }

  return null
}

type Intencion = {
  tipo_repuesto: string | null
  marca_repuesto: string | null
  tipo_vehiculo: 'pesado' | 'agricola' | null
  terminos_busqueda: string[]
}

const INTENCION_SYSTEM_PROMPT = `Eres un extractor de intención para búsqueda de repuestos automotrices. Del mensaje del usuario, extrae SOLO estos campos y responde en JSON:

{
  "tipo_repuesto": string o null — tipo específico de pieza mencionado (ej: "sensor", "pastilla de freno", "bujia", "filtro de aire"). Usa el término más específico y genérico posible, en español, sin tildes. null si no se menciona un tipo de pieza claro.
  "marca_repuesto": string o null — marca/fabricante del repuesto SOLO si se menciona explícitamente (ej: "bosch", "monroe", "ngk"). null si no se menciona.
  "tipo_vehiculo": "pesado" si menciona camión/bus/tráiler/línea pesada, "agricola" si menciona tractor/maquinaria agrícola, null en cualquier otro caso (incluye autos, camionetas, o si no se especifica).
  "terminos_busqueda": array de 2 a 4 strings — palabras clave para buscar en el nombre del producto: marca/modelo de vehículo si se menciona (ej: "toyota", "hilux", "sprinter", "515"), lado ("derecho"/"izquierdo"/"delantero"/"trasero") si aplica, y cualquier otra palabra descriptiva relevante. NO repitas aquí el tipo_repuesto si ya lo pusiste en ese campo.
}

Responde SOLO el JSON, nada más, sin explicaciones.`

async function extraerIntencion(texto: string): Promise<Intencion | null> {
  try {
    const completion = await client.chat.completions.create({
      model: isOpenAI ? 'gpt-4o-mini' : 'deepseek-chat',
      messages: [
        { role: 'system', content: INTENCION_SYSTEM_PROMPT },
        { role: 'user', content: texto },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
    })
    const raw = completion.choices[0]?.message?.content
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const intencion: Intencion = {
      tipo_repuesto: parsed.tipo_repuesto ?? null,
      marca_repuesto: parsed.marca_repuesto ?? null,
      tipo_vehiculo: parsed.tipo_vehiculo === 'pesado' || parsed.tipo_vehiculo === 'agricola' ? parsed.tipo_vehiculo : null,
      terminos_busqueda: Array.isArray(parsed.terminos_busqueda) ? parsed.terminos_busqueda.filter((t: unknown) => typeof t === 'string') : [],
    }
    console.log('[chat] extraerIntencion:', JSON.stringify(intencion))
    return intencion
  } catch (err) {
    console.error('[chat] extraerIntencion error:', err)
    return null
  }
}

type FiltrosBusqueda = {
  tipo_repuesto?: string | null
  marca_repuesto?: string | null
  tipo_vehiculo?: string | null
}

type ResultadoBusqueda = { context: string; cantidadResultados: number }

async function buscarProductosDB(term: string, filtros?: FiltrosBusqueda): Promise<ResultadoBusqueda> {
  console.log('[chat] buscarProductosDB — searching:', term, 'filtros:', JSON.stringify(filtros ?? {}))
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    let { data, error } = await supabase.rpc('ra_chatbot_buscar', {
      q: term,
      p_tipo_repuesto: filtros?.tipo_repuesto ?? null,
      p_marca_repuesto: filtros?.marca_repuesto ?? null,
      p_tipo_vehiculo: filtros?.tipo_vehiculo ?? null,
    })

    if (error) {
      console.error('[chat] rpc error:', JSON.stringify(error))
      return { context: '', cantidadResultados: 0 }
    }

    // El LLM adivina tipo/marca en su propio vocabulario, que puede no coincidir
    // con el texto exacto guardado en ra_tipos_repuesto/ra_marcas_repuesto (ej.
    // adivinó "kit de palier" pero en la base está como "PALIERES CHINA", o
    // "bomba" pero el producto real está categorizado como "BOMBIN"/"AUXILIAR").
    // El filtro no solo puede devolver 0 — puede devolver 1 o 2 cuando en
    // realidad hay más opciones relevantes categorizadas distinto. Si el
    // resultado es escaso, se amplía con texto libre y se MEZCLAN ambos sets
    // (los del filtro primero, más precisos; después los extra del texto
    // ampliado) en vez de reemplazar — no se pierde precisión ni recall.
    const huboFiltro = !!(filtros?.tipo_repuesto || filtros?.marca_repuesto || filtros?.tipo_vehiculo)
    const pocosResultados = !data || !Array.isArray(data) || data.length < 3
    if (huboFiltro && pocosResultados) {
      const termAmpliado = [term, filtros?.tipo_repuesto, filtros?.marca_repuesto]
        .filter(Boolean)
        .join(' ')
      console.log('[chat] pocos resultados con filtros, ampliando con texto:', termAmpliado)
      const retry = await supabase.rpc('ra_chatbot_buscar', { q: termAmpliado })
      if (retry.error) {
        console.error('[chat] rpc error (retry):', JSON.stringify(retry.error))
      } else if (Array.isArray(retry.data)) {
        const existentes = new Set(
          (Array.isArray(data) ? data : []).map((r: { nombre: string; codigo_oem: string | null }) => `${r.nombre}|${r.codigo_oem}`)
        )
        const extras = retry.data.filter(
          (r: { nombre: string; codigo_oem: string | null }) => !existentes.has(`${r.nombre}|${r.codigo_oem}`)
        )
        data = [...(Array.isArray(data) ? data : []), ...extras].slice(0, 6)
      }
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.log('[chat] rpc returned empty — data:', data)
      return { context: '', cantidadResultados: 0 }
    }

    console.log('[chat] rpc returned', data.length, 'rows')

    const lines = (data as Array<{
      nombre: string
      codigo_oem: string | null
      codigos_alternos: string | null
      precio_venta: number | null
      precio_venta_dolar: number | null
      stock_actual: number
      modelos: string | null
      marca_repuesto: string | null
      tipo_repuesto: string | null
    }>).map((r, i) => {
      const precios: string[] = []
      if (r.precio_venta != null) precios.push(`S/ ${Number(r.precio_venta).toFixed(2)}`)
      if (r.precio_venta_dolar != null) precios.push(`USD ${Number(r.precio_venta_dolar).toFixed(2)}`)
      const precio = precios.length > 0 ? precios.join(' / ') : 'Precio a consultar'
      const qty = Number(r.stock_actual ?? 0)
      const stock = qty > 0 ? `Stock: ${qty} unidad${qty !== 1 ? 'es' : ''}` : 'Stock a confirmar'
      const oem = r.codigo_oem ? `Código comercial: ${r.codigo_oem}` : ''
      const alternos = r.codigos_alternos ? `Códigos alternos: ${r.codigos_alternos}` : ''
      const modelos = r.modelos ? `Vehículos: ${r.modelos}` : ''
      const marca = r.marca_repuesto ? `Marca: ${r.marca_repuesto}` : ''
      const detalles = [oem, alternos, modelos, marca].filter(Boolean).join(' | ')
      return `${i + 1}. ${r.nombre}\n   Precio: ${precio} | ${stock}${detalles ? `\n   ${detalles}` : ''}`
    })

    return {
      context:
        `\n\nPRODUCTOS EN INVENTARIO (${data.length} resultado${data.length > 1 ? 's' : ''}):\n\n` +
        lines.join('\n\n') +
        '\n\nPrecios sujetos a confirmación. Para más opciones consulta por WhatsApp.',
      cantidadResultados: data.length,
    }
  } catch (err) {
    console.error('[chat] buscarProductosDB exception:', err)
    return { context: '', cantidadResultados: 0 }
  }
}

async function registrarLog(datos: {
  preguntaUsuario: string
  respuestaBot: string
  searchTerm: string | null
  filtros: FiltrosBusqueda | undefined
  cantidadResultados: number
}) {
  if (process.env.CHATBOT_LOGGING_ENABLED !== 'true') return
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { error } = await supabase.from('ra_chatbot_logs').insert({
      pregunta_usuario: datos.preguntaUsuario,
      respuesta_bot: datos.respuestaBot,
      search_term: datos.searchTerm,
      filtros: datos.filtros ?? null,
      cantidad_resultados: datos.cantidadResultados,
    })
    if (error) console.error('[chat] registrarLog error:', JSON.stringify(error))
  } catch (err) {
    console.error('[chat] registrarLog exception:', err)
  }
}

export async function POST(request: Request) {
  console.log('[chat] POST received')
  try {
    const { messages }: { messages: ChatMessage[] } = await request.json()
    console.log('[chat] messages count:', messages.length)

    console.log('[chat] systemPrompt length:', SYSTEM_PROMPT.length)

    // 1) Camino rápido y barato: código exacto o seguimiento de un código previo.
    let searchTerm = extractFastPathTerm(messages)
    let filtros: FiltrosBusqueda | undefined

    // 2) Sin match rápido: Etapa 2 — el LLM extrae intención estructurada
    //    (tipo de repuesto, marca, tipo de vehículo) de la pregunta libre.
    if (!searchTerm) {
      const lastMsg = messages.filter((m) => m.role === 'user').at(-1)?.content ?? ''
      const intencion = await extraerIntencion(lastMsg)

      if (intencion) {
        filtros = {
          tipo_repuesto: intencion.tipo_repuesto,
          marca_repuesto: intencion.marca_repuesto,
          tipo_vehiculo: intencion.tipo_vehiculo,
        }
        searchTerm = intencion.terminos_busqueda.join(' ') || buildMultiQuery(lastMsg) || null
      } else {
        // Si el LLM de intención falla, no perdemos la búsqueda: fallback al
        // extractor de palabras libres de siempre.
        searchTerm = buildMultiQuery(lastMsg) || null
      }
    }

    const { context: dbContext, cantidadResultados } = searchTerm
      ? await buscarProductosDB(searchTerm, filtros)
      : { context: '', cantidadResultados: 0 }
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
        let accumulated = ''
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) {
            totalChars += text.length
            accumulated += text
            controller.enqueue(encoder.encode(text))
          }
        }
        console.log('[chat] stream complete — chars sent:', totalChars)

        const lastUser = messages.filter((m) => m.role === 'user').at(-1)?.content ?? ''
        await registrarLog({
          preguntaUsuario: lastUser,
          respuestaBot: accumulated,
          searchTerm,
          filtros,
          cantidadResultados,
        })

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
