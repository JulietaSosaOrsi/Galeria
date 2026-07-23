"use client";

import Masonry from "react-masonry-css";
import Image from "next/image";

const breakpoints = {
  default: 4,
  1280: 3,
  768: 2,
  480: 2,
};

export default function MasonryGrid({ posts }) {
  if (!posts || posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-mute">
        <p className="font-display text-2xl italic mb-2">todavía nada aquí</p>
        <p className="text-sm tracking-wide">vuelve pronto.</p>
      </div>
    );
  }

  return (
    <Masonry
      breakpointCols={breakpoints}
      className="masonry-grid"
      columnClassName="masonry-grid_column"
    >
      {posts.map((post) => (
        <figure
          key={post.id}
          className="group relative overflow-hidden bg-charcoal border border-line"
        >
          <Image
            src={post.image_url}
            alt={post.caption || "foto de la galería"}
            width={post.width || 800}
            height={post.height || 1000}
            className="w-full h-auto object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            sizes="(max-width: 480px) 50vw, (max-width: 768px) 33vw, 25vw"
          />
          {post.caption && (
            <figcaption className="absolute inset-x-0 bottom-0 p-3 text-xs text-bone/90 bg-gradient-to-t from-ink/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              {post.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </Masonry>
  );
}
