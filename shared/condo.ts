import { z } from "zod";
import { upgradeState } from "./upgrade";

/**
 * Modelo do condomínio. Tudo fica num único JSON por condomínio.
 * Dinheiro em centavos inteiros; leituras em milésimos de m³ (1 m³ = 1000).
 */

export const EXPENSE_CATEGORIES = [
  "Água",
  "Gás",
  "Limpeza",
  "Manutenção",
  "Administração",
  "Outros",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

const id = z.string().min(1).max(80);
const money = z.number().int().min(0).max(100_000_000);
const signedMoney = z.number().int().min(-100_000_000).max(100_000_000);
const reading = z.number().int().min(0).max(1_000_000_000);

export const unitSchema = z.object({
  id,
  number: z.string().trim().min(1).max(30),
  resident: z.string().trim().max(120),
  active: z.boolean(),
});

export const readingSchema = z
  .object({
    unitId: id,
    waterPrevious: reading,
    waterCurrent: reading,
    gasPrevious: reading,
    gasCurrent: reading,
  })
  .refine(r => r.waterCurrent >= r.waterPrevious, {
    message: "A leitura atual de água não pode ser menor que a anterior.",
    path: ["waterCurrent"],
  })
  .refine(r => r.gasCurrent >= r.gasPrevious, {
    message: "A leitura atual de gás não pode ser menor que a anterior.",
    path: ["gasCurrent"],
  });

export const expenseSchema = z.object({
  id,
  description: z.string().trim().min(1).max(200),
  category: z.enum(EXPENSE_CATEGORIES),
  amountCents: money,
});

/** Valor recebido do apartamento no mês (o que entrou no banco). */
export const paymentSchema = z.object({
  unitId: id,
  amountCents: money,
});

export const monthSchema = z.object({
  id,
  competence: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  status: z.enum(["open", "closed"]),
  /** Fundo de reserva cobrado de cada apartamento no mês. */
  reservePerUnitCents: money,
  readings: z.array(readingSchema).max(1000),
  expenses: z.array(expenseSchema).max(3000),
  payments: z.array(paymentSchema).max(1000),
  /** Saldo do extrato bancário no fim do mês, informado pelo síndico. */
  bankBalanceCents: signedMoney.nullable(),
});

const baseStateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    /** Saldo da conta do condomínio antes do primeiro mês lançado. */
    openingBalanceCents: signedMoney,
    units: z.array(unitSchema).max(1000),
    months: z.array(monthSchema).max(240),
  })
  .superRefine((state, ctx) => {
    const duplicated = (values: string[]) =>
      new Set(values).size !== values.length;
    if (duplicated(state.units.map(u => u.id)))
      ctx.addIssue({
        code: "custom",
        path: ["units"],
        message: "Unidades duplicadas.",
      });
    if (duplicated(state.units.map(u => u.number.toLowerCase())))
      ctx.addIssue({
        code: "custom",
        path: ["units"],
        message: "Número de apartamento repetido.",
      });
    if (
      duplicated(state.months.map(m => m.id)) ||
      duplicated(state.months.map(m => m.competence))
    )
      ctx.addIssue({
        code: "custom",
        path: ["months"],
        message: "Mês repetido.",
      });

    const unitIds = new Set(state.units.map(u => u.id));
    state.months.forEach((month, i) => {
      const readingIds = month.readings.map(r => r.unitId);
      const paymentIds = month.payments.map(p => p.unitId);
      if (duplicated(readingIds))
        ctx.addIssue({
          code: "custom",
          path: ["months", i, "readings"],
          message: "Leitura repetida para o mesmo apartamento.",
        });
      if (duplicated(paymentIds))
        ctx.addIssue({
          code: "custom",
          path: ["months", i, "payments"],
          message: "Pagamento repetido para o mesmo apartamento.",
        });
      if (duplicated(month.expenses.map(e => e.id)))
        ctx.addIssue({
          code: "custom",
          path: ["months", i, "expenses"],
          message: "Despesa repetida.",
        });
      if ([...readingIds, ...paymentIds].some(unitId => !unitIds.has(unitId)))
        ctx.addIssue({
          code: "custom",
          path: ["months", i],
          message: "Lançamento para apartamento inexistente.",
        });
    });
  });

export const condoStateSchema = z.preprocess(upgradeState, baseStateSchema);

export type Unit = z.infer<typeof unitSchema>;
export type Reading = z.infer<typeof readingSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type Month = z.infer<typeof monthSchema>;
export type CondoState = z.infer<typeof baseStateSchema>;

export const initialState: CondoState = {
  name: "Condomínio San Gimignano",
  openingBalanceCents: 0,
  units: [],
  months: [],
};
