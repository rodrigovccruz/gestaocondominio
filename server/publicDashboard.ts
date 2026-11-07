import { TRPCError } from "@trpc/server";
import {
  type CondoState,
  condoStateSchema,
  attachUnitSnapshots,
} from "@shared/condo";
import type {
  PublicDashboard,
  PublicExpenseCategory,
} from "@shared/public-dashboard";
import {
  getPublicStateFromResolution,
  resolveConfiguredCondo,
} from "./condo-config";

const PUBLIC_CATEGORIES: PublicExpenseCategory[] = [
  "Água",
  "Gás",
  "Manutenção",
  "Limpeza",
  "Administração",
  "Outros",
];

function validatedState(value: CondoState): CondoState {
  const parsed = condoStateSchema.safeParse(value);
  if (!parsed.success) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "O estado persistido do condomínio é inválido.",
    });
  }
  return attachUnitSnapshots(parsed.data);
}

/** Pure projection used by both the public router and isolated unit tests. */
export function toPublicDashboard(value: CondoState): PublicDashboard {
  const state = validatedState(value);
  const latest = state.months.reduce<(typeof state.months)[number] | null>(
    (current, month) =>
      !current || month.competence > current.competence ? month : current,
    null
  );

  if (!latest) {
    return {
      name: state.name,
      apartmentCount: state.units.filter(unit => unit.active).length,
      latest: null,
    };
  }

  const categoryTotals = new Map<PublicExpenseCategory, number>();
  for (const expense of latest.expenses) {
    categoryTotals.set(
      expense.category,
      (categoryTotals.get(expense.category) ?? 0) + expense.amountCents
    );
  }

  return {
    name: state.name,
    apartmentCount: state.units.filter(unit => unit.active).length,
    latest: {
      competence: latest.competence,
      status: latest.status,
      totalExpensesCents: latest.expenses.reduce(
        (total, expense) => total + expense.amountCents,
        0
      ),
      expenses: latest.expenses.map(expense => ({
        id: expense.id,
        description: expense.description,
        category: expense.category,
        date: expense.date,
        amountCents: expense.amountCents,
      })),
      categories: PUBLIC_CATEGORIES.flatMap(category => {
        const amountCents = categoryTotals.get(category);
        return amountCents === undefined ? [] : [{ category, amountCents }];
      }),
    },
  };
}

export async function getPublicDashboard(): Promise<PublicDashboard> {
  const resolution = await resolveConfiguredCondo();
  const { state } = getPublicStateFromResolution(resolution);
  return toPublicDashboard(state);
}
