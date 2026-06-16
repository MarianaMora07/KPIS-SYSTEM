"use server";

import { revalidatePath } from "next/cache";
import { createRegion, createHotel } from "../services/catalog-service";

export async function createRegionAction(input: {
  codigo: string;
  nombre: string;
  descripcion?: string;
}) {
  await createRegion(input);
  revalidatePath("/catalogo");
}

export async function createHotelAction(input: {
  region_id: string;
  codigo: string;
  nombre: string;
  ciudad?: string;
}) {
  await createHotel(input);
  revalidatePath("/catalogo");
}
