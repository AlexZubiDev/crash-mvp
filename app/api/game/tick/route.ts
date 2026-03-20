import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CRON_SECRET = process.env.CRON_SECRET

const LOBBY_MS      = 10_000  // waiting period before round starts
const POST_CRASH_MS =  3_000  // cooldown between crash and next waiting round

export async function POST(req: Request) {
  const auth = req.headers.get('authorization')

  if (auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const now = Date.now()

    // ── Step 1: Finalize running rounds past their crash_at ─────────────────

    const { data: running } = await supabase
      .from('crash_rounds')
      .select('id, crash_at')
      .eq('status', 'running')

    for (const round of running ?? []) {
      if (round.crash_at && now >= new Date(round.crash_at).getTime()) {
        await supabase
          .from('crash_rounds')
          .update({ status: 'crashed' })
          .eq('id', round.id)
          .neq('status', 'crashed')

        await supabase
          .from('crash_bets')
          .update({
            status: 'lost',
            payout: 0,
            resolved_at: new Date().toISOString()
          })
          .eq('round_id', round.id)
          .eq('status', 'active')
      }
    }

    // ── Step 2: Advance waiting rounds past their start_at ──────────────────

    const { data: waiting } = await supabase
      .from('crash_rounds')
      .select('id, start_at')
      .eq('status', 'waiting')

    for (const round of waiting ?? []) {
      if (round.start_at && now >= new Date(round.start_at).getTime()) {
        await supabase
          .from('crash_rounds')
          .update({ status: 'running' })
          .eq('id', round.id)
          .eq('status', 'waiting')
      }
    }

    // ── Step 3: Create next waiting round if none active ────────────────────

    const { count } = await supabase
      .from('crash_rounds')
      .select('id', { count: 'exact', head: true })
      .in('status', ['waiting', 'running'])

    if (count === 0) {
      const { data: lastCrashed } = await supabase
        .from('crash_rounds')
        .select('crash_at, crash_point')
        .eq('status', 'crashed')
        .order('crash_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const cooldownOk =
        !lastCrashed?.crash_at ||
        now >= new Date(lastCrashed.crash_at).getTime() + POST_CRASH_MS

      if (cooldownOk) {
        const randomInt  = crypto.randomInt(0, 1_000_000)
        const crashPoint = Number((1 + (randomInt / 1_000_000) * 5).toFixed(2))
        const startAt    = new Date(now + LOBBY_MS)
        const durationMs = Math.round((crashPoint - 1.0) / 0.03 * 100)
        const crashAt    = new Date(startAt.getTime() + durationMs)

        await supabase.from('crash_rounds').insert({
          status:      'waiting',
          crash_point: crashPoint,
          start_at:    startAt.toISOString(),
          crash_at:    crashAt.toISOString(),
        })
      }

      return NextResponse.json({
        round:     null,
        lastCrash: lastCrashed?.crash_point
          ? { crashPoint: Number(lastCrashed.crash_point) }
          : undefined,
      })
    }

    // ── Return current active round ─────────────────────────────────────────

    const { data: current } = await supabase
      .from('crash_rounds')
      .select('id, status, start_at, crash_at')
      .in('status', ['waiting', 'running'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ round: current ?? null })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Error interno', details: String(err) },
      { status: 500 }
    )
  }
}