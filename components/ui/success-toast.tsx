"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

interface SuccessToastContextValue {
  showSuccess: (message: string) => void;
}

const SuccessToastContext = createContext<SuccessToastContextValue>({
  showSuccess: () => {},
});

export const SUCCESS_MESSAGES = {
  created: "Creado con éxito",
  updated: "Modificado con éxito",
  deleted: "Eliminado con éxito",
} as const;

export function SuccessToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const showSuccess = useCallback((msg: string) => {
    setMessage(msg);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <SuccessToastContext.Provider value={{ showSuccess }}>
      {children}
      <AnimatePresence>
        {message && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-[80] flex max-w-sm items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800 shadow-lg shadow-green-900/10"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
            <span>{message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </SuccessToastContext.Provider>
  );
}

export function useSuccessToast() {
  return useContext(SuccessToastContext);
}
