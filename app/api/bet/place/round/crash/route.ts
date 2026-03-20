import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const roundId = body.roundId
    const crashPoint = Number(body.crashPoint)

    if (!roundId) {
      return NextResponse.json(
        { success: false, error: 'roundId es obligatorio' },
        { status: 400 }
      )
    }

    if (!crashPoint || crashPoint < 1) {
      return NextResponse.json(
        { success: false, error: 'crashPoint inválido: debe ser >= 1' },
        { status: 400 }
      )
    }

    const { data: round, error: roundError } = await supabase
      .from('crash_rounds')
      .select('id, status')
      .eq('id', roundId)
      .single()

    if (roundError || !round) {
      return NextResponse.json(
        { success: false, error: 'Ronda no encontrada', details: roundError?.message },
        { status: 404 }
      )
    }

    if (round.status === 'crashed') {
      return NextResponse.json(
        { success: false, error: 'La ronda ya está crasheada' },
        { status: 409 }
      )
    }

    const resolvedAt = new Date().toISOString()

    const { error: roundUpdateError } = await supabase
      .from('crash_rounds')
      .update({
        status: 'crashed',
        crash_point: crashPoint,
        crashed_at: resolvedAt,
      })
      .eq('id', roundId)

    if (roundUpdateError) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se pudo actualizar la ronda',
          details: roundUpdateError.message,
        },
        { status: 500 }
      )
    }

    const { data: resolvedBets, error: betsUpdateError } = await supabase
      .from('crash_bets')
      .update({
        status: 'lost',
        payout: 0,
        resolved_at: resolvedAt,
      })
      .eq('round_id', roundId)
      .eq('status', 'active')
      .select('id')

    if (betsUpdateError) {
      console.error('crash_bets update failed after round crash:', betsUpdateError.message)
    }

    const resolvedBetsCount = resolvedBets?.length ?? 0

    return NextResponse.json({
      success: true,
      roundId,
      crashPoint,
      resolvedBetsCount,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Error interno', details: String(error) },
      { status: 500 }
    )
  }
}