import { createClient } from '@supabase/supabase-js'

// Inicializamos el cliente de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export const dynamic = "force-dynamic";

export async function POST(request) {
  const h = request.headers;

  // 1. Leer IP y Geo del request (Vercel)
  const fwd = h.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip")) || "no disponible (local)";
  
  const dec = (v) => {
    try { return v ? decodeURIComponent(v) : null; } catch { return v; }
  };

  const country = dec(h.get("x-vercel-ip-country"));
  const city = dec(h.get("x-vercel-ip-city"));
  const region = dec(h.get("x-vercel-ip-country-region"));

  // 2. Leer los datos del navegador enviados por el frontend
  const clienteData = await request.json();

  // 3. Guardar en Supabase usando su SDK
  const { error } = await supabase
    .from('huellas')
    .insert([
      {
        ip: ip,
        pais: country || 'Desconocido',
        ciudad: city || 'Desconocido',
        os: clienteData.os,
        navegador: clienteData.browser,
        dispositivo: clienteData.device,
        gpu: clienteData.gpuRenderer,
        fingerprint: clienteData.fingerprint
      }
    ]);

  if (error) {
    console.error("Error guardando en Supabase:", error.message);
  }

  // 4. Devolver la IP/Geo al frontend
  const body = {
    ip, country, region, city,
    latitude: h.get("x-vercel-ip-latitude"),
    longitude: h.get("x-vercel-ip-longitude"),
    timezone: h.get("x-vercel-ip-timezone")
  };

  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}