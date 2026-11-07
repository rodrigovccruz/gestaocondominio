import { z } from "zod";
import { calculateExpenseAllocation } from "./rateio";

const id = z.string().min(1).max(80);
const money = z.number().int().min(0).max(100_000_000);
const reading = z.number().int().min(0).max(1_000_000_000);
export const unitSchema = z.object({
  id,
  number: z.string().trim().min(1).max(30),
  resident: z.string().trim().max(120),
  fraction: z.number().min(0).max(100),
  active: z.boolean(),
});
export const chargeSchema = z
  .object({
    unitId: id,
    unitSnapshot: z
      .object({
        number: z.string().min(1).max(30),
        resident: z.string().max(120),
      })
      .optional(),
    waterPrevious: reading,
    waterCurrent: reading,
    gasPrevious: reading,
    gasCurrent: reading,
    condoCents: money,
    reserveCents: money,
    fineCents: money,
    otherCents: money,
    paidCents: money,
    notes: z.string().max(500),
  })
  .refine(v => v.waterCurrent >= v.waterPrevious, {
    message: "A leitura atual de água não pode ser menor que a anterior.",
    path: ["waterCurrent"],
  })
  .refine(v => v.gasCurrent >= v.gasPrevious, {
    message: "A leitura atual de gás não pode ser menor que a anterior.",
    path: ["gasCurrent"],
  });
export const expenseSchema = z.object({
  id,
  description: z.string().trim().min(1).max(200),
  category: z.enum([
    "Água",
    "Gás",
    "Manutenção",
    "Limpeza",
    "Administração",
    "Outros",
  ]),
  date: z.iso.date(),
  amountCents: money,
  rateable: z.boolean().optional(),
});
export const allocationConfigSchema = z
  .object({
    method: z.enum(["equal", "fraction"]),
    participants: z
      .array(
        z.object({ unitId: id, weight: z.number().int().min(1).max(100_000) })
      )
      .min(1)
      .max(1000),
  })
  .superRefine((config, ctx) => {
    if (
      new Set(config.participants.map(p => p.unitId)).size !==
      config.participants.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["participants"],
        message: "Participantes do rateio duplicados.",
      });
    if (
      config.method === "equal" &&
      config.participants.some(p => p.weight !== 1)
    )
      ctx.addIssue({
        code: "custom",
        path: ["participants"],
        message: "O rateio igual deve usar peso 1 para cada participante.",
      });
    if (
      config.method === "fraction" &&
      Math.abs(
        config.participants.reduce((sum, p) => sum + p.weight, 0) - 100_000
      ) > 10
    )
      ctx.addIssue({
        code: "custom",
        path: ["participants"],
        message: "Os pesos da fração ideal devem somar 100% da distribuição.",
      });
  });
export const monthSchema = z.object({
  id,
  competence: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  status: z.enum(["open", "closed"]),
  waterRateCents: money,
  gasRateCents: money,
  openingBalanceCents: z.number().int().min(-100_000_000).max(100_000_000),
  charges: z.array(chargeSchema).max(1000),
  expenses: z.array(expenseSchema).max(3000),
  allocation: allocationConfigSchema.optional(),
});
export const condoStateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    units: z.array(unitSchema).max(1000),
    months: z.array(monthSchema).max(240),
  })
  .superRefine((state, ctx) => {
    const unique = (
      values: string[],
      path: (string | number)[],
      label: string
    ) => {
      if (new Set(values).size !== values.length)
        ctx.addIssue({ code: "custom", path, message: `${label} duplicados.` });
    };
    unique(
      state.units.map(u => u.id),
      ["units"],
      "Identificadores de unidades"
    );
    unique(
      state.units.map(u => u.number.toLowerCase()),
      ["units"],
      "Números de unidades"
    );
    unique(
      state.months.map(m => m.id),
      ["months"],
      "Identificadores de competências"
    );
    unique(
      state.months.map(m => m.competence),
      ["months"],
      "Competências"
    );
    const unitIds = new Set(state.units.map(u => u.id));
    state.months.forEach((m, i) => {
      unique(
        m.charges.map(c => c.unitId),
        ["months", i, "charges"],
        "Cobranças por unidade"
      );
      unique(
        m.expenses.map(e => e.id),
        ["months", i, "expenses"],
        "Identificadores de despesas"
      );
      if (m.charges.some(c => !unitIds.has(c.unitId)))
        ctx.addIssue({
          code: "custom",
          path: ["months", i, "charges"],
          message: "Cobrança associada a uma unidade inexistente.",
        });
      if (m.expenses.some(e => !e.date.startsWith(m.competence)))
        ctx.addIssue({
          code: "custom",
          path: ["months", i, "expenses"],
          message: "A data da despesa deve pertencer à competência.",
        });
      if (
        m.allocation?.participants.some(
          p =>
            !unitIds.has(p.unitId) ||
            !m.charges.some(c => c.unitId === p.unitId)
        )
      )
        ctx.addIssue({
          code: "custom",
          path: ["months", i, "allocation"],
          message:
            "Cada participante do rateio deve existir e ter uma cobrança na competência.",
        });
    });
  });
export type AllocationConfig = z.infer<typeof allocationConfigSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type Charge = z.infer<typeof chargeSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type Month = z.infer<typeof monthSchema>;
export type CondoState = z.infer<typeof condoStateSchema>;
export const initialState: CondoState = {
  name: "Condomínio San Gimignano",
  units: [],
  months: [],
};

/** Registra a identificação usada na cobrança, sem alterar snapshots existentes. */
export function attachUnitSnapshots(state: CondoState): CondoState {
  const units = new Map(state.units.map(unit => [unit.id, unit]));
  return {
    ...state,
    months: state.months.map(month => ({
      ...month,
      charges: month.charges.map(charge => {
        const unit = units.get(charge.unitId);
        return charge.unitSnapshot || !unit
          ? charge
          : {
              ...charge,
              unitSnapshot: { number: unit.number, resident: unit.resident },
            };
      }),
    })),
  };
}
export function resolveChargeUnit(
  state: CondoState,
  charge: Charge
): Unit | undefined {
  const current = state.units.find(unit => unit.id === charge.unitId);
  return current ? { ...current, ...charge.unitSnapshot } : undefined;
}

/** Leituras são milésimos de m³; moeda e tarifa são centavos. */
export function calculateCharge(
  charge: Charge,
  month: Month,
  allocatedCentsOverride?: number
) {
  const waterMilli = charge.waterCurrent - charge.waterPrevious;
  const gasMilli = charge.gasCurrent - charge.gasPrevious;
  const waterCents = Number(
    (BigInt(waterMilli) * BigInt(month.waterRateCents) + 500n) / 1000n
  );
  const gasCents = Number(
    (BigInt(gasMilli) * BigInt(month.gasRateCents) + 500n) / 1000n
  );
  const sharedCents =
    allocatedCentsOverride ??
    calculateExpenseAllocation(month).byUnit[charge.unitId] ??
    0;
  const totalCents =
    waterCents +
    gasCents +
    sharedCents +
    charge.condoCents +
    charge.reserveCents +
    charge.fineCents +
    charge.otherCents;
  return {
    waterMilli,
    gasMilli,
    waterCents,
    gasCents,
    sharedCents,
    totalCents,
    outstandingCents: totalCents - charge.paidCents,
  };
}
export function calculateMonth(month: Month) {
  const allocation = calculateExpenseAllocation(month);
  const values = month.charges.map(c => ({
    ...calculateCharge(c, month, allocation.byUnit[c.unitId] ?? 0),
    paidCents: c.paidCents,
    reserveCents: c.reserveCents,
  }));
  const sum = (key: keyof (typeof values)[number]) =>
    values.reduce((total, v) => total + v[key], 0);
  const expensesCents = month.expenses.reduce(
    (total, e) => total + e.amountCents,
    0
  );
  return {
    waterMilli: sum("waterMilli"),
    gasMilli: sum("gasMilli"),
    waterCents: sum("waterCents"),
    gasCents: sum("gasCents"),
    allocatedCents: sum("sharedCents"),
    billedCents: sum("totalCents"),
    receivedCents: sum("paidCents"),
    reserveCents: sum("reserveCents"),
    outstandingCents: values.reduce(
      (total, v) => total + Math.max(0, v.outstandingCents),
      0
    ),
    creditCents: values.reduce(
      (total, v) => total + Math.max(0, -v.outstandingCents),
      0
    ),
    expensesCents,
    cashBalanceCents:
      month.openingBalanceCents + sum("paidCents") - expensesCents,
    projectedBalanceCents:
      month.openingBalanceCents + sum("totalCents") - expensesCents,
  };
}
export function emptyCharge(unitId: string): Charge {
  return {
    unitId,
    waterPrevious: 0,
    waterCurrent: 0,
    gasPrevious: 0,
    gasCurrent: 0,
    condoCents: 0,
    reserveCents: 0,
    fineCents: 0,
    otherCents: 0,
    paidCents: 0,
    notes: "",
  };
}
export function newMonthlyCharge(
  unitId: string,
  prior?: Charge,
  copyFixed = false
): Charge {
  return {
    ...emptyCharge(unitId),
    waterPrevious: prior?.waterCurrent ?? 0,
    waterCurrent: prior?.waterCurrent ?? 0,
    gasPrevious: prior?.gasCurrent ?? 0,
    gasCurrent: prior?.gasCurrent ?? 0,
    condoCents: copyFixed ? (prior?.condoCents ?? 0) : 0,
    reserveCents: copyFixed ? (prior?.reserveCents ?? 0) : 0,
  };
}
export const formatMoney = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );
export const formatReading = (milli: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(
    milli / 1000
  );
export const formatMonth = (competence: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${competence}-01T12:00:00Z`));
