"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Mail, CheckCircle2, ArrowRight } from "lucide-react";

function ConfirmContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "su correo";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-landing-bg px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="glow-orb animate-pulse-glow absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <Image src="/logo.svg" alt="Estelar KPI" width={56} height={56} className="rounded-xl" />
        </div>

        <div className="glass-dark rounded-2xl p-8">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
            <Mail className="h-8 w-8 text-cyan-400" />
          </div>

          <h1 className="mb-2 text-2xl font-semibold text-white">
            Confirme su correo
          </h1>
          <p className="mb-6 text-sm leading-relaxed text-slate-400">
            Enviamos un enlace de confirmación a{" "}
            <strong className="text-white">{email}</strong>. Revise su bandeja de
            entrada y la carpeta de spam.
          </p>

          <div className="mb-6 space-y-3 rounded-xl border border-white/10 bg-white/5 p-4 text-left text-sm text-slate-300">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
              <span>Abra el correo de Hoteles Estelar KPI</span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
              <span>Haga clic en el enlace de confirmación</span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
              <span>Vuelva aquí e inicie sesión con sus credenciales</span>
            </div>
          </div>

          <Link
            href="/login"
            className="btn-gradient inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium"
          >
            Ir a iniciar sesión
            <ArrowRight className="h-4 w-4" />
          </Link>

          <p className="mt-4 text-xs text-slate-500">
            ¿No recibió el correo? Espere unos minutos o contacte al administrador.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmarCorreoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-landing-bg text-slate-400">
          Cargando...
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
