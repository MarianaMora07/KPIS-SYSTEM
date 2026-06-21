import {
  ALL_MEASUREMENT_UNITS,
  MEASUREMENT_UNIT_SECTIONS,
} from "@/lib/kpis/measurement-units";

interface FormUnitSelectProps {
  label: string;
  name: string;
  required?: boolean;
  optional?: boolean;
  defaultValue?: string | null;
  placeholder?: string;
}

export function FormUnitSelect({
  label,
  name,
  required = false,
  optional = false,
  defaultValue,
  placeholder = "Seleccione unidad",
}: FormUnitSelectProps) {
  const resolved = defaultValue ?? "";
  const isCustom = resolved !== "" && !ALL_MEASUREMENT_UNITS.includes(resolved);

  return (
    <div>
      <label className="form-label">{label}</label>
      <select
        name={name}
        required={required && !optional}
        defaultValue={resolved}
        className="form-input"
      >
        {optional ? (
          <option value="">{placeholder}</option>
        ) : (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {MEASUREMENT_UNIT_SECTIONS.map((section) => (
          <optgroup key={section.id} label={section.label}>
            {section.units.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </optgroup>
        ))}
        {isCustom && (
          <optgroup label="Valor registrado">
            <option value={resolved}>{resolved}</option>
          </optgroup>
        )}
      </select>
    </div>
  );
}
