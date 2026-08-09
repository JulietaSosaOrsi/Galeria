"use client";

import { useState } from "react";
import Image from "next/image";

export default function MasonryGrid({ posts }) {
  const [active, setActive] = useState(null);

  if (!posts || posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-mute">
        <p className="font-display text-2xl italic mb-2">todavía nada aquí</p>
        <p className="text-sm tracking-wide">vuelve pronto.</p>
      </div>
    );
  }

  return (
    <>
      <div className="masonry-columns">
        {posts.map((post) => (
          <figure
            key={post.id}
            onClick={() => setActive(post)}
            className="masonry-item group relative overflow-hidden bg-charcoal cursor-zoom-in"
          >
            <Image
              src={post.image_url}
              alt={post.caption || "foto de la galería"}
              width={post.width || 800}
              height={post.height || 1000}
              className="w-full h-auto block transition-transform duration-500 ease-out group-hover:scale-[1.02]"
              sizes="(max-width: 480px) 50vw, (max-width: 900px) 33vw, (max-width: 1400px) 20vw, 16vw"
            />
            {post.caption && (
              <figcaption className="absolute inset-x-0 bottom-0 p-2.5 text-[11px] leading-tight text-bone/95 bg-gradient-to-t from-ink/95 via-ink/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {post.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      {/* Lightbox */}
      {active && (
        <div
          className="fixed inset-0 z-50 bg-ink/95 flex items-center justify-center p-4 sm:p-10"
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
        </div>
      )}
    </>
  );
}
