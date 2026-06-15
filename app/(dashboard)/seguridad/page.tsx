export default function SeguridadPage() {
  return (
    <div className="glass rounded-xl border border-slate-200/60 p-8">
      <p className="text-sm text-slate-600">
        Gestión de roles (Administrador, Director Comercial, Director Mercadeo,
        Gerente Hotel, Analista, Consulta), restricción por hotel/región y
        consulta de bitácora de auditoría inmutable.
      </p>
      <p className="mt-4 text-xs text-slate-400">
        Servicio: <code className="text-amber-600">modules/seguridad</code>
      </p>
    </div>
  );
}
