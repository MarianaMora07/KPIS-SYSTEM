"use client";

import { X } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg";
}

export function FormModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "lg",
}: FormModalProps) {
  if (!open) return null;

  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-imperial-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={cn(
          "relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-2xl",
          "border border-indigo-200/60 bg-gradient-to-br from-white via-indigo-50/30 to-purple-50/40",
          "shadow-2xl shadow-indigo-500/10",
          widths[maxWidth]
        )}
      >
        <div className="sticky top-0 z-10 border-b border-indigo-100/80 bg-gradient-to-r from-indigo-600/10 via-purple-600/10 to-pink-600/10 px-6 py-4 backdrop-blur-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-imperial-900">{title}</h2>
              {subtitle && (
                <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/80 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  name?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  step?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  children?: React.ReactNode;
}

export function FormField({
  label,
  name,
  required,
  type = "text",
  placeholder,
  step,
  value,
  defaultValue,
  onChange,
  children,
}: FormFieldProps) {
  return (
    <div>
      <label className="form-label">{label}</label>
      {children ?? (
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          step={step}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          className="form-input"
        />
      )}
    </div>
  );
}

export function FormSelect({
  label,
  name,
  required,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  options: { id: string; nombre: string }[];
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <select
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="form-input"
      >
        {options.map((o) => (
          <option key={o.id || "empty"} value={o.id}>
            {o.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FormActions({
  onCancel,
  submitLabel,
  pending,
  pendingLabel = "Guardando...",
  showCancel = true,
}: {
  onCancel?: () => void;
  submitLabel: string;
  pending?: boolean;
  pendingLabel?: string;
  showCancel?: boolean;
}) {
  return (
    <div className="flex gap-3 border-t border-indigo-100/80 pt-4">
      <button
        type="submit"
        disabled={pending}
        className="btn-gradient flex-1 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
      {showCancel && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 bg-white/80 px-5 py-2.5 text-sm text-slate-600 transition-colors hover:border-slate-300 hover:bg-white"
        >
          Cancelar
        </button>
      )}
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
      {message}
    </p>
  );
}

export function FormPrimaryButton({
  children,
  onClick,
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="btn-gradient inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function FormSecondaryButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white/80 px-5 py-2.5 text-sm font-medium text-indigo-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50"
    >
      {children}
    </button>
  );
}
