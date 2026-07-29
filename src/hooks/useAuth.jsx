import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = cargando

  useEffect(() => {
    let mounted = true

    // 1) Suscripción primero: supabase-js dispara la sesión restaurada (INITIAL_SESSION)
    //    y también los cambios (login, logout, refresh de token).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (mounted) setSession(s ?? null)
    })

    // 2) Respaldo: leemos la sesión persistida por si el evento inicial no llega.
    //    Solo la aplicamos si aún no se ha cargado nada (no pisamos la del paso 1).
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
