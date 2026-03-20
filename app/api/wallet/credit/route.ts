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

    const { data: wallet, error: fetchError } = await supabase
      .from('wallets')
      .select('id, balance')
      .eq('user_id', DEMO_USER_ID)
      .single()

    if (fetchError || !wallet) {
      return NextResponse.json(
        { error: 'Wallet no encontrada', details: fetchError?.message },
        { status: 500 }
      )
    }

    const currentBalance = Number(wallet.balance)
    const newBalance = currentBalance + amount

    const { error: updateError } = await supabase
      .from('wallets')
      .update({
        balance: newBalance,
      })
      .eq('user_id', DEMO_USER_ID)

    if (updateError) {
      return NextResponse.json(
        { error: 'No se pudo actualizar el saldo', details: updateError.message },
        { status: 500 }
      )
    }

    const { error: txError } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        type: 'credit',
        amount: amount,
        balance_after: newBalance,
        reference_type: body.reference_type ?? null,
        reference_id: body.reference_id ?? null,
      })

    if (txError) {
      console.error('wallet_transactions insert failed after credit:', txError.message)
    }

    return NextResponse.json({
      success: true,
      balance: newBalance,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Error interno', details: String(error) },
      { status: 500 }
    )
  }
}