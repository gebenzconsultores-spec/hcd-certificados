import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, sesionGuardadaLocal } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = cargando
  const [tardando, setTardando] = useState(false)
  // Sesión que ya estaba guardada en este navegador: permite pintar el panel
  // al instante aunque Supabase tarde en confirmar/renovar el token.
  const [sesionLocal] = useState(() => sesionGuardadaLocal())

  useEffect(() => {
    let mounted = true

    // 1) Suscripción: supabase-js dispara la sesión restaurada (INITIAL_SESSION)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento, s) => {
      if (mounted) setSession(s ?? null)
      // Link de "Reset password" del correo: llevar a la pantalla para poner contraseña nueva
      if (evento === 'PASSWORD_RECOVERY' && window.location.pathname !== '/restablecer') {
        window.location.replace('/restablecer')
      }
    })

    // 2) Respaldo: leemos la sesión persistida
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(prev => (prev === undefined ? (data.session ?? null) : prev))
    }).catch(() => {})

    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  // Si tras 7s seguimos sin resolver la sesión (ej. conexión lenta o el
  // cliente de Supabase se quedó colgado), lo señalamos para poder avisarle
  // al usuario que le dé refresh en vez de dejarlo viendo el spinner infinito.
  useEffect(() => {
    if (session !== undefined) { setTardando(false); return }
    const t = setTimeout(() => setTardando(true), 8000)
    return () => clearTimeout(t)
  }, [session])

  return (
    <AuthContext.Provider value={{ session, loading: session === undefined, tardando, sesionLocal }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
