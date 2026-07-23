# Galería — Fase 1

Galería pública en modo oscuro con grid masonry, y un panel privado en
`/admin` para subir fotos desde el celular sin tocar código.

## 1. Crear el proyecto en Supabase (gratis)

1. Ve a https://supabase.com → "New project".
2. Elige nombre, contraseña de base de datos y región (elige la más
   cercana a tu audiencia, ej. São Paulo si tu público es LatAm).
3. Cuando el proyecto esté listo, ve a **SQL Editor** → pega el
   contenido de `supabase/schema.sql` de este proyecto → **Run**.
   Esto crea las tablas, los permisos de seguridad y el bucket de
   imágenes llamado `gallery`.
4. Ve a **Authentication → Users → Add user** y crea tu propio usuario
   (tu email + una contraseña). Ese será tu login en `/admin`.
5. Ve a **SQL Editor** de nuevo y corre esto (reemplaza el email y
   elige tu username), para crear tu perfil:

   ```sql
   insert into public.profiles (id, username)
   select id, 'tu_usuario'
   from auth.users
   where email = 'tu@email.com';
   ```

6. Ve a **Project Settings → API**. Ahí están:
   - **Project URL** → va en `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → va en `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Configurar el proyecto localmente (opcional, solo si quieres probar)

```bash
npm install
cp .env.local.example .env.local
# pega tus valores reales de Supabase en .env.local
npm run dev
```

Abre http://localhost:3000 para la galería pública y
http://localhost:3000/login para entrar al panel de admin.

## 3. Subir el código a GitHub

```bash
git init
git add .
git commit -m "Fase 1: galería + panel admin"
gh repo create galeria --private --source=. --push
# o crea el repo manualmente en github.com y usa git remote add origin ...
```

## 4. Deploy en Vercel (gratis, sin "sleep")

1. Ve a https://vercel.com → **Add New → Project** → importa tu repo
   de GitHub.
2. En **Environment Variables**, agrega:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy. En ~1 minuto tienes una URL tipo `galeria.vercel.app`.
4. (Opcional) Conecta un dominio propio en **Settings → Domains**.
5. Pon esa URL en tu bio de Instagram.

## 5. Uso diario

- Público: entra a tu dominio, ve la galería. No necesita login.
- Tú: entra a `tudominio.com/login`, inicia sesión, ve a `/admin`,
  sube la foto desde el celular (puedes tomarla directo con la
  cámara). Se publica al instante, sin tocar código ni redeploys.

## Notas

- El bucket de Storage es público para lectura (cualquiera ve las
  fotos), pero solo un usuario autenticado puede subir — y gracias a
  las políticas de Row Level Security, solo puede insertar posts
  donde `user_id` sea el suyo. Esto ya deja todo listo para cuando en
  Fase 2 haya más usuarios.
- Si el proyecto de Supabase pasa 7 días sin ninguna actividad, la
  capa gratuita lo pausa automáticamente. Como subirás contenido
  seguido, no debería pasarte. Si quieres un seguro extra, se puede
  agregar un GitHub Action que haga ping al proyecto cada pocos días
  (pregúntame si lo quieres cuando lleguemos a ese punto).
