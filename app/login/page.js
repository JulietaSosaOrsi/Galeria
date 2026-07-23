"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError("Credenciales incorrectas.");
      return;
    }

    router.push("/admin");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm border border-line bg-charcoal p-8"
      >
        <h1 className="font-display italic text-2xl text-bone mb-6 text-center">
          acceso
        </h1>

        <label className="block text-[11px] uppercase tracking-widest2 text-mute mb-2">
          Correo
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 bg-ink border border-line px-3 py-2 text-bone text-sm focus:outline-none focus:border-accent"
        />

        <label className="block text-[11px] uppercase tracking-widest2 text-mute mb-2">
          Contraseña
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-6 bg-ink border border-line px-3 py-2 text-bone text-sm focus:outline-none focus:border-accent"
        />

        {error && (
          <p className="text-red-400 text-xs mb-4 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full border border-accent text-accent py-2 text-sm uppercase tracking-widest2 hover:bg-accent hover:text-ink transition-colors disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
