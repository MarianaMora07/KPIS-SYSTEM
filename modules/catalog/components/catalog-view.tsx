"use client";

import { useState, useTransition } from "react";
import { Building2, Plus } from "lucide-react";
import { usePermissions } from "@/components/layout/permissions-context";
import { createRegionAction, createHotelAction } from "../actions/catalog-actions";

interface CatalogViewProps {
  regions: { id: string; codigo: string; nombre: string }[];
  hotels: { id: string; codigo: string; nombre: string; region_id: string }[];
}

export function CatalogView({ regions, hotels }: CatalogViewProps) {
  const { can } = usePermissions();
  const canManage = can("catalogo.gestionar");
  const [pending, startTransition] = useTransition();
  const [showRegion, setShowRegion] = useState(false);
  const [showHotel, setShowHotel] = useState(false);

  return (
    <div className="space-y-6">
      <section className="glass rounded-xl border border-slate-200/60 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-slate-500">
            <Building2 className="h-4 w-4" />
            Regiones
          </h2>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowRegion(!showRegion)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva región
            </button>
          )}
        </div>
        {showRegion && (
          <form
            className="mb-4 grid gap-3 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                await createRegionAction({
                  codigo: fd.get("codigo") as string,
                  nombre: fd.get("nombre") as string,
                });
                setShowRegion(false);
              });
            }}
          >
            <input name="codigo" placeholder="Código" required className="rounded-lg border px-3 py-2 text-sm" />
            <input name="nombre" placeholder="Nombre" required className="rounded-lg border px-3 py-2 text-sm" />
            <button type="submit" disabled={pending} className="rounded-lg bg-imperial-900 px-4 py-2 text-sm text-white">
              Guardar
            </button>
          </form>
        )}
        <ul className="space-y-2">
          {regions.map((r) => (
            <li key={r.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="font-mono text-xs text-amber-700">{r.codigo}</span> — {r.nombre}
            </li>
          ))}
        </ul>
      </section>

      <section className="glass rounded-xl border border-slate-200/60 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">Hoteles</h2>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowHotel(!showHotel)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo hotel
            </button>
          )}
        </div>
        {showHotel && (
          <form
            className="mb-4 grid gap-3 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              startTransition(async () => {
                await createHotelAction({
                  region_id: fd.get("region_id") as string,
                  codigo: fd.get("codigo") as string,
                  nombre: fd.get("nombre") as string,
                  ciudad: (fd.get("ciudad") as string) || undefined,
                });
                setShowHotel(false);
              });
            }}
          >
            <select name="region_id" required className="rounded-lg border px-3 py-2 text-sm">
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
            <input name="codigo" placeholder="Código" required className="rounded-lg border px-3 py-2 text-sm" />
            <input name="nombre" placeholder="Nombre" required className="rounded-lg border px-3 py-2 text-sm" />
            <button type="submit" disabled={pending} className="rounded-lg bg-imperial-900 px-4 py-2 text-sm text-white">
              Guardar
            </button>
          </form>
        )}
        <ul className="space-y-2">
          {hotels.map((h) => (
            <li key={h.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="font-mono text-xs text-amber-700">{h.codigo}</span> — {h.nombre}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
