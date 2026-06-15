"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";
  const confirmed = searchParams.get("confirmed") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { nombre },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/login`,
          },
        });
        if (signUpError) throw signUpError;
        router.push(`/confirmar-correo?email=${encodeURIComponent(email)}`);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de autenticación");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-landing-bg px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="glow-orb animate-pulse-glow absolute -left-20 top-1/4 h-72 w-72 rounded-full" />
        <div className="glow-orb animate-pulse-glow absolute -right-20 bottom-1/4 h-64 w-64 rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image src="/logo.svg" alt="Estelar KPI" width={56} height={56} className="rounded-xl" />
          <h1 className="text-2xl font-semibold text-white">Sistema de KPIs</h1>
          <p className="text-sm text-slate-400">Hoteles Estelar</p>
        </div>

        {confirmed && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Correo confirmado. Ya puede iniciar sesión.
          </div>
        )}

        <form onSubmit={handleSubmit} className="glass-dark rounded-2xl p-8">
          {isSignUp && (
            <div className="mb-4">
              <label className="form-label form-label-dark">Nombre</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="form-input form-input-dark"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="form-label form-label-dark">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input form-input-dark"
            />
          </div>

          <div className="mb-6">
            <label className="form-label form-label-dark">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="form-input form-input-dark"
            />
          </div>

          {error && (
            <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-gradient w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
          >
            {loading
              ? "Procesando..."
              : isSignUp
                ? "Crear cuenta"
                : "Iniciar sesión"}
          </button>

          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="mt-4 w-full text-center text-sm text-slate-400 hover:text-white"
          >
            {isSignUp
              ? "¿Ya tiene cuenta? Inicie sesión"
              : "¿No tiene cuenta? Regístrese"}
          </button>

          <Link
            href="/"
            className="mt-3 block w-full text-center text-xs text-slate-500 hover:text-slate-300"
          >
            ← Volver al inicio
          </Link>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-landing-bg text-slate-400">
          Cargando...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
