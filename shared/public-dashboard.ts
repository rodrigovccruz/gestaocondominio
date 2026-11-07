export type PublicExpenseCategory =
  | "Água"
  | "Gás"
  | "Manutenção"
  | "Limpeza"
  | "Administração"
  | "Outros";

export type PublicExpense = {
  id: string;
  description: string;
  category: PublicExpenseCategory;
  date: string;
  amountCents: number;
};

export type PublicDashboard = {
  name: string;
  apartmentCount: number;
  latest: {
    competence: string;
    status: "open" | "closed";
    totalExpensesCents: number;
    expenses: PublicExpense[];
    categories: { category: PublicExpenseCategory; amountCents: number }[];
  } | null;
};
