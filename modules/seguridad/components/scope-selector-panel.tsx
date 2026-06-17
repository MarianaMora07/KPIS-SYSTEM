"use client";

interface ScopeSelectorPanelProps {
  hotels: { id: string; nombre: string }[];
  regions: { id: string; nombre: string }[];
  selectedHotels: string[];
  selectedRegions: string[];
  onToggleHotel: (id: string) => void;
  onToggleRegion: (id: string) => void;
  onClearHotels: () => void;
  onClearRegions: () => void;
}

export function ScopeSelectorPanel({
  hotels,
  regions,
  selectedHotels,
  selectedRegions,
  onToggleHotel,
  onToggleRegion,
  onClearHotels,
  onClearRegions,
}: ScopeSelectorPanelProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Hoteles ({selectedHotels.length})
          </p>
          {selectedHotels.length > 0 && (
            <button
              type="button"
              onClick={onClearHotels}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Limpiar
            </button>
          )}
        </div>
        <p className="mb-2 text-xs text-slate-400">
          Marque uno o varios hoteles y confirme con Guardar alcance.
        </p>
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {hotels.map((h) => (
            <li key={h.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selectedHotels.includes(h.id)}
                  onChange={() => onToggleHotel(h.id)}
                  className="rounded border-slate-300"
                />
                <span>{h.nombre}</span>
              </label>
            </li>
          ))}
        </ul>
        {selectedHotels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {selectedHotels.map((id) => {
              const hotel = hotels.find((h) => h.id === id);
              return (
                <span
                  key={id}
                  className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900"
                >
                  {hotel?.nombre ?? id.slice(0, 8)}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Regiones ({selectedRegions.length})
          </p>
          {selectedRegions.length > 0 && (
            <button
              type="button"
              onClick={onClearRegions}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Limpiar
            </button>
          )}
        </div>
        <p className="mb-2 text-xs text-slate-400">
          Puede combinar varias regiones según el alcance del usuario.
        </p>
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {regions.map((r) => (
            <li key={r.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selectedRegions.includes(r.id)}
                  onChange={() => onToggleRegion(r.id)}
                  className="rounded border-slate-300"
                />
                <span>{r.nombre}</span>
              </label>
            </li>
          ))}
        </ul>
        {selectedRegions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {selectedRegions.map((id) => {
              const region = regions.find((r) => r.id === id);
              return (
                <span
                  key={id}
                  className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs text-cyan-900"
                >
                  {region?.nombre ?? id.slice(0, 8)}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
