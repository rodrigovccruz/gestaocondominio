import type { CondoState, Month, Unit } from "./condo";

/**
 * Regras do condomínio:
 * 1. Conta de água do prédio dividida pelo consumo de cada hidrômetro.
 * 2. Conta de gás do prédio dividida pelo consumo de cada medidor.
 * 3. Demais despesas divididas igualmente entre os apartamentos do mês.
 * 4. Fundo de reserva: valor fixo por apartamento, definido no mês.
 * Se ninguém consumiu (soma zero), a conta é dividida igualmente.
 * A soma das partes é sempre exatamente o total da conta.
 */

/**
 * Divide `amountCents` proporcionalmente aos pesos (maiores restos).
 * Centavos que sobram vão para quem tem o maior resto; empate pela ordem da lista.
 */
export function splitCents(
  amountCents: number,
  weights: { key: string; weight: number }[]
): Record<string, number> {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0)
    throw new Error("Valor inválido para divisão.");
  if (weights.some(w => !Number.isSafeInteger(w.weight) || w.weight < 0))
    throw new Error("Peso inválido para divisão.");
  const result: Record<string, number> = {};
  if (!weights.length) return result;

  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  const effective =
    total > 0 ? weights : weights.map(w => ({ key: w.key, weight: 1 }));
  const totalWeight = total > 0 ? total : weights.length;

  const rows = effective.map((w, index) => {
    const numerator = BigInt(amountCents) * BigInt(w.weight);
    return {
      key: w.key,
      index,
      cents: Number(numerator / BigInt(totalWeight)),
      remainder: Number(numerator % BigInt(totalWeight)),
    };
  });
  let leftover = amountCents - rows.reduce((sum, r) => sum + r.cents, 0);
  const order = [...rows].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index
  );
  for (const row of order) {
    if (leftover <= 0) break;
    row.cents += 1;
    leftover -= 1;
  }
  for (const row of rows) result[row.key] = row.cents;
  return result;
}

export const byApartmentNumber = (
  a: { number: string },
  b: { number: string }
) => a.number.localeCompare(b.number, "pt-BR", { numeric: true });

export function sortUnits(units: Unit[]) {
  return [...units].sort(byApartmentNumber);
}

/** Meses em ordem cronológica (mais antigo primeiro). */
export function sortMonthsAsc(months: Month[]) {
  return [...months].sort((a, b) => a.competence.localeCompare(b.competence));
}

export type UnitQuota = {
  unitId: string;
  number: string;
  waterMilli: number;
  gasMilli: number;
  waterCents: number;
  gasCents: number;
  commonCents: number;
  reserveCents: number;
  totalCents: number;
};

export type MonthTotals = {
  waterBillCents: number;
  gasBillCents: number;
  commonCents: number;
  expensesCents: number;
  reserveCents: number;
  quotasCents: number;
  waterMilli: number;
  gasMilli: number;
};

/** Quanto cada apartamento paga no mês (sem dívidas anteriores). */
export function calculateQuotas(
  month: Month,
  units: Unit[]
): { quotas: UnitQuota[]; totals: MonthTotals } {
  const numberOf = new Map(units.map(u => [u.id, u.number]));
  const readings = [...month.readings].sort((a, b) =>
    byApartmentNumber(
      { number: numberOf.get(a.unitId) ?? a.unitId },
      { number: numberOf.get(b.unitId) ?? b.unitId }
    )
  );

  const sumCategory = (match: (category: string) => boolean) =>
    month.expenses
      .filter(e => match(e.category))
      .reduce((sum, e) => sum + e.amountCents, 0);
  const waterBillCents = sumCategory(c => c === "Água");
  const gasBillCents = sumCategory(c => c === "Gás");
  const commonCents = sumCategory(c => c !== "Água" && c !== "Gás");

  const water = splitCents(
    waterBillCents,
    readings.map(r => ({
      key: r.unitId,
      weight: r.waterCurrent - r.waterPrevious,
    }))
  );
  const gas = splitCents(
    gasBillCents,
    readings.map(r => ({ key: r.unitId, weight: r.gasCurrent - r.gasPrevious }))
  );
  const common = splitCents(
    commonCents,
    readings.map(r => ({ key: r.unitId, weight: 1 }))
  );

  const quotas = readings.map(r => {
    const waterCents = water[r.unitId] ?? 0;
    const gasCents = gas[r.unitId] ?? 0;
    const shared = common[r.unitId] ?? 0;
    const reserveCents = month.reservePerUnitCents;
    return {
      unitId: r.unitId,
      number: numberOf.get(r.unitId) ?? "?",
      waterMilli: r.waterCurrent - r.waterPrevious,
      gasMilli: r.gasCurrent - r.gasPrevious,
      waterCents,
      gasCents,
      commonCents: shared,
      reserveCents,
      totalCents: waterCents + gasCents + shared + reserveCents,
    };
  });

  return {
    quotas,
    totals: {
      waterBillCents,
      gasBillCents,
      commonCents,
      expensesCents: waterBillCents + gasBillCents + commonCents,
      reserveCents: quotas.reduce((sum, q) => sum + q.reserveCents, 0),
      quotasCents: quotas.reduce((sum, q) => sum + q.totalCents, 0),
      waterMilli: quotas.reduce((sum, q) => sum + q.waterMilli, 0),
      gasMilli: quotas.reduce((sum, q) => sum + q.gasMilli, 0),
    },
  };
}

export type UnitStatement = {
  unitId: string;
  number: string;
  /** Saldo trazido do mês anterior: positivo = devia, negativo = tinha crédito. */
  previousCents: number;
  quotaCents: number;
  /** Total a pagar no mês = anterior + cota. */
  dueCents: number;
  paidCents: number;
  /** O que fica para o mês seguinte: positivo = deve, negativo = crédito. */
  balanceCents: number;
};

export type CashSummary = {
  openingCents: number;
  receivedCents: number;
  expensesCents: number;
  /** Saldo que deveria estar no banco = abertura + recebido - despesas. */
  closingCents: number;
  bankCents: number | null;
  /** Extrato menos saldo calculado. Zero = bateu. */
  differenceCents: number | null;
};

export type MonthReport = {
  month: Month;
  quotas: UnitQuota[];
  totals: MonthTotals;
  statements: UnitStatement[];
  cash: CashSummary;
};

/**
 * Percorre os meses em ordem e encadeia:
 * saldo do banco (fechamento vira abertura do mês seguinte) e
 * saldo de cada apartamento (quem não pagou carrega a diferença).
 */
export function buildReports(state: CondoState): MonthReport[] {
  const units = sortUnits(state.units);
  const unitBalance = new Map<string, number>();
  let cash = state.openingBalanceCents;

  return sortMonthsAsc(state.months).map(month => {
    const { quotas, totals } = calculateQuotas(month, units);
    const quotaOf = new Map(quotas.map(q => [q.unitId, q.totalCents]));
    const paidOf = new Map(month.payments.map(p => [p.unitId, p.amountCents]));

    const statements = units
      .filter(
        u =>
          quotaOf.has(u.id) ||
          paidOf.has(u.id) ||
          (unitBalance.get(u.id) ?? 0) !== 0
      )
      .map(u => {
        const previousCents = unitBalance.get(u.id) ?? 0;
        const quotaCents = quotaOf.get(u.id) ?? 0;
        const paidCents = paidOf.get(u.id) ?? 0;
        const dueCents = previousCents + quotaCents;
        const balanceCents = dueCents - paidCents;
        unitBalance.set(u.id, balanceCents);
        return {
          unitId: u.id,
          number: u.number,
          previousCents,
          quotaCents,
          dueCents,
          paidCents,
          balanceCents,
        };
      });

    const receivedCents = month.payments.reduce((s, p) => s + p.amountCents, 0);
    const openingCents = cash;
    const closingCents = openingCents + receivedCents - totals.expensesCents;
    cash = closingCents;

    return {
      month,
      quotas,
      totals,
      statements,
      cash: {
        openingCents,
        receivedCents,
        expensesCents: totals.expensesCents,
        closingCents,
        bankCents: month.bankBalanceCents,
        differenceCents:
          month.bankBalanceCents === null
            ? null
            : month.bankBalanceCents - closingCents,
      },
    };
  });
}

/** Leitura anterior do novo mês = leitura atual do mês anterior. */
export function newMonth(
  state: CondoState,
  competence: string,
  id: string
): Month {
  const previous = sortMonthsAsc(state.months)
    .filter(m => m.competence < competence)
    .at(-1);
  const prior = new Map(previous?.readings.map(r => [r.unitId, r]) ?? []);
  return {
    id,
    competence,
    status: "open",
    reservePerUnitCents: previous?.reservePerUnitCents ?? 0,
    readings: sortUnits(state.units)
      .filter(u => u.active)
      .map(u => {
        const last = prior.get(u.id);
        return {
          unitId: u.id,
          waterPrevious: last?.waterCurrent ?? 0,
          waterCurrent: last?.waterCurrent ?? 0,
          gasPrevious: last?.gasCurrent ?? 0,
          gasCurrent: last?.gasCurrent ?? 0,
        };
      }),
    expenses: [],
    payments: [],
    bankBalanceCents: null,
  };
}

export const formatMoney = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );

export const formatM3 = (milli: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(
    milli / 1000
  );

export function formatMonth(competence: string) {
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${competence}-01T12:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
