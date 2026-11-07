import type { ExpenseCategory } from "./condo";

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
  }[];
  categories: { category: ExpenseCategory; amountCents: number }[];
  totals: {
    expensesCents: number;
    waterBillCents: number;
    gasBillCents: number;
    commonCents: number;
    reserveCents: number;
    quotasCents: number;
    waterMilli: number;
    gasMilli: number;
  };
  quotas: {
    number: string;
    waterMilli: number;
    gasMilli: number;
    waterCents: number;
    gasCents: number;
    commonCents: number;
    reserveCents: number;
    totalCents: number;
  }[];
  cash: {
    openingCents: number;
    receivedCents: number;
    expensesCents: number;
    closingCents: number;
  };
};

export type PublicDashboard = {
  name: string;
  apartmentCount: number;
  /** Meses disponíveis, do mais recente para o mais antigo. */
  competences: string[];
  month: PublicMonth | null;
};
