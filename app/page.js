import { supabase } from "@/lib/supabaseClient";
import MasonryGrid from "@/components/MasonryGrid";

// Revalida el contenido cada 30s: suficientemente fresco para que tus
// seguidores vean fotos nuevas rápido, sin pegarle a la DB en cada visita.
export const revalidate = 30;

async function getPosts() {
  const { data, error } = await supabase
    .from("posts")
    .select("id, image_url, caption, width, height, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }
  return data;
}

export default async function HomePage() {
  const posts = await getPosts();

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-10">
      <header className="text-center mb-12">
        <h1 className="font-display italic text-4xl sm:text-5xl tracking-wide text-bone">
          galería
        </h1>
        <p className="mt-2 text-[11px] uppercase tracking-widest2 text-mute">
          una colección en curso
        </p>
      </header>

      <MasonryGrid posts={posts} />

      <footer className="mt-20 pb-10 text-center text-[11px] text-mute tracking-wide">
        actualizado casi todos los días
      </footer>
    </main>
  );
}
