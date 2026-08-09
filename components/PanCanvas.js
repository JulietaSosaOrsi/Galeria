"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ============================================================
// Tamaño del "período" — el bloque que se repite infinitamente.
// Ajustá esto si cambia mucho la cantidad de fotos (más fotos =
// período más grande para que no se vean muy chicas).
// ============================================================
const PERIOD_W = 1700;
const PERIOD_H = 1300;
const GAP = 76; // ~2cm a 96dpi

// PRNG determinístico simple (mismo layout en cada carga, no
// cambia el mosaico cada vez que refrescás la página).
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Particiona recursivamente un rectángulo en N piezas asimétricas
// que en conjunto llenan el rectángulo exactamente (sin huecos,
// sin superposición) — por eso el tile repite sin costuras.
function bspLayout(items, rect, rng, gap) {
  if (items.length === 1) {
    return [{ item: items[0], ...rect }];
  }

  const mid = Math.max(1, Math.floor(items.length / 2) + (rng() > 0.5 ? 1 : 0) - (items.length === 2 ? 0 : 0));
  const splitAt = Math.min(items.length - 1, Math.max(1, mid));
  const groupA = items.slice(0, splitAt);
  const groupB = items.slice(splitAt);

  const horizontal = rect.w >= rect.h;
  const ratioBase = groupA.length / items.length;
  const ratio = Math.min(0.7, Math.max(0.3, ratioBase + (rng() - 0.5) * 0.2));

  if (horizontal) {
    const wA = rect.w * ratio - gap / 2;
    const wB = rect.w - wA - gap;
    const rectA = { x: rect.x, y: rect.y, w: wA, h: rect.h };
    const rectB = { x: rect.x + wA + gap, y: rect.y, w: wB, h: rect.h };
    return [
      ...bspLayout(groupA, rectA, rng, gap),
      ...bspLayout(groupB, rectB, rng, gap),
    ];
  } else {
    const hA = rect.h * ratio - gap / 2;
    const hB = rect.h - hA - gap;
    const rectA = { x: rect.x, y: rect.y, w: rect.w, h: hA };
    const rectB = { x: rect.x, y: rect.y + hA + gap, w: rect.w, h: hB };
    return [
      ...bspLayout(groupA, rectA, rng, gap),
      ...bspLayout(groupB, rectB, rng, gap),
    ];
  }
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
  const tiles = useMemo(() => {
    if (!posts || posts.length === 0) return [];
    const rng = mulberry32(posts.length * 7919);
    const rootRect = {
      x: GAP / 2,
      y: GAP / 2,
      w: PERIOD_W - GAP,
      h: PERIOD_H - GAP,
    };
    return bspLayout(posts, rootRect, rng, GAP);
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

  const copiesX = Math.ceil(viewport.w / PERIOD_W) + 2;
  const copiesY = Math.ceil(viewport.h / PERIOD_H) + 2;

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

      const wrappedX = ((pan.current.x % PERIOD_W) + PERIOD_W) % PERIOD_W;
      const wrappedY = ((pan.current.y % PERIOD_H) + PERIOD_H) % PERIOD_H;

      if (worldRef.current) {
        worldRef.current.style.transform = `translate3d(${-wrappedX}px, ${-wrappedY}px, 0)`;
      }

      rafId.current = requestAnimationFrame(frame);
    }
    rafId.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId.current);
  }, []);

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

  const copyOffsetsX = Array.from({ length: copiesX }, (_, i) => (i - 1) * PERIOD_W);
  const copyOffsetsY = Array.from({ length: copiesY }, (_, i) => (i - 1) * PERIOD_H);

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
                width: PERIOD_W,
                height: PERIOD_H,
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
