import { NextResponse } from 'next/server'
import { createClient } from '../../../utils/supabase/server'
import { adminClient } from '../../../utils/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data, error } = await adminClient
    .from('wallets')
    .select('id, balance')
    .eq('user_id', user.id)
    .limit(1)

  if (error) {
    return NextResponse.json(
      { error: 'Error cargando saldo', details: error.message },
      { status: 500 }
    )
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: 'Wallet no encontrada' },
      { status: 404 }
    )
  }

  return NextResponse.json({ balance: Number(data[0].balance) })
}