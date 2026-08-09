import { supabase } from "@/lib/supabaseClient";
import MasonryGrid from "@/components/MasonryGrid";

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
    <main className="max-w-[1800px] mx-auto">
      <header className="text-center pt-8 pb-5 px-4">
        <h1 className="font-display italic text-3xl sm:text-4xl tracking-wide text-bone">
          galería
        </h1>
        <p className="mt-1 text-[10px] uppercase tracking-widest2 text-mute">
          una colección en curso
        </p>
      </header>

      <div className="px-1 sm:px-2">
        <MasonryGrid posts={posts} />
      </div>

      <footer className="py-10 text-center text-[11px] text-mute tracking-wide">
        actualizado casi todos los días
      </footer>
    </main>
  );
}
