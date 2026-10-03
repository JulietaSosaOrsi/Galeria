"use client";

import { useEffect, useState } from "react";

// ============================================================
// DEMO EDUCATIVA — "¿QUÉ REVELA TU NAVEGADOR?" (Capa 1)
// ============================================================
// IMPORTANTE: ESTA PÁGINA NO GUARDA NADA DE NADIE.
// TODO SE CALCULA EN EL NAVEGADOR DEL PROPIO VISITANTE Y SE MUESTRA
// EN PANTALLA. NO HAY BASE DE DATOS, NO HAY ENVÍO A NINGÚN SERVIDOR
// PARA ALMACENAR, NO QUEDA REGISTRO. AL CERRAR LA PESTAÑA, DESAPARECE.
// (El único fetch opcional a /api/huella lee la IP/geo del request y
//  la DEVUELVE para mostrarla — tampoco la persiste.)
// ============================================================

// --- Parseo del User-Agent (navegador / SO / tipo de dispositivo) ---
function parseUA(ua) {
  let os = "Desconocido";
  let browser = "Desconocido";
  let device = "Escritorio";

  if (/Windows NT 10/.test(ua)) os = "Windows 10/11";
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Android/.test(ua)) { os = "Android"; device = "Móvil"; }
  else if (/iPhone|iPod/.test(ua)) { os = "iOS"; device = "Móvil"; }
  else if (/iPad/.test(ua)) { os = "iPadOS"; device = "Tablet"; }
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";

  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";

  if (/Mobile/.test(ua) && device === "Escritorio") device = "Móvil";
  return { os, browser, device };
}

// --- GPU vía WebGL (fabricante y modelo real de la placa) ---
function getGPU() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
    if (!gl) return { vendor: "—", renderer: "—" };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    };
  } catch {
    return { vendor: "—", renderer: "—" };
  }
}

// --- Detección de fuentes instaladas (técnica de medición) ---
function detectFonts() {
  const base = ["monospace", "sans-serif", "serif"];
  const testString = "mmmmmmmmmmlli";
  const testSize = "72px";
  const body = document.body;
  const span = document.createElement("span");
  span.style.position = "absolute";
  span.style.left = "-9999px";
  span.style.fontSize = testSize;
  span.textContent = testString;

  const defaultW = {};
  const defaultH = {};
  for (const b of base) {
    span.style.fontFamily = b;
    body.appendChild(span);
    defaultW[b] = span.offsetWidth;
    defaultH[b] = span.offsetHeight;
    body.removeChild(span);
  }

  const candidates = [
    "Arial", "Arial Black", "Verdana", "Tahoma", "Trebuchet MS", "Times New Roman",
    "Georgia", "Garamond", "Courier New", "Consolas", "Impact", "Comic Sans MS",
    "Helvetica", "Calibri", "Cambria", "Segoe UI", "Segoe UI Emoji", "Roboto",
    "Ubuntu", "Noto Sans", "Open Sans", "Franklin Gothic Medium", "Palatino Linotype",
    "Lucida Console", "MS Gothic", "Menlo", "Monaco",
  ];

  const found = [];
  for (const font of candidates) {
    let detected = false;
    for (const b of base) {
      span.style.fontFamily = `'${font}',${b}`;
      body.appendChild(span);
      if (span.offsetWidth !== defaultW[b] || span.offsetHeight !== defaultH[b]) {
        detected = true;
      }
      body.removeChild(span);
      if (detected) break;
    }
    if (detected) found.push(font);
  }
  return found;
}

// --- Huella de canvas (dibuja y compara el resultado de renderizado) ---
function canvasFingerprint() {
  try {
    const c = document.createElement("canvas");
    c.width = 240;
    c.height = 60;
    const ctx = c.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font = "16px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Huella 🎨 123", 2, 15);
    ctx.fillStyle = "rgba(102,204,0,0.7)";
    ctx.fillText("Huella 🎨 123", 4, 17);
    return c.toDataURL();
  } catch {
    return "";
  }
}

async function sha256(str) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Fallback simple si no hay crypto.subtle (contexto no seguro)
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  }
}

export default function HuellaPage() {
  const [data, setData] = useState(null);
  const [net, setNet] = useState(null); // IP / geo (del servidor)

  useEffect(() => {
    async function collect() {
      const ua = navigator.userAgent;
      const { os, browser, device } = parseUA(ua);
      const gpu = getGPU();
      const fonts = detectFonts();

      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offset = -new Date().getTimezoneOffset() / 60;

      const conn = navigator.connection || {};

      let battery = null;
      try {
        if (navigator.getBattery) {
          const b = await navigator.getBattery();
          battery = { level: Math.round(b.level * 100), charging: b.charging };
        }
      } catch {}

      const canvas = canvasFingerprint();
      const fpSource = [
        ua, os, browser, tz, gpu.renderer, fonts.join(","),
        screen.width + "x" + screen.height, navigator.language,
        navigator.hardwareConcurrency, navigator.deviceMemory, canvas,
      ].join("|");
      const fingerprint = await sha256(fpSource);

      // Agrupamos todo en una constante
      const infoRecolectada = {
        ua, os, browser, device,
        languages: (navigator.languages || [navigator.language]).join(", "),
        language: navigator.language,
        platform: navigator.userAgentData?.platform || navigator.platform || "—",
        referrer: document.referrer || "(entrada directa)",
        tz, offset,
        screenW: screen.width, screenH: screen.height,
        availW: screen.availWidth, availH: screen.availHeight,
        winW: window.innerWidth, winH: window.innerHeight,
        dpr: window.devicePixelRatio, colorDepth: screen.colorDepth,
        cores: navigator.hardwareConcurrency || "—",
        memory: navigator.deviceMemory ? navigator.deviceMemory + " GB (aprox)" : "no expuesto",
        touch: ("ontouchstart" in window || navigator.maxTouchPoints > 0)
          ? `Sí (${navigator.maxTouchPoints} puntos)` : "No",
        gpuVendor: gpu.vendor, gpuRenderer: gpu.renderer,
        battery,
        connection: conn.effectiveType
          ? `${conn.effectiveType}${conn.downlink ? ", " + conn.downlink + " Mbps" : ""}`
          : "no expuesto",
        cookies: navigator.cookieEnabled ? "Habilitadas" : "Deshabilitadas",
        dnt: navigator.doNotTrack === "1" ? "Activado" : "No activado",
        online: navigator.onLine ? "Sí" : "No",
        fonts, fontsCount: fonts.length,
        fingerprint,
      };

      // 1. Lo guardamos en el estado para que se muestre en pantalla
      setData(infoRecolectada);

      // 2. Lo enviamos por POST a nuestro servidor (route.js) para que lo guarde en Supabase
      fetch("/api/huella", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(infoRecolectada)
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j && setNet(j)) // Recibimos la IP de vuelta y la pintamos
        .catch(() => {});
    }
    
    collect();
  }, []);

  return (
    <main className="min-h-screen bg-ink text-bone px-5 py-10 sm:px-10">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl italic mb-2">tu huella digital</h1>
          <p className="text-mute text-sm leading-relaxed">
            Esto es todo lo que un sitio web puede ver de vos en el primer clic,
            sin pedirte ningún permiso (datos de “Capa 1”).
          </p>
          <p className="mt-3 text-xs text-mute/80 border border-mute/20 rounded-md px-3 py-2">
            🔒 Los datos recolectados se guardan en Supabase de forma segura.
          </p>
        </header>

        {!data ? (
          <p className="text-mute animate-pulse">Analizando tu navegador…</p>
        ) : (
          <div className="space-y-8">
            <Section title="🌐 Red (lo que ve el servidor)">
              <Row k="Dirección IP" v={net ? net.ip : "requiere servidor (deploy)"} />
              <Row k="País" v={net?.country || "—"} />
              <Row k="Región" v={net?.region || "—"} />
              <Row k="Ciudad" v={net?.city || "—"} />
              <Row k="Idiomas (Accept-Language)" v={data.languages} />
              <Row k="Vino desde (Referer)" v={data.referrer} />
            </Section>

            <Section title="💻 Sistema y navegador">
              <Row k="Navegador" v={data.browser} />
              <Row k="Sistema operativo" v={data.os} />
              <Row k="Tipo de dispositivo" v={data.device} />
              <Row k="Plataforma" v={data.platform} />
              <Row k="User-Agent completo" v={data.ua} mono />
            </Section>

            <Section title="🖥️ Pantalla y hardware">
              <Row k="Resolución de pantalla" v={`${data.screenW} × ${data.screenH}`} />
              <Row k="Área disponible" v={`${data.availW} × ${data.availH}`} />
              <Row k="Tamaño de ventana" v={`${data.winW} × ${data.winH}`} />
              <Row k="Densidad de píxeles" v={`${data.dpr}×`} />
              <Row k="Profundidad de color" v={`${data.colorDepth} bits`} />
              <Row k="Núcleos de CPU" v={data.cores} />
              <Row k="Memoria RAM" v={data.memory} />
              <Row k="Pantalla táctil" v={data.touch} />
              <Row k="GPU (fabricante)" v={data.gpuVendor} />
              <Row k="GPU (modelo)" v={data.gpuRenderer} mono />
            </Section>

            <Section title="📍 Entorno">
              <Row k="Zona horaria" v={`${data.tz} (UTC${data.offset >= 0 ? "+" : ""}${data.offset})`} />
              <Row k="Batería" v={data.battery ? `${data.battery.level}% ${data.battery.charging ? "(enchufado)" : "(a batería)"}` : "no expuesto"} />
              <Row k="Conexión" v={data.connection} />
              <Row k="Cookies" v={data.cookies} />
              <Row k="¿Online?" v={data.online} />
              <Row k="Do Not Track" v={data.dnt} />
            </Section>

            <Section title={`🔤 Fuentes instaladas (${data.fontsCount} detectadas)`}>
              <p className="text-sm text-bone/90 leading-relaxed">
                {data.fonts.length ? data.fonts.join(" · ") : "—"}
              </p>
            </Section>

            <Section title="🆔 Huella única (fingerprint)">
              <p className="text-xs text-mute mb-2">
                Este hash combina todos los datos de arriba. Identifica tu navegador
                entre millones, sin usar cookies:
              </p>
              <p className="font-mono text-xs break-all text-bone bg-charcoal rounded-md p-3">
                {data.fingerprint}
              </p>
            </Section>
          </div>
        )}

        <footer className="mt-12 text-xs text-mute/70">
          <a href="/" className="underline hover:text-bone">← volver a la galería</a>
        </footer>
      </div>
    </main>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-sm uppercase tracking-widest text-mute mb-3">{title}</h2>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Row({ k, v, mono }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 border-b border-mute/10 pb-1.5">
      <span className="text-mute text-sm sm:w-56 sm:shrink-0">{k}</span>
      <span className={`text-bone text-sm break-words ${mono ? "font-mono text-xs" : ""}`}>{v}</span>
    </div>
  );
}