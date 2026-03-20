import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  try {
    const { data: round, error } = await supabase
      .from('crash_rounds')
      .insert({ status: 'waiting' })
      .select()
      .single()

    if (error || !round) {
      return NextResponse.json(
        { success: false, error: 'No se pudo crear la ronda', details: error?.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      round,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Error interno', details: String(error) },
      { status: 500 }
    )
  }
}