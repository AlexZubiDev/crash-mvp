import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  "https://cduuipivbfuajmivskbe.supabase.co",
  "sb_publishable__32lvjDicHJTOiozfAVP1w_mbwjMa-1"
)

const DEMO_USER_ID = '11111111-1111-1111-1111-111111111111'

export async function GET() {
  const { data, error } = await supabase
    .from('wallets')
    .select('balance')
    .eq('user_id', DEMO_USER_ID)
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Error cargando saldo', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ balance: Number(data.balance) })
}