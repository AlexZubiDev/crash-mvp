import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// TODO: This polling endpoint is a temporary MVP mechanism for crash detection.
// Replace with WebSocket or Server-Sent Events (SSE) in production so the server
// can push crash events to clients instead of clients polling every 500ms.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roundId } = await context.params

    const { data: round, error } = await supabase
      .from('crash_rounds')
      .select('id, status, crash_point, start_at, crash_at')
      .eq('id', roundId)
      .single()

    if (error || !round) {
      return NextResponse.json(
        { success: false, error: 'Ronda no encontrada' },
        { status: 404 }
      )
    }

    // Already finalized — safe to reveal crash_point now
    if (round.status === 'crashed') {
      return NextResponse.json({
        crashed: true,
        crashPoint: Number(round.crash_point),
        crashAt: round.crash_at,
      })
    }

    // Not yet started (no timing locked in)
    if (!round.crash_at) {
      return NextResponse.json({ crashed: false })
    }

    const now = Date.now()
    const crashAtMs = new Date(round.crash_at).getTime()

    if (now < crashAtMs) {
      return NextResponse.json({ crashed: false })
    }

    // Time elapsed — finalize crash server-side.
    // Safe sequence: mark round first, then bets (round status is the gate).
    // .neq / .eq guards make both updates idempotent under concurrent polls.
    await supabase
      .from('crash_rounds')
      .update({ status: 'crashed' })
      .eq('id', roundId)
      .neq('status', 'crashed')

    await supabase
      .from('crash_bets')
      .update({ status: 'lost', payout: 0, resolved_at: new Date().toISOString() })
      .eq('round_id', roundId)
      .eq('status', 'active')

    return NextResponse.json({
      crashed: true,
      crashPoint: Number(round.crash_point),
      crashAt: round.crash_at,
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Error interno', details: String(err) },
      { status: 500 }
    )
  }
}
