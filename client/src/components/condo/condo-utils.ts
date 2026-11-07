import {
  calculateCharge,
  calculateMonth,
  emptyCharge,
  formatMoney,
  formatMonth,
  formatReading,
  initialState,
  resolveChargeUnit,
  type Charge,
  type CondoState,
  type Expense,
  type Month,
  type Unit,
} from "@shared/condo";
export type CondoResponse = {
  state: CondoState;
  revision: number;
};
export type SaveInput = { state: CondoState; revision: number };
export type { Charge, CondoState, Expense, Month, Unit };

export type TabKey =
  | "overview"
  | "units"
  | "readings"
  | "expenses"
  | "allocation"
  | "history";

export const monthLabel = (competence: string) => {
  const label = formatMonth(competence);
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export function safeNumber(value: string) {
  const raw = value.trim().replace(/\s/g, "");
  if (!/^-?(?:\d+(?:[.,]\d+)?|\d{1,3}(?:\.\d{3})+,\d+)$/.test(raw)) return null;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  if (!normalized || normalized === "-") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseMoneyInput(value: string) {
  const parsed = safeNumber(value);
  if (parsed === null || parsed < 0) return null;
  const cents = Math.round(parsed * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function parseSignedMoneyInput(value: string) {
  const parsed = safeNumber(value);
  if (parsed === null) return null;
  const cents = Math.round(parsed * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function moneyInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function readingInput(milli: number) {
  return (milli / 1000).toFixed(3).replace(".", ",");
}

export function parseReadingInput(value: string) {
  const parsed = safeNumber(value);
  if (parsed === null || parsed < 0) return null;
  const milli = Math.round(parsed * 1000);
  return Number.isSafeInteger(milli) ? milli : null;
}

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function previousCompetence(competence: string) {
  const [year, month] = competence.split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1, 12));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function sortMonths(months: Month[]) {
  return [...months].sort((a, b) => b.competence.localeCompare(a.competence));
}

export function activeUnits(state: CondoState) {
  return state.units
    .filter(unit => unit.active)
    .sort((a, b) =>
      a.number.localeCompare(b.number, "pt-BR", { numeric: true })
    );
}

export function statusForCharge(charge: Charge, month: Month) {
  const value = calculateCharge(charge, month).outstandingCents;
  if (value < 0) return { label: "Crédito", tone: "credit" as const };
  if (value === 0) return { label: "Pago", tone: "paid" as const };
  return { label: "Pendente", tone: "pending" as const };
}

export function parseApiError(error: unknown) {
  const maybe = error as {
    message?: string;
    data?: { code?: string; httpStatus?: number; path?: string };
  } | null;
  const raw = maybe?.message ?? "Não foi possível concluir esta operação.";
  if (/unauthorized|não autenticado|not authenticated/i.test(raw))
    return "Sua sessão expirou. Entre novamente para continuar.";
  if (/revision|conflict|conflito|cas/i.test(raw))
    return "Os dados foram alterados em outra sessão. Recarregue os dados antes de salvar novamente.";
  if (/validation|invalid|zod/i.test(raw))
    return "Revise os campos informados e tente novamente.";
  return raw.length > 220 ? "Não foi possível concluir esta operação." : raw;
}

export function isConflictError(error: unknown) {
  const maybe = error as { message?: string; data?: { code?: string } } | null;
  return (
    maybe?.data?.code === "CONFLICT" ||
    /revision|conflict|conflito|cas/i.test(maybe?.message ?? "")
  );
}

export function missingActiveUnits(state: CondoState, month: Month) {
  const included = new Set(month.charges.map(charge => charge.unitId));
  return activeUnits(state).filter(unit => !included.has(unit.id));
}

function csvSafe(value: string) {
  const text = String(value);
  const formulaSafe = /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[;"\n\r]/.test(formulaSafe)
    ? `"${formulaSafe.replace(/"/g, '""')}"`
    : formulaSafe;
}

function dateForFile(value: string) {
  return value.replace(/[^0-9-]/g, "-");
}

export function exportMonthCsv(
  state: CondoState,
  month: Month,
  unit?: Unit,
  filteredUnitIds?: string[]
) {
  const charges = month.charges.filter(charge => {
    if (unit && charge.unitId !== unit.id) return false;
    return (
      filteredUnitIds === undefined || filteredUnitIds.includes(charge.unitId)
    );
  });
  const exportCharge = unit
    ? charges.find(charge => charge.unitId === unit.id)
    : undefined;
  const exportUnit = unit
    ? ((exportCharge ? resolveChargeUnit(state, exportCharge) : undefined) ??
      unit)
    : undefined;
  const rows = [
    [
      "Competência",
      "Unidade",
      "Morador",
      "Água anterior (m³)",
      "Água atual (m³)",
      "Consumo água (m³)",
      "Tarifa água (R$/m³)",
      "Valor água",
      "Gás anterior (m³)",
      "Gás atual (m³)",
      "Consumo gás (m³)",
      "Tarifa gás (R$/m³)",
      "Valor gás",
      "Rateio de despesas",
      "Condomínio",
      "Fundo reserva",
      "Multa",
      "Outros",
      "Total",
      "Pago",
      "Saldo",
      "Status",
      "Observações",
    ],
    ...charges.map(charge => {
      const owner = resolveChargeUnit(state, charge);
      const computed = calculateCharge(charge, month);
      const status = statusForCharge(charge, month).label;
      return [
        monthLabel(month.competence),
        owner?.number ?? "Unidade removida",
        owner?.resident ?? "",
        formatReading(charge.waterPrevious),
        formatReading(charge.waterCurrent),
        formatReading(computed.waterMilli),
        formatMoney(month.waterRateCents),
        formatMoney(computed.waterCents),
        formatReading(charge.gasPrevious),
        formatReading(charge.gasCurrent),
        formatReading(computed.gasMilli),
        formatMoney(month.gasRateCents),
        formatMoney(computed.gasCents),
        formatMoney(computed.sharedCents),
        formatMoney(charge.condoCents),
        formatMoney(charge.reserveCents),
        formatMoney(charge.fineCents),
        formatMoney(charge.otherCents),
        formatMoney(computed.totalCents),
        formatMoney(charge.paidCents),
        formatMoney(computed.outstandingCents),
        status,
        charge.notes,
      ];
    }),
  ];
  const csv =
    "\ufeff" +
    rows.map(row => row.map(item => csvSafe(item)).join(";")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${dateForFile(month.competence)}${exportUnit ? `-unidade-${dateForFile(exportUnit.number)}` : "-cobrancas"}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export {
  calculateCharge,
  calculateMonth,
  emptyCharge,
  formatMoney,
  formatReading,
};
