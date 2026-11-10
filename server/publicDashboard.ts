import { z } from "zod";
import { EXPENSE_CATEGORIES, type CondoState } from "@shared/condo";
import { buildReports } from "@shared/calc";
import type { PublicDashboard } from "@shared/public-dashboard";
import {
  getPublicStateFromResolution,
  resolveConfiguredCondo,
} from "./condo-config";

export const publicDashboardInputSchema = z
  .object({
    competence: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional(),
  })
  .optional();

/** Projeção pública: lista do que pode aparecer, nada além disso. */
export function toPublicDashboard(
  state: CondoState,
  competence?: string
): PublicDashboard {
  const reports = buildReports(state);
  const competences = reports.map(r => r.month.competence).reverse();
  const report =
    reports.find(r => r.month.competence === competence) ?? reports.at(-1);
  const base = {
    name: state.name,
    apartmentCount: state.units.filter(u => u.active).length,
    competences,
  };
  if (!report) return { ...base, month: null };

  const { month, totals, quotas, cash } = report;
  return {
    ...base,
    month: {
      competence: month.competence,
      status: month.status,
      expenses: month.expenses.map(e => ({
        id: e.id,
        description: e.description,
        category: e.category,
        amountCents: e.amountCents,
        fromReserve: e.fromReserve,
        paid: e.paid,
        paidOn: e.paidOn,
      })),
      categories: EXPENSE_CATEGORIES.map(category => ({
        category,
        amountCents: month.expenses
          .filter(e => e.category === category)
          .reduce((sum, e) => sum + e.amountCents, 0),
      })).filter(c => c.amountCents > 0),
      totals,
      quotas: quotas.map(({ unitId: _unitId, ...q }) => q),
      cash: {
        openingCents: cash.openingCents,
        receivedCents: cash.receivedCents,
        expensesCents: cash.expensesCents,
        closingCents: cash.closingCents,
        condoOpeningCents: cash.condoOpeningCents,
        condoClosingCents: cash.condoClosingCents,
        reserveOpeningCents: cash.reserveOpeningCents,
        reserveInCents: cash.reserveInCents,
        reserveOutCents: cash.reserveOutCents,
        reserveClosingCents: cash.reserveClosingCents,
        toReceiveCents: cash.toReceiveCents,
        toPayCents: cash.toPayCents,
        projectedCents: cash.projectedCents,
        projectedCondoCents: cash.projectedCondoCents,
      },
    },
  };
}

export async function getPublicDashboard(
  competence?: string
): Promise<PublicDashboard> {
  const resolution = await resolveConfiguredCondo();
  const { state } = getPublicStateFromResolution(resolution);
  return toPublicDashboard(state, competence);
}
