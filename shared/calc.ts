import type { CondoState, Month, Tariffs, Unit } from "./condo";

/**
 * Regras do condomínio (as mesmas da planilha):
 * 1. Água e gás: consumo do medidor × preço do m³ do mês.
 * 2. Taxa de condomínio fixa por apartamento.
 * 3. Fundo de manutenção e fundo de reserva: % da taxa de condomínio.
 * 4. Taxa de administração fixa por apartamento.
 * 5. Isento (ex.: síndico) não paga taxa, manutenção nem administração;
 *    paga consumo, fundo de reserva e cobranças avulsas.
 * 6. Cobranças avulsas (multa, reembolso) somam só no apartamento.
 * As partes são calculadas sem arredondar; só o total do apartamento é
 * arredondado para centavos.
 */

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
  exempt: boolean;
  waterMilli: number;
  gasMilli: number;
  waterCents: number;
  gasCents: number;
  feeCents: number;
  maintenanceCents: number;
  reserveCents: number;
  adminCents: number;
  extraCents: number;
  totalCents: number;
};

export type MonthTotals = {
  waterMilli: number;
  gasMilli: number;
  waterCents: number;
  gasCents: number;
  feeCents: number;
  maintenanceCents: number;
  /** Vai para o fundo de reserva. */
  reserveCents: number;
  adminCents: number;
  extraCents: number;
  quotasCents: number;
  expensesCents: number;
  /** Despesas pagas com o fundo de reserva. */
  reserveExpensesCents: number;
};

/** Valores em 1/10000 de centavo, para somar sem arredondar. */
const SCALE = 10_000n;
const toCents = (scaled: bigint) =>
  Number((scaled + (scaled >= 0n ? SCALE / 2n : -SCALE / 2n)) / SCALE);
const byPrice = (milli: number, priceCents: number) =>
  (BigInt(milli) * BigInt(priceCents) * SCALE) / 1000n;
const byPercent = (cents: number, bp: number) => BigInt(cents) * BigInt(bp);
const fixed = (cents: number) => BigInt(cents) * SCALE;

/** Quanto cada apartamento paga no mês (sem dívidas anteriores). */
export function calculateQuotas(
  month: Month,
  units: Unit[]
): { quotas: UnitQuota[]; totals: MonthTotals } {
  const unitOf = new Map(units.map(u => [u.id, u]));
  const numberOf = (unitId: string) => unitOf.get(unitId)?.number ?? unitId;
  const readings = [...month.readings].sort((a, b) =>
    byApartmentNumber(
      { number: numberOf(a.unitId) },
      { number: numberOf(b.unitId) }
    )
  );
  let reserveScaled = 0n;
  let maintenanceScaled = 0n;
  let waterScaled = 0n;
  let gasScaled = 0n;

  const quotas = readings.map(r => {
    const exempt = unitOf.get(r.unitId)?.exempt ?? false;
    const waterMilli = r.waterCurrent - r.waterPrevious;
    const gasMilli = r.gasCurrent - r.gasPrevious;
    const extraCents = month.extraCharges
      .filter(e => e.unitId === r.unitId)
      .reduce((sum, e) => sum + e.amountCents, 0);
    const parts = {
      water: byPrice(waterMilli, month.waterPriceCents),
      gas: byPrice(gasMilli, month.gasPriceCents),
      fee: exempt ? 0n : fixed(month.feeCents),
      maintenance: exempt ? 0n : byPercent(month.feeCents, month.maintenanceBp),
      reserve: byPercent(month.feeCents, month.reserveBp),
      admin: exempt ? 0n : fixed(month.adminCents),
      extra: fixed(extraCents),
    };
    reserveScaled += parts.reserve;
    maintenanceScaled += parts.maintenance;
    waterScaled += parts.water;
    gasScaled += parts.gas;
    const total = Object.values(parts).reduce((sum, v) => sum + v, 0n);
    return {
      unitId: r.unitId,
      number: numberOf(r.unitId),
      exempt,
      waterMilli,
      gasMilli,
      waterCents: toCents(parts.water),
      gasCents: toCents(parts.gas),
      feeCents: toCents(parts.fee),
      maintenanceCents: toCents(parts.maintenance),
      reserveCents: toCents(parts.reserve),
      adminCents: toCents(parts.admin),
      extraCents,
      totalCents: toCents(total),
    };
  });

  const sum = (pick: (q: UnitQuota) => number) =>
    quotas.reduce((total, q) => total + pick(q), 0);
  const expensesCents = month.expenses.reduce((t, e) => t + e.amountCents, 0);
  return {
    quotas,
    totals: {
      waterMilli: sum(q => q.waterMilli),
      gasMilli: sum(q => q.gasMilli),
      // Consumo e percentuais somados sem arredondar, como a planilha.
      waterCents: toCents(waterScaled),
      gasCents: toCents(gasScaled),
      feeCents: sum(q => q.feeCents),
      maintenanceCents: toCents(maintenanceScaled),
      reserveCents: toCents(reserveScaled),
      adminCents: sum(q => q.adminCents),
      extraCents: sum(q => q.extraCents),
      quotasCents: sum(q => q.totalCents),
      expensesCents,
      reserveExpensesCents: month.expenses
        .filter(e => e.fromReserve)
        .reduce((t, e) => t + e.amountCents, 0),
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
  /** O saldo do banco dividido em condomínio e fundo de reserva. */
  condoOpeningCents: number;
  condoClosingCents: number;
  reserveOpeningCents: number;
  /** Fundo de reserva cobrado dos apartamentos no mês. */
  reserveInCents: number;
  /** Despesas pagas com o fundo de reserva. */
  reserveOutCents: number;
  reserveClosingCents: number;
  /** O que os apartamentos ainda devem (do mês e de antes). */
  toReceiveCents: number;
  /** Despesas lançadas que ainda não saíram do banco. */
  toPayCents: number;
  /** Previsão do saldo ao fim do mês, se todos pagarem e as contas forem pagas. */
  projectedCents: number;
  /** Parte da previsão que fica para o condomínio (previsão − fundo). */
  projectedCondoCents: number;
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
/** Último dia do mês "AAAA-MM", como "AAAA-MM-DD". */
function lastDayOf(competence: string) {
  const [year, month] = competence.split("-").map(Number);
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${competence}-${String(day).padStart(2, "0")}`;
}

export function buildReports(state: CondoState): MonthReport[] {
  const units = sortUnits(state.units);
  const unitBalance = new Map<string, number>();
  let cash = state.openingBalanceCents;
  let reserve = state.openingReserveCents;

  const months = sortMonthsAsc(state.months);
  // O dinheiro de uma despesa sai no dia em que foi paga, não no mês em que foi lançada.
  const cashOut = months.map(() => ({ total: 0, reserve: 0 }));
  const toPayBy = months.map(() => 0);
  months.forEach((month, monthIndex) => {
    for (const e of month.expenses) {
      // Só "paid: false" é a pagar; sem o campo (estado antigo), vale como paga.
      if (e.paid === false) {
        for (let i = monthIndex; i < months.length; i++)
          toPayBy[i] += e.amountCents;
        continue;
      }
      const date = e.paidOn ?? lastDayOf(month.competence);
      if (state.openingDate && date <= state.openingDate) continue;
      const target = months.findIndex(m => m.competence >= date.slice(0, 7));
      const slot = cashOut[target === -1 ? months.length - 1 : target];
      slot.total += e.amountCents;
      if (e.fromReserve) slot.reserve += e.amountCents;
    }
  });

  return months.map((month, index) => {
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
    const toReceiveCents = statements.reduce(
      (sum, s) => sum + Math.max(0, s.balanceCents),
      0
    );
    const openingCents = cash;
    const paidOutCents = cashOut[index].total;
    const toPayCents = toPayBy[index];
    const closingCents = openingCents + receivedCents - paidOutCents;
    cash = closingCents;
    const reserveOpeningCents = reserve;
    const reserveClosingCents =
      reserveOpeningCents + totals.reserveCents - cashOut[index].reserve;
    reserve = reserveClosingCents;

    return {
      month,
      quotas,
      totals,
      statements,
      cash: {
        openingCents,
        receivedCents,
        expensesCents: paidOutCents,
        closingCents,
        bankCents: month.bankBalanceCents,
        differenceCents:
          month.bankBalanceCents === null
            ? null
            : month.bankBalanceCents - closingCents,
        condoOpeningCents: openingCents - reserveOpeningCents,
        condoClosingCents: closingCents - reserveClosingCents,
        reserveOpeningCents,
        reserveInCents: totals.reserveCents,
        reserveOutCents: cashOut[index].reserve,
        reserveClosingCents,
        toReceiveCents,
        toPayCents,
        projectedCents: closingCents + toReceiveCents - toPayCents,
        projectedCondoCents:
          closingCents + toReceiveCents - toPayCents - reserveClosingCents,
      },
    };
  });
}

/** Taxa de condomínio = % do salário mínimo, arredondada em centavos. */
export function tariffFeeCents(t: Tariffs) {
  return toCents(byPercent(t.minimumWageCents, t.feeBp));
}

/** Valores de cobrança de um mês a partir das tarifas vigentes. */
export function chargesFromTariffs(t: Tariffs) {
  return {
    feeCents: tariffFeeCents(t),
    maintenanceBp: t.maintenanceBp,
    reserveBp: t.reserveBp,
    adminCents: t.adminCents,
    waterPriceCents: t.waterPriceCents,
    gasPriceCents: t.gasPriceCents,
  };
}

const hasTariffs = (t: Tariffs) => Object.values(t).some(v => v > 0);

/**
 * Leitura anterior do novo mês = leitura atual do mês anterior.
 * Taxa, percentuais e preços do m³ vêm das tarifas vigentes (Cadastro);
 * sem tarifas cadastradas, vêm do mês anterior. O mês guarda a cópia.
 */
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
    ...(hasTariffs(state.tariffs)
      ? chargesFromTariffs(state.tariffs)
      : {
          feeCents: previous?.feeCents ?? 0,
          maintenanceBp: previous?.maintenanceBp ?? 0,
          reserveBp: previous?.reserveBp ?? 0,
          adminCents: previous?.adminCents ?? 0,
          waterPriceCents: previous?.waterPriceCents ?? 0,
          gasPriceCents: previous?.gasPriceCents ?? 0,
        }),
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
    extraCharges: [],
    bankBalanceCents: null,
  };
}

/** Percentual em pontos-base para exibir: 1500 → "15". */
export const formatPercent = (bp: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(bp / 100);

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
