export interface MeasurementUnitOption {
  value: string;
  label: string;
}

export interface MeasurementUnitSection {
  id: string;
  label: string;
  units: MeasurementUnitOption[];
}

/** Catálogo de unidades de medida disponibles en el sistema. */
export const MEASUREMENT_UNIT_SECTIONS: MeasurementUnitSection[] = [
  {
    id: "porcentaje",
    label: "Porcentaje",
    units: [{ value: "%", label: "Porcentaje (%)" }],
  },
  {
    id: "monetario",
    label: "Monetario",
    units: [
      { value: "COP", label: "Peso colombiano (COP)" },
      { value: "USD", label: "Dólar estadounidense (USD)" },
      { value: "EUR", label: "Euro (EUR)" },
    ],
  },
  {
    id: "cantidad",
    label: "Cantidad",
    units: [
      { value: "unidades", label: "Unidades" },
      { value: "pts", label: "Puntos (pts)" },
      { value: "reservas", label: "Reservas" },
      { value: "habitaciones", label: "Habitaciones" },
      { value: "huéspedes", label: "Huéspedes" },
    ],
  },
  {
    id: "tiempo",
    label: "Tiempo",
    units: [
      { value: "min", label: "Minutos (min)" },
      { value: "h", label: "Horas (h)" },
      { value: "días", label: "Días" },
    ],
  },
  {
    id: "ratio",
    label: "Ratio e índice",
    units: [
      { value: "ratio", label: "Ratio" },
      { value: "índice", label: "Índice" },
    ],
  },
];

export const ALL_MEASUREMENT_UNITS = MEASUREMENT_UNIT_SECTIONS.flatMap((section) =>
  section.units.map((unit) => unit.value)
);

export function isKnownMeasurementUnit(value: string): boolean {
  return ALL_MEASUREMENT_UNITS.includes(value);
}
