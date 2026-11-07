import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  CircleOff,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  calculateCharge,
  formatMoney,
  type AllocationConfig,
  type CondoState,
  type Month,
} from "@shared/condo";
import {
  allocationConfigurationChanged,
  calculateExpenseAllocation,
  makeAllocationConfig,
} from "@shared/rateio";
import { buildAllocationPreview } from "./rateio-utils";
import {
  EmptyState,
  MoneyLine,
  Notice,
  Panel,
  SaveButton,
  SectionHeading,
  StatusBadge,
} from "./condo-ui";

function methodLabel(method: AllocationConfig["method"]) {
  return method === "equal" ? "Divisão igual" : "Fração ideal";
}

export function RateioPanel({
  state,
  month,
  disabled,
  pending,
  onConfigure,
  onClear,
  onGoExpenses,
}: {
  state: CondoState;
  month?: Month;
  disabled?: boolean;
  pending?: boolean;
  onConfigure: (method: AllocationConfig["method"], unitIds: string[]) => void;
  onClear: () => void;
  onGoExpenses?: () => void;
}) {
  const [method, setMethod] = useState<AllocationConfig["method"]>(
    month?.allocation?.method ?? "equal"
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(
    () =>
      month?.allocation?.participants.map(p => p.unitId) ??
      state.units.filter(unit => unit.active).map(unit => unit.id)
  );

  useEffect(() => {
    setMethod(month?.allocation?.method ?? "equal");
  }, [month?.id, month?.allocation?.method]);
  useEffect(() => {
    const activeIds = state.units
      .filter(unit => unit.active)
      .map(unit => unit.id);
    setSelectedIds(
      month?.allocation?.participants
        .map(p => p.unitId)
        .filter(id => activeIds.includes(id)) ?? activeIds
    );
  }, [month?.id, month?.allocation, state.units]);

  const activeUnits = useMemo(
    () =>
      state.units
        .filter(unit => unit.active)
        .sort((a, b) =>
          a.number.localeCompare(b.number, "pt-BR", { numeric: true })
        ),
    [state.units]
  );
  const previewConfig = useMemo(() => {
    return month
      ? buildAllocationPreview(
          state,
          month,
          method,
          Boolean(disabled),
          selectedIds
        )
      : undefined;
  }, [method, state, month, disabled, selectedIds]);
  const effectiveConfig = previewConfig?.config;
  const previewMonth = previewConfig?.draftMonth;
  const displayUnits = previewConfig?.units ?? activeUnits;
  const allocation = previewMonth
    ? calculateExpenseAllocation(previewMonth)
    : {
        totalCents: 0,
        byUnit: {} as Record<string, number>,
        expenses: [] as {
          expenseId: string;
          amountCents: number;
          byUnit: Record<string, number>;
        }[],
      };
  const outdated = month ? allocationConfigurationChanged(state, month) : false;
  const hasManualQuota = Boolean(
    month?.charges.some(charge => charge.condoCents > 0)
  );

  if (!month) {
    return (
      <Panel>
        <EmptyState
          icon={Calculator}
          title="Rateio começa com uma competência"
          description="Selecione ou crie uma competência para configurar como as despesas compartilhadas serão distribuídas."
        />
      </Panel>
    );
  }

  const participantIds = new Set(
    effectiveConfig?.participants.map(participant => participant.unitId) ?? []
  );
  const chargeByUnit = new Map(
    month.charges.map(charge => [charge.unitId, charge])
  );
  const rateableExpenses = month.expenses.filter(
    expense => expense.rateable === true
  );

  return (
    <div className="space-y-5">
      <Panel>
        <SectionHeading
          eyebrow="Despesas compartilhadas"
          title="Rateio da competência"
          description="Escolha o método e as unidades participantes e confirme explicitamente. A configuração captura os pesos no momento do salvamento e não altera quotas manuais existentes."
          action={
            <div className="rateio-actions">
              {month.allocation ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled || pending}
                  onClick={onClear}
                >
                  <Trash2 size={15} /> Limpar configuração
                </Button>
              ) : null}
              <Button
                size="sm"
                disabled={disabled || pending || !effectiveConfig}
                onClick={() => onConfigure(method, selectedIds)}
              >
                {outdated ? (
                  <RefreshCw size={15} />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                {month.allocation
                  ? "Atualizar configuração"
                  : "Configurar rateio"}
              </Button>
            </div>
          }
        />
        {disabled ? (
          <Notice>
            Competência fechada: a configuração fica somente para consulta.
          </Notice>
        ) : null}
        {outdated ? (
          <div className="rateio-warning">
            <AlertTriangle size={17} />
            <span>
              A composição atual das unidades ativas ou suas frações mudou desde
              o snapshot. A prévia só será persistida quando você confirmar
              “Atualizar configuração”.
            </span>
          </div>
        ) : null}
        {
          <div className="rateio-config-grid">
            <div className="rateio-method-card">
              <label htmlFor="allocation-method">Método da prévia</label>
              <Select
                value={method}
                onValueChange={value =>
                  setMethod(value as AllocationConfig["method"])
                }
                disabled={disabled || pending}
              >
                <SelectTrigger id="allocation-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal">
                    Divisão igual entre unidades selecionadas
                  </SelectItem>
                  <SelectItem value="fraction">
                    Fração ideal das unidades selecionadas
                  </SelectItem>
                </SelectContent>
              </Select>
              <small>
                {effectiveConfig?.participants.length ?? activeUnits.length}{" "}
                participantes · {methodLabel(method)}
              </small>
            </div>
            <div className="rateio-method-card rateio-snapshot-card">
              <span>Snapshot usado no cálculo</span>
              <strong>
                {effectiveConfig
                  ? `${effectiveConfig.participants.length} participantes`
                  : "Ainda não configurado"}
              </strong>
              <small>
                {month.allocation
                  ? disabled
                    ? "Snapshot salvo da competência fechada."
                    : "A prévia só será salva após confirmação."
                  : "Esta é uma simulação; nada foi salvo ainda."}
              </small>
            </div>
          </div>
        }
        {!disabled ? (
          <fieldset className="rateio-participants">
            <legend>Unidades que participam deste rateio</legend>
            <div className="rateio-participants-grid">
              {activeUnits.map(unit => (
                <label key={unit.id}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(unit.id)}
                    disabled={pending}
                    onChange={event =>
                      setSelectedIds(current =>
                        event.target.checked
                          ? [...current, unit.id]
                          : current.filter(id => id !== unit.id)
                      )
                    }
                  />
                  <span>{unit.number}</span>
                </label>
              ))}
            </div>
            <small>
              As despesas marcadas são distribuídas apenas entre estas unidades.
              A fração ideal é proporcional ao conjunto selecionado; consumos
              individuais continuam separados.
            </small>
          </fieldset>
        ) : null}
        {previewConfig?.error ? (
          <div className="rateio-warning">
            <AlertTriangle size={17} />
            <span>
              {previewConfig.error} Escolha divisão igual ou corrija o cadastro
              para continuar.
            </span>
          </div>
        ) : null}
        {previewConfig?.hasUnsavedChanges && !previewConfig.error ? (
          <Notice>
            Prévia não salva: as cobranças continuam usando a configuração
            anterior até você confirmar.
          </Notice>
        ) : null}
        {hasManualQuota ? (
          <div className="rateio-warning rateio-warning-soft">
            <AlertTriangle size={17} />
            <span>
              Há quotas manuais de condomínio em cobranças existentes. O rateio
              de despesas é adicional e não substitui esses valores; confira
              para evitar cobrança duplicada.
            </span>
          </div>
        ) : null}
        {!rateableExpenses.length ? (
          <Notice>
            Nenhuma despesa está marcada para rateio nesta competência. Você
            pode configurar agora e marcar despesas individualmente depois.
            {onGoExpenses ? (
              <button
                type="button"
                className="link-button"
                onClick={onGoExpenses}
              >
                Ver despesas
              </button>
            ) : null}
          </Notice>
        ) : null}
      </Panel>

      <Panel>
        <SectionHeading
          eyebrow="Conferência"
          title="Despesas e distribuição"
          description="Cada centavo rateável é distribuído pelo método escolhido. A soma da tabela permanece exatamente igual ao total das despesas marcadas."
        />
        <div className="rateio-summary-grid">
          <div>
            <span>Total de despesas</span>
            <strong>
              {formatMoney(
                month.expenses.reduce(
                  (sum, expense) => sum + expense.amountCents,
                  0
                )
              )}
            </strong>
          </div>
          <div>
            <span>Total rateado</span>
            <strong>{formatMoney(allocation.totalCents)}</strong>
          </div>
          <div>
            <span>Fora do rateio</span>
            <strong>
              {formatMoney(
                month.expenses
                  .filter(expense => expense.rateable !== true)
                  .reduce((sum, expense) => sum + expense.amountCents, 0)
              )}
            </strong>
          </div>
          <div>
            <span>Conferência</span>
            <strong className="rateio-exact">
              {previewConfig?.error ? (
                "Prévia indisponível"
              ) : (
                <>
                  <CheckCircle2 size={15} /> Exato
                </>
              )}
            </strong>
          </div>
        </div>
        <div className="table-scroll rateio-table-wrap">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Despesa</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Rateio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {month.expenses.length ? (
                month.expenses.map(expense => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <strong className="table-primary">
                        {expense.description}
                      </strong>
                    </TableCell>
                    <TableCell>{expense.category}</TableCell>
                    <TableCell>{formatMoney(expense.amountCents)}</TableCell>
                    <TableCell>
                      {expense.rateable === true ? (
                        <StatusBadge
                          status={month.allocation ? "open" : "pending"}
                          label={
                            month.allocation
                              ? "Rateada"
                              : "Aguardando configuração"
                          }
                        />
                      ) : (
                        <span className="muted-text">
                          <CircleOff size={14} /> Fora do rateio
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="muted-text">
                    Nenhuma despesa nesta competência.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Panel>

      <Panel>
        <SectionHeading
          eyebrow="Prévia por unidade"
          title="Rateio separado da cobrança"
          description="Consumo de água e gás e valores fixos continuam separados; o rateio aparece como componente próprio da cobrança."
        />
        <div className="table-scroll rateio-table-wrap">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead>Consumo</TableHead>
                <TableHead>Fixos e adicionais</TableHead>
                <TableHead>Despesas rateadas</TableHead>
                <TableHead>Total projetado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayUnits.map(unit => {
                const charge = chargeByUnit.get(unit.id);
                const computed =
                  charge && previewMonth
                    ? calculateCharge(charge, previewMonth)
                    : undefined;
                return (
                  <TableRow key={unit.id}>
                    <TableCell>
                      <strong className="table-primary">{unit.number}</strong>
                      <small className="table-secondary">
                        {participantIds.has(unit.id)
                          ? "Participante desta distribuição"
                          : "Fora desta distribuição"}
                      </small>
                    </TableCell>
                    <TableCell>
                      {formatMoney(
                        (computed?.waterCents ?? 0) + (computed?.gasCents ?? 0)
                      )}
                    </TableCell>
                    <TableCell>
                      {formatMoney(
                        (charge?.condoCents ?? 0) +
                          (charge?.reserveCents ?? 0) +
                          (charge?.fineCents ?? 0) +
                          (charge?.otherCents ?? 0)
                      )}
                    </TableCell>
                    <TableCell>
                      <strong>
                        {formatMoney(allocation.byUnit[unit.id] ?? 0)}
                      </strong>
                    </TableCell>
                    <TableCell>
                      {formatMoney(
                        computed?.totalCents ?? allocation.byUnit[unit.id] ?? 0
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell colSpan={3}>
                  <strong>Total distribuído</strong>
                </TableCell>
                <TableCell>
                  <strong>
                    {formatMoney(
                      Object.values(allocation.byUnit).reduce(
                        (sum, cents) => sum + cents,
                        0
                      )
                    )}
                  </strong>
                </TableCell>
                <TableCell>
                  <strong>
                    {formatMoney(
                      previewMonth?.charges.reduce(
                        (sum, charge) =>
                          sum +
                          calculateCharge(charge, previewMonth).totalCents,
                        0
                      ) ?? 0
                    )}
                  </strong>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div className="rateio-breakdown">
          <MoneyLine
            label="Despesas marcadas para rateio"
            cents={allocation.totalCents}
          />
          <MoneyLine
            label="Soma das parcelas por unidade"
            cents={Object.values(allocation.byUnit).reduce(
              (sum, cents) => sum + cents,
              0
            )}
            strong
          />
        </div>
      </Panel>
    </div>
  );
}

export { allocationConfigurationChanged };
