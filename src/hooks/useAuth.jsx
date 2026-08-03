import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = cargando

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

  return (
    <AuthContext.Provider value={{ session, loading: session === undefined }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
