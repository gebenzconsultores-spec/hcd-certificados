# HCD Certificados — Hablando con Datos

Sistema de gestión y emisión de certificados.

## Stack
- React + Vite (Frontend)
- Supabase (Base de datos + Auth)
- Vercel (Hosting)

## Despliegue paso a paso

### 1. Crear tablas en Supabase
1. Entra a supabase.com → tu proyecto
2. Menú izquierdo → **SQL Editor** → **New Query**
3. Copia y pega todo el contenido de `supabase_schema.sql`
4. Clic en **Run**

### 2. Crear usuario administrador en Supabase
1. Menú izquierdo → **Authentication** → **Users**
2. Clic en **Add user** → **Create new user**
3. Email: el correo del admin de HCD
4. Password: una contraseña segura
5. Clic en **Create user**

### 3. Subir logo
1. Menú izquierdo → **Storage** → **New bucket**
2. Nombre: `public`, marcar como **Public**
3. Subir `logo-hcd.png` a ese bucket
4. La URL pública será: `https://[project].supabase.co/storage/v1/object/public/public/logo-hcd.png`
5. Actualizar `VITE_APP_URL` en Vercel con la URL del sitio

### 4. Subir a GitHub
```bash
git init
git add .
git commit -m "Initial commit - HCD Certificados"
git remote add origin https://github.com/gebenzconsultores-spec/hcd-certificados.git
git push -u origin main
```

### 5. Conectar con Vercel
1. Entra a vercel.com
2. **Add New Project** → importa el repo `hcd-certificados`
3. En **Environment Variables** agrega:
   - `VITE_SUPABASE_URL` = `https://ecxwfopxsgnulrtkxkyr.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGci...` (la key completa)
   - `VITE_APP_URL` = `https://hcd-certificados.vercel.app` (URL que te asigne Vercel)
4. Clic en **Deploy**

## URLs del sistema
- `/login` — Panel administrador
- `/admin` — Dashboard
- `/admin/cursos` — Gestión de cursos y exámenes
- `/admin/empresas` — Empresas clientes
- `/admin/participantes` — Participantes
- `/admin/certificados` — Certificados emitidos
- `/examen/:cursoId` — Examen público (para participantes)
- `/verificar/:idUnico` — Verificación pública por QR
