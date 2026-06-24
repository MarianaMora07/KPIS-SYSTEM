"use client";

import { useState, useTransition } from "react";
import { Database, Loader2, Plus, PlugZap, Trash2 } from "lucide-react";

export interface DatabaseConnectionListItem {
  id: string;
  nombre: string;
  tipo: string;
  config: Record<string, unknown>;
  activa: boolean;
}

interface DatabaseConnectionsPanelProps {
  initialConnections: DatabaseConnectionListItem[];
  canManage: boolean;
}

export function DatabaseConnectionsPanel({
  initialConnections,
  canManage,
}: DatabaseConnectionsPanelProps) {
  const [connections, setConnections] = useState(initialConnections);
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setMessageError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-imperial-900" />
          <h2 className="text-lg font-semibold text-imperial-900">Conexiones de base de datos</h2>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          >
            <Plus className="h-4 w-4" />
            Nueva conexión
          </button>
        )}
      </div>

      {showForm && canManage && (
        <CreateConnectionForm
          pending={pending}
          onCancel={() => setShowForm(false)}
          onCreated={(c) => {
            setConnections((prev) => [...prev, c]);
            setShowForm(false);
            setMessage("Conexión creada");
          }}
          onError={setMessageError}
          startTransition={startTransition}
        />
      )}

      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {connections.length === 0 ? (
        <p className="text-sm text-slate-500">No hay conexiones configuradas.</p>
      ) : (
        <ul className="space-y-3">
          {connections.map((c) => (
            <ConnectionCard
              key={c.id}
              connection={c}
              canManage={canManage}
              onDeleted={(id) => setConnections((prev) => prev.filter((x) => x.id !== id))}
              onTestResult={(msg, isError) => {
                if (isError) setMessageError(msg);
                else {
                  setMessage(msg);
                  setMessageError(null);
                }
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateConnectionForm({
  pending,
  onCancel,
  onCreated,
  onError,
  startTransition,
}: {
  pending: boolean;
  onCancel: () => void;
  onCreated: (c: DatabaseConnectionListItem) => void;
  onError: (msg: string | null) => void;
  startTransition: (fn: () => void) => void;
}) {
  const [tipo, setTipo] = useState<"supabase_internal" | "postgres_external">(
    "supabase_internal"
  );

  return (
    <form
      className="glass grid gap-3 rounded-xl border border-slate-200/60 p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onError(null);
        const fd = new FormData(e.currentTarget);
        const body: Record<string, unknown> = {
          nombre: fd.get("nombre"),
          tipo,
          activa: true,
        };
        if (tipo === "postgres_external") {
          body.config = {
            host: fd.get("host"),
            port: Number(fd.get("port") || 5432),
            database: fd.get("database"),
            user: fd.get("user"),
            ssl: fd.get("ssl") === "on",
          };
          body.password = fd.get("password");
        }
        startTransition(async () => {
          const res = await fetch("/api/database-connections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (!res.ok) {
            onError(data.error ?? "Error al crear");
            return;
          }
          onCreated(data);
        });
      }}
    >
      <input
        name="nombre"
        placeholder="Nombre"
        required
        className="rounded border px-3 py-2 text-sm sm:col-span-2"
      />
      <select
        value={tipo}
        onChange={(e) =>
          setTipo(e.target.value as "supabase_internal" | "postgres_external")
        }
        className="rounded border px-3 py-2 text-sm sm:col-span-2"
      >
        <option value="supabase_internal">Supabase (proyecto actual)</option>
        <option value="postgres_external">PostgreSQL externo</option>
      </select>
      {tipo === "postgres_external" && (
        <>
          <input name="host" placeholder="Host" required className="rounded border px-3 py-2 text-sm" />
          <input
            name="port"
            placeholder="Puerto"
            defaultValue="5432"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            name="database"
            placeholder="Base de datos"
            required
            className="rounded border px-3 py-2 text-sm"
          />
          <input name="user" placeholder="Usuario" required className="rounded border px-3 py-2 text-sm" />
          <input
            name="password"
            type="password"
            placeholder="Contraseña"
            required
            className="rounded border px-3 py-2 text-sm sm:col-span-2"
          />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="ssl" />
            Usar SSL
          </label>
        </>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-imperial-900 px-4 py-2 text-sm text-white"
        >
          Crear
        </button>
        <button type="button" onClick={onCancel} className="rounded border px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ConnectionCard({
  connection,
  canManage,
  onDeleted,
  onTestResult,
}: {
  connection: DatabaseConnectionListItem;
  canManage: boolean;
  onDeleted: (id: string) => void;
  onTestResult: (msg: string, isError?: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const cfg = connection.config as { host?: string; database?: string };

  return (
    <li className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/60 p-4">
      <div>
        <p className="font-medium text-imperial-900">{connection.nombre}</p>
        <p className="text-xs text-slate-500">
          {connection.tipo === "supabase_internal"
            ? "Supabase interno"
            : `PostgreSQL — ${cfg.host ?? "?"} / ${cfg.database ?? "?"}`}
        </p>
      </div>
      {canManage && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await fetch(`/api/database-connections/${connection.id}/test`, {
                  method: "POST",
                });
                const data = await res.json();
                if (data.ok) onTestResult("Conexión exitosa");
                else onTestResult(data.error ?? "Falló la prueba", true);
              })
            }
            className="flex items-center gap-1 rounded border px-3 py-1.5 text-sm"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlugZap className="h-4 w-4" />
            )}
            Probar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("¿Eliminar esta conexión?")) return;
              startTransition(async () => {
                const res = await fetch(`/api/database-connections/${connection.id}`, {
                  method: "DELETE",
                });
                const data = await res.json();
                if (!res.ok) {
                  onTestResult(data.error ?? "No se pudo eliminar", true);
                  return;
                }
                onDeleted(connection.id);
              });
            }}
            className="rounded border border-red-200 p-2 text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </li>
  );
}
