import { supabase } from "@/lib/supabaseClient";
import PanCanvas from "@/components/PanCanvas";

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
  return <PanCanvas posts={posts} />;
}