import { NextResponse } from 'next/server'
import crypto from 'crypto'

function generateCrashPoint() {
  const randomInt = crypto.randomInt(0, 1000000)
  const random = randomInt / 1000000

  const crash = 1 + random * 5
  return Number(crash.toFixed(2))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const bet = Number(body.bet)

    if (!bet || bet <= 0) {
      return NextResponse.json({ error: 'Apuesta no válida' }, { status: 400 })
    }

    const crashPoint = generateCrashPoint()

    return NextResponse.json({
      success: true,
      crashPoint,
      bet
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}