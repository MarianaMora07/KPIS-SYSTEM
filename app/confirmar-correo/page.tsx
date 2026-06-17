"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Mail, CheckCircle2, ArrowRight } from "lucide-react";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

function ConfirmContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "su correo";

  return (
    <AuthPageShell>
      <div className="mb-6 flex justify-center">
        <Image
          src="/logo.svg"
          alt="Estelar KPI"
          width={56}
          height={56}
          className="rounded-xl shadow-md ring-2 ring-imperial-900/10"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-imperial-900/15 bg-white/90 shadow-xl shadow-imperial-900/10 backdrop-blur-md">
        <div className="border-b border-imperial-800 bg-imperial-900 px-6 py-4 text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide text-white">
            Confirme su correo
          </h1>
        </div>

        <div className="p-8 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-imperial-900/10">
            <Mail className="h-8 w-8 text-imperial-900" />
          </div>

          <p className="mb-6 text-sm leading-relaxed text-slate-600">
            Enviamos un enlace de confirmación a{" "}
            <strong className="text-imperial-900">{email}</strong>. Revise su
            bandeja de entrada y la carpeta de spam.
          </p>

          <div className="mb-6 space-y-3 rounded-xl border border-imperial-900/10 bg-imperial-900/5 p-4 text-left text-sm text-slate-700">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-imperial-900" />
              <span>Abra el correo de Hoteles Estelar KPI</span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-imperial-900" />
              <span>Haga clic en el enlace de confirmación</span>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-imperial-900" />
              <span>Vuelva aquí e inicie sesión con sus credenciales</span>
            </div>
          </div>

          <Link
            href="/login"
            className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold uppercase tracking-wide"
          >
            Ir a iniciar sesión
            <ArrowRight className="h-4 w-4" />
          </Link>

          <p className="mt-4 text-xs text-slate-500">
            ¿No recibió el correo? Espere unos minutos o contacte al
            administrador.
          </p>
        </div>
      </div>
    </AuthPageShell>
  );
}

export default function ConfirmarCorreoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#dce6f2] to-white text-slate-500">
          Cargando...
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
