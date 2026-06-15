export default function ImportPage() {
  return (
    <div className="glass rounded-xl border border-slate-200/60 p-8">
      <p className="text-sm text-slate-600">
        Importación asíncrona de archivos XLSX y CSV. La API responde con estado
        &quot;Procesando...&quot; mientras el job se ejecuta en segundo plano.
      </p>
      <p className="mt-4 text-xs text-slate-400">
        Servicio: <code className="text-amber-600">modules/import</code>
      </p>
    </div>
  );
}
