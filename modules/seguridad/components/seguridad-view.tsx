"use client";

import { useState, useTransition } from "react";
import { Shield, Users, FileText, Key } from "lucide-react";
import type { AppRole } from "@/types/database";
import type {
  AuditLogRow,
  PermissionRow,
  UserWithScopes,
} from "@/modules/seguridad/types";
import {
  assignRoleAction,
  toggleUserActiveAction,
  setScopesAction,
  filterAuditLogsAction,
} from "@/modules/seguridad/actions/security-actions";
import { RoleBadge } from "@/components/ui/role-badge";
import { usePermissions } from "@/components/layout/permissions-context";

const ROLES: AppRole[] = [
  "administrador",
  "director_comercial",
  "director_mercadeo",
  "gerente_hotel",
  "analista",
  "consulta",
];

type Tab = "usuarios" | "roles" | "bitacora";

interface SeguridadViewProps {
  users: UserWithScopes[];
  auditLogs: AuditLogRow[];
  permissions: PermissionRow[];
  hotels: { id: string; nombre: string }[];
  regions: { id: string; nombre: string }[];
}

export function SeguridadView({
  users,
  auditLogs,
  permissions,
  hotels,
  regions,
}: SeguridadViewProps) {
  const [tab, setTab] = useState<Tab>("usuarios");
  const { canManageUsers } = usePermissions();

  return (
    <div className="space-y-6">
      {!canManageUsers && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Modo consulta: puede ver usuarios, roles y bitácora. Solo un administrador
          puede asignar roles y alcances.
        </p>
      )}
      <div className="flex gap-2 border-b border-slate-200">
        <TabButton active={tab === "usuarios"} onClick={() => setTab("usuarios")} icon={Users}>
          Usuarios
        </TabButton>
        <TabButton active={tab === "roles"} onClick={() => setTab("roles")} icon={Key}>
          Roles y permisos
        </TabButton>
        <TabButton active={tab === "bitacora"} onClick={() => setTab("bitacora")} icon={FileText}>
          Bitácora
        </TabButton>
      </div>

      {tab === "usuarios" && (
        <UsersTab
          users={users}
          hotels={hotels}
          regions={regions}
          canManageUsers={canManageUsers}
        />
      )}
      {tab === "roles" && <RolesTab permissions={permissions} />}
      {tab === "bitacora" && <AuditTab logs={auditLogs} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-amber-500 text-imperial-900"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function UsersTab({
  users,
  hotels,
  regions,
  canManageUsers,
}: {
  users: UserWithScopes[];
  hotels: { id: string; nombre: string }[];
  regions: { id: string; nombre: string }[];
  canManageUsers: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editingScopes, setEditingScopes] = useState<string | null>(null);
  const [selectedHotels, setSelectedHotels] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  return (
    <div className="glass overflow-hidden rounded-xl border border-slate-200/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase text-slate-500">
            <th className="px-4 py-3">Usuario</th>
            <th className="px-4 py-3">Rol</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Alcance</th>
            {canManageUsers && <th className="px-4 py-3">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-slate-100">
              <td className="px-4 py-3">
                <p className="font-medium text-imperial-900">
                  {u.nombre} {u.apellido ?? ""}
                </p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </td>
              <td className="px-4 py-3">
                {u.roles[0] ? (
                  <RoleBadge role={u.roles[0]} variant="light" />
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    u.activo
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {u.activo ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-slate-600">
                {u.hotel_ids.length} hoteles · {u.region_ids.length} regiones
              </td>
              {canManageUsers && (
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                      value={u.roles[0] ?? ""}
                      disabled={pending}
                      onChange={(e) =>
                        startTransition(() =>
                          assignRoleAction(u.id, e.target.value as AppRole)
                        )
                      }
                    >
                      <option value="">Sin rol</option>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(() =>
                          toggleUserActiveAction(u.id, !u.activo)
                        )
                      }
                      className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                    >
                      {u.activo ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      type="button"
                      className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800"
                      onClick={() => {
                        setEditingScopes(u.id);
                        setSelectedHotels(u.hotel_ids);
                        setSelectedRegions(u.region_ids);
                      }}
                    >
                      Alcance
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {editingScopes && canManageUsers && (
        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-medium">Asignar alcance geográfico</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-slate-500">Hoteles</p>
              <select
                multiple
                className="h-24 w-full rounded border border-slate-200 text-sm"
                value={selectedHotels}
                onChange={(e) =>
                  setSelectedHotels(
                    Array.from(e.target.selectedOptions, (o) => o.value)
                  )
                }
              >
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-1 text-xs text-slate-500">Regiones</p>
              <select
                multiple
                className="h-24 w-full rounded border border-slate-200 text-sm"
                value={selectedRegions}
                onChange={(e) =>
                  setSelectedRegions(
                    Array.from(e.target.selectedOptions, (o) => o.value)
                  )
                }
              >
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await setScopesAction(
                    editingScopes,
                    selectedHotels,
                    selectedRegions
                  );
                  setEditingScopes(null);
                })
              }
              className="rounded-lg bg-imperial-900 px-4 py-2 text-sm text-white"
            >
              Guardar alcance
            </button>
            <button
              type="button"
              onClick={() => setEditingScopes(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RolesTab({ permissions }: { permissions: PermissionRow[] }) {
  const byModule = permissions.reduce(
    (acc, p) => {
      if (!acc[p.modulo]) acc[p.modulo] = [];
      acc[p.modulo].push(p);
      return acc;
    },
    {} as Record<string, PermissionRow[]>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Matriz de permisos por módulo. La asignación rol-permiso se gestiona en
        base de datos (seed inicial).
      </p>
      {Object.entries(byModule).map(([modulo, perms]) => (
        <div key={modulo} className="glass rounded-xl border border-slate-200/60 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium uppercase text-slate-500">
            <Shield className="h-4 w-4" />
            {modulo}
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {perms.map((p) => (
              <li
                key={p.codigo}
                className="rounded-lg bg-slate-50 px-3 py-2 text-sm"
              >
                <code className="text-xs text-amber-700">{p.codigo}</code>
                <p className="text-slate-600">{p.descripcion}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function AuditTab({ logs: initialLogs }: { logs: AuditLogRow[] }) {
  const [logs, setLogs] = useState(initialLogs);
  const [entidad, setEntidad] = useState("");
  const [usuarioEmail, setUsuarioEmail] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [pending, startTransition] = useTransition();

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const filtered = await filterAuditLogsAction({
        entidad: entidad || undefined,
        usuarioEmail: usuarioEmail || undefined,
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
      });
      setLogs(filtered);
    });
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleFilter}
        className="glass grid gap-2 rounded-xl border border-slate-200/60 p-4 sm:grid-cols-4"
      >
        <input
          value={entidad}
          onChange={(e) => setEntidad(e.target.value)}
          placeholder="Entidad (kpis, metas…)"
          className="rounded border px-2 py-1 text-sm"
        />
        <input
          value={usuarioEmail}
          onChange={(e) => setUsuarioEmail(e.target.value)}
          placeholder="Usuario (email)"
          className="rounded border px-2 py-1 text-sm"
        />
        <input
          type="date"
          value={fechaDesde}
          onChange={(e) => setFechaDesde(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
        />
        <input
          type="date"
          value={fechaHasta}
          onChange={(e) => setFechaHasta(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-imperial-900 px-3 py-1 text-sm text-white sm:col-span-4"
        >
          {pending ? "Filtrando…" : "Filtrar bitácora"}
        </button>
      </form>

      <div className="glass overflow-x-auto rounded-xl border border-slate-200/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase text-slate-500">
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Usuario</th>
            <th className="px-4 py-3">Acción</th>
            <th className="px-4 py-3">Entidad</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-slate-100">
              <td className="px-4 py-3 text-slate-600">
                {log.fecha} {String(log.hora).slice(0, 5)}
              </td>
              <td className="px-4 py-3">{log.usuario_email ?? "—"}</td>
              <td className="px-4 py-3 capitalize">{log.accion}</td>
              <td className="px-4 py-3">
                {log.entidad}
                {log.entidad_id && (
                  <span className="ml-1 font-mono text-xs text-slate-400">
                    {log.entidad_id.slice(0, 8)}…
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
