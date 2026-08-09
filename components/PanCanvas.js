"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ============================================================
// ▼▼▼ ACÁ SE AJUSTAN LOS DOS PARÁMETROS QUE PEDISTE ▼▼▼
// ============================================================

// Margen entre fotos, en píxeles. 1cm ≈ 37.8px a 96dpi.
// 0.5cm ≈ 19px. Subí o bajá este número para más o menos separación.
const GAP = 19;

// Cantidad de columnas del mosaico (como en Pinterest/masonry).
// Más columnas = fotos más chicas y más "densas".
const COLS = 5;

// Ancho de cada columna en píxeles (el alto de cada foto sale solo,
// de su proporción real — nunca se recorta ninguna imagen).
const COL_WIDTH = 340;

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

// Masonry real por columnas: cada foto conserva su proporción
// original (nunca se recorta). El "período" resultante es siempre
// un rectángulo exacto (PERIOD_W × PERIOD_H calculado), por eso
// sigue repitiendo sin costuras al hacer wraparound.
function columnMasonryLayout(items, cols, colWidth, gap, rng) {
  // Orden aleatorio (pero determinístico) para que el mosaico no
  // quede siempre con las mismas fotos arriba.
  const shuffled = [...items].sort(() => rng() - 0.5);

  const colHeights = new Array(cols).fill(0);
  const tiles = [];

  for (const item of shuffled) {
    // La foto va a la columna más corta hasta ahora (masonry clásico).
    let col = 0;
    for (let c = 1; c < cols; c++) {
      if (colHeights[c] < colHeights[col]) col = c;
    }

    const aspect =
      item.width && item.height ? item.width / item.height : 0.8; // fallback 4:5
    const h = colWidth / aspect;
    const x = gap / 2 + col * (colWidth + gap);
    const y = gap / 2 + colHeights[col];

    tiles.push({ item, x, y, w: colWidth, h });

    colHeights[col] += h + gap;
  }

  const periodW = cols * (colWidth + gap);
  const periodH = Math.max(...colHeights) + gap / 2;

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

  // Layout determinístico: se calcula una sola vez por set de fotos.
  const { tiles, periodW, periodH } = useMemo(() => {
    if (!posts || posts.length === 0) return { tiles: [], periodW: 1, periodH: 1 };
    const rng = mulberry32(posts.length * 7919);
    return columnMasonryLayout(posts, COLS, COL_WIDTH, GAP, rng);
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
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, []);

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
        {copyOffsetsY.map((offY) =>
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
              {tiles.map(({ item, x, y, w, h }) => (
                <div
                  key={`${offX}-${offY}-${item.id}`}
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
