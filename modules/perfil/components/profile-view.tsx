"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { Camera, Lock, User } from "lucide-react";
import { RoleBadge } from "@/components/ui/role-badge";
import {
  FormField,
  FormActions,
  FormError,
} from "@/components/ui/form-modal";
import {
  updateProfileAction,
  changePasswordAction,
  uploadAvatarAction,
} from "@/modules/perfil/actions/profile-actions";
import type { SessionUser } from "@/lib/auth/session-user";

interface ProfileViewProps {
  user: SessionUser;
}

export function ProfileView({ user }: ProfileViewProps) {
  const [profilePending, startProfileTransition] = useTransition();
  const [passwordPending, startPasswordTransition] = useTransition();
  const [avatarPending, startAvatarTransition] = useTransition();
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url);
  const fileRef = useRef<HTMLInputElement>(null);

  const displayName = [user.nombre, user.apellido].filter(Boolean).join(" ");

  function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileError(null);
    setSuccessMsg(null);
    const fd = new FormData(e.currentTarget);
    startProfileTransition(async () => {
      try {
        await updateProfileAction({
          nombre: fd.get("nombre") as string,
          apellido: (fd.get("apellido") as string) || null,
        });
        setSuccessMsg("Perfil actualizado correctamente.");
      } catch (err) {
        setProfileError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordError(null);
    setSuccessMsg(null);
    const fd = new FormData(e.currentTarget);
    startPasswordTransition(async () => {
      try {
        await changePasswordAction({
          password: fd.get("password") as string,
          confirmPassword: fd.get("confirmPassword") as string,
        });
        setSuccessMsg("Contraseña actualizada correctamente.");
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        setPasswordError(err instanceof Error ? err.message : "Error al cambiar contraseña");
      }
    });
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setSuccessMsg(null);
    const fd = new FormData();
    fd.append("avatar", file);
    startAvatarTransition(async () => {
      try {
        const url = await uploadAvatarAction(fd);
        setAvatarUrl(url);
        setSuccessMsg("Foto de perfil actualizada.");
      } catch (err) {
        setAvatarError(err instanceof Error ? err.message : "Error al subir imagen");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMsg}
        </div>
      )}

      {/* Avatar card */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="relative">
            <div className="relative h-28 w-28 overflow-hidden rounded-full bg-imperial-900 ring-4 ring-white shadow-lg">
              {avatarUrl ? (
                <Image src={avatarUrl} alt={displayName} fill className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User className="h-14 w-14 text-white/80" />
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={avatarPending}
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-imperial-900 text-white shadow-md transition-transform hover:scale-105 disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-semibold text-imperial-900">{displayName}</h2>
            <p className="text-sm text-slate-500">{user.email}</p>
            {user.rol && (
              <div className="mt-2">
                <RoleBadge role={user.rol} variant="light" />
              </div>
            )}
            {avatarPending && (
              <p className="mt-2 text-xs text-imperial-700">Subiendo imagen...</p>
            )}
            {avatarError && <p className="mt-2 text-xs text-red-600">{avatarError}</p>}
          </div>
        </div>
      </section>

      {/* Profile info */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-imperial-900" />
          <h3 className="font-semibold text-imperial-900">Información personal</h3>
        </div>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Nombre *"
              name="nombre"
              required
              value={undefined}
            >
              <input
                name="nombre"
                defaultValue={user.nombre}
                required
                className="form-input"
              />
            </FormField>
            <FormField label="Apellido" name="apellido">
              <input
                name="apellido"
                defaultValue={user.apellido ?? ""}
                className="form-input"
              />
            </FormField>
          </div>
          <FormField label="Correo electrónico">
            <input
              value={user.email}
              disabled
              className="form-input cursor-not-allowed opacity-60"
            />
          </FormField>
          {profileError && <FormError message={profileError} />}
          <FormActions
            submitLabel="Guardar cambios"
            pending={profilePending}
            showCancel={false}
          />
        </form>
      </section>

      {/* Password */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="h-5 w-5 text-imperial-900" />
          <h3 className="font-semibold text-imperial-900">Cambiar contraseña</h3>
        </div>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <FormField label="Nueva contraseña *" name="password" type="password" required />
          <FormField
            label="Confirmar contraseña *"
            name="confirmPassword"
            type="password"
            required
          />
          {passwordError && <FormError message={passwordError} />}
          <FormActions
            submitLabel="Actualizar contraseña"
            pending={passwordPending}
            pendingLabel="Actualizando..."
            showCancel={false}
          />
        </form>
      </section>
    </div>
  );
}
