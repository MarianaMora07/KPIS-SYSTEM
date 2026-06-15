import type { AppRole } from "@/types/database";

export interface SessionUser {
  id: string;
  email: string;
  nombre: string;
  apellido: string | null;
  avatar_url: string | null;
  rol: AppRole | null;
}
