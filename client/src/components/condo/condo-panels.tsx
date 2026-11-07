import { useMemo, useState } from "react";
import {
  Archive,
  Download,
  Edit3,
  FileText,
  Filter,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveChargeUnit } from "@shared/condo";
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
  calculateMonth,
  exportMonthCsv,
  formatMoney,
  formatReading,
  monthLabel,
  moneyInput,
  statusForCharge,
  type Charge,
  type CondoState,
  type Expense,
  type Month,
  type Unit,
} from "./condo-utils";
import {
  AddButton,
  EmptyState,
  FormulaSafeHint,
  MetricCard,
  MoneyLine,
  Notice,
  Panel,
  PrintButton,
  SectionHeading,
  StatusBadge,
} from "./condo-ui";

export function OverviewPanel({
  state,
  month,
  onNewMonth,
  onEditMonth,
  onGoUnits,
  onGoReadings,
  onGoExpenses,
}: {
  state: CondoState;
  month?: Month;
  onNewMonth: () => void;
  onEditMonth: () => void;
  onGoUnits: () => void;
  onGoReadings: () => void;
  onGoExpenses: () => void;
}) {
  if (!month)
    return (
      <Panel>
        <EmptyState
          icon={History}
          title="Nenhuma competência aberta"
          description="Cadastre as unidades e abra a primeira competência para acompanhar leituras, cobranças e despesas em um só lugar."
          action={
            <Button onClick={onNewMonth}>
              <Plus size={16} /> Criar primeira competência
            </Button>
          }
          secondary={
            <Button variant="outline" onClick={onGoUnits}>
              <UsersRound size={16} /> Cadastrar unidades
            </Button>
          }
        />
      </Panel>
    );
  const summary = calculateMonth(month);
  const activeCount = state.units.filter(unit => unit.active).length;
  const paidCount = month.charges.filter(
    charge => statusForCharge(charge, month).tone === "paid"
  ).length;
  const pendingCount = month.charges.filter(
    charge => statusForCharge(charge, month).tone === "pending"
  ).length;
  return (
    <div className="space-y-5">
      <div className="overview-grid">
        <MetricCard
          label="Total lançado"
          value={formatMoney(summary.billedCents)}
          detail={`${month.charges.length} cobranças na competência`}
          tone="green"
          icon={ReceiptText}
        />
        <MetricCard
          label="Recebido"
          value={formatMoney(summary.receivedCents)}
          detail={`${paidCount} unidades quitadas`}
          tone="blue"
          icon={TrendingUp}
        />
        <MetricCard
          label="Em aberto"
          value={formatMoney(summary.outstandingCents)}
          detail={`${pendingCount} unidades pendentes · créditos ${formatMoney(summary.creditCents)}`}
          tone="terracotta"
          icon={TrendingDown}
        />
        <MetricCard
          label="Saldo em caixa"
          value={formatMoney(summary.cashBalanceCents)}
          detail={`Projetado: ${formatMoney(summary.projectedBalanceCents)}`}
          tone="neutral"
          icon={Settings2}
        />
      </div>
      <div className="dashboard-grid">
        <Panel>
          <SectionHeading
            eyebrow="Visão financeira"
            title="Fluxo da competência"
            description="Saldo em caixa considera apenas recebimentos e despesas. O projetado considera todos os lançamentos."
            action={
              month.status === "open" ? (
                <Button variant="outline" size="sm" onClick={onEditMonth}>
                  <Edit3 size={15} /> Editar parâmetros
                </Button>
              ) : (
                <StatusBadge status="closed" label="Parâmetros bloqueados" />
              )
            }
          />
          <div className="financial-list">
            <MoneyLine
              label="Saldo de abertura"
              cents={month.openingBalanceCents}
            />
            <MoneyLine
              label="Recebimentos"
              cents={summary.receivedCents}
              tone="positive"
            />
            <MoneyLine
              label="Despesas"
              cents={summary.expensesCents}
              tone="negative"
            />
            <MoneyLine
              label="Rateio de despesas"
              cents={summary.allocatedCents}
            />
            <MoneyLine
              label="Saldo em caixa"
              cents={summary.cashBalanceCents}
              strong
            />
            <div className="financial-divider" />
            <MoneyLine
              label="Lançamentos previstos"
              cents={summary.billedCents}
            />
            <MoneyLine
              label="Saldo projetado"
              cents={summary.projectedBalanceCents}
              strong
            />
          </div>
        </Panel>
        <Panel>
          <SectionHeading
            eyebrow="Composição"
            title="Cobranças por unidade"
            description={`${activeCount} unidades ativas · fração ideal apenas informativa`}
          />
          <div className="mini-stat-list">
            <div>
              <span>Água</span>
              <strong>{formatMoney(summary.waterCents)}</strong>
              <small>{formatReading(summary.waterMilli)} m³</small>
            </div>
            <div>
              <span>Gás</span>
              <strong>{formatMoney(summary.gasCents)}</strong>
              <small>{formatReading(summary.gasMilli)} m³</small>
            </div>
            <div>
              <span>Fundo reserva lançado</span>
              <strong>{formatMoney(summary.reserveCents)}</strong>
              <small>componente da cobrança</small>
            </div>
            <div>
              <span>Despesas</span>
              <strong>{formatMoney(summary.expensesCents)}</strong>
              <small>{month.expenses.length} registros</small>
            </div>
            <div>
              <span>Rateio de despesas</span>
              <strong>{formatMoney(summary.allocatedCents)}</strong>
              <small>{month.allocation ? "snapshot ativo" : "não configurado"}</small>
            </div>
          </div>
        </Panel>
      </div>
      <Panel>
        <SectionHeading
          eyebrow="Próximos passos"
          title="Mantenha a competência em dia"
        />
        <div className="action-grid">
          <button type="button" className="action-card" onClick={onGoReadings}>
            <span className="action-card-icon">
              <ReceiptText size={19} />
            </span>
            <span>
              <strong>Atualizar leituras</strong>
              <small>Água, gás, valores fixos e pagamentos.</small>
            </span>
            <span className="action-card-arrow">→</span>
          </button>
          <button type="button" className="action-card" onClick={onGoExpenses}>
            <span className="action-card-icon">
              <TrendingDown size={19} />
            </span>
            <span>
              <strong>Registrar despesas</strong>
              <small>Organize a saída de caixa por categoria.</small>
            </span>
            <span className="action-card-arrow">→</span>
          </button>
          <button type="button" className="action-card" onClick={onGoUnits}>
            <span className="action-card-icon">
              <UsersRound size={19} />
            </span>
            <span>
              <strong>Conferir unidades</strong>
              <small>Moradores, frações e unidades arquivadas.</small>
            </span>
            <span className="action-card-arrow">→</span>
          </button>
        </div>
      </Panel>
    </div>
  );
}

export function UnitsPanel({
  state,
  currentMonth,
  onAdd,
  onEdit,
  onArchive,
  onExport,
}: {
  state: CondoState;
  currentMonth?: Month;
  onAdd: () => void;
  onEdit: (unit: Unit) => void;
  onArchive: (unit: Unit) => void;
  onExport: (unit: Unit) => void;
}) {
  const [search, setSearch] = useState("");
  const units = useMemo(
    () =>
      state.units
        .filter(unit =>
          `${unit.number} ${unit.resident}`
            .toLowerCase()
            .includes(search.toLowerCase())
        )
        .sort((a, b) =>
          a.number.localeCompare(b.number, "pt-BR", { numeric: true })
        ),
    [state.units, search]
  );
  return (
    <Panel>
      <SectionHeading
        eyebrow="Cadastro"
        title="Unidades"
        description="Arquivar preserva referências em todas as competências."
        action={<AddButton onClick={onAdd}>Nova unidade</AddButton>}
      />
      <div className="toolbar-row">
        <div className="search-field">
          <Search size={16} />
          <Input
            aria-label="Buscar unidade"
            placeholder="Buscar por número ou morador"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>
        <span className="toolbar-count">
          {state.units.filter(unit => unit.active).length} ativas ·{" "}
          {state.units.filter(unit => !unit.active).length} arquivadas
        </span>
      </div>
      {units.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="Nenhuma unidade encontrada"
          description="Ajuste a busca ou cadastre a primeira unidade do condomínio."
          action={<AddButton onClick={onAdd}>Cadastrar unidade</AddButton>}
        />
      ) : (
        <div className="table-scroll">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead>Morador responsável</TableHead>
                <TableHead>Fração ideal</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map(unit => (
                <TableRow key={unit.id}>
                  <TableCell>
                    <strong className="table-primary">{unit.number}</strong>
                  </TableCell>
                  <TableCell>
                    {unit.resident || (
                      <span className="muted-text">Não informado</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {unit.fraction.toLocaleString("pt-BR", {
                      maximumFractionDigits: 2,
                    })}
                    % <span className="muted-text">informativa</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={unit.active ? "open" : "closed"}
                      label={unit.active ? "Ativa" : "Arquivada"}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="table-actions">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Editar unidade"
                        aria-label={`Editar unidade ${unit.number}`}
                        onClick={() => onEdit(unit)}
                      >
                        <Pencil size={15} />
                      </Button>
                      {unit.active ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Arquivar unidade"
                          aria-label={`Arquivar unidade ${unit.number}`}
                          onClick={() => onArchive(unit)}
                        >
                          <Archive size={15} />
                        </Button>
                      ) : null}
                      {currentMonth ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Exportar extrato"
                          aria-label={`Exportar extrato ${unit.number}`}
                          onClick={() => onExport(unit)}
                        >
                          <Download size={15} />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}

export function ReadingsPanel({
  state,
  month,
  onEdit,
  onStatement,
  onExport,
  disabled,
}: {
  state: CondoState;
  month?: Month;
  onEdit: (unit: Unit, charge?: Charge) => void;
  onStatement: (unit: Unit, charge: Charge) => void;
  onExport: (unit?: Unit, filteredUnitIds?: string[]) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  if (!month)
    return (
      <Panel>
        <EmptyState
          icon={ReceiptText}
          title="Leituras começam com uma competência"
          description="Crie uma competência para lançar os medidores e os componentes da cobrança."
        />
      </Panel>
    );
  const chargedUnitIds = new Set(month.charges.map(charge => charge.unitId));
  const missingUnits =
    month.status === "open"
      ? state.units
          .filter(unit => unit.active && !chargedUnitIds.has(unit.id))
          .sort((a, b) =>
            a.number.localeCompare(b.number, "pt-BR", { numeric: true })
          )
      : [];
  const rows = month.charges
    .map(charge => ({ charge, unit: resolveChargeUnit(state, charge) }))
    .filter(row => row.unit)
    .filter(row =>
      `${row.unit?.number} ${row.unit?.resident}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .filter(
      row =>
        status === "all" || statusForCharge(row.charge, month).tone === status
    );
  return (
    <Panel>
      <SectionHeading
        eyebrow={`Competência ${month.competence}`}
        title="Leituras e cobranças"
        description={
          disabled
            ? "Competência fechada: visualização e exportação disponíveis."
            : "Edite leituras com três casas decimais e valores em centavos."
        }
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onExport(
                undefined,
                rows.map(row => row.charge.unitId)
              )
            }
          >
            <Download size={15} /> Exportar CSV
          </Button>
        }
      />
      <div className="toolbar-row toolbar-wrap">
        <div className="search-field">
          <Search size={16} />
          <Input
            aria-label="Buscar cobrança"
            placeholder="Buscar apartamento ou morador"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger
            className="toolbar-select"
            aria-label="Filtrar por status"
          >
            <Filter size={15} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="paid">Pagos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="credit">Créditos</SelectItem>
          </SelectContent>
        </Select>
        <span className="toolbar-count">
          {rows.length} de {month.charges.length}
        </span>
      </div>
      {missingUnits.length ? (
        <Notice>
          <strong>Unidades sem cobrança:</strong>{" "}
          <span className="flex flex-wrap items-center gap-2 mt-2">
            {missingUnits.map(unit => (
              <Button
                key={unit.id}
                variant="outline"
                size="sm"
                onClick={() => onEdit(unit, undefined)}
              >
                <Plus size={15} /> Lançar unidade {unit.number}
              </Button>
            ))}
          </span>
        </Notice>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhuma cobrança encontrada"
          description="Ajuste os filtros para localizar a unidade."
        />
      ) : (
        <div className="table-scroll">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead>Leituras</TableHead>
                <TableHead>Consumo</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ charge, unit }) => {
                const computed = calculateCharge(charge, month);
                const chargeStatus = statusForCharge(charge, month);
                return (
                  <TableRow key={charge.unitId}>
                    <TableCell>
                      <strong className="table-primary">{unit?.number}</strong>
                      <small className="table-secondary">
                        {unit?.resident || "Morador não informado"}
                      </small>
                    </TableCell>
                    <TableCell>
                      <span className="reading-pair">
                        <span>
                          Água {formatReading(charge.waterPrevious)} →{" "}
                          {formatReading(charge.waterCurrent)}
                        </span>
                        <span>
                          Gás {formatReading(charge.gasPrevious)} →{" "}
                          {formatReading(charge.gasCurrent)}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="reading-pair">
                        <span>{formatReading(computed.waterMilli)} m³</span>
                        <span>{formatReading(computed.gasMilli)} m³</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <strong>{formatMoney(computed.totalCents)}</strong>
                    </TableCell>
                    <TableCell>{formatMoney(charge.paidCents)}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={chargeStatus.tone}
                        label={chargeStatus.label}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="table-actions">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Ver extrato"
                          aria-label={`Ver extrato da unidade ${unit?.number}`}
                          onClick={() => unit && onStatement(unit, charge)}
                        >
                          <FileText size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={
                            disabled ? "Competência fechada" : "Editar cobrança"
                          }
                          aria-label={`Editar cobrança da unidade ${unit?.number}`}
                          disabled={disabled}
                          onClick={() => unit && onEdit(unit, charge)}
                        >
                          <Pencil size={15} />
                        </Button>
                        {unit ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Exportar unidade"
                            aria-label={`Exportar unidade ${unit.number}`}
                            onClick={() => onExport(unit)}
                          >
                            <Download size={15} />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}

export function ExpensesPanel({
  month,
  onAdd,
  onEdit,
  onRemove,
  disabled,
  onGoAllocation,
}: {
  month?: Month;
  onAdd: () => void;
  onEdit: (expense: Expense) => void;
  onRemove: (expense: Expense) => void;
  disabled?: boolean;
  onGoAllocation?: () => void;
}) {
  if (!month)
    return (
      <Panel>
        <EmptyState
          icon={TrendingDown}
          title="Nenhuma competência selecionada"
          description="As despesas ficam organizadas dentro de cada competência."
        />
      </Panel>
    );
  const total = month.expenses.reduce(
    (sum, expense) => sum + expense.amountCents,
    0
  );
  const grouped = month.expenses.reduce<Record<string, number>>(
    (result, expense) => {
      result[expense.category] =
        (result[expense.category] ?? 0) + expense.amountCents;
      return result;
    },
    {}
  );
  return (
    <div className="space-y-5">
      <Panel>
        <SectionHeading
          eyebrow="Saídas de caixa"
          title="Despesas"
          description={
            disabled
              ? "Competência fechada: despesas em modo somente leitura."
              : "Registre cada saída na data e categoria corretas."
          }
          action={
            !disabled ? (
              <AddButton onClick={onAdd}>Nova despesa</AddButton>
            ) : undefined
          }
        />
        {month.expenses.some(expense => expense.rateable === true) &&
        !month.allocation ? (
          <Notice>
            <strong>Há despesas marcadas para rateio, mas a competência ainda não tem configuração.</strong>{" "}
            {onGoAllocation ? (
              <button type="button" className="link-button" onClick={onGoAllocation}>
                Configurar rateio
              </button>
            ) : null}
          </Notice>
        ) : null}
        <div className="expense-summary">
          <div>
            <span>Total da competência</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          {Object.entries(grouped).map(([category, cents]) => (
            <div key={category}>
              <span>{category}</span>
              <strong>{formatMoney(cents)}</strong>
            </div>
          ))}
        </div>
        {month.expenses.length === 0 ? (
          <EmptyState
            icon={TrendingDown}
            title="Nenhuma despesa lançada"
            description="O saldo em caixa permanece sem saídas nesta competência."
            action={
              !disabled ? (
                <AddButton onClick={onAdd}>Adicionar despesa</AddButton>
              ) : undefined
            }
          />
        ) : (
          <div className="table-scroll">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Rateio</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {month.expenses.map(expense => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <strong className="table-primary">
                        {expense.description}
                      </strong>
                    </TableCell>
                    <TableCell>{expense.category}</TableCell>
                    <TableCell>
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeZone: "UTC",
                      }).format(new Date(`${expense.date}T12:00:00Z`))}
                    </TableCell>
                    <TableCell>
                      {expense.rateable === true ? (
                        <StatusBadge
                          status={month.allocation ? "open" : "pending"}
                          label={month.allocation ? "Rateada" : "Sem configuração"}
                        />
                      ) : (
                        <span className="muted-text">Fora do rateio</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <strong>{formatMoney(expense.amountCents)}</strong>
                    </TableCell>
                    <TableCell>
                      <div className="table-actions justify-end">
                        {!disabled ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Editar despesa"
                              aria-label={`Editar ${expense.description}`}
                              onClick={() => onEdit(expense)}
                            >
                              <Pencil size={15} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Remover despesa"
                              aria-label={`Remover ${expense.description}`}
                              onClick={() => onRemove(expense)}
                            >
                              <Trash2 size={15} />
                            </Button>
                          </>
                        ) : (
                          <span className="muted-text">Somente leitura</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function HistoryPanel({
  state,
  selectedMonth,
  onSelectMonth,
  onExport,
  onExportUnit,
}: {
  state: CondoState;
  selectedMonth?: Month;
  onSelectMonth: (competence: string) => void;
  onExport: (month: Month) => void;
  onExportUnit: (month: Month, unit: Unit) => void;
}) {
  const months = [...state.months].sort((a, b) =>
    b.competence.localeCompare(a.competence)
  );
  const unitById = new Map(state.units.map(unit => [unit.id, unit]));
  const previous = selectedMonth
    ? months.find(month => month.competence < selectedMonth.competence)
    : undefined;
  const selectedSummary = selectedMonth
    ? calculateMonth(selectedMonth)
    : undefined;
  const previousSummary = previous ? calculateMonth(previous) : undefined;
  return (
    <div className="space-y-5">
      <Panel>
        <SectionHeading
          eyebrow="Arquivo"
          title="Histórico e relatórios"
          description="Compare competências e exporte um extrato em CSV com colunas pt-BR."
          action={
            selectedMonth ? (
              <div className="flex gap-2">
                <PrintButton />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onExport(selectedMonth)}
                >
                  <Download size={15} /> Exportar CSV
                </Button>
              </div>
            ) : undefined
          }
        />
        {months.length === 0 ? (
          <EmptyState
            icon={History}
            title="Seu histórico aparecerá aqui"
            description="Depois que a primeira competência for criada, ela ficará disponível para consulta e exportação."
          />
        ) : (
          <div className="table-scroll">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total lançado</TableHead>
                  <TableHead>Recebido</TableHead>
                  <TableHead>Despesas</TableHead>
                  <TableHead>Saldo em caixa</TableHead>
                  <TableHead className="text-right">Relatório</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {months.map(month => {
                  const summary = calculateMonth(month);
                  return (
                    <TableRow
                      key={month.id}
                      className={
                        selectedMonth?.id === month.id ? "row-selected" : ""
                      }
                    >
                      <TableCell>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => onSelectMonth(month.competence)}
                        >
                          {monthLabel(month.competence)}
                        </button>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={month.status} />
                      </TableCell>
                      <TableCell>{formatMoney(summary.billedCents)}</TableCell>
                      <TableCell>
                        {formatMoney(summary.receivedCents)}
                      </TableCell>
                      <TableCell>
                        {formatMoney(summary.expensesCents)}
                      </TableCell>
                      <TableCell>
                        <strong>{formatMoney(summary.cashBalanceCents)}</strong>
                      </TableCell>
                      <TableCell>
                        <div className="table-actions justify-end">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Exportar competência"
                            aria-label={`Exportar ${month.competence}`}
                            onClick={() => onExport(month)}
                          >
                            <Download size={15} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
      {selectedMonth && selectedSummary ? (
        <Panel>
          <SectionHeading
            eyebrow="Comparação simples"
            title={`${monthLabel(selectedMonth.competence)} em perspectiva`}
            description={
              previous
                ? `Comparativo com ${monthLabel(previous.competence)}.`
                : "Ainda não há uma competência anterior para comparar."
            }
          />
          {previous && previousSummary ? (
            <div className="comparison-grid">
              {[
                [
                  "Total lançado",
                  selectedSummary.billedCents,
                  previousSummary.billedCents,
                ],
                [
                  "Recebido",
                  selectedSummary.receivedCents,
                  previousSummary.receivedCents,
                ],
                [
                  "Despesas",
                  selectedSummary.expensesCents,
                  previousSummary.expensesCents,
                ],
                [
                  "Saldo em caixa",
                  selectedSummary.cashBalanceCents,
                  previousSummary.cashBalanceCents,
                ],
              ].map(([label, current, prior]) => {
                const delta = Number(current) - Number(prior);
                return (
                  <div className="comparison-card" key={String(label)}>
                    <span>{String(label)}</span>
                    <strong>{formatMoney(Number(current))}</strong>
                    <small className={delta >= 0 ? "delta-up" : "delta-down"}>
                      {delta >= 0 ? "↑" : "↓"} {formatMoney(Math.abs(delta))}{" "}
                      vs. anterior
                    </small>
                  </div>
                );
              })}
            </div>
          ) : (
            <Notice>
              Selecione uma competência anterior assim que ela existir para
              visualizar a variação lado a lado.
            </Notice>
          )}
        </Panel>
      ) : null}
      {selectedMonth ? (
        <Panel>
          <SectionHeading
            eyebrow="Extrato por unidade"
            title="Exportação individual"
            description="Cada arquivo mantém a unidade escolhida e usa proteção contra injeção de fórmulas."
          />
          <div className="unit-export-list">
            {state.units
              .filter(unit =>
                selectedMonth.charges.some(charge => charge.unitId === unit.id)
              )
              .sort((a, b) =>
                a.number.localeCompare(b.number, "pt-BR", { numeric: true })
              )
              .map(unit => (
                <div className="unit-export-row" key={unit.id}>
                  <div>
                    <strong>Unidade {unit.number}</strong>
                    <small>{unit.resident || "Morador não informado"}</small>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onExportUnit(selectedMonth, unit)}
                  >
                    <Download size={15} /> CSV
                  </Button>
                </div>
              ))}
          </div>
          <FormulaSafeHint />
        </Panel>
      ) : null}
    </div>
  );
}
