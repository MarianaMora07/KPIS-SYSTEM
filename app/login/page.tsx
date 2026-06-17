"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2 } from "lucide-react";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

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
    <AuthPageShell>
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <Image
          src="/logo_estelar.png"
          alt="Estelar KPI"
          width={56}
          height={56}
          className="rounded-full object-contain shadow-md ring-2 ring-imperial-900/10"
        />
        <h1 className="text-2xl font-bold text-imperial-900">Sistema de KPIs</h1>
        <p className="text-sm font-medium text-imperial-700/80">Hoteles Estelar</p>
      </div>

      {confirmed && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-800 backdrop-blur-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Correo confirmado. Ya puede iniciar sesión.
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-2xl border-2 border-imperial-900/15 bg-white/90 shadow-xl shadow-imperial-900/10 backdrop-blur-md"
      >
        <div className="border-b border-imperial-800 bg-imperial-900 px-6 py-4 text-center">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">
            {isSignUp ? "Crear cuenta" : "Iniciar sesión"}
          </h2>
          <p className="mt-1 text-xs text-white/70">
            Acceso al panel de indicadores
          </p>
        </div>

        <div className="space-y-0 p-6">
          {isSignUp && (
            <div className="mb-4">
              <label className="form-label">Nombre</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="form-input"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="form-label">Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
            />
          </div>

          <div className="mb-6">
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="form-input"
            />
          </div>

          {error && (
            <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full rounded-xl py-3 text-sm font-semibold uppercase tracking-wide disabled:opacity-50"
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
            className="mt-4 w-full text-center text-sm text-slate-600 hover:text-imperial-900"
          >
            {isSignUp
              ? "¿Ya tiene cuenta? Inicie sesión"
              : "¿No tiene cuenta? Regístrese"}
          </button>

          <Link
            href="/"
            className="mt-3 block w-full text-center text-xs text-slate-500 hover:text-imperial-900"
          >
            ← Volver al inicio
          </Link>
        </div>
      </form>
    </AuthPageShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#dce6f2] to-white text-slate-500">
          Cargando...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
