import {
  emptyCharge,
  resolveChargeUnit,
  type AllocationConfig,
  type CondoState,
  type Month,
} from "@shared/condo";
import { makeAllocationConfig } from "@shared/rateio";

/** Uma prévia nunca modifica o estado salvo. Inclui cobranças ainda não criadas. */
export function buildAllocationPreview(
  state: CondoState,
  month: Month,
  method: AllocationConfig["method"],
  readonly = false,
  selectedUnitIds?: string[]
) {
  let config: AllocationConfig | undefined;
  let error: string | undefined;
  try {
    config = readonly
      ? month.allocation
      : makeAllocationConfig(state, method, selectedUnitIds);
  } catch (cause) {
    error =
      cause instanceof Error
        ? cause.message
        : "Não foi possível calcular a prévia.";
  }
  const unitIds = new Set([
    ...(config?.participants.map(p => p.unitId) ?? []),
    ...month.charges.map(charge => charge.unitId),
    ...(!readonly
      ? state.units.filter(unit => unit.active).map(unit => unit.id)
      : []),
  ]);
  const byUnit = new Map(month.charges.map(charge => [charge.unitId, charge]));
  const units = state.units
    .filter(unit => unitIds.has(unit.id))
    .map(unit => {
      const charge = byUnit.get(unit.id);
      return readonly && charge
        ? (resolveChargeUnit(state, charge) ?? unit)
        : unit;
    })
    .sort((a, b) =>
      a.number.localeCompare(b.number, "pt-BR", { numeric: true })
    );
  const draftMonth: Month = {
    ...month,
    allocation: config,
    charges: units.map(unit => byUnit.get(unit.id) ?? emptyCharge(unit.id)),
  };
  return {
    config,
    error,
    units,
    draftMonth,
    hasUnsavedChanges:
      !readonly && JSON.stringify(config) !== JSON.stringify(month.allocation),
  };
}
