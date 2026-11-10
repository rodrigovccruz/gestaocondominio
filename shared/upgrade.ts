/**
 * Converte o formato antigo (cobranças com tarifa por m³, rateio configurável,
 * frações) para o modelo atual. Estados já no formato atual passam intactos.
 */
export function upgradeState(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const raw = value as Record<string, unknown>;
  const rawMonths = Array.isArray(raw.months) ? raw.months : [];
  const isLegacy = rawMonths.some(
    m => m && typeof m === "object" && "charges" in (m as object)
  );
  if (!isLegacy && "openingBalanceCents" in raw) return value;

  type LegacyCharge = {
    unitId: string;
    waterPrevious: number;
    waterCurrent: number;
    gasPrevious: number;
    gasCurrent: number;
    paidCents?: number;
  };
  type LegacyMonth = {
    id: string;
    competence: string;
    status: "open" | "closed";
    openingBalanceCents?: number;
    charges?: LegacyCharge[];
    expenses?: {
      id: string;
      description: string;
      category: string;
      amountCents: number;
    }[];
  };
  const months = rawMonths as LegacyMonth[];
  const first = [...months].sort((a, b) =>
    String(a.competence).localeCompare(String(b.competence))
  )[0];

  return {
    name: raw.name,
    openingBalanceCents:
      typeof raw.openingBalanceCents === "number"
        ? raw.openingBalanceCents
        : (first?.openingBalanceCents ?? 0),
    units: raw.units,
    months: months.map(m =>
      "charges" in m
        ? {
            id: m.id,
            competence: m.competence,
            status: m.status,
            readings: (m.charges ?? []).map(c => ({
              unitId: c.unitId,
              waterPrevious: c.waterPrevious,
              waterCurrent: c.waterCurrent,
              gasPrevious: c.gasPrevious,
              gasCurrent: c.gasCurrent,
            })),
            expenses: (m.expenses ?? []).map(e => ({
              id: e.id,
              description: e.description,
              category: e.category,
              amountCents: e.amountCents,
            })),
            payments: (m.charges ?? [])
              .filter(c => (c.paidCents ?? 0) > 0)
              .map(c => ({ unitId: c.unitId, amountCents: c.paidCents })),
            bankBalanceCents: null,
          }
        : m
    ),
  };
}
