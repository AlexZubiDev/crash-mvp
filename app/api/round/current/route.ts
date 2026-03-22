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

    if (running) {
      if (running.crash_at && Date.now() >= new Date(running.crash_at).getTime()) {
        await supabase
          .from('crash_rounds')
          .update({ status: 'crashed' })
          .eq('id', running.id)
        return NextResponse.json({ success: true, round: { ...running, status: 'crashed' } })
      }
      return NextResponse.json({ success: true, round: running })
    }

    const { data: waiting } = await supabase
      .from('crash_rounds')
      .select('id, status, start_at, crash_at, created_at')
      .eq('status', 'waiting')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!waiting) {
      const { data: lastCrashed } = await supabase
        .from('crash_rounds')
        .select('crash_point')
        .eq('status', 'crashed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return NextResponse.json(
        {
          round: null,
          lastCrash: lastCrashed?.crash_point
            ? { crashPoint: Number(lastCrashed.crash_point) }
            : null,
        },
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