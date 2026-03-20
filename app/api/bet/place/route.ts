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
    const amount = Number(body.amount)

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Cantidad inválida' },
        { status: 400 }
      )
    }

    const { data: round, error: roundError } = await supabase
      .from('crash_rounds')
      .select('id, start_at')
      .eq('status', 'waiting')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (roundError || !round) {
      return NextResponse.json(
        { error: 'No hay ninguna ronda abierta para apostar' },
        { status: 400 }
      )
    }

    // Reject if lobby period has already ended (tick transitions round to running)
    if (!round.start_at || Date.now() >= new Date(round.start_at).getTime()) {
      return NextResponse.json(
        { error: 'La ronda ya ha comenzado' },
        { status: 400 }
      )
    }

    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('id, balance')
      .eq('user_id', DEMO_USER_ID)
      .single()

    if (walletError || !wallet) {
      return NextResponse.json(
        { error: 'Wallet no encontrada', details: walletError?.message },
        { status: 500 }
      )
    }

    const currentBalance = Number(wallet.balance)

    if (currentBalance < amount) {
      return NextResponse.json(
        { error: 'Saldo insuficiente' },
        { status: 400 }
      )
    }

    const newBalance = currentBalance - amount

    const { error: updateError } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('user_id', DEMO_USER_ID)

    if (updateError) {
      return NextResponse.json(
        { error: 'No se pudo actualizar el saldo', details: updateError.message },
        { status: 500 }
      )
    }

    const { data: bet, error: betError } = await supabase
      .from('crash_bets')
      .insert({
        round_id: round.id,
        user_id: DEMO_USER_ID,
        amount: amount,
        status: 'active',
      })
      .select('id, round_id, user_id, amount, status, created_at')
      .single()

    if (betError || !bet) {
      console.error('crash_bets insert failed after debit:', betError?.message)

      if (betError?.code === '23505') {
        return NextResponse.json(
          { error: 'Ya tienes una apuesta en esta ronda' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: 'No se pudo registrar la apuesta', details: betError?.message },
        { status: 500 }
      )
    }

    const { error: txError } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        type: 'debit',
        amount: amount,
        balance_after: newBalance,
        reference_type: 'crash_bet',
        reference_id: bet.id,
      })

    if (txError) {
      console.error('wallet_transactions insert failed after bet:', txError.message)
    }

    return NextResponse.json({
      success: true,
      balance: newBalance,
      bet,
      startedAt: round.start_at, // pre-set by tick at round creation; crash_point never sent
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Error interno', details: String(error) },
      { status: 500 }
    )
  }
}