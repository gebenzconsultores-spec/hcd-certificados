import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = cargando
  const [tardando, setTardando] = useState(false)

  useEffect(() => {
    let mounted = true

    // 1) Suscripción: supabase-js dispara la sesión restaurada (INITIAL_SESSION)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (mounted) setSession(s ?? null)
    })

    // 2) Respaldo: leemos la sesión persistida
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(prev => (prev === undefined ? (data.session ?? null) : prev))
    })

    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  // Si tras 7s seguimos sin resolver la sesión (ej. conexión lenta o el
  // cliente de Supabase se quedó colgado), lo señalamos para poder avisarle
  // al usuario que le dé refresh en vez de dejarlo viendo el spinner infinito.
  useEffect(() => {
    if (session !== undefined) { setTardando(false); return }
    const t = setTimeout(() => setTardando(true), 7000)
    return () => clearTimeout(t)
  }, [session])

  return (
    <AuthContext.Provider value={{ session, loading: session === undefined, tardando }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
