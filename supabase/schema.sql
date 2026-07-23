-- ============================================================
-- SCHEMA INICIAL — Fase 1 (galería personal) preparado para Fase 2 (red social)
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- Perfiles públicos, vinculados 1:1 con auth.users (que maneja Supabase Auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  created_at timestamptz default now()
);

-- Publicaciones / fotos
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  image_url text not null,
  caption text,
  width int,          -- útil para el masonry grid (evita "saltos" al cargar)
  height int,
  created_at timestamptz default now()
);

-- Preparado para Fase 2 (vacío por ahora, no se usa en Fase 1)
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (post_id, user_id)
);

-- Preparado para Fase 2 (vacío por ahora, no se usa en Fase 1)
create table if not exists public.follows (
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

-- ============================================================
-- SEGURIDAD (Row Level Security)
-- ============================================================
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;

-- Cualquiera puede LEER posts y perfiles (galería pública)
create policy "Posts son públicos para lectura"
  on public.posts for select
  using (true);

create policy "Perfiles son públicos para lectura"
  on public.profiles for select
  using (true);

-- Solo el dueño autenticado puede INSERTAR/EDITAR/BORRAR sus propios posts
-- En Fase 1 solo tu usuario existe, así que en la práctica eres solo tú.
-- En Fase 2, esta misma regla ya funciona para todos los usuarios nuevos.
create policy "Usuarios autenticados suben sus propios posts"
  on public.posts for insert
  with check (auth.uid() = user_id);

create policy "Usuarios editan solo sus propios posts"
  on public.posts for update
  using (auth.uid() = user_id);

create policy "Usuarios borran solo sus propios posts"
  on public.posts for delete
  using (auth.uid() = user_id);

create policy "Usuarios crean su propio perfil"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ============================================================
-- STORAGE: crear bucket público para las imágenes
-- (Esto también se puede hacer desde la UI: Storage → New bucket → "gallery" → Public)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

create policy "Cualquiera puede ver imágenes del bucket gallery"
  on storage.objects for select
  using (bucket_id = 'gallery');

create policy "Usuarios autenticados suben a su propia carpeta"
  on storage.objects for insert
  with check (
    bucket_id = 'gallery'
    and auth.role() = 'authenticated'
  );
