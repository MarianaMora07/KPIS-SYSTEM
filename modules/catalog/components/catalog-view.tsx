"use client";

import { useState, useTransition } from "react";
import { Building2, Plus } from "lucide-react";
import {
  FormModal,
  FormField,
  FormSelect,
  FormActions,
  FormPrimaryButton,
} from "@/components/ui/form-modal";
import { SUCCESS_MESSAGES, useSuccessToast } from "@/components/ui/success-toast";
import { usePermissions } from "@/components/layout/permissions-context";
import { createRegionAction, createHotelAction } from "../actions/catalog-actions";

interface CatalogViewProps {
  regions: { id: string; codigo: string; nombre: string }[];
  hotels: { id: string; codigo: string; nombre: string; region_id: string }[];
}

export function CatalogView({ regions, hotels }: CatalogViewProps) {
  const { can } = usePermissions();
  const { showSuccess } = useSuccessToast();
  const canManage = can("catalogo.gestionar");
  const [pending, startTransition] = useTransition();
  const [regionOpen, setRegionOpen] = useState(false);
  const [hotelOpen, setHotelOpen] = useState(false);

  return (
    <div className="space-y-6">
      <section className="glass rounded-xl border border-slate-200/60 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-slate-500">
            <Building2 className="h-4 w-4" />
            Regiones
          </h2>
          {canManage && (
            <FormPrimaryButton onClick={() => setRegionOpen(true)}>
              <Plus className="h-4 w-4" />
              Nueva región
            </FormPrimaryButton>
          )}
        </div>

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
            <FormPrimaryButton onClick={() => setHotelOpen(true)}>
              <Plus className="h-4 w-4" />
              Nuevo hotel
            </FormPrimaryButton>
          )}
        </div>

        <ul className="space-y-2">
          {hotels.map((h) => (
            <li key={h.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="font-mono text-xs text-amber-700">{h.codigo}</span> — {h.nombre}
            </li>
          ))}
        </ul>
      </section>

      <FormModal
        open={regionOpen}
        onClose={() => setRegionOpen(false)}
        title="Nueva región"
        subtitle="Agregue una región al catálogo organizacional"
        maxWidth="md"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              await createRegionAction({
                codigo: fd.get("codigo") as string,
                nombre: fd.get("nombre") as string,
              });
              setRegionOpen(false);
              showSuccess(SUCCESS_MESSAGES.created);
            });
          }}
        >
          <FormField label="Código" name="codigo" required placeholder="REG-AND" />
          <FormField label="Nombre" name="nombre" required placeholder="Región Andina" />
          <FormActions
            onCancel={() => setRegionOpen(false)}
            submitLabel="Guardar región"
            pending={pending}
          />
        </form>
      </FormModal>

      <FormModal
        open={hotelOpen}
        onClose={() => setHotelOpen(false)}
        title="Nuevo hotel"
        subtitle="Registre un hotel y asígnelo a una región"
        maxWidth="md"
      >
        <form
          className="space-y-4"
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
              setHotelOpen(false);
              showSuccess(SUCCESS_MESSAGES.created);
            });
          }}
        >
          <FormSelect
            label="Región"
            name="region_id"
            required
            options={regions.map((r) => ({ id: r.id, nombre: r.nombre }))}
          />
          <FormField label="Código" name="codigo" required placeholder="HTL-BOG" />
          <FormField label="Nombre" name="nombre" required placeholder="Estelar Bogotá" />
          <FormField label="Ciudad" name="ciudad" placeholder="Opcional" />
          <FormActions
            onCancel={() => setHotelOpen(false)}
            submitLabel="Guardar hotel"
            pending={pending}
          />
        </form>
      </FormModal>
    </div>
  );
}
