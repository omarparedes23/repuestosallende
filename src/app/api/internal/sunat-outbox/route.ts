import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { processSunatOutbox } from '@/lib/facturacion/outbox'

export const runtime = 'nodejs'
export const maxDuration = 50

function authorized(request: Request) {
  const expected = process.env.SUNAT_OUTBOX_CRON_SECRET
  const authorization = request.headers.get('authorization')
  if (!expected || !authorization?.startsWith('Bearer ')) return false
  const received = authorization.slice(7)
  const left = Buffer.from(received)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json(await processSunatOutbox(10))
  } catch (error) {
    console.error('[sunat-outbox] Worker failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Worker failed' }, { status: 500 })
  }
}

// Vercel Cron invoca rutas con GET. Se conserva POST para cron/systemd/curl en VPS.
export const GET = POST
