import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Calculator,
  CircleUserRound,
  DoorOpen,
  LockKeyhole,
  LogOut,
  Menu,
  RefreshCw,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  initialState,
  newMonthlyCharge,
  type Charge,
  type CondoState,
  type Expense,
  type Month,
  type Unit,
  type AllocationConfig,
} from "@shared/condo";
import { makeAllocationConfig } from "@shared/rateio";
import {
  calculateMonth,
  createId,
  emptyCharge,
  exportMonthCsv,
  isConflictError,
  missingActiveUnits,
  monthLabel,
  parseApiError,
  previousCompetence,
  sortMonths,
  type CondoResponse,
  type TabKey,
} from "@/components/condo/condo-utils";
import { RateioPanel } from "@/components/condo/rateio-panel";
import {
  AddButton,
  BreadcrumbTitle,
  LoadingState,
  Panel,
  SectionHeading,
  StatusBadge,
  TabNav,
} from "@/components/condo/condo-ui";
import {
  ChargeDialog,
  ConfirmDialog,
  ExpenseDialog,
  MonthDialog,
  StatementDialog,
  UnitDialog,
  type MonthDraft,
  type UnitDraft,
} from "@/components/condo/condo-dialogs";
import {
  ExpensesPanel,
  HistoryPanel,
  OverviewPanel,
  ReadingsPanel,
  UnitsPanel,
} from "@/components/condo/condo-panels";
import type { SyndicIdentity } from "@shared/syndic";
import { TRPCClientError } from "@trpc/client";

type CondoQueryResult = {
  data?: CondoResponse;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => Promise<{ data?: CondoResponse }>;
};

const logoUrl =
  "/manus-storage/async-images/30vFO89ur9tqpGbBC2ukR7/image-1.webp";

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "brand brand-compact" : "brand"}>
      <span className="brand-mark">
        <img
          src={logoUrl}
          alt=""
          onError={event => {
            event.currentTarget.style.display = "none";
          }}
        />
        <Building2 size={21} strokeWidth={1.7} />
      </span>
      <span className="brand-copy">
        <small>Administração serena</small>
        <strong>San Gimignano</strong>
        {!compact ? <em>Condomínio residencial</em> : null}
      </span>
    </div>
  );
}

function LoginGate({
  loading,
  error,
  onLogin,
}: {
  loading: boolean;
  error?: unknown;
  onLogin: (credentials: {
    username: string;
    password: string;
  }) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    try {
      await onLogin({ username: username.trim(), password });
    } catch {
      const message = "Usuário ou senha inválidos.";
      setFormError(message);
      toast.error(message);
    }
  };

  const visibleError =
    formError || (error ? "Não foi possível validar a sessão." : "");

  return (
    <div className="login-screen">
      <div className="login-card">
        <Brand />
        <p className="section-eyebrow">Área do síndico</p>
        <h1>Entrar</h1>
        <p>Acesse a gestão financeira e operacional do condomínio.</p>
        <form
          className="form-stack login-form"
          onSubmit={event => void submit(event)}
        >
          <div className="form-field">
            <label htmlFor="syndic-username">Usuário</label>
            <input
              id="syndic-username"
              type="text"
              value={username}
              onChange={event => setUsername(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="syndic-password">Senha</label>
            <input
              id="syndic-password"
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {visibleError ? (
            <p className="field-error" role="alert" aria-live="polite">
              {visibleError}
            </p>
          ) : null}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? (
              <RefreshCw size={17} className="animate-spin" />
            ) : (
              <LockKeyhole size={17} />
            )}
            {loading ? "Verificando acesso…" : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function RequestError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div className="workspace-state">
      <Panel>
        <div className="error-state">
          <div className="empty-icon">
            <RefreshCw size={22} />
          </div>
          <h2>Não conseguimos carregar seus dados</h2>
          <p>{parseApiError(error)}</p>
          <Button onClick={onRetry}>
            <RefreshCw size={16} /> Tentar novamente
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function EmptyWorkspace({
  onUnits,
  onMonth,
}: {
  onUnits: () => void;
  onMonth: () => void;
}) {
  return (
    <Panel className="welcome-panel">
      <div className="welcome-mark">
        <Building2 size={28} strokeWidth={1.5} />
      </div>
      <p className="section-eyebrow">Primeiro acesso</p>
      <h2>Nenhuma competência cadastrada</h2>
      <p>
        Cadastre as unidades ou crie uma competência para começar o fluxo mensal
        com os dados reais do condomínio.
      </p>
      <div className="welcome-actions">
        <Button onClick={onUnits}>Cadastrar unidades</Button>
        <Button variant="outline" onClick={onMonth}>
          Criar competência
        </Button>
      </div>
    </Panel>
  );
}

function Workspace({
  response,
  query,
  authUser,
  logout,
}: {
  response: CondoResponse;
  query: CondoQueryResult;
  authUser: SyndicIdentity;
  logout: () => Promise<void>;
}) {
  const [stateResponse, setStateResponse] = useState(response);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [selectedCompetence, setSelectedCompetence] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [monthDialog, setMonthDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    month?: Month;
  }>({ open: false, mode: "create" });
  const [unitDialog, setUnitDialog] = useState<{ open: boolean; unit?: Unit }>({
    open: false,
  });
  const [chargeDialog, setChargeDialog] = useState<{
    open: boolean;
    unit?: Unit;
    charge?: Charge;
  }>({ open: false });
  const [expenseDialog, setExpenseDialog] = useState<{
    open: boolean;
    expense?: Expense;
  }>({ open: false });
  const [statementDialog, setStatementDialog] = useState<{
    open: boolean;
    unit?: Unit;
    charge?: Charge;
    month?: Month;
  }>({ open: false });
  const [confirmDialog, setConfirmDialog] = useState<{
    kind:
      | "archive"
      | "remove-expense"
      | "toggle-month"
      | "clear-allocation"
      | null;
    unit?: Unit;
    expense?: Expense;
    month?: Month;
  }>({ kind: null });
  const saveMutation = trpc.condo.save.useMutation();
  const isSaving = saveMutation.isPending;

  useEffect(() => {
    setStateResponse(response);
  }, [response.revision, response.state]);
  const state = stateResponse.state;
  const months = useMemo(() => sortMonths(state.months), [state.months]);
  useEffect(() => {
    if (
      !selectedCompetence ||
      !state.months.some(month => month.competence === selectedCompetence)
    )
      setSelectedCompetence(months[0]?.competence ?? "");
  }, [months, selectedCompetence, state.months]);
  const currentMonth =
    state.months.find(month => month.competence === selectedCompetence) ??
    months[0];
  const hasOpenMonth = state.months.some(month => month.status === "open");

  const commit = async (nextState: CondoState, successMessage: string) => {
    try {
      const next = await saveMutation.mutateAsync({
        state: nextState,
        revision: stateResponse.revision,
      });
      setStateResponse(next);
      setConflict(false);
      toast.success(successMessage);
      void query.refetch();
      return true;
    } catch (error) {
      if (isConflictError(error)) setConflict(true);
      toast.error(parseApiError(error), {
        description: isConflictError(error)
          ? "Recarregue os dados para continuar com a versão mais recente."
          : undefined,
      });
      return false;
    }
  };

  const updateMonth = (
    monthId: string,
    updater: (month: Month) => Month
  ): CondoState => ({
    ...state,
    months: state.months.map(month =>
      month.id === monthId ? updater(month) : month
    ),
  });
  const handleRefresh = async () => {
    const result = await query.refetch();
    if (result.data) {
      setStateResponse(result.data);
      setConflict(false);
      toast.success("Dados recarregados.");
    }
  };
  const handleCreateMonth = async (draft: MonthDraft) => {
    if (state.months.some(month => month.competence === draft.competence)) {
      toast.error("Essa competência já existe.");
      return;
    }
    const previous = state.months.find(
      month => month.competence === previousCompetence(draft.competence)
    );
    const activeUnits = state.units.filter(unit => unit.active);
    const charges = activeUnits.map(unit =>
      newMonthlyCharge(
        unit.id,
        previous?.charges.find(charge => charge.unitId === unit.id),
        draft.copyPrevious
      )
    );
    const month: Month = {
      id: createId("month"),
      competence: draft.competence,
      status: "open",
      waterRateCents: draft.waterRateCents,
      gasRateCents: draft.gasRateCents,
      openingBalanceCents: draft.openingBalanceCents,
      charges,
      expenses: [],
    };
    const ok = await commit(
      { ...state, months: [...state.months, month] },
      "Competência criada."
    );
    if (ok) {
      setSelectedCompetence(month.competence);
      setMonthDialog({ open: false, mode: "create" });
    }
  };
  const handleEditMonth = async (draft: MonthDraft) => {
    const target = monthDialog.month;
    if (!target) return;
    const ok = await commit(
      updateMonth(target.id, month => ({
        ...month,
        waterRateCents: draft.waterRateCents,
        gasRateCents: draft.gasRateCents,
        openingBalanceCents: draft.openingBalanceCents,
      })),
      "Parâmetros atualizados."
    );
    if (ok) setMonthDialog({ open: false, mode: "create" });
  };
  const handleUnit = async (draft: UnitDraft) => {
    const duplicate = state.units.some(
      item =>
        item.id !== unitDialog.unit?.id &&
        item.number.trim().toLowerCase() === draft.number.trim().toLowerCase()
    );
    if (duplicate) {
      toast.error("Já existe uma unidade com este número.");
      return;
    }
    if (unitDialog.unit) {
      const ok = await commit(
        {
          ...state,
          units: state.units.map(unit =>
            unit.id === unitDialog.unit?.id
              ? {
                  ...unit,
                  number: draft.number,
                  resident: draft.resident,
                  fraction: draft.fraction,
                }
              : unit
          ),
        },
        "Unidade atualizada."
      );
      if (ok) setUnitDialog({ open: false });
      return;
    }
    const unit: Unit = {
      id: createId("unit"),
      number: draft.number,
      resident: draft.resident,
      fraction: draft.fraction,
      active: true,
    };
    let nextState: CondoState = { ...state, units: [...state.units, unit] };
    const openMonth =
      state.months.find(
        month =>
          month.status === "open" && month.competence === selectedCompetence
      ) ?? state.months.find(month => month.status === "open");
    if (draft.includeInCurrentMonth && openMonth)
      nextState = updateMonthInState(nextState, openMonth.id, month => ({
        ...month,
        charges: [...month.charges, emptyCharge(unit.id)],
      }));
    const ok = await commit(nextState, "Unidade cadastrada.");
    if (ok) setUnitDialog({ open: false });
  };
  const handleArchive = async () => {
    const unit = confirmDialog.unit;
    if (!unit) return;
    const ok = await commit(
      {
        ...state,
        units: state.units.map(item =>
          item.id === unit.id ? { ...item, active: false } : item
        ),
      },
      "Unidade arquivada."
    );
    if (ok) setConfirmDialog({ kind: null });
  };
  const handleCharge = async (charge: Charge) => {
    const target = currentMonth;
    if (!target) return;
    const next = updateMonth(target.id, month => ({
      ...month,
      charges: month.charges.some(item => item.unitId === charge.unitId)
        ? month.charges.map(item =>
            item.unitId === charge.unitId ? charge : item
          )
        : [...month.charges, charge],
    }));
    const ok = await commit(next, "Cobrança atualizada.");
    if (ok) setChargeDialog({ open: false });
  };
  const handleExpense = async (draft: Omit<Expense, "id">) => {
    const target = currentMonth;
    if (!target) return;
    const next = updateMonth(target.id, month => {
      const expenses = expenseDialog.expense
        ? month.expenses.map(expense =>
            expense.id === expenseDialog.expense?.id
              ? { ...draft, id: expense.id }
              : expense
          )
        : [...month.expenses, { ...draft, id: createId("expense") }];
      return { ...month, expenses };
    });
    const ok = await commit(
      next,
      expenseDialog.expense ? "Despesa atualizada." : "Despesa adicionada."
    );
    if (ok) setExpenseDialog({ open: false });
  };
  const handleRemoveExpense = async () => {
    const target = currentMonth;
    const expense = confirmDialog.expense;
    if (!target || !expense) return;
    const ok = await commit(
      updateMonth(target.id, month => ({
        ...month,
        expenses: month.expenses.filter(item => item.id !== expense.id),
      })),
      "Despesa removida."
    );
    if (ok) setConfirmDialog({ kind: null });
  };
  const handleToggleMonth = async () => {
    const target = confirmDialog.month;
    if (!target) return;
    const nextStatus = target.status === "open" ? "closed" : "open";
    const ok = await commit(
      updateMonth(target.id, month => ({ ...month, status: nextStatus })),
      nextStatus === "closed" ? "Competência fechada." : "Competência reaberta."
    );
    if (ok) setConfirmDialog({ kind: null });
  };

  const handleConfigureAllocation = async (
    method: AllocationConfig["method"],
    selectedIds: string[]
  ) => {
    const target = currentMonth;
    if (!target) return;
    try {
      const allocation = makeAllocationConfig(state, method, selectedIds);
      const activeIds = new Set(
        allocation.participants.map(participant => participant.unitId)
      );
      const includedIds = new Set(target.charges.map(charge => charge.unitId));
      const missingCharges = state.units
        .filter(unit => unit.active && !includedIds.has(unit.id))
        .filter(unit => activeIds.has(unit.id))
        .map(unit => emptyCharge(unit.id));
      const next = updateMonth(target.id, month => ({
        ...month,
        charges: [...month.charges, ...missingCharges],
        allocation,
      }));
      await commit(
        next,
        target.allocation
          ? "Configuração de rateio atualizada."
          : "Rateio configurado."
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível configurar o rateio."
      );
    }
  };

  const handleClearAllocation = async () => {
    const target = currentMonth;
    if (!target) return;
    const ok = await commit(
      updateMonth(target.id, month => {
        const { allocation: _allocation, ...withoutAllocation } = month;
        return withoutAllocation;
      }),
      "Configuração de rateio removida."
    );
    if (ok) setConfirmDialog({ kind: null });
  };

  const monthDialogInitial = monthDialog.month
    ? {
        competence: monthDialog.month.competence,
        waterRateCents: monthDialog.month.waterRateCents,
        gasRateCents: monthDialog.month.gasRateCents,
        openingBalanceCents: monthDialog.month.openingBalanceCents,
      }
    : {
        competence: "",
        waterRateCents: 0,
        gasRateCents: 0,
        openingBalanceCents: 0,
      };
  const statusConfirmation = confirmDialog.month;
  const statusSummary = statusConfirmation
    ? calculateMonth(statusConfirmation)
    : undefined;
  const missingUnits = statusConfirmation
    ? missingActiveUnits(state, statusConfirmation)
    : [];
  const activeUserName = authUser.name || authUser.email || "Conta autenticada";
  const navigate = (tab: TabKey) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="condo-app">
      <aside
        className={
          mobileMenuOpen ? "condo-sidebar is-mobile-open" : "condo-sidebar"
        }
      >
        <div className="sidebar-top">
          <Brand />
          <button
            className="mobile-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>
        <div className="sidebar-rule" />
        <p className="sidebar-label">Navegação</p>
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {[
            { key: "overview", label: "Visão geral" },
            { key: "units", label: "Unidades" },
            { key: "readings", label: "Leituras e cobranças" },
            { key: "expenses", label: "Despesas" },
            { key: "allocation", label: "Rateio", icon: Calculator },
            { key: "history", label: "Histórico e relatórios" },
          ].map(item => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.key}
                className={
                  activeTab === item.key
                    ? "sidebar-link is-active"
                    : "sidebar-link"
                }
                onClick={() => navigate(item.key as TabKey)}
              >
                {Icon ? <Icon size={15} strokeWidth={1.8} /> : null}
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <CircleUserRound size={18} />
            <span>
              <strong>{activeUserName}</strong>
              <small>sessão autenticada</small>
            </span>
          </div>
          <button
            type="button"
            className="sidebar-logout"
            onClick={() => void logout()}
          >
            <LogOut size={15} /> Sair
          </button>
        </div>
      </aside>
      <main className="condo-main">
        <header className="mobile-header">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={19} />
          </Button>
          <Brand compact />
          <span className="mobile-header-spacer" />
        </header>
        {mobileMenuOpen ? (
          <button
            type="button"
            className="mobile-backdrop"
            aria-label="Fechar menu"
            onClick={() => setMobileMenuOpen(false)}
          />
        ) : null}
        <div
          className={
            mobileMenuOpen ? "sidebar-mobile-open" : "sidebar-mobile-closed"
          }
        >
          {/* The desktop sidebar remains semantic; this button only exposes it on narrow screens. */}
        </div>
        <div className="condo-content">
          {conflict ? (
            <div className="conflict-banner">
              <div>
                <strong>Há uma versão mais recente dos dados.</strong>
                <span>
                  Seu último salvamento não foi aplicado para evitar
                  sobrescrever alterações.
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleRefresh()}
                disabled={query.isFetching}
              >
                <RefreshCw
                  size={15}
                  className={query.isFetching ? "animate-spin" : ""}
                />{" "}
                Recarregar dados
              </Button>
            </div>
          ) : null}
          <div className="content-topline">
            <BreadcrumbTitle
              title={state.name || initialState.name}
              subtitle={
                currentMonth
                  ? `${monthLabel(currentMonth.competence)} · operação mensal`
                  : "Organização financeira e operacional"
              }
            />
            <div className="topline-user">
              <span className="secure-pill">
                <ShieldCheck size={14} /> Dados protegidos
              </span>
            </div>
          </div>
          <div className="month-toolbar">
            <div className="month-selector-wrap">
              <label htmlFor="competence-select">Competência</label>
              {months.length ? (
                <Select
                  value={currentMonth?.competence ?? ""}
                  onValueChange={setSelectedCompetence}
                >
                  <SelectTrigger
                    id="competence-select"
                    className="month-selector"
                  >
                    <SelectValue placeholder="Selecionar mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => (
                      <SelectItem key={month.id} value={month.competence}>
                        {monthLabel(month.competence)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="no-month-selected">Nenhuma criada</span>
              )}
            </div>
            <div className="toolbar-actions">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMonthDialog({ open: true, mode: "create" })}
              >
                <Settings2 size={15} /> Nova competência
              </Button>
              {currentMonth ? (
                <>
                  <StatusBadge status={currentMonth.status} />
                  <Button
                    variant={
                      currentMonth.status === "open" ? "default" : "outline"
                    }
                    size="sm"
                    disabled={isSaving}
                    onClick={() =>
                      setConfirmDialog({
                        kind: "toggle-month",
                        month: currentMonth,
                      })
                    }
                  >
                    {currentMonth.status === "open" ? (
                      <>
                        <LockKeyhole size={15} /> Fechar mês
                      </>
                    ) : (
                      <>
                        <DoorOpen size={15} /> Reabrir mês
                      </>
                    )}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
          {currentMonth ? (
            <div className="month-facts">
              <span>
                Água{" "}
                <strong>
                  {(currentMonth.waterRateCents / 100).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                  /m³
                </strong>
              </span>
              <span>
                Gás{" "}
                <strong>
                  {(currentMonth.gasRateCents / 100).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                  /m³
                </strong>
              </span>
              <span>
                Abertura{" "}
                <strong>
                  {(currentMonth.openingBalanceCents / 100).toLocaleString(
                    "pt-BR",
                    { style: "currency", currency: "BRL" }
                  )}
                </strong>
              </span>
              {currentMonth.status === "open" ? (
                <button
                  type="button"
                  onClick={() =>
                    setMonthDialog({
                      open: true,
                      mode: "edit",
                      month: currentMonth,
                    })
                  }
                >
                  Editar parâmetros
                </button>
              ) : (
                <span className="muted-text">Somente leitura</span>
              )}
            </div>
          ) : null}
          <div className="print-only-title">
            <h1>{state.name}</h1>
            <p>
              {currentMonth ? monthLabel(currentMonth.competence) : "Relatório"}
            </p>
          </div>
          <TabNav active={activeTab} onChange={navigate} />
          {activeTab === "overview" ? (
            state.units.length === 0 && state.months.length === 0 ? (
              <EmptyWorkspace
                onUnits={() => navigate("units")}
                onMonth={() => setMonthDialog({ open: true, mode: "create" })}
              />
            ) : (
              <OverviewPanel
                state={state}
                month={currentMonth}
                onNewMonth={() =>
                  setMonthDialog({ open: true, mode: "create" })
                }
                onEditMonth={() =>
                  currentMonth &&
                  setMonthDialog({
                    open: true,
                    mode: "edit",
                    month: currentMonth,
                  })
                }
                onGoUnits={() => navigate("units")}
                onGoReadings={() => navigate("readings")}
                onGoExpenses={() => navigate("expenses")}
              />
            )
          ) : activeTab === "units" ? (
            <UnitsPanel
              state={state}
              currentMonth={currentMonth}
              onAdd={() => setUnitDialog({ open: true })}
              onEdit={unit => setUnitDialog({ open: true, unit })}
              onArchive={unit => setConfirmDialog({ kind: "archive", unit })}
              onExport={unit =>
                currentMonth && exportMonthCsv(state, currentMonth, unit)
              }
            />
          ) : activeTab === "readings" ? (
            <ReadingsPanel
              state={state}
              month={currentMonth}
              disabled={currentMonth?.status === "closed"}
              onEdit={(unit, charge) =>
                setChargeDialog({ open: true, unit, charge })
              }
              onStatement={(unit, charge) =>
                setStatementDialog({
                  open: true,
                  unit,
                  charge,
                  month: currentMonth,
                })
              }
              onExport={(unit, filteredUnitIds) =>
                currentMonth &&
                exportMonthCsv(state, currentMonth, unit, filteredUnitIds)
              }
            />
          ) : activeTab === "expenses" ? (
            <ExpensesPanel
              month={currentMonth}
              disabled={currentMonth?.status === "closed"}
              onAdd={() => setExpenseDialog({ open: true })}
              onEdit={expense => setExpenseDialog({ open: true, expense })}
              onRemove={expense =>
                setConfirmDialog({ kind: "remove-expense", expense })
              }
              onGoAllocation={() => navigate("allocation")}
            />
          ) : activeTab === "allocation" ? (
            <RateioPanel
              state={state}
              month={currentMonth}
              disabled={currentMonth?.status === "closed"}
              pending={isSaving}
              onConfigure={(method, unitIds) =>
                void handleConfigureAllocation(method, unitIds)
              }
              onClear={() => setConfirmDialog({ kind: "clear-allocation" })}
              onGoExpenses={() => navigate("expenses")}
            />
          ) : (
            <HistoryPanel
              state={state}
              selectedMonth={currentMonth}
              onSelectMonth={competence => {
                setSelectedCompetence(competence);
                setActiveTab("history");
              }}
              onExport={month => exportMonthCsv(state, month)}
              onExportUnit={(month, unit) => exportMonthCsv(state, month, unit)}
            />
          )}
        </div>
        <footer className="app-footer">
          <span>San Gimignano · administração condominial</span>
          <span>Os dados são salvos somente após confirmação do servidor.</span>
        </footer>
      </main>
      <MonthDialog
        open={monthDialog.open}
        mode={monthDialog.mode}
        onOpenChange={open => setMonthDialog(current => ({ ...current, open }))}
        initial={monthDialogInitial}
        previousCompetenceAvailable={state.months.length > 0}
        onSubmit={
          monthDialog.mode === "create" ? handleCreateMonth : handleEditMonth
        }
        pending={isSaving}
      />
      <UnitDialog
        open={unitDialog.open}
        unit={unitDialog.unit}
        hasOpenMonth={hasOpenMonth}
        onOpenChange={open => setUnitDialog(current => ({ ...current, open }))}
        onSubmit={handleUnit}
        pending={isSaving}
      />
      {chargeDialog.unit && currentMonth ? (
        <ChargeDialog
          open={chargeDialog.open}
          unit={chargeDialog.unit}
          charge={chargeDialog.charge}
          month={currentMonth}
          onOpenChange={open =>
            setChargeDialog(current => ({ ...current, open }))
          }
          onSubmit={handleCharge}
          pending={isSaving}
        />
      ) : null}
      <ExpenseDialog
        open={expenseDialog.open}
        expense={expenseDialog.expense}
        competence={currentMonth?.competence ?? ""}
        onOpenChange={open =>
          setExpenseDialog(current => ({ ...current, open }))
        }
        onSubmit={handleExpense}
        pending={isSaving}
      />
      {statementDialog.month ? (
        <StatementDialog
          open={statementDialog.open}
          unit={statementDialog.unit}
          charge={statementDialog.charge}
          month={statementDialog.month}
          onOpenChange={open =>
            setStatementDialog(current => ({ ...current, open }))
          }
        />
      ) : null}
      <ConfirmDialog
        open={confirmDialog.kind === "archive"}
        onOpenChange={open => !open && setConfirmDialog({ kind: null })}
        title="Arquivar unidade?"
        description={
          <>
            A unidade <strong>{confirmDialog.unit?.number}</strong> deixará de
            ser incluída em novas competências. O histórico e as cobranças
            existentes serão preservados.
          </>
        }
        confirmLabel="Arquivar unidade"
        tone="danger"
        onConfirm={() => void handleArchive()}
        pending={isSaving}
      />
      <ConfirmDialog
        open={confirmDialog.kind === "remove-expense"}
        onOpenChange={open => !open && setConfirmDialog({ kind: null })}
        title="Remover despesa?"
        description={
          <>
            A despesa <strong>{confirmDialog.expense?.description}</strong> será
            removida da competência aberta. Esta ação não pode ser desfeita.
          </>
        }
        confirmLabel="Remover despesa"
        tone="danger"
        onConfirm={() => void handleRemoveExpense()}
        pending={isSaving}
      />
      <ConfirmDialog
        open={confirmDialog.kind === "toggle-month"}
        onOpenChange={open => !open && setConfirmDialog({ kind: null })}
        title={
          statusConfirmation?.status === "open"
            ? "Fechar competência?"
            : "Reabrir competência?"
        }
        description={
          statusConfirmation ? (
            <div className="confirm-summary">
              <p>
                {statusConfirmation.status === "open"
                  ? "Ao fechar, leituras, cobranças e despesas ficam somente para consulta."
                  : "A competência voltará a aceitar edições. Nenhum conteúdo será alterado além do status."}
              </p>
              {statusSummary ? (
                <div className="confirm-summary-grid">
                  <span>
                    Caixa atual{" "}
                    <strong>
                      {(statusSummary.cashBalanceCents / 100).toLocaleString(
                        "pt-BR",
                        { style: "currency", currency: "BRL" }
                      )}
                    </strong>
                  </span>
                  <span>
                    Projetado{" "}
                    <strong>
                      {(
                        statusSummary.projectedBalanceCents / 100
                      ).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </strong>
                  </span>
                </div>
              ) : null}
              {missingUnits.length ? (
                <p className="missing-warning">
                  Faltam {missingUnits.length} unidades ativas:{" "}
                  {missingUnits.map(unit => unit.number).join(", ")}
                </p>
              ) : null}
            </div>
          ) : (
            ""
          )
        }
        confirmLabel={
          statusConfirmation?.status === "open"
            ? "Fechar competência"
            : "Reabrir competência"
        }
        onConfirm={() => void handleToggleMonth()}
        pending={isSaving}
      />
      <ConfirmDialog
        open={confirmDialog.kind === "clear-allocation"}
        onOpenChange={open => !open && setConfirmDialog({ kind: null })}
        title="Limpar configuração de rateio?"
        description="As despesas continuarão registradas e as quotas manuais não serão alteradas. O rateio automático deixará de compor as cobranças desta competência até uma nova configuração."
        confirmLabel="Limpar configuração"
        tone="danger"
        onConfirm={() => void handleClearAllocation()}
        pending={isSaving}
      />
    </div>
  );
}

function updateMonthInState(
  state: CondoState,
  monthId: string,
  updater: (month: Month) => Month
): CondoState {
  return {
    ...state,
    months: state.months.map(month =>
      month.id === monthId ? updater(month) : month
    ),
  };
}

function isSessionError(error: unknown) {
  return (
    error instanceof TRPCClientError &&
    (error.data?.code === "UNAUTHORIZED" || error.data?.code === "FORBIDDEN")
  );
}

export default function Home() {
  const auth = useAuth();
  const query = trpc.condo.get.useQuery(undefined, {
    enabled: Boolean(auth.user),
    retry: false,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (query.error && isSessionError(query.error)) void auth.refresh();
    // A atualização só é disparada quando o erro protegido muda; consultas
    // públicas não passam por este caminho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.error]);
  if (auth.loading || (auth.user && query.isLoading))
    return (
      <div className="app-loading">
        <Brand />
        <LoadingState label="Preparando o espaço do condomínio" />
      </div>
    );
  if (!auth.user)
    return (
      <LoginGate
        loading={auth.loading}
        error={auth.error}
        onLogin={auth.login}
      />
    );
  if (query.error)
    return (
      <div className="error-app-shell">
        <Brand />
        <RequestError
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  const response = query.data;
  if (!response)
    return (
      <div className="app-loading">
        <Brand />
        <LoadingState />
      </div>
    );
  return (
    <Workspace
      response={response}
      query={query}
      authUser={auth.user}
      logout={auth.logout}
    />
  );
}
