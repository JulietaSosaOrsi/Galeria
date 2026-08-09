-- ============================================================
-- Siembra 20 fotos de PRUEBA (usando picsum.photos como placeholder)
-- para ver el diseño del grid antes de subir tus fotos reales.
-- Se vinculan a tu primer perfil existente en la tabla profiles.
-- Ejecutar en Supabase → SQL Editor.
-- ============================================================

with u as (
  select id from public.profiles order by created_at asc limit 1
)
insert into public.posts (user_id, image_url, width, height, caption)
select u.id, v.image_url, v.width, v.height, v.caption
from u, (values
  ('https://picsum.photos/seed/cine1/800/1100',  800, 1100, null),
  ('https://picsum.photos/seed/cine2/800/600',   800, 600,  null),
  ('https://picsum.photos/seed/cine3/800/1300',  800, 1300, null),
  ('https://picsum.photos/seed/cine4/800/800',   800, 800,  null),
  ('https://picsum.photos/seed/cine5/800/1000',  800, 1000, null),
  ('https://picsum.photos/seed/cine6/800/650',   800, 650,  null),
  ('https://picsum.photos/seed/cine7/800/1200',  800, 1200, null),
  ('https://picsum.photos/seed/cine8/800/900',   800, 900,  null),
  ('https://picsum.photos/seed/cine9/800/1150',  800, 1150, null),
  ('https://picsum.photos/seed/cine10/800/700',  800, 700,  null),
  ('https://picsum.photos/seed/cine11/800/1000', 800, 1000, null),
  ('https://picsum.photos/seed/cine12/800/850',  800, 850,  null),
  ('https://picsum.photos/seed/cine13/800/1250', 800, 1250, null),
  ('https://picsum.photos/seed/cine14/800/600',  800, 600,  null),
  ('https://picsum.photos/seed/cine15/800/950',  800, 950,  null),
  ('https://picsum.photos/seed/cine16/800/1100', 800, 1100, null),
  ('https://picsum.photos/seed/cine17/800/750',  800, 750,  null),
  ('https://picsum.photos/seed/cine18/800/1000', 800, 1000, null),
  ('https://picsum.photos/seed/cine19/800/900',  800, 900,  null),
  ('https://picsum.photos/seed/cine20/800/1200', 800, 1200, null)
) as v(image_url, width, height, caption);

-- Para borrar las 20 fotos de prueba más adelante (cuando subas las tuyas reales):
-- delete from public.posts where image_url like 'https://picsum.photos%';
