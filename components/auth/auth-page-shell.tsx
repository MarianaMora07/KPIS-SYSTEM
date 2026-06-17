"use client";

import { SiriWavesBackground } from "@/components/landing/siri-waves-background";

interface AuthPageShellProps {
  children: React.ReactNode;
}

/** Fondo con gradiente Estelar + ondas Siri para login/registro */
export function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#dce6f2] via-[#eef3f9] to-white px-4 py-10">
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <SiriWavesBackground />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(11,48,97,0.14),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(11,48,97,0.08),transparent_45%)]" />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
