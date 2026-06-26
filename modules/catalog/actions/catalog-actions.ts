"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/require-permission";
import { invalidateCache } from "@/lib/cache/dashboard-cache";
import { createRegion, createHotel } from "../services/catalog-service";

export async function createRegionAction(input: {
  codigo: string;
  nombre: string;
  descripcion?: string;
}) {
  await assertPermission("catalogo.gestionar");
  await createRegion(input);
  invalidateCache("catalog:");
  revalidatePath("/catalogo");
}

export async function createHotelAction(input: {
  region_id: string;
  codigo: string;
  nombre: string;
  ciudad?: string;
}) {
  await assertPermission("catalogo.gestionar");
  await createHotel(input);
  invalidateCache("catalog:");
  revalidatePath("/catalogo");
}
