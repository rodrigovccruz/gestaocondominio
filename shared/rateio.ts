import type { AllocationConfig, CondoState, Month } from "./condo";

/** Distribuição pelo método dos maiores restos, com desempate estável por ID. */
export function allocateCents(
  amountCents: number,
  participants: { unitId: string; weight: number }[]
) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0)
    throw new Error("Valor de rateio inválido.");
  if (
    !participants.length ||
    participants.some(p => !Number.isSafeInteger(p.weight) || p.weight <= 0) ||
    new Set(participants.map(p => p.unitId)).size !== participants.length
  )
    throw new Error(
      "O rateio precisa de participantes únicos com pesos positivos."
    );
  const totalWeight = participants.reduce((sum, p) => sum + p.weight, 0);
  if (!Number.isSafeInteger(totalWeight))
    throw new Error("Soma de pesos inválida.");
  const rows = participants.map(p => {
    const numerator = amountCents * p.weight;
    if (!Number.isSafeInteger(numerator))
      throw new Error("Limite de cálculo do rateio excedido.");
    return {
      unitId: p.unitId,
      cents: Math.floor(numerator / totalWeight),
      remainder: numerator % totalWeight,
    };
  });
  const remainderCents =
    amountCents - rows.reduce((sum, p) => sum + p.cents, 0);
  const ordered = [...rows].sort(
    (a, b) =>
      b.remainder - a.remainder ||
      (a.unitId < b.unitId ? -1 : a.unitId > b.unitId ? 1 : 0)
  );
  for (let i = 0; i < remainderCents; i++) ordered[i].cents++;
  return Object.fromEntries(rows.map(p => [p.unitId, p.cents])) as Record<
    string,
    number
  >;
}

export function calculateExpenseAllocation(
  month: Pick<Month, "allocation" | "expenses">
) {
  const byUnit: Record<string, number> = {};
  const expenses: {
    expenseId: string;
    amountCents: number;
    byUnit: Record<string, number>;
  }[] = [];
  if (!month.allocation) return { totalCents: 0, byUnit, expenses };
  const participants = month.allocation.participants.map(p => ({
    unitId: p.unitId,
    weight: month.allocation!.method === "equal" ? 1 : p.weight,
  }));
  for (const participant of participants) byUnit[participant.unitId] = 0;
  for (const expense of month.expenses.filter(e => e.rateable === true)) {
    const parts = allocateCents(expense.amountCents, participants);
    for (const [unitId, cents] of Object.entries(parts))
      byUnit[unitId] += cents;
    expenses.push({
      expenseId: expense.id,
      amountCents: expense.amountCents,
      byUnit: parts,
    });
  }
  return {
    totalCents: expenses.reduce((sum, expense) => sum + expense.amountCents, 0),
    byUnit,
    expenses,
  };
}

/** Captura participantes/frações atuais; nenhuma alteração cadastral posterior os muda. */
export function makeAllocationConfig(
  state: CondoState,
  method: AllocationConfig["method"],
  selectedUnitIds?: string[]
): AllocationConfig {
  const activeUnits = state.units.filter(unit => unit.active);
  const selectedIds = selectedUnitIds ?? activeUnits.map(unit => unit.id);
  if (
    !selectedIds.length ||
    new Set(selectedIds).size !== selectedIds.length ||
    selectedIds.some(id => !activeUnits.some(unit => unit.id === id))
  )
    throw new Error(
      "Selecione unidades ativas, sem duplicidade, para configurar o rateio."
    );
  const units = activeUnits.filter(unit => selectedIds.includes(unit.id));
  if (!units.length)
    throw new Error(
      "Cadastre ao menos uma unidade ativa antes de configurar o rateio."
    );
  if (method === "equal")
    return {
      method,
      participants: units.map(unit => ({ unitId: unit.id, weight: 1 })),
    };
  const allFractions = activeUnits.map(unit => ({
    unitId: unit.id,
    weight: Math.round(unit.fraction * 1000),
  }));
  if (allFractions.some(p => p.weight <= 0))
    throw new Error(
      "Preencha uma fração ideal positiva em todas as unidades ativas."
    );
  const sum = allFractions.reduce((total, p) => total + p.weight, 0);
  if (Math.abs(sum - 100_000) > 10)
    throw new Error(
      "As frações ideais das unidades ativas devem somar 100% (tolerância de 0,01 ponto percentual)."
    );
  const fractions = allFractions.filter(participant =>
    selectedIds.includes(participant.unitId)
  );
  const normalized = allocateCents(100_000, fractions);
  const participants = fractions.map(participant => ({
    unitId: participant.unitId,
    weight: normalized[participant.unitId],
  }));
  return { method, participants };
}

export function allocationConfigurationChanged(
  state: CondoState,
  month: Month
) {
  if (!month.allocation) return false;
  try {
    return (
      JSON.stringify(
        makeAllocationConfig(
          state,
          month.allocation.method,
          month.allocation.participants.map(p => p.unitId)
        )
      ) !== JSON.stringify(month.allocation)
    );
  } catch {
    return true;
  }
}
