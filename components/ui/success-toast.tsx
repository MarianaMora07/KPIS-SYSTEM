"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";

const SIMPLE_TOAST_MS = 7000;
const GUIDED_AUTO_DISMISS_MS = 30000;

export const SUCCESS_MESSAGES = {
  created: "Creado con éxito",
  updated: "Modificado con éxito",
  deleted: "Eliminado con éxito",
} as const;

export const GUIDED_SUCCESS = {
  kpiCreated: {
    title: "KPI creado con éxito",
    message: "El indicador ya está disponible en el catálogo.",
    instructions: [
      "Configure metas por periodo en la pestaña Metas y semáforo.",
      "Defina o valide la fórmula si el indicador es calculado.",
      "Registre el primer valor o importe datos desde Excel o SQL.",
    ],
  },
  kpiDuplicated: {
    title: "KPI duplicado con éxito",
    message: "Se creó una copia del indicador con su configuración base.",
    instructions: [
      "Revise nombre, código y alcance antes de publicar el indicador.",
      "Ajuste metas y fórmula según el nuevo indicador.",
    ],
  },
  formulaValidated: {
    title: "Fórmula validada y guardada",
    message: "La expresión es válida y quedó asociada al indicador.",
    instructions: [
      "Use Registrar valor para ingresar las variables y calcular el KPI.",
      "Los registros anteriores no se recalculan automáticamente.",
    ],
  },
  valueRegistered: {
    title: "Valor registrado con éxito",
    message: "El dato quedó guardado y alimentará el seguimiento del indicador.",
    instructions: [
      "Revise la pestaña Seguimiento para ver el cumplimiento.",
      "Configure o ajuste metas si aún no hay una para este periodo.",
    ],
  },
  variableCreated: {
    title: "Variable creada con éxito",
    message: "La variable ya está disponible en el catálogo de fórmulas.",
    instructions: [
      "Selecciónela al configurar la fórmula de un indicador.",
      "Use códigos cortos y únicos para evitar conflictos.",
    ],
  },
  targetCreated: {
    title: "Meta creada con éxito",
    message: "La meta quedó configurada para el periodo indicado.",
    instructions: [
      "Registre valores del KPI para medir el cumplimiento.",
      "Revise el semáforo en dashboard o en el detalle del indicador.",
    ],
  },
  regionCreated: {
    title: "Región creada con éxito",
    message: "La región ya forma parte del catálogo organizacional.",
    instructions: [
      "Asigne hoteles a esta región desde el catálogo.",
      "Use la región al filtrar reportes y dashboards.",
    ],
  },
  hotelCreated: {
    title: "Hotel creado con éxito",
    message: "El hotel quedó registrado en el catálogo.",
    instructions: [
      "Asigne usuarios con alcance a este hotel en Seguridad.",
      "Configure KPIs y metas con el hotel como desglose.",
    ],
  },
  scheduledReportCreated: {
    title: "Reporte programado con éxito",
    message: "El envío automático quedó configurado.",
    instructions: [
      "Verifique destinatarios y frecuencia en el panel de reportes.",
      "El cron ejecutará el envío según la programación definida.",
    ],
  },
  integrationCreated: {
    title: "Integración creada con éxito",
    message: "La conexión externa quedó registrada en el sistema.",
    instructions: [
      "Ejecute una sincronización manual para validar la conexión.",
      "Revise el historial de jobs si la carga falla o queda pendiente.",
    ],
  },
} as const;

export interface GuidedSuccessOptions {
  title: string;
  message: string;
  instructions?: readonly string[];
  autoDismissMs?: number;
}

interface SimpleToast {
  kind: "simple";
  message: string;
}

interface GuidedToast extends GuidedSuccessOptions {
  kind: "guided";
}

type ActiveToast = SimpleToast | GuidedToast;

interface SuccessToastContextValue {
  showSuccess: (message: string) => void;
  showGuidedSuccess: (options: GuidedSuccessOptions) => void;
  dismiss: () => void;
}

const SuccessToastContext = createContext<SuccessToastContextValue>({
  showSuccess: () => {},
  showGuidedSuccess: () => {},
  dismiss: () => {},
});

function GuidedSuccessOverlay({
  toast,
  onDismiss,
}: {
  toast: GuidedToast;
  onDismiss: () => void;
}) {
  const autoDismissMs = toast.autoDismissMs ?? GUIDED_AUTO_DISMISS_MS;
  const [secondsLeft, setSecondsLeft] = useState(
    Math.ceil(autoDismissMs / 1000)
  );

  useEffect(() => {
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, Math.ceil((autoDismissMs - elapsed) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) onDismiss();
    }, 250);
    return () => window.clearInterval(interval);
  }, [autoDismissMs, onDismiss]);

  return (
    <motion.div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="guided-success-title"
      aria-describedby="guided-success-message"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-imperial-900/40 p-4 backdrop-blur-[2px]"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-lg rounded-2xl border border-green-200 bg-white p-6 shadow-2xl shadow-green-900/10"
      >
        <button
          type="button"
          aria-label="Cerrar aviso"
          onClick={onDismiss}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-100">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="guided-success-title"
              className="text-lg font-semibold text-imperial-900"
            >
              {toast.title}
            </h2>
            <p id="guided-success-message" className="mt-1 text-sm text-slate-600">
              {toast.message}
            </p>
          </div>
        </div>

        {toast.instructions && toast.instructions.length > 0 && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Qué hacer ahora
            </p>
            <ul className="mt-2 space-y-2">
              {toast.instructions.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm text-slate-700"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            Se cerrará automáticamente en {secondsLeft}s
          </p>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg bg-imperial-900 px-4 py-2 text-sm font-medium text-white hover:bg-imperial-800"
          >
            Entendido
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function SuccessToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ActiveToast | null>(null);

  const dismiss = useCallback(() => setToast(null), []);

  const showSuccess = useCallback((message: string) => {
    setToast({ kind: "simple", message });
  }, []);

  const showGuidedSuccess = useCallback((options: GuidedSuccessOptions) => {
    setToast({ kind: "guided", ...options });
  }, []);

  useEffect(() => {
    if (!toast || toast.kind !== "simple") return;
    const timer = window.setTimeout(dismiss, SIMPLE_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast, dismiss]);

  useEffect(() => {
    if (!toast || toast.kind !== "guided") return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toast, dismiss]);

  return (
    <SuccessToastContext.Provider value={{ showSuccess, showGuidedSuccess, dismiss }}>
      {children}
      <AnimatePresence>
        {toast?.kind === "simple" && (
          <motion.div
            key="simple-toast"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-[80] flex max-w-sm items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800 shadow-lg shadow-green-900/10"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div className="min-w-0 flex-1">
              <span>{toast.message}</span>
              <button
                type="button"
                aria-label="Cerrar aviso"
                onClick={dismiss}
                className="mt-1 block text-xs font-normal text-green-700 underline hover:text-green-900"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        )}
        {toast?.kind === "guided" && (
          <GuidedSuccessOverlay key="guided-toast" toast={toast} onDismiss={dismiss} />
        )}
      </AnimatePresence>
    </SuccessToastContext.Provider>
  );
}

export function useSuccessToast() {
  return useContext(SuccessToastContext);
}
