'use client'

import { useEffect, useRef, useState } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

type GameState  = 'idle' | 'betplaced' | 'running' | 'crashed' | 'cashedout'
type RoundStatus = 'waiting' | 'running' | null

interface Bet { id: string; amount: number }

interface CurrentRound {
  id: string
  status: string
  start_at: string | null
  crash_at: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMultiplierLabel(
  gameState: GameState,
  roundStatus: RoundStatus,
  lastCrashPoint: number | null,
  countdown: number,
): string {
  if (gameState === 'crashed' || lastCrashPoint !== null) return 'Crashed'
  if (gameState === 'cashedout') return 'Cobrado'
  if (gameState === 'betplaced') return `Apuesta lista · Empieza en ${countdown}s`
  if (roundStatus === 'running')  return 'En juego'
  if (roundStatus === 'waiting')  return `Empieza en ${countdown}s`
  return 'Esperando próxima ronda...'
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  main: {
    maxWidth: 420,
    margin: '60px auto',
    padding: '0 20px',
    fontFamily: 'sans-serif',
    textAlign: 'center' as const,
  },
  title:         { fontSize: 24, fontWeight: 600, marginBottom: 32 },
  walletSection: { marginBottom: 24 },
  balance:       { fontSize: 36, fontWeight: 700, marginBottom: 12 },
  betRow:        { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },
  betLabel:      { fontSize: 14, color: '#666' },
  betInput: {
    width: 90,
    fontSize: 16,
    padding: '6px 10px',
    textAlign: 'center' as const,
    border: '1px solid #ccc',
    borderRadius: 6,
  },
  multiplierSection: { margin: '28px 0' },
  multiplierValue: (crashed: boolean, cashedout: boolean, running: boolean) => ({
    fontSize: 64,
    fontWeight: 700,
    lineHeight: 1,
    color: crashed   ? '#e53e3e'
         : cashedout ? '#3182ce'
         : running   ? '#38a169'
         : '#888',
  }),
  multiplierLabel: { fontSize: 13, color: '#999', marginTop: 6 },
  actionsSection:  { marginBottom: 20 },
  buttonRow: { display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 16 },
  btnPrimary: (disabled: boolean) => ({
    flex: 1,
    maxWidth: 160,
    padding: '12px 0',
    fontSize: 16,
    fontWeight: 600,
    borderRadius: 8,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? '#ddd' : '#38a169',
    color: disabled ? '#999' : '#fff',
    transition: 'background 0.15s',
  }),
  btnSecondary: (disabled: boolean) => ({
    flex: 1,
    maxWidth: 160,
    padding: '12px 0',
    fontSize: 16,
    fontWeight: 600,
    borderRadius: 8,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: disabled ? '#ddd' : '#e53e3e',
    color: disabled ? '#999' : '#fff',
    transition: 'background 0.15s',
  }),
  message: { fontSize: 15, color: '#444', minHeight: 22 },
  error:   { fontSize: 14, color: '#e53e3e', minHeight: 20, marginTop: 6 },
  warning: { fontSize: 13, color: '#d97706', marginBottom: 12 },
} as const

// ── Component ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [balance,        setBalance]        = useState<number | null>(null)
  const [roundId,        setRoundId]        = useState<string | null>(null)
  const [roundStatus,    setRoundStatus]    = useState<RoundStatus>(null)
  const [roundStartAt,   setRoundStartAt]   = useState<string | null>(null)
  const [lastCrashPoint, setLastCrashPoint] = useState<number | null>(null)
  const [activeBet,      setActiveBet]      = useState<Bet | null>(null)
  const [bet,            setBet]            = useState(10)
  const [multiplier,     setMultiplier]     = useState(1.0)
  const [countdown,      setCountdown]      = useState(0)
  const [gameState,      setGameState]      = useState<GameState>('idle')
  const [message,        setMessage]        = useState('')
  const [error,          setError]          = useState<string | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [placing,        setPlacing]        = useState(false)
  const [cashingOut,     setCashingOut]     = useState(false)

  const tickRef      = useRef<NodeJS.Timeout | null>(null)
  const displayRef   = useRef<NodeJS.Timeout | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const gameStateRef = useRef<GameState>('idle')
  const activeBetRef = useRef<Bet | null>(null)

  // Keep refs in sync with state so interval callbacks avoid stale closures
  useEffect(() => { gameStateRef.current = gameState }, [gameState])
  useEffect(() => { activeBetRef.current = activeBet }, [activeBet])

  // ── Tick callback — drives global round state ─────────────────────────────

  const callRound = async () => {
    try {
      const res = await fetch('/api/round/current')
      if (!res.ok && res.status !== 404) return
      const data = await res.json()

      if (!data.round) {
        // No active round (cooldown or no rounds exist yet)
        if (gameStateRef.current === 'running' || gameStateRef.current === 'betplaced') {
          setGameState('crashed')
          setActiveBet(null)
        }
        if (gameStateRef.current !== 'cashedout') {
          startedAtRef.current = null
        }
        setRoundId(null)
        setRoundStatus(null)
        setRoundStartAt(null)
        if (data.lastCrash) {
          setLastCrashPoint(data.lastCrash.crashPoint)
          if (gameStateRef.current !== 'cashedout') {
            setMessage(`💥 Crash en ${Number(data.lastCrash.crashPoint).toFixed(2)}x`)
          }
        }
        return
      }

      const round: CurrentRound = data.round

      // New waiting round appeared after a finished game — reset to idle
      if (
        round.status === 'waiting' &&
        (gameStateRef.current === 'crashed' ||
          gameStateRef.current === 'cashedout')
      ) {
        setGameState('idle')
        setMessage('')
        setMultiplier(1.0)
        startedAtRef.current = null
        setLastCrashPoint(null)
      }

      setRoundId(round.id)
      setRoundStatus(round.status as RoundStatus)
      setRoundStartAt(round.start_at)
      setLastCrashPoint(null)

      if (round.status === 'running' && round.start_at) {
        startedAtRef.current = new Date(round.start_at).getTime()
        // Transition user from pre-start waiting to active game
        if (gameStateRef.current === 'betplaced') {
          setGameState('running')
        }
      }
    } catch { /* ignore transient tick errors */ }
  }

  // ── Display loop — drives visual multiplier (100ms) ───────────────────────

  const startDisplayLoop = () => {
    if (displayRef.current !== null) return
    displayRef.current = setInterval(() => {
      if (startedAtRef.current !== null) {
        const elapsed = Date.now() - startedAtRef.current
        setMultiplier(Number((1 + (elapsed / 100) * 0.03).toFixed(2)))
      }
    }, 100)
  }

  // ── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      const [walletRes, roundRes] = await Promise.all([
        fetch('/api/wallet'),
        fetch('/api/round/current'),
      ])

      const walletData = await walletRes.json()
      if (!walletRes.ok) {
        setError(walletData.error || 'Error cargando saldo')
      } else {
        setBalance(walletData.balance)
      }

      const roundData = await roundRes.json()
      if (roundData.round) {
        const r: CurrentRound = roundData.round
        setRoundId(r.id)
        setRoundStatus(r.status as RoundStatus)
        setRoundStartAt(r.start_at)
        if (r.status === 'running' && r.start_at) {
          startedAtRef.current = new Date(r.start_at).getTime()
        }
      } else if (roundData.lastCrash) {
        setLastCrashPoint(roundData.lastCrash.crashPoint)
      }

      setLoading(false)
    }

    init()

    // tickRef — 1s, drives backend state progression for all clients
    tickRef.current = setInterval(callRound, 1_000)

    // displayRef — 100ms, drives visual multiplier animation
    startDisplayLoop()

    return () => {
      if (tickRef.current)    clearInterval(tickRef.current)
      if (displayRef.current) clearInterval(displayRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Countdown — updated whenever roundStartAt changes ────────────────────

  useEffect(() => {
    if ((roundStatus !== 'waiting' && gameState !== 'betplaced') || !roundStartAt) {
      setCountdown(0)
      return
    }
    const tick = () => {
      setCountdown(Math.max(0, Math.ceil((new Date(roundStartAt).getTime() - Date.now()) / 1000)))
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [roundStatus, roundStartAt, gameState])

  // ── Bet input validation ──────────────────────────────────────────────────

  const handleBetChange = (value: number) => {
    setBet(value)
    if (value <= 0) {
      setError('La apuesta debe ser mayor que 0')
    } else if (balance !== null && value > balance) {
      setError('Saldo insuficiente')
    } else {
      setError(null)
    }
  }

  // ── Place bet ─────────────────────────────────────────────────────────────

  const startGame = async () => {
    if (loading || balance === null || placing) return
    if (gameState !== 'idle') return

    if (!roundId || roundStatus !== 'waiting') {
      setError('No hay ninguna ronda abierta para apostar')
      return
    }
    if (bet <= 0) { setError('La apuesta debe ser mayor que 0'); return }
    if (bet > balance) { setError('No tienes saldo suficiente'); return }

    setError(null)
    setMessage('')
    setMultiplier(1.0)
    setPlacing(true)

    const res = await fetch('/api/bet/place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: bet }),
    })

    const data = await res.json()
    setPlacing(false)

    if (!res.ok) {
      setError(data.error || 'Error al registrar la apuesta')
      return
    }

    setBalance(data.balance)
    setActiveBet({ id: data.bet.id, amount: data.bet.amount })
    setGameState('betplaced')
    // tickRef transitions gameState to 'running' when round.status becomes 'running';
    // startedAtRef is set at that point so display doesn't animate negative elapsed time.
  }

  // ── Cashout ───────────────────────────────────────────────────────────────

  const cashOut = async () => {
    if (gameState !== 'running' || cashingOut) return
    if (!roundId || !activeBet) return

    setCashingOut(true)

    const res = await fetch('/api/bet/cashout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId }),
    })

    const data = await res.json()
    setCashingOut(false)

    if (!res.ok) {
      // 404 = too late; tickRef will detect the crash within 1s and update UI
      if (res.status !== 404) setError('Error al procesar cashout')
      return
    }

    setError(null)
    setBalance(data.balance)
    setGameState('cashedout')
    setMessage(`✅ Cobras en ${Number(data.cashoutAt).toFixed(2)}x → +${data.payout}`)
    setActiveBet(null)
  }

  // ── Render flags ──────────────────────────────────────────────────────────

  // Only 'idle' can place a bet; 'betplaced' already has one in this round
  const canBet     = !loading && !placing && balance !== null
                     && gameState === 'idle' && roundStatus === 'waiting' && !error
  // Cashout only when round is globally running AND user has an active bet
  const canCashout = gameState === 'running' && !!activeBet && !cashingOut

  // ── Derived display values ────────────────────────────────────────────────

  const isCrashed  = gameState === 'crashed' || (lastCrashPoint !== null && gameState === 'idle')
  const isCashedout = gameState === 'cashedout'
  const isRunning  = (roundStatus === 'running' || gameState === 'running') && !isCrashed

  const displayMultiplier =
    isCashedout             ? multiplier :
    lastCrashPoint !== null ? lastCrashPoint :
    isRunning               ? multiplier :
    1.0

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main style={styles.main}>
      <h1 style={styles.title}>🚀 Crash MVP</h1>

      {/* Wallet section */}
      <section style={styles.walletSection}>
        <div style={styles.balance}>
          {loading ? '...' : balance === null ? '—' : `$${balance.toFixed(2)}`}
        </div>
        <div style={styles.betRow}>
          <label htmlFor="bet-input" style={styles.betLabel}>Apuesta</label>
          <input
            id="bet-input"
            type="number"
            value={bet}
            min={1}
            style={styles.betInput}
            onChange={(e) => handleBetChange(Number(e.target.value))}
            disabled={gameState === 'running' || gameState === 'betplaced' || loading}
          />
        </div>
      </section>

      {/* Multiplier section */}
      <section style={styles.multiplierSection}>
        <div style={styles.multiplierValue(isCrashed, isCashedout, isRunning)}>
          {displayMultiplier.toFixed(2)}x
        </div>
        <div style={styles.multiplierLabel}>
          {getMultiplierLabel(gameState, roundStatus, lastCrashPoint, countdown)}
        </div>
      </section>

      {/* No active round */}
      {!loading && !roundId && gameState === 'idle' && !lastCrashPoint && (
        <p style={styles.warning}>⚠️ Esperando próxima ronda...</p>
      )}

      {/* Actions section */}
      <section style={styles.actionsSection}>
        <div style={styles.buttonRow}>
          <button style={styles.btnPrimary(!canBet)} onClick={startGame} disabled={!canBet}>
            {placing ? 'Apostando...' : 'Apostar'}
          </button>
          <button style={styles.btnSecondary(!canCashout)} onClick={cashOut} disabled={!canCashout}>
            {cashingOut ? 'Cobrando...' : 'Cashout'}
          </button>
        </div>
        <p style={styles.message}>{message}</p>
        <p style={styles.error}>{error ?? ''}</p>
      </section>
    </main>
  )
}
