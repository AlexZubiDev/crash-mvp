'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../utils/supabase/client'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  const handleSignIn = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/')
    router.refresh()
  }

  const handleSignUp = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/')
    router.refresh()
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px 12px', fontSize: 15, borderRadius: 6, border: '1px solid #ccc',
  }
  const btnStyle = (color: string): React.CSSProperties => ({
    padding: '12px 0', fontSize: 16, fontWeight: 600, borderRadius: 8,
    border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
    background: loading ? '#ddd' : color, color: loading ? '#999' : '#fff',
  })

  return (
    <main style={{ maxWidth: 360, margin: '80px auto', padding: '0 20px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 32 }}>🚀 Crash MVP</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={inputStyle}
        />
        {error && <p style={{ fontSize: 14, color: '#e53e3e', margin: 0 }}>{error}</p>}
        <button onClick={handleSignIn} disabled={loading} style={btnStyle('#38a169')}>
          {loading ? 'Cargando...' : 'Entrar'}
        </button>
        <button onClick={handleSignUp} disabled={loading} style={btnStyle('#3182ce')}>
          {loading ? 'Cargando...' : 'Registrarse'}
        </button>
      </div>
    </main>
  )
}
