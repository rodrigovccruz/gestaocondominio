import type { CashSummary, MonthTotals, UnitQuota } from "./calc";
import type { ExpenseCategory } from "./condo";

/** Caixa sem o extrato do banco (que fica só para o síndico). */
export type PublicCash = Omit<CashSummary, "bankCents" | "differenceCents">;

/**
 * O que o quadro público mostra. Sem nomes de moradores e sem quem está
 * devendo: só despesas, a cota do mês de cada apartamento e o caixa.
 */
export type PublicMonth = {
  competence: string;
  status: "open" | "closed";
  expenses: {
    id: string;
    description: string;
    category: ExpenseCategory;
    amountCents: number;
    fromReserve: boolean;
  }[];
  categories: { category: ExpenseCategory; amountCents: number }[];
  totals: MonthTotals;
  quotas: Omit<UnitQuota, "unitId">[];
  cash: PublicCash;
};

export type PublicDashboard = {
  name: string;
  apartmentCount: number;
  /** Meses disponíveis, do mais recente para o mais antigo. */
  competences: string[];
  month: PublicMonth | null;
};
