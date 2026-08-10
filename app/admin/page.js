"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AdminPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [message, setMessage] = useState("");

  // Subida masiva (varias fotos a la vez)
  const [files, setFiles] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [bulkErrors, setBulkErrors] = useState([]);

  // Recalcular dimensiones (fotos viejas subidas manualmente)
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

  function getImageDimensions(f) {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.src = URL.createObjectURL(f);
    });
  }

  function getRemoteImageDimensions(url) {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () =>
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = url;
    });
  }

  function handleFilesChange(e) {
    setFiles(Array.from(e.target.files || []));
  }

  // Sube TODAS las fotos seleccionadas, una por una, midiendo el
  // tamaño real de cada una antes de subirla. Funciona igual con
  // 1 foto que con 400 — no hay ningún límite en el código.
  async function handleBulkUpload(e) {
    e.preventDefault();
    if (!files.length || !user) return;

    setBulkUploading(true);
    setBulkErrors([]);
    setBulkProgress({ done: 0, total: files.length });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const { width, height } = await getImageDimensions(file);
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}-${i}.${ext}`;

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
          caption: null,
          width,
          height,
        });
        if (insertError) throw insertError;
      } catch (err) {
        console.error("Error subiendo", file.name, err);
        const reason = err?.message || err?.error_description || String(err);
        setBulkErrors((prev) => [...prev, `${file.name}: ${reason}`]);
      }
      setBulkProgress({ done: i + 1, total: files.length });
    }

    await loadPosts();
    setBulkUploading(false);
    setFiles([]);
    setMessage("Subida masiva terminada.");
  }

  async function handleFixDimensions() {
    setFixing(true);
    setFixProgress({ done: 0, total: posts.length });
    let fixed = 0;

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      try {
        const { width, height } = await getRemoteImageDimensions(
          post.image_url
        );
        const { data, error } = await supabase
          .from("posts")
          .update({ width, height })
          .eq("id", post.id)
          .select();
        if (error) throw error;
        if (data && data.length > 0) fixed++;
      } catch (err) {
        console.error("No se pudo actualizar:", post.image_url, err);
      }
      setFixProgress({ done: i + 1, total: posts.length });
    }

    await loadPosts();
    setFixing(false);
    setMessage(
      fixed === posts.length
        ? `Listo, se corrigieron ${fixed} fotos.`
        : `Se corrigieron ${fixed} de ${posts.length}. Las que no cambiaron probablemente no son tuyas (user_id distinto) — mejor borralas y resubilas con "Subir varias fotos".`
    );
  }

  async function handleDelete(postId) {
    const confirmed = window.confirm("¿Borrar esta foto?");
    if (!confirmed) return;
    await supabase.from("posts").delete().eq("id", postId);
    loadPosts();
  }

  async function handleDeleteAll() {
    const confirmed = window.confirm(
      `¿Borrar las ${posts.length} fotos publicadas? Esto NO se puede deshacer.`
    );
    if (!confirmed) return;
    await supabase.from("posts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
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
        <h1 className="font-display italic text-3xl text-bone">panel</h1>
        <button
          onClick={handleLogout}
          className="text-[11px] uppercase tracking-widest2 text-mute hover:text-bone transition-colors"
        >
          Salir
        </button>
      </div>

      {/* Subida masiva */}
      <form
        onSubmit={handleBulkUpload}
        className="border border-line bg-charcoal p-6 mb-8"
      >
        <h2 className="text-[11px] uppercase tracking-widest2 text-bone mb-2">
          Subir varias fotos a la vez
        </h2>
        <p className="text-xs text-mute mb-4 leading-relaxed">
          Elegí todas las fotos que quieras (podés seleccionar cientos a la
          vez desde el explorador de archivos). Cada una se sube con su
          tamaño real medido automáticamente — no hace falta ningún paso
          extra después.
        </p>

        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesChange}
          className="block w-full text-sm text-bone file:mr-4 file:py-2 file:px-4 file:border file:border-line file:bg-ink file:text-bone file:text-xs file:uppercase file:tracking-widest2 mb-4"
        />

        {files.length > 0 && (
          <p className="text-xs text-mute mb-4">
            {files.length} foto{files.length !== 1 ? "s" : ""} seleccionada
            {files.length !== 1 ? "s" : ""}.
          </p>
        )}

        <button
          type="submit"
          disabled={bulkUploading || files.length === 0}
          className="w-full border border-accent text-accent py-2 text-sm uppercase tracking-widest2 hover:bg-accent hover:text-ink transition-colors disabled:opacity-50"
        >
          {bulkUploading
            ? `Subiendo... ${bulkProgress.done}/${bulkProgress.total}`
            : "Subir fotos seleccionadas"}
        </button>

        {bulkErrors.length > 0 && (
          <p className="text-xs text-red-400 mt-3">
            Fallaron {bulkErrors.length}: {bulkErrors.join(", ")}
          </p>
        )}
      </form>

      {/* Herramienta legacy: recalcular dimensiones de fotos viejas */}
      <div className="border border-accent/40 bg-charcoal p-5 mb-8">
        <h2 className="text-[11px] uppercase tracking-widest2 text-accent mb-2">
          Corregir tamaños (fotos viejas subidas por Storage)
        </h2>
        <p className="text-xs text-mute mb-4 leading-relaxed">
          Solo para fotos que subiste manualmente por Supabase Storage antes
          de tener la subida masiva de arriba. Si esto no corrige nada, es
          porque esas fotos quedaron con otro dueño — mejor borralas (abajo)
          y resubilas con la herramienta de arriba.
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

      {message && (
        <p className="text-center text-xs text-mute mb-8">{message}</p>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] uppercase tracking-widest2 text-mute">
          Publicadas ({posts.length})
        </h2>
        {posts.length > 0 && (
          <button
            onClick={handleDeleteAll}
            className="text-[11px] uppercase tracking-widest2 text-red-400 hover:text-red-300"
          >
            Borrar todas
          </button>
        )}
      </div>
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
              {p.width}×{p.height}
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