import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DEMO_USER_ID = '11111111-1111-1111-1111-111111111111'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const roundId = body.roundId

    if (!roundId) {
      return NextResponse.json(
        { success: false, error: 'roundId es obligatorio' },
        { status: 400 }
      )
    }

    // Fetch bet without status filter to support idempotency check
    const { data: bet, error: betError } = await supabase
      .from('crash_bets')
      .select('id, amount, status, cashout_at, payout')
      .eq('round_id', roundId)
      .eq('user_id', DEMO_USER_ID)
      .single()

    if (betError || !bet) {
      return NextResponse.json(
        { success: false, error: 'No se encontró una apuesta en esta ronda' },
        { status: 404 }
      )
    }

    // Idempotency: already cashed out — return the same result without side effects
    if (bet.status === 'won') {
      const { data: w } = await supabase
        .from('wallets').select('balance').eq('user_id', DEMO_USER_ID).single()
      return NextResponse.json({
        success: true,
        payout: Number(bet.payout),
        cashoutAt: Number(bet.cashout_at),
        balance: Number(w?.balance ?? 0),
        bet,
      })
    }

    if (bet.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'La apuesta ya fue resuelta' },
        { status: 409 }
      )
    }

    // Fetch round to surface crash_point on TOO_LATE responses
    const { data: round, error: roundError } = await supabase
      .from('crash_rounds')
      .select('crash_point')
      .eq('id', roundId)
      .single()

    if (roundError || !round) {
      return NextResponse.json(
        { success: false, error: 'Ronda no encontrada' },
        { status: 400 }
      )
    }

    // All pre-conditions met — delegate computation and writes to the atomic RPC.
    const { data: rpcRows, error: rpcError } = await supabase
      .rpc('cashout_bet', {
        p_bet_id:  bet.id,
        p_user_id: DEMO_USER_ID,
      })

    if (rpcError) {
      console.error('cashout_bet RPC error:', rpcError.message)
      return NextResponse.json(
        { success: false, error: 'Error interno en cashout', details: rpcError.message },
        { status: 500 }
      )
    }

    const result = rpcRows?.[0]

    if (!result?.success) {
      const isTooLate = result?.error_code === 'TOO_LATE'
      return NextResponse.json(
        {
          success: false,
          error: isTooLate ? 'Demasiado tarde' : 'Cashout ya procesado',
          ...(isTooLate && { crashPoint: Number(round.crash_point) }),
        },
        { status: isTooLate ? 404 : 409 }
      )
    }

    return NextResponse.json({
      success:   true,
      payout:    Number(result.payout),
      cashoutAt: Number(result.cashout_at),
      balance:   Number(result.new_balance),
      bet,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Error interno', details: String(error) },
      { status: 500 }
    )
  }
}
