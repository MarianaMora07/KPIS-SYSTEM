"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/cn";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  loading?: boolean;
  confirmDisabled?: boolean;
  showCancel?: boolean;
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  loading = false,
  confirmDisabled = false,
  showCancel = true,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  const Icon = variant === "default" ? Info : AlertTriangle;
  const iconStyles = {
    danger: "bg-red-100 text-red-600",
    warning: "bg-amber-100 text-amber-600",
    default: "bg-indigo-100 text-indigo-600",
  };
  const confirmStyles = {
    danger: "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500/30",
    warning: "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500/30",
    default: "bg-imperial-900 hover:bg-imperial-800 focus-visible:ring-imperial-500/30",
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.button
            type="button"
            aria-label="Cerrar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-imperial-900/50 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby={description ? "confirm-desc" : undefined}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "relative z-10 w-full max-w-md rounded-2xl border border-slate-200/80",
              "bg-white p-6 shadow-xl shadow-slate-300/40",
              children ? "max-w-lg" : undefined
            )}
          >
            <div className="flex gap-4">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  iconStyles[variant]
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="confirm-title" className="text-base font-semibold text-imperial-900">
                  {title}
                </h2>
                {description && (
                  <p id="confirm-desc" className="mt-1.5 text-sm text-slate-600">
                    {description}
                  </p>
                )}
                {children}
              </div>
            </div>

            <div className={cn("mt-6 flex gap-3", showCancel ? "justify-end" : "justify-center")}>
              {showCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={loading}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  {cancelLabel}
                </button>
              )}
              <button
                ref={confirmRef}
                type="button"
                onClick={onConfirm}
                disabled={loading || confirmDisabled}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2",
                  confirmStyles[variant],
                  loading && "opacity-60"
                )}
              >
                {loading ? "Procesando…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
