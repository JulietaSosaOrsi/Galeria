"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AdminPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  // Estado del recalculo de dimensiones
  const [fixing, setFixing] = useState(false);
  const [fixProgress, setFixProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      setUser(session.user);
      setChecking(false);
    });
  }, [router]);

  const loadPosts = useCallback(async () => {
    const { data } = await supabase
      .from("posts")
      .select("id, image_url, caption, width, height, created_at")
      .order("created_at", { ascending: false });
    setPosts(data || []);
  }, []);

  useEffect(() => {
    if (user) loadPosts();
  }, [user, loadPosts]);

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function getImageDimensions(f) {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.src = URL.createObjectURL(f);
    });
  }

  // Lee el tamaño REAL de una imagen ya publicada (por URL), cargándola
  // en el navegador una vez.
  function getRemoteImageDimensions(url) {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () =>
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = url;
    });
  }

  // Recorre todas las fotos y corrige width/height con el valor real.
  // Sirve para las que se subieron manualmente por Storage (sin pasar
  // por este formulario) y quedaron con un tamaño "inventado".
  async function handleFixDimensions() {
    setFixing(true);
    setFixProgress({ done: 0, total: posts.length });

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      try {
        const { width, height } = await getRemoteImageDimensions(
          post.image_url
        );
        await supabase
          .from("posts")
          .update({ width, height })
          .eq("id", post.id);
      } catch (err) {
        console.error("No se pudo leer la imagen:", post.image_url, err);
      }
      setFixProgress({ done: i + 1, total: posts.length });
    }

    await loadPosts();
    setFixing(false);
    setMessage("Dimensiones actualizadas. Ya podés recargar la galería.");
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file || !user) return;

    setUploading(true);
    setMessage("");

    try {
      const { width, height } = await getImageDimensions(file);

      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("gallery")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("gallery").getPublicUrl(path);

      const { error: insertError } = await supabase.from("posts").insert({
        user_id: user.id,
        image_url: publicUrl,
        caption: caption || null,
        width,
        height,
      });

      if (insertError) throw insertError;

      setMessage("Foto publicada.");
      setFile(null);
      setPreview(null);
      setCaption("");
      loadPosts();
    } catch (err) {
      console.error(err);
      setMessage("Ocurrió un error al subir la foto.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(postId) {
    const confirmed = window.confirm("¿Borrar esta foto?");
    if (!confirmed) return;
    await supabase.from("posts").delete().eq("id", postId);
    loadPosts();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center text-mute text-sm">
        Verificando acceso...
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-10">
        <h1 className="font-display italic text-3xl text-bone">subir foto</h1>
        <button
          onClick={handleLogout}
          className="text-[11px] uppercase tracking-widest2 text-mute hover:text-bone transition-colors"
        >
          Salir
        </button>
      </div>

      {/* Herramienta: recalcular dimensiones reales */}
      <div className="border border-accent/40 bg-charcoal p-5 mb-8">
        <h2 className="text-[11px] uppercase tracking-widest2 text-accent mb-2">
          Corregir tamaños de fotos
        </h2>
        <p className="text-xs text-mute mb-4 leading-relaxed">
          Usá esto si subiste fotos manualmente desde Supabase Storage (no
          desde este formulario) y en la galería se ven recortadas. Lee el
          tamaño real de cada foto y corrige la base de datos. Se puede
          correr las veces que quieras, no hace daño.
        </p>
        <button
          onClick={handleFixDimensions}
          disabled={fixing || posts.length === 0}
          className="w-full border border-accent text-accent py-2 text-sm uppercase tracking-widest2 hover:bg-accent hover:text-ink transition-colors disabled:opacity-50"
        >
          {fixing
            ? `Corrigiendo... ${fixProgress.done}/${fixProgress.total}`
            : "Recalcular dimensiones reales"}
        </button>
      </div>

      <form
        onSubmit={handleUpload}
        className="border border-line bg-charcoal p-6 mb-12"
      >
        <label className="block mb-4">
          <span className="block text-[11px] uppercase tracking-widest2 text-mute mb-2">
            Foto
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            required
            className="block w-full text-sm text-bone file:mr-4 file:py-2 file:px-4 file:border file:border-line file:bg-ink file:text-bone file:text-xs file:uppercase file:tracking-widest2"
          />
        </label>

        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Vista previa"
            className="w-full max-h-80 object-contain mb-4 border border-line"
          />
        )}

        <label className="block mb-6">
          <span className="block text-[11px] uppercase tracking-widest2 text-mute mb-2">
            Descripción (opcional)
          </span>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full bg-ink border border-line px-3 py-2 text-bone text-sm focus:outline-none focus:border-accent"
          />
        </label>

        <button
          type="submit"
          disabled={uploading || !file}
          className="w-full border border-accent text-accent py-2 text-sm uppercase tracking-widest2 hover:bg-accent hover:text-ink transition-colors disabled:opacity-50"
        >
          {uploading ? "Subiendo..." : "Publicar"}
        </button>

        {message && (
          <p className="text-center text-xs text-mute mt-4">{message}</p>
        )}
      </form>

      <h2 className="text-[11px] uppercase tracking-widest2 text-mute mb-4">
        Publicadas ({posts.length})
      </h2>
      <ul className="space-y-2">
        {posts.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 border border-line bg-charcoal p-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.image_url}
              alt={p.caption || ""}
              className="w-14 h-14 object-cover"
            />
            <span className="flex-1 text-xs text-mute truncate">
              {p.caption || "sin descripción"} · {p.width}×{p.height}
            </span>
            <button
              onClick={() => handleDelete(p.id)}
              className="text-[11px] uppercase tracking-widest2 text-red-400 hover:text-red-300"
            >
              Borrar
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
