import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Prefer running round (active game), fall back to waiting
    const { data: running } = await supabase
      .from('crash_rounds')
      .select('id, status, start_at, crash_at, created_at')
      .eq('status', 'running')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (running) return NextResponse.json({ success: true, round: running })

    const { data: waiting } = await supabase
      .from('crash_rounds')
      .select('id, status, start_at, crash_at, created_at')
      .eq('status', 'waiting')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!waiting) {
      return NextResponse.json(
        { success: false, error: 'No hay ninguna ronda activa' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, round: waiting })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Error interno', details: String(error) },
      { status: 500 }
    )
  }
}