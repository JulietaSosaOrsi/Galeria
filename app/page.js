import { readdirSync, statSync, readFileSync } from "fs";
import path from "path";
import { imageSize } from "image-size";
import PanCanvas from "@/components/PanCanvas";

// Relee la carpeta en cada carga: agregás/quitás fotos y con F5 ya aparecen.
export const dynamic = "force-dynamic";

// ============================================================
// ▼▼▼ ACÁ SE CARGAN LAS FOTOS ▼▼▼
// Poné tus imágenes en la carpeta:   public/fotos/
// Formatos soportados: .jpg .jpeg .png .webp .gif .avif
// No hace falta tocar código: solo pegar los archivos y refrescar.
// ============================================================

const EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

function getLocalPhotos() {
  const dir = path.join(process.cwd(), "public", "fotos");

  let files;
  try {
    files = readdirSync(dir);
  } catch {
    return []; // la carpeta todavía no existe: galería vacía
  }

  const photos = [];
  for (const name of files) {
    if (!EXTS.has(path.extname(name).toLowerCase())) continue;
    const full = path.join(dir, name);
    try {
      const { width, height } = imageSize(readFileSync(full));
      photos.push({
        id: name,
        image_url: `/fotos/${encodeURIComponent(name)}`,
        caption: "",
        width,
        height,
        created_at: statSync(full).mtimeMs,
      });
    } catch {
      // archivo ilegible o formato no reconocido: lo salteamos
    }
  }

  // Las más nuevas primero (por fecha de modificación del archivo).
  photos.sort((a, b) => b.created_at - a.created_at);
  return photos;
}

export default function HomePage() {
  const posts = getLocalPhotos();
  return <PanCanvas posts={posts} />;
}
