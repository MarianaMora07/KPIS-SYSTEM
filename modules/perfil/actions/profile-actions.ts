"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const profileUpdateSchema = z.object({
  nombre: z.string().min(1).max(150),
  apellido: z.string().max(150).optional().nullable(),
});

const passwordChangeSchema = z
  .object({
    password: z.string().min(6),
    confirmPassword: z.string().min(6),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export async function updateProfileAction(input: {
  nombre: string;
  apellido?: string | null;
}) {
  const parsed = profileUpdateSchema.parse(input);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("user_profiles")
    .update({
      nombre: parsed.nombre,
      apellido: parsed.apellido ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) throw new Error(error.message);

  await supabase.auth.updateUser({
    data: { nombre: parsed.nombre, apellido: parsed.apellido },
  });

  revalidatePath("/perfil");
  revalidatePath("/dashboard");
}

export async function changePasswordAction(input: {
  password: string;
  confirmPassword: string;
}) {
  const parsed = passwordChangeSchema.parse(input);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { error } = await supabase.auth.updateUser({
    password: parsed.password,
  });

  if (error) throw new Error(error.message);
}

export async function uploadAvatarAction(formData: FormData) {
  const file = formData.get("avatar") as File | null;
  if (!file || file.size === 0) throw new Error("No se seleccionó archivo");

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    throw new Error("Formato no permitido. Use JPG, PNG o WebP.");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("La imagen no debe superar 2 MB.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) throw new Error(uploadError.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const avatarUrl = `${publicUrl}?t=${Date.now()}`;

  const { error: profileError } = await supabase
    .from("user_profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (profileError) throw new Error(profileError.message);

  revalidatePath("/perfil");
  revalidatePath("/dashboard");

  return avatarUrl;
}
