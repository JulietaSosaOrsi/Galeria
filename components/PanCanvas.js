"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ============================================================
// ▼▼▼ ACÁ SE AJUSTAN LOS PARÁMETROS DEL MOSAICO ▼▼▼
// ============================================================

// Margen entre fotos, en píxeles. 1cm ≈ 37.8px a 96dpi.
const GAP = 19;

// Cantidad MÁXIMA de columnas — el mosaico nunca va a tener más
// columnas que esto, aunque subas miles de fotos.
const MAX_COLS = 6;

// Mínimo de fotos que quiero, en promedio, por columna, antes de
// agregar una columna más. Con pocas fotos, esto mantiene las
// columnas parejas (menos espacios vacíos que rellenar).
const PHOTOS_PER_COL = 3;

// Ancho de cada columna en píxeles (el alto de cada foto sale solo,
// de su proporción real — nunca se recorta ninguna imagen).
// Achicado de 340 a 220 para fotos más pequeñas.
const COL_WIDTH = 220;

// Fotos apiladas (en promedio) por columna dentro de un "período".
// MÁS ALTO = columnas más largas = las separaciones sobrantes se
// reparten en muchos gaps chiquitos → mosaico compacto tipo VSCO,
// sin baches. (Contra: las fotos se repiten un poco más seguido.)
// MÁS BAJO = menos repetición, pero separaciones más grandes.
const STACK_PER_COL = 14;

// ============================================================

// PRNG determinístico simple (mismo orden de fotos en cada carga).
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Masonry por columnas para un lienzo infinito, SIN baches y SIN
// recortar ninguna foto. Idea:
//
//  - El "período" (el rectángulo que se repite) tiene una altura fija
//    y ALTA: cada columna apila MUCHAS fotos (STACK_PER_COL).
//  - Cada columna se llena hasta casi esa altura y el poquito que
//    sobra se reparte por igual entre TODAS sus separaciones.
//
// Al haber muchas fotos por columna, ese sobrante se diluye en gaps
// chiquititos y parejos (mosaico compacto), en vez de juntarse en un
// hueco grande. Y como cada columna mide EXACTO lo mismo, el bloque
// repite sin costuras en todas las direcciones.
function columnMasonryLayout(items, cols, colWidth, gap, rng) {
  const aspectH = (item) => {
    const aspect = item.width && item.height ? item.width / item.height : 0.8;
    return colWidth / aspect;
  };

  const heights = items.map(aspectH);
  const avgH = heights.reduce((s, h) => s + h, 0) / heights.length;

  // Altura fija del período: STACK_PER_COL fotos de alto promedio.
  const periodH = (avgH + gap) * STACK_PER_COL;

  const tiles = [];
  let key = 0;

  for (let c = 0; c < cols; c++) {
    const x = gap / 2 + c * (colWidth + gap);

    // Orden propio de la columna (para que no queden todas iguales).
    const order = [...items].sort(() => rng() - 0.5);

    // Apilar fotos hasta que no entre otra dejando el gap mínimo.
    const colItems = [];
    let sumH = 0;
    let idx = 0;
    let safety = 0;
    while (safety++ < items.length * 60) {
      const item = order[idx % order.length];
      const h = aspectH(item);
      const m = colItems.length + 1; // cantidad si agrego esta foto
      // ¿entra dejando al menos `gap` de separación en todas?
      if (sumH + h + m * gap > periodH && colItems.length >= 1) break;
      colItems.push({ item, h });
      sumH += h;
      idx++;
    }

    const n = colItems.length;
    // Gap uniforme que llena EXACTO el período (siempre >= gap base).
    const g = n > 0 ? (periodH - sumH) / n : gap;

    let y = 0;
    for (const { item, h } of colItems) {
      tiles.push({ key: key++, item, x, y, w: colWidth, h });
      y += h + g;
    }
  }

  const periodW = cols * (colWidth + gap);
  return { tiles, periodW, periodH };
}

export default function PanCanvas({ posts }) {
  const viewportRef = useRef(null);
  const worldRef = useRef(null);
  const pan = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const rafId = useRef(null);

  const [viewport, setViewport] = useState({ w: 1200, h: 800 });
  const [active, setActive] = useState(null);
  // El lienzo depende del tamaño real de la ventana y de un orden
  // aleatorio: eso el servidor no lo sabe. Lo dibujamos solo en el
  // navegador (después de montar) para evitar desajustes de hidratación.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Layout determinístico: se calcula una sola vez por set de fotos.
  const { tiles, periodW, periodH } = useMemo(() => {
    if (!posts || posts.length === 0) return { tiles: [], periodW: 1, periodH: 1 };
    const rng = mulberry32(posts.length * 7919);
    // Menos fotos → menos columnas (más parejo). Más fotos → hasta
    // MAX_COLS. Nunca menos de 2 columnas.
    const cols = Math.min(
      posts.length, // nunca más columnas que fotos (evita franjas vacías)
      Math.max(2, Math.min(MAX_COLS, Math.round(posts.length / PHOTOS_PER_COL)))
    );
    return columnMasonryLayout(posts, cols, COL_WIDTH, GAP, rng);
  }, [posts]);

  // Medir viewport y recalcular en resize.
  useEffect(() => {
    function measure() {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const copiesX = Math.ceil(viewport.w / periodW) + 2;
  const copiesY = Math.ceil(viewport.h / periodH) + 2;

  // Loop de render: aplica transform directo al DOM (sin pasar por
  // React state) para que el pan sea fluido a 60fps.
  useEffect(() => {
    function frame() {
      // Inercia: si no estás arrastrando, decae la velocidad.
      if (!dragging.current) {
        pan.current.x += velocity.current.x;
        pan.current.y += velocity.current.y;
        velocity.current.x *= 0.92;
        velocity.current.y *= 0.92;
        if (Math.abs(velocity.current.x) < 0.02) velocity.current.x = 0;
        if (Math.abs(velocity.current.y) < 0.02) velocity.current.y = 0;
      }

      const wrappedX = ((pan.current.x % periodW) + periodW) % periodW;
      const wrappedY = ((pan.current.y % periodH) + periodH) % periodH;

      if (worldRef.current) {
        worldRef.current.style.transform = `translate3d(${-wrappedX}px, ${-wrappedY}px, 0)`;
      }

      rafId.current = requestAnimationFrame(frame);
    }
    rafId.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId.current);
  }, [periodW, periodH]);

  // Wheel: rueda del mouse pandea el mundo.
  useEffect(() => {
    function onWheel(e) {
      e.preventDefault();
      pan.current.x += e.deltaX;
      pan.current.y += e.deltaY;
      velocity.current.x = 0;
      velocity.current.y = 0;
    }
    const vp = viewportRef.current;
    if (!vp) return; // sin fotos, el contenedor no existe: no enganchamos nada
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [tiles.length]);

  // Pointer drag (mouse y touch, unificado).
  function onPointerDown(e) {
    dragging.current = true;
    moved.current = false;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    velocity.current = { x: 0, y: 0 };
    viewportRef.current.setPointerCapture(e.pointerId);
    viewportRef.current.style.cursor = "grabbing";
  }

  function onPointerMove(e) {
    if (!dragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved.current = true;

    pan.current.x -= dx;
    pan.current.y -= dy;
    velocity.current = { x: -dx, y: -dy };
    lastPointer.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp() {
    dragging.current = false;
    if (viewportRef.current) viewportRef.current.style.cursor = "grab";
  }

  function handleTileClick(post) {
    if (moved.current) return; // era un arrastre, no un click
    setActive(post);
  }

  const copyOffsetsX = Array.from({ length: copiesX }, (_, i) => (i - 1) * periodW);
  const copyOffsetsY = Array.from({ length: copiesY }, (_, i) => (i - 1) * periodH);

  if (!tiles.length) {
    return (
      <div className="fixed inset-0 flex items-center justify-center text-mute">
        <p className="font-display text-2xl italic">todavía nada aquí</p>
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      className="fixed inset-0 overflow-hidden touch-none cursor-grab select-none bg-ink"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div ref={worldRef} className="absolute top-0 left-0 will-change-transform">
        {mounted && copyOffsetsY.map((offY) =>
          copyOffsetsX.map((offX) => (
            <div
              key={`${offX}-${offY}`}
              className="absolute top-0 left-0"
              style={{
                transform: `translate3d(${offX}px, ${offY}px, 0)`,
                width: periodW,
                height: periodH,
              }}
            >
              {tiles.map(({ key, item, x, y, w, h }) => (
                <div
                  key={`${offX}-${offY}-${key}`}
                  className="absolute overflow-hidden bg-charcoal"
                  style={{ left: x, top: y, width: w, height: h }}
                  onClick={() => handleTileClick(item)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image_url}
                    alt={item.caption || "foto de la galería"}
                    className="w-full h-full object-cover pointer-events-none"
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 bg-ink/95 flex items-center justify-center p-6 sm:p-16"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setActive(null)}
        >
          <button
            className="absolute top-5 right-5 text-bone/70 hover:text-bone text-sm uppercase tracking-widest2"
            onClick={() => setActive(null)}
          >
            Cerrar ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.image_url}
            alt={active.caption || ""}
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {active.caption && (
            <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-bone/80 text-sm tracking-wide">
              {active.caption}
            </p>
          )}
        </div>
      )}
    </div>
  );
}