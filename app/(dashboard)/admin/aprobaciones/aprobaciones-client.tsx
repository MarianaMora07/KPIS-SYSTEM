"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  X,
  Eye,
  Clock,
  User,
  Building2,
  FileText,
  Calculator,
  Calendar,
  AlertCircle,
  MessageSquare,
  CheckCircle,
  Shield,
  UserCheck,
  UserX,
} from "lucide-react";
import { processApprovalRequest } from "@/modules/kpis/actions/kpi-actions";
import { cn } from "@/lib/utils/cn";
import { useSuccessToast } from "@/components/ui/success-toast";

type ApproverRole =
  | "administrador"
  | "director_comercial"
  | "director_mercadeo"
  | "gerente_hotel"
  | "analista";

interface Gerente {
  nombre: string;
  apellido: string;
  email: string;
}

interface RequestRow {
  id: string;
  kpi_id: string | null;
  solicitante_id: string;
  aprobador_id: string | null;
  hotel_id: string;
  tipo: "creacion" | "edicion" | "medicion";
  estado: "pendiente" | "aprobado" | "rechazado";
  datos_propuestos: any;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
  solicitante: { nombre: string; apellido: string; email: string } | null;
  aprobador: { nombre: string; apellido: string; email: string } | null;
  hotel: { nombre: string } | null;
  kpi: { nombre: string; codigo: string } | null;
}

interface AprobacionesClientProps {
  initialRequests: RequestRow[];
  userRole: ApproverRole;
  /** Nombre del hotel del gerente (solo si userRole === "gerente_hotel") */
  gerenteHotelNombre: string | null;
  /** Mapa hotel_id → lista de gerentes responsables (solo para admins/directores) */
  gerentesMap: Record<string, Gerente[]>;
}

export function AprobacionesClient({
  initialRequests,
  userRole,
  gerenteHotelNombre,
  gerentesMap,
}: AprobacionesClientProps) {
  const router = useRouter();
  const { showSuccess } = useSuccessToast();
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [selectedRequest, setSelectedRequest] = useState<RequestRow | null>(null);
  const [obsText, setObsText] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);

  const isGlobalApprover = ["administrador", "director_comercial", "director_mercadeo"].includes(userRole);
  const isGerente = userRole === "gerente_hotel";
  const isAnalista = userRole === "analista";

  const pendingRequests = initialRequests.filter((r) => r.estado === "pendiente");
  const historyRequests = initialRequests.filter((r) => r.estado !== "pendiente");

  const displayRequests = activeTab === "pending" ? pendingRequests : historyRequests;

  const actionLabels: Record<string, string> = {
    creacion: "Creación de KPI",
    edicion: "Edición de KPI",
    medicion: "Registro de Medición",
  };

  const statusLabels: Record<string, string> = {
    pendiente: "Pendiente",
    aprobado: "Aprobado",
    rechazado: "Rechazado",
  };

  function handleOpenDetails(req: RequestRow) {
    setSelectedRequest(req);
    setObsText("");
    setShowRejectForm(false);
    setLocalError(null);
  }

  function handleCloseDetails() {
    setSelectedRequest(null);
    setObsText("");
    setShowRejectForm(false);
    setLocalError(null);
  }

  function handleProcess(action: "aprobar" | "rechazar") {
    if (!selectedRequest) return;
    if (action === "rechazar" && !obsText.trim()) {
      setLocalError("Las observaciones son obligatorias para rechazar una solicitud.");
      return;
    }

    setLocalError(null);
    startTransition(async () => {
      try {
        await processApprovalRequest(selectedRequest.id, action, obsText);
        showSuccess(
          action === "aprobar"
            ? "Solicitud aprobada con éxito."
            : "Solicitud rechazada con éxito."
        );
        handleCloseDetails();
        router.refresh();
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "Error al procesar la solicitud");
      }
    });
  }

  // Encabezado dinámico según rol
  const pageTitle = isAnalista
    ? "Mis Solicitudes de Aprobación"
    : isGerente
    ? `Bandeja de Aprobaciones${gerenteHotelNombre ? ` — ${gerenteHotelNombre}` : ""}`
    : "Supervisión Global de Aprobaciones";

  const pageSubtitle = isAnalista
    ? "Consulta el estado y retroalimentación de las solicitudes que has creado."
    : isGerente
    ? "Solicitudes de los analistas de tu hotel pendientes de tu aprobación."
    : "Revisa todas las solicitudes de aprobación de KPIs de todos los hoteles.";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            isGerente ? "bg-emerald-100 text-emerald-700" : "bg-imperial-100 text-imperial-900"
          )}
        >
          {isGerente ? <UserCheck className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{pageTitle}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{pageSubtitle}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("pending")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-semibold transition-all",
            activeTab === "pending"
              ? "border-imperial-900 text-imperial-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <Clock className="h-4 w-4" />
          Pendientes ({pendingRequests.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-semibold transition-all",
            activeTab === "history"
              ? "border-imperial-900 text-imperial-900"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <CheckCircle className="h-4 w-4" />
          Historial ({historyRequests.length})
        </button>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {displayRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Eye className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No hay solicitudes
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {activeTab === "pending"
                ? isAnalista
                  ? "No tienes solicitudes de aprobación pendientes."
                  : isGerente
                  ? "No hay solicitudes pendientes en tu hotel."
                  : "No hay solicitudes de aprobación pendientes."
                : "No se han procesado solicitudes de aprobación todavía."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4">Hotel de Origen</th>
                  <th className="px-6 py-4">Tipo de Acción</th>
                  <th className="px-6 py-4">Solicitante</th>
                  {/* Columna "Gerente Responsable" solo visible para admins/directores */}
                  {isGlobalApprover && activeTab === "pending" && (
                    <th className="px-6 py-4">
                      <span className="flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5" />
                        Gerente Responsable
                      </span>
                    </th>
                  )}
                  <th className="px-6 py-4">Fecha</th>
                  {activeTab === "history" && <th className="px-6 py-4">Estado</th>}
                  <th className="px-6 py-4 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayRequests.map((req) => {
                  const responsibleManagers = isGlobalApprover
                    ? (gerentesMap[req.hotel_id] ?? [])
                    : [];

                  return (
                    <tr key={req.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-400" />
                          {req.hotel?.nombre || "Global / Sin hotel"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                            req.tipo === "creacion" && "bg-blue-50 text-blue-700 border border-blue-100",
                            req.tipo === "edicion" && "bg-amber-50 text-amber-700 border border-amber-100",
                            req.tipo === "medicion" && "bg-purple-50 text-purple-700 border border-purple-100"
                          )}
                        >
                          {actionLabels[req.tipo]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">
                            {req.solicitante
                              ? `${req.solicitante.nombre} ${req.solicitante.apellido}`
                              : "Usuario"}
                          </span>
                          <span className="text-xs text-slate-500">
                            {req.solicitante?.email}
                          </span>
                        </div>
                      </td>

                      {/* Celda Gerente Responsable — solo para admins/directores en tab pendientes */}
                      {isGlobalApprover && activeTab === "pending" && (
                        <td className="px-6 py-4">
                          {responsibleManagers.length === 0 ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                              <UserX className="h-3 w-3" />
                              Sin gerente asignado
                            </span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {responsibleManagers.map((g) => (
                                <div key={g.email} className="flex flex-col">
                                  <span className="text-xs font-semibold text-slate-800">
                                    {g.nombre} {g.apellido}
                                  </span>
                                  <span className="text-xs text-slate-400">{g.email}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      )}

                      <td className="px-6 py-4 text-slate-500">
                        {new Date(req.created_at).toLocaleString("es-ES", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      {activeTab === "history" && (
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                              req.estado === "aprobado" && "bg-green-50 text-green-700 border border-green-100",
                              req.estado === "rechazado" && "bg-red-50 text-red-700 border border-red-100"
                            )}
                          >
                            {statusLabels[req.estado]}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenDetails(req)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-imperial-900 group-hover:border-slate-300"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Side Drawer/Modal Overlay */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-[2px]">
          {/* Backdrop Closer */}
          <div className="absolute inset-0" onClick={handleCloseDetails} />

          {/* Panel */}
          <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-imperial-900">
                  Detalles de la Solicitud
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ID: {selectedRequest.id.substring(0, 8)}...
                </p>
              </div>
              <button
                onClick={handleCloseDetails}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {localError && (
                <div className="flex gap-2 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                  <div>{localError}</div>
                </div>
              )}

              {/* Basic metadata cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Hotel
                  </span>
                  <span className="mt-1 font-medium text-slate-900 flex items-center gap-1.5 text-sm">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    {selectedRequest.hotel?.nombre || "Global"}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Acción
                  </span>
                  <span className="mt-1 font-medium text-slate-900 flex items-center gap-1.5 text-sm">
                    <FileText className="h-4 w-4 text-slate-400" />
                    {actionLabels[selectedRequest.tipo]}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 col-span-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Solicitante
                  </span>
                  <span className="mt-1 font-medium text-slate-900 flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-slate-400" />
                    {selectedRequest.solicitante
                      ? `${selectedRequest.solicitante.nombre} ${selectedRequest.solicitante.apellido} (${selectedRequest.solicitante.email})`
                      : "Usuario"}
                  </span>
                </div>

                {/* Gerente Responsable en el panel de detalle — solo para admins/directores */}
                {isGlobalApprover && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 col-span-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                      Gerente(s) Responsable(s)
                    </span>
                    {(gerentesMap[selectedRequest.hotel_id] ?? []).length === 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-sm text-red-600 font-medium">
                        <UserX className="h-4 w-4" />
                        Sin gerente asignado a este hotel
                      </span>
                    ) : (
                      <div className="space-y-2">
                        {(gerentesMap[selectedRequest.hotel_id] ?? []).map((g) => (
                          <div key={g.email} className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                            <div>
                              <span className="text-sm font-medium text-slate-900">
                                {g.nombre} {g.apellido}
                              </span>
                              <span className="ml-1.5 text-xs text-slate-500">({g.email})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* proposed payload display */}
              <div className="border-t border-slate-200 pt-6">
                <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Calculator className="h-4.5 w-4.5 text-slate-500" />
                  Datos Propuestos
                </h4>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4 space-y-4">
                  {selectedRequest.tipo === "medicion" ? (
                    // Measurement payload display
                    <div className="space-y-3">
                      <div className="flex justify-between border-b border-slate-200/50 pb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase">
                          KPI Relacionado:
                        </span>
                        <span className="text-sm font-medium text-slate-900">
                          {selectedRequest.kpi?.nombre} ({selectedRequest.kpi?.codigo})
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/50 pb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase">
                          Fecha de Medición:
                        </span>
                        <span className="text-sm font-medium text-slate-900 flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {selectedRequest.datos_propuestos.fecha}
                        </span>
                      </div>

                      {selectedRequest.datos_propuestos.variable_inputs &&
                      Object.keys(selectedRequest.datos_propuestos.variable_inputs).length > 0 ? (
                        <div className="pt-2">
                          <span className="text-xs font-semibold text-slate-500 uppercase block mb-2">
                            Variables de la Fórmula:
                          </span>
                          <div className="grid gap-2 grid-cols-2">
                            {Object.entries(selectedRequest.datos_propuestos.variable_inputs).map(
                              ([code, val]) => (
                                <div
                                  key={code}
                                  className="flex justify-between rounded-lg bg-white border border-slate-100 px-3 py-1.5 text-xs shadow-sm"
                                >
                                  <span className="font-medium text-slate-500">{code}:</span>
                                  <span className="font-semibold text-slate-900">
                                    {Number(val).toLocaleString()}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between">
                          <span className="text-xs font-semibold text-slate-500 uppercase">
                            Valor Real:
                          </span>
                          <span className="text-sm font-bold text-slate-950">
                            {Number(selectedRequest.datos_propuestos.valor_real).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    // KPI definition payload display (creation or edition)
                    <div className="space-y-3">
                      <div className="flex justify-between border-b border-slate-200/50 pb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase">
                          Nombre del KPI:
                        </span>
                        <span className="text-sm font-semibold text-slate-900">
                          {selectedRequest.datos_propuestos.nombre}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/50 pb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase">
                          Código:
                        </span>
                        <span className="text-sm font-mono font-medium text-imperial-900">
                          {selectedRequest.datos_propuestos.codigo}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/50 pb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase">
                          Área Responsable:
                        </span>
                        <span className="text-sm font-medium text-slate-900">
                          {selectedRequest.datos_propuestos.area_responsable}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/50 pb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase">
                          Frecuencia / Unidad:
                        </span>
                        <span className="text-sm font-medium text-slate-900">
                          {selectedRequest.datos_propuestos.frecuencia} /{" "}
                          {selectedRequest.datos_propuestos.unidad_medida}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/50 pb-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase">
                          Meta Fija:
                        </span>
                        <span className="text-sm font-medium text-slate-900">
                          {selectedRequest.datos_propuestos.meta != null
                            ? selectedRequest.datos_propuestos.meta
                            : "N/A"}
                        </span>
                      </div>
                      {selectedRequest.datos_propuestos.formula && (
                        <div className="pt-2">
                          <span className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                            Fórmula Propuesta:
                          </span>
                          <span className="text-xs font-mono block rounded-lg border border-slate-200 bg-white p-2.5 text-imperial-950 font-semibold shadow-inner">
                            {selectedRequest.datos_propuestos.formula}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* processed request meta if history */}
              {selectedRequest.estado !== "pendiente" && (
                <div className="border-t border-slate-200 pt-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-semibold text-slate-900">
                      Resultado de Revisión
                    </h4>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
                        selectedRequest.estado === "aprobado" && "bg-green-50 text-green-700 border border-green-100",
                        selectedRequest.estado === "rechazado" && "bg-red-50 text-red-700 border border-red-100"
                      )}
                    >
                      {statusLabels[selectedRequest.estado]}
                    </span>
                  </div>
                  {selectedRequest.aprobador && (
                    <p className="text-xs text-slate-600">
                      Procesado por:{" "}
                      <span className="font-semibold text-slate-800">
                        {selectedRequest.aprobador.nombre} {selectedRequest.aprobador.apellido}
                      </span>{" "}
                      ({selectedRequest.aprobador.email})
                    </p>
                  )}
                  {selectedRequest.observaciones && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Observaciones / Retroalimentación
                      </span>
                      <p className="text-sm text-slate-700 italic">
                        "{selectedRequest.observaciones}"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Buttons — visibles solo si la solicitud está pendiente Y el rol no es analista */}
            {selectedRequest.estado === "pendiente" && userRole !== "analista" && (
              <div className="border-t border-slate-200 bg-slate-50/50 p-6 space-y-4">
                {showRejectForm ? (
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                      <MessageSquare className="h-4 w-4 text-slate-500" />
                      Observaciones de Rechazo *
                    </label>
                    <textarea
                      value={obsText}
                      onChange={(e) => setObsText(e.target.value)}
                      placeholder="Ingrese el motivo del rechazo para dar retroalimentación al hotel de origen..."
                      className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                      rows={3}
                      disabled={pending}
                    />
                    <div className="flex justify-end gap-3 pt-1">
                      <button
                        onClick={() => setShowRejectForm(false)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                        disabled={pending}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleProcess("rechazar")}
                        className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                        disabled={pending || !obsText.trim()}
                      >
                        Confirmar Rechazo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-4">
                    <button
                      onClick={() => setShowRejectForm(true)}
                      className="flex-1 rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-100 hover:text-red-800 disabled:opacity-50"
                      disabled={pending}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <X className="h-4 w-4" />
                        Rechazar
                      </div>
                    </button>
                    <button
                      onClick={() => handleProcess("aprobar")}
                      className="flex-1 rounded-xl bg-imperial-900 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-imperial-800 disabled:opacity-50"
                      disabled={pending}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Check className="h-4 w-4" />
                        Aprobar y Publicar
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
