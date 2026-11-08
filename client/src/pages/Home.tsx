import { useEffect, useMemo, useState } from "react";
import {
  DoorOpen,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { TRPCClientError } from "@trpc/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  EXPENSE_CATEGORIES,
  type CondoState,
  type Expense,
  type ExpenseCategory,
  type Month,
  type Payment,
  type Reading,
  type Unit,
} from "@shared/condo";
import {
  buildReports,
  formatM3,
  formatMoney,
  formatMonth,
  newMonth,
  sortUnits,
  type MonthReport,
  type UnitStatement,
} from "@shared/calc";
import {
  Badge,
  Brand,
  Metric,
  MonthStatus,
  Notice,
  Panel,
} from "@/components/condo/condo-ui";
import { BuildingBoard } from "@/components/condo/building-board";
import {
  CashLines,
  QuotaTable,
  SplitRule,
} from "@/components/condo/quota-table";
import {
  createId,
  currentCompetence,
  isConflictError,
  moneyInput,
  nextCompetence,
  parseApiError,
  parseMoneyInput,
  parseReadingInput,
  parseSignedMoneyInput,
  readingInput,
} from "@/components/condo/condo-utils";

type Saved = { state: CondoState; revision: number };
type Tab = "painel" | "despesas" | "leituras" | "pagamentos" | "cadastro";

const TABS: { key: Tab; label: string }[] = [
  { key: "painel", label: "Painel" },
  { key: "despesas", label: "Despesas" },
  { key: "leituras", label: "Leituras" },
  { key: "pagamentos", label: "Pagamentos" },
  { key: "cadastro", label: "Cadastro" },
];

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
        <h1>Área do síndico</h1>
        <form className="stack" onSubmit={event => void submit(event)}>
          <label className="field">
            <span>Usuário</span>
            <input
              className="input"
              type="text"
              value={username}
              onChange={event => setUsername(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </label>
          <label className="field">
            <span>Senha</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
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
        <a className="muted small" href="/">
          Voltar ao quadro
        </a>
      </div>
    </div>
  );
}

/* ---------- Painel ---------- */

function situation(s: UnitStatement) {
  if (s.balanceCents > 0)
    return <Badge tone="due">Deve {formatMoney(s.balanceCents)}</Badge>;
  if (s.balanceCents < 0)
    return <Badge tone="credit">Crédito {formatMoney(-s.balanceCents)}</Badge>;
  return <Badge tone="ok">Em dia</Badge>;
}

function BankCheck({
  report,
  locked,
  onSave,
}: {
  report: MonthReport;
  locked: boolean;
  onSave: (bankBalanceCents: number | null) => Promise<boolean>;
}) {
  const { cash } = report;
  const [value, setValue] = useState(
    cash.bankCents === null ? "" : moneyInput(cash.bankCents)
  );
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!value.trim()) return void onSave(null);
    const cents = parseSignedMoneyInput(value);
    if (cents === null) return void toast.error("Valor do extrato inválido.");
    void onSave(cents);
  };
  const diff = cash.differenceCents;

  return (
    <Panel title="Conferência com o banco">
      <CashLines cash={cash} />
      <form className="form-row" onSubmit={submit}>
        <label className="field">
          <span>Saldo no extrato do banco</span>
          <input
            className="input"
            inputMode="decimal"
            placeholder="0,00"
            value={value}
            onChange={event => setValue(event.target.value)}
            disabled={locked}
          />
        </label>
        <Button type="submit" disabled={locked}>
          Conferir
        </Button>
      </form>
      {diff === null ? (
        <Notice>Digite o saldo do extrato no fim do mês para conferir.</Notice>
      ) : diff === 0 ? (
        <Notice tone="ok">Bateu com o banco.</Notice>
      ) : (
        <Notice tone="warn">
          Diferença de {formatMoney(Math.abs(diff))}.{" "}
          {diff > 0
            ? "Tem mais dinheiro no banco do que o lançado: falta registrar algum pagamento?"
            : "Tem menos dinheiro no banco do que o lançado: falta lançar alguma despesa ou tarifa?"}
        </Notice>
      )}
    </Panel>
  );
}

function PainelTab({
  report,
  locked,
  onSaveBank,
  onDelete,
}: {
  report: MonthReport;
  locked: boolean;
  onSaveBank: (bankBalanceCents: number | null) => Promise<boolean>;
  onDelete: () => void;
}) {
  const { totals, statements, cash, quotas } = report;
  const toReceive = statements.reduce(
    (sum, s) => sum + Math.max(0, s.dueCents),
    0
  );
  const owing = statements.filter(s => s.balanceCents > 0).length;

  return (
    <>
      <div className="metrics">
        <Metric
          label="Despesas do mês"
          value={formatMoney(totals.expensesCents)}
        />
        <Metric label="A receber" value={formatMoney(toReceive)} />
        <Metric
          label="Recebido"
          value={formatMoney(cash.receivedCents)}
          detail={owing ? `${owing} apto(s) com saldo devedor` : "Todos em dia"}
          tone={owing ? "bad" : "good"}
        />
        <Metric label="Saldo em caixa" value={formatMoney(cash.closingCents)} />
      </div>

      {!report.month.expenses.length ? (
        <Notice>Nenhuma despesa lançada neste mês ainda.</Notice>
      ) : null}
      {totals.waterBillCents > 0 && totals.waterMilli === 0 ? (
        <Notice tone="warn">
          Conta de água lançada sem consumo nas leituras: está sendo dividida
          igualmente.
        </Notice>
      ) : null}
      {totals.gasBillCents > 0 && totals.gasMilli === 0 ? (
        <Notice tone="warn">
          Conta de gás lançada sem consumo nas leituras: está sendo dividida
          igualmente.
        </Notice>
      ) : null}

      <BuildingBoard
        title="Situação no prédio"
        units={statements.map(s => ({
          number: s.number,
          value: formatMoney(s.dueCents),
          note:
            s.balanceCents > 0
              ? `Falta ${formatMoney(s.balanceCents)}`
              : s.balanceCents < 0
                ? `Crédito ${formatMoney(-s.balanceCents)}`
                : "Pago",
          tone:
            s.balanceCents > 0 ? "due" : s.balanceCents < 0 ? "credit" : "ok",
        }))}
        footer="A pagar no mês"
      />

      <Panel title="Situação de cada apartamento">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Apto</th>
                <th>Situação</th>
                <th className="num">A pagar</th>
                <th className="num">Pago</th>
                <th className="num">Cota do mês</th>
                <th className="num">Anterior</th>
              </tr>
            </thead>
            <tbody>
              {statements.map(s => (
                <tr key={s.unitId}>
                  <td>
                    <strong>{s.number}</strong>
                  </td>
                  <td>{situation(s)}</td>
                  <td className="num">
                    <strong>{formatMoney(s.dueCents)}</strong>
                  </td>
                  <td className="num">{formatMoney(s.paidCents)}</td>
                  <td className="num">{formatMoney(s.quotaCents)}</td>
                  <td className="num">{formatMoney(s.previousCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Composição da cota">
        <QuotaTable quotas={quotas} />
        <SplitRule count={quotas.length} />
      </Panel>

      <BankCheck
        key={`${report.month.id}-${report.month.bankBalanceCents}`}
        report={report}
        locked={locked}
        onSave={onSaveBank}
      />

      {!locked ? (
        <button type="button" className="link-danger" onClick={onDelete}>
          Excluir este mês
        </button>
      ) : null}
    </>
  );
}

/* ---------- Despesas ---------- */

function DespesasTab({
  month,
  locked,
  onSaveExpenses,
  onSaveReserve,
}: {
  month: Month;
  locked: boolean;
  onSaveExpenses: (expenses: Expense[], message: string) => Promise<boolean>;
  onSaveReserve: (cents: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("Água");
  const [amount, setAmount] = useState("");
  const [reserve, setReserve] = useState(moneyInput(month.reservePerUnitCents));

  const reset = () => {
    setEditing(null);
    setDescription("");
    setAmount("");
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const amountCents = parseMoneyInput(amount);
    if (!description.trim()) return void toast.error("Informe a descrição.");
    if (amountCents === null || amountCents === 0)
      return void toast.error("Valor inválido.");
    const item: Expense = {
      id: editing ?? createId("desp"),
      description: description.trim(),
      category,
      amountCents,
    };
    const expenses = editing
      ? month.expenses.map(e => (e.id === editing ? item : e))
      : [...month.expenses, item];
    if (
      await onSaveExpenses(
        expenses,
        editing ? "Despesa alterada." : "Despesa lançada."
      )
    )
      reset();
  };
  const edit = (e: Expense) => {
    setEditing(e.id);
    setDescription(e.description);
    setCategory(e.category);
    setAmount(moneyInput(e.amountCents));
  };
  const remove = (e: Expense) => {
    if (!window.confirm(`Remover "${e.description}"?`)) return;
    void onSaveExpenses(
      month.expenses.filter(x => x.id !== e.id),
      "Despesa removida."
    );
  };
  const saveReserve = (event: React.FormEvent) => {
    event.preventDefault();
    const cents = parseMoneyInput(reserve || "0");
    if (cents === null) return void toast.error("Valor inválido.");
    void onSaveReserve(cents);
  };
  const total = month.expenses.reduce((sum, e) => sum + e.amountCents, 0);

  return (
    <>
      {!locked ? (
        <Panel title={editing ? "Alterar despesa" : "Lançar despesa"}>
          <form className="form-row" onSubmit={event => void submit(event)}>
            <label className="field grow">
              <span>Descrição</span>
              <input
                className="input"
                value={description}
                maxLength={200}
                placeholder="Ex.: Conta Copasa"
                onChange={event => setDescription(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Categoria</span>
              <select
                className="input"
                value={category}
                onChange={event =>
                  setCategory(event.target.value as ExpenseCategory)
                }
              >
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Valor (R$)</span>
              <input
                className="input"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={event => setAmount(event.target.value)}
              />
            </label>
            <Button type="submit">
              <Plus size={16} /> {editing ? "Salvar" : "Lançar"}
            </Button>
            {editing ? (
              <Button type="button" variant="ghost" onClick={reset}>
                Cancelar
              </Button>
            ) : null}
          </form>
          <p className="muted small">
            Categoria Água ou Gás: dividida pelo consumo dos medidores. As
            demais: divididas igualmente.
          </p>
        </Panel>
      ) : null}

      <Panel title="Despesas do mês">
        {month.expenses.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <tbody>
                {month.expenses.map(e => (
                  <tr key={e.id}>
                    <td>
                      {e.description}
                      <small>{e.category}</small>
                    </td>
                    <td className="num">{formatMoney(e.amountCents)}</td>
                    {!locked ? (
                      <td className="actions">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Alterar ${e.description}`}
                          onClick={() => edit(e)}
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remover ${e.description}`}
                          onClick={() => remove(e)}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num">{formatMoney(total)}</td>
                  {!locked ? <td /> : null}
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="muted">Nenhuma despesa lançada.</p>
        )}
      </Panel>

      <Panel title="Fundo de reserva">
        <form className="form-row" onSubmit={saveReserve}>
          <label className="field">
            <span>Valor por apartamento neste mês (R$)</span>
            <input
              className="input"
              inputMode="decimal"
              value={reserve}
              onChange={event => setReserve(event.target.value)}
              disabled={locked}
            />
          </label>
          <Button type="submit" variant="outline" disabled={locked}>
            Salvar
          </Button>
        </form>
        <p className="muted small">
          Entra na cota de cada apartamento e fica no caixa. Deixe 0,00 se não
          houver.
        </p>
      </Panel>
    </>
  );
}

/* ---------- Leituras ---------- */

type ReadingDraft = { wp: string; wc: string; gp: string; gc: string };

function LeiturasTab({
  month,
  units,
  locked,
  onSave,
}: {
  month: Month;
  units: Unit[];
  locked: boolean;
  onSave: (readings: Reading[]) => Promise<boolean>;
}) {
  const numberOf = new Map(units.map(u => [u.id, u.number]));
  const ordered = [...month.readings].sort((a, b) =>
    (numberOf.get(a.unitId) ?? "").localeCompare(
      numberOf.get(b.unitId) ?? "",
      "pt-BR",
      { numeric: true }
    )
  );
  const [drafts, setDrafts] = useState<Record<string, ReadingDraft>>(() =>
    Object.fromEntries(
      month.readings.map(r => [
        r.unitId,
        {
          wp: readingInput(r.waterPrevious),
          wc: readingInput(r.waterCurrent),
          gp: readingInput(r.gasPrevious),
          gc: readingInput(r.gasCurrent),
        },
      ])
    )
  );
  const missing = units.filter(
    u => u.active && !month.readings.some(r => r.unitId === u.id)
  );

  const set = (unitId: string, field: keyof ReadingDraft, value: string) =>
    setDrafts(current => ({
      ...current,
      [unitId]: { ...current[unitId], [field]: value },
    }));

  const save = () => {
    const readings: Reading[] = [];
    for (const r of ordered) {
      const d = drafts[r.unitId];
      const apt = numberOf.get(r.unitId) ?? "?";
      const values = [d.wp, d.wc, d.gp, d.gc].map(parseReadingInput);
      if (values.some(v => v === null))
        return void toast.error(`Leitura inválida no apto ${apt}.`);
      const [waterPrevious, waterCurrent, gasPrevious, gasCurrent] =
        values as number[];
      if (waterCurrent < waterPrevious || gasCurrent < gasPrevious)
        return void toast.error(
          `Apto ${apt}: a leitura atual não pode ser menor que a anterior.`
        );
      readings.push({
        unitId: r.unitId,
        waterPrevious,
        waterCurrent,
        gasPrevious,
        gasCurrent,
      });
    }
    void onSave(readings);
  };

  const consumption = (
    unitId: string,
    prev: keyof ReadingDraft,
    cur: keyof ReadingDraft
  ) => {
    const d = drafts[unitId];
    const a = parseReadingInput(d[prev]);
    const b = parseReadingInput(d[cur]);
    return a === null || b === null || b < a ? "–" : formatM3(b - a);
  };

  return (
    <Panel
      title="Leituras dos medidores (m³)"
      action={
        !locked ? <Button onClick={save}>Salvar leituras</Button> : undefined
      }
    >
      <div className="table-wrap">
        <table className="data-table readings">
          <thead>
            <tr>
              <th>Apto</th>
              <th>Água anterior</th>
              <th>Água atual</th>
              <th className="num">Consumo</th>
              <th>Gás anterior</th>
              <th>Gás atual</th>
              <th className="num">Consumo</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map(r => {
              const d = drafts[r.unitId];
              const input = (field: keyof ReadingDraft, label: string) => (
                <input
                  className="input input-sm"
                  inputMode="decimal"
                  aria-label={`${label} apto ${numberOf.get(r.unitId)}`}
                  value={d[field]}
                  onChange={event => set(r.unitId, field, event.target.value)}
                  disabled={locked}
                />
              );
              return (
                <tr key={r.unitId}>
                  <td>
                    <strong>{numberOf.get(r.unitId) ?? "?"}</strong>
                  </td>
                  <td>{input("wp", "Água anterior")}</td>
                  <td>{input("wc", "Água atual")}</td>
                  <td className="num">{consumption(r.unitId, "wp", "wc")}</td>
                  <td>{input("gp", "Gás anterior")}</td>
                  <td>{input("gc", "Gás atual")}</td>
                  <td className="num">{consumption(r.unitId, "gp", "gc")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        A leitura anterior já vem do mês passado. Digite só a atual.
      </p>
      {missing.length > 0 && !locked ? (
        <Notice tone="warn">
          Fora deste mês: {missing.map(u => u.number).join(", ")}.{" "}
          <button
            type="button"
            className="link"
            onClick={() =>
              void onSave([
                ...month.readings,
                ...missing.map(u => ({
                  unitId: u.id,
                  waterPrevious: 0,
                  waterCurrent: 0,
                  gasPrevious: 0,
                  gasCurrent: 0,
                })),
              ])
            }
          >
            Incluir no mês
          </button>
        </Notice>
      ) : null}
    </Panel>
  );
}

/* ---------- Pagamentos ---------- */

function PagamentosTab({
  report,
  locked,
  onSave,
}: {
  report: MonthReport;
  locked: boolean;
  onSave: (payments: Payment[]) => Promise<boolean>;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      report.statements.map(s => [
        s.unitId,
        s.paidCents ? moneyInput(s.paidCents) : "",
      ])
    )
  );

  const save = () => {
    const payments: Payment[] = [];
    for (const s of report.statements) {
      const raw = drafts[s.unitId]?.trim() ?? "";
      if (!raw) continue;
      const cents = parseMoneyInput(raw);
      if (cents === null)
        return void toast.error(`Valor inválido no apto ${s.number}.`);
      if (cents > 0) payments.push({ unitId: s.unitId, amountCents: cents });
    }
    void onSave(payments);
  };

  return (
    <Panel
      title="Recebido de cada apartamento"
      action={
        !locked ? <Button onClick={save}>Salvar pagamentos</Button> : undefined
      }
    >
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Apto</th>
              <th className="num">A pagar</th>
              <th>Recebido no mês (R$)</th>
              {!locked ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {report.statements.map(s => (
              <tr key={s.unitId}>
                <td>
                  <strong>{s.number}</strong>
                </td>
                <td className="num">{formatMoney(s.dueCents)}</td>
                <td>
                  <input
                    className="input input-sm"
                    inputMode="decimal"
                    placeholder="0,00"
                    aria-label={`Recebido apto ${s.number}`}
                    value={drafts[s.unitId] ?? ""}
                    onChange={event =>
                      setDrafts(current => ({
                        ...current,
                        [s.unitId]: event.target.value,
                      }))
                    }
                    disabled={locked}
                  />
                </td>
                {!locked ? (
                  <td>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={s.dueCents <= 0}
                      onClick={() =>
                        setDrafts(current => ({
                          ...current,
                          [s.unitId]: moneyInput(Math.max(0, s.dueCents)),
                        }))
                      }
                    >
                      Pagou tudo
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Lance aqui o que entrou no banco neste mês, inclusive atrasados. Quem
        pagar menos carrega a diferença para o mês seguinte.
      </p>
    </Panel>
  );
}

/* ---------- Cadastro ---------- */

type UnitDraft = {
  id: string;
  number: string;
  resident: string;
  active: boolean;
};

function CadastroTab({
  state,
  onSave,
}: {
  state: CondoState;
  onSave: (next: CondoState) => Promise<boolean>;
}) {
  const [name, setName] = useState(state.name);
  const [opening, setOpening] = useState(moneyInput(state.openingBalanceCents));
  const [units, setUnits] = useState<UnitDraft[]>(() => sortUnits(state.units));

  const update = (id: string, patch: Partial<UnitDraft>) =>
    setUnits(current =>
      current.map(u => (u.id === id ? { ...u, ...patch } : u))
    );

  const save = () => {
    const openingBalanceCents = parseSignedMoneyInput(opening);
    if (!name.trim()) return void toast.error("Informe o nome do condomínio.");
    if (openingBalanceCents === null)
      return void toast.error("Saldo inicial inválido.");
    const cleaned = units
      .map(u => ({
        ...u,
        number: u.number.trim(),
        resident: u.resident.trim(),
      }))
      .filter(u => u.number || state.units.some(s => s.id === u.id));
    if (cleaned.some(u => !u.number))
      return void toast.error("Todo apartamento precisa de número.");
    void onSave({
      ...state,
      name: name.trim(),
      openingBalanceCents,
      units: cleaned,
    });
  };

  return (
    <>
      <Panel title="Condomínio">
        <div className="form-row">
          <label className="field grow">
            <span>Nome</span>
            <input
              className="input"
              value={name}
              maxLength={120}
              onChange={event => setName(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Saldo no banco antes do 1º mês (R$)</span>
            <input
              className="input"
              inputMode="decimal"
              value={opening}
              onChange={event => setOpening(event.target.value)}
            />
          </label>
        </div>
      </Panel>

      <Panel
        title="Apartamentos"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setUnits(current => [
                ...current,
                {
                  id: createId("apto"),
                  number: "",
                  resident: "",
                  active: true,
                },
              ])
            }
          >
            <Plus size={15} /> Apartamento
          </Button>
        }
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Morador (não aparece no quadro)</th>
                <th>Ativo</th>
              </tr>
            </thead>
            <tbody>
              {units.map(u => (
                <tr key={u.id}>
                  <td>
                    <input
                      className="input input-sm"
                      value={u.number}
                      maxLength={30}
                      aria-label="Número do apartamento"
                      onChange={event =>
                        update(u.id, { number: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="input input-sm"
                      value={u.resident}
                      maxLength={120}
                      aria-label={`Morador do apto ${u.number}`}
                      onChange={event =>
                        update(u.id, { resident: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={u.active}
                      aria-label={`Apto ${u.number} ativo`}
                      onChange={event =>
                        update(u.id, { active: event.target.checked })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Apartamento desativado não entra nos próximos meses. Meses já criados
          não mudam.
        </p>
      </Panel>
      <div>
        <Button onClick={save}>Salvar cadastro</Button>
      </div>
    </>
  );
}

/* ---------- Área do síndico ---------- */

function Workspace({
  initial,
  refetch,
  logout,
}: {
  initial: Saved;
  refetch: () => Promise<Saved | undefined>;
  logout: () => Promise<void>;
}) {
  const [saved, setSaved] = useState(initial);
  const [tab, setTab] = useState<Tab>("painel");
  const [selected, setSelected] = useState("");
  const [creating, setCreating] = useState<string | null>(null);
  const saveMutation = trpc.condo.save.useMutation();

  useEffect(() => setSaved(initial), [initial]);

  const state = saved.state;
  const units = useMemo(() => sortUnits(state.units), [state.units]);
  const reports = useMemo(() => buildReports(state), [state]);
  const report =
    reports.find(r => r.month.competence === selected) ?? reports.at(-1);
  const month = report?.month;
  const locked = month?.status === "closed";
  const busy = saveMutation.isPending;

  const commit = async (next: CondoState, message: string) => {
    try {
      const result = await saveMutation.mutateAsync({
        state: next,
        revision: saved.revision,
      });
      setSaved(result);
      toast.success(message);
      return true;
    } catch (error) {
      toast.error(parseApiError(error));
      if (isConflictError(error)) {
        const fresh = await refetch();
        if (fresh) setSaved(fresh);
      }
      return false;
    }
  };

  const updateMonth = (updater: (m: Month) => Month, message: string) =>
    month
      ? commit(
          {
            ...state,
            months: state.months.map(m => (m.id === month.id ? updater(m) : m)),
          },
          message
        )
      : Promise.resolve(false);

  const latest = reports.at(-1)?.month.competence;
  const suggested = latest ? nextCompetence(latest) : currentCompetence();

  const createMonth = async (competence: string) => {
    if (!/^\d{4}-\d{2}$/.test(competence))
      return void toast.error("Escolha o mês.");
    if (state.months.some(m => m.competence === competence))
      return void toast.error("Esse mês já existe.");
    if (!state.units.some(u => u.active)) {
      setTab("cadastro");
      return void toast.error("Cadastre os apartamentos primeiro.");
    }
    const created = newMonth(state, competence, createId("mes"));
    const ok = await commit(
      { ...state, months: [...state.months, created] },
      `${formatMonth(competence)} criado.`
    );
    if (ok) {
      setSelected(competence);
      setCreating(null);
      setTab("leituras");
    }
  };

  const toggleStatus = () => {
    if (!report || !month) return;
    if (month.status === "open") {
      const diff = report.cash.differenceCents;
      const warning =
        diff === null
          ? "O saldo do extrato ainda não foi conferido. "
          : diff !== 0
            ? `O banco está com diferença de ${formatMoney(Math.abs(diff))}. `
            : "";
      if (!window.confirm(`${warning}Fechar ${formatMonth(month.competence)}?`))
        return;
    }
    void updateMonth(
      m => ({ ...m, status: m.status === "open" ? "closed" : "open" }),
      month.status === "open" ? "Mês fechado." : "Mês reaberto."
    );
  };

  const deleteMonth = () => {
    if (!month) return;
    if (
      !window.confirm(
        `Excluir ${formatMonth(month.competence)} e tudo que foi lançado nele?`
      )
    )
      return;
    void commit(
      { ...state, months: state.months.filter(m => m.id !== month.id) },
      "Mês excluído."
    ).then(ok => ok && setSelected(""));
  };

  const tabKey = `${month?.id}-${saved.revision}`;

  return (
    <div className="page">
      <header className="topbar">
        <Brand name={state.name} />
        <div className="topbar-actions">
          <a className="topbar-link" href="/">
            Quadro
          </a>
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            <LogOut size={15} /> Sair
          </Button>
        </div>
      </header>

      <div className="month-bar">
        {reports.length ? (
          <select
            className="input month-select"
            aria-label="Mês"
            value={month?.competence ?? ""}
            onChange={event => setSelected(event.target.value)}
          >
            {[...reports].reverse().map(r => (
              <option key={r.month.id} value={r.month.competence}>
                {formatMonth(r.month.competence)}
              </option>
            ))}
          </select>
        ) : null}
        {month ? <MonthStatus status={month.status} /> : null}
        <span className="spacer" />
        {month ? (
          <Button
            size="sm"
            variant={month.status === "open" ? "default" : "outline"}
            disabled={busy}
            onClick={toggleStatus}
          >
            {month.status === "open" ? (
              <>
                <LockKeyhole size={15} /> Fechar mês
              </>
            ) : (
              <>
                <DoorOpen size={15} /> Reabrir
              </>
            )}
          </Button>
        ) : null}
        {creating === null ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => setCreating(suggested)}
          >
            <Plus size={15} /> Novo mês
          </Button>
        ) : (
          <form
            className="inline-form"
            onSubmit={event => {
              event.preventDefault();
              void createMonth(creating);
            }}
          >
            <input
              className="input"
              type="month"
              aria-label="Mês a criar"
              value={creating}
              onChange={event => setCreating(event.target.value)}
            />
            <Button size="sm" type="submit" disabled={busy}>
              Criar
            </Button>
            <Button
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => setCreating(null)}
            >
              Cancelar
            </Button>
          </form>
        )}
      </div>

      <nav className="tabs" aria-label="Seções">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            className={t.key === tab ? "tab is-active" : "tab"}
            aria-current={t.key === tab ? "page" : undefined}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="stack">
        {locked && tab !== "cadastro" ? (
          <Notice>Mês fechado. Para corrigir algo, reabra o mês.</Notice>
        ) : null}

        {tab === "cadastro" ? (
          <CadastroTab
            key={saved.revision}
            state={state}
            onSave={next => commit(next, "Cadastro salvo.")}
          />
        ) : !report || !month ? (
          <Panel>
            <p>Nenhum mês lançado ainda.</p>
            <Button onClick={() => void createMonth(suggested)} disabled={busy}>
              <Plus size={16} /> Criar {formatMonth(suggested)}
            </Button>
          </Panel>
        ) : tab === "painel" ? (
          <PainelTab
            report={report}
            locked={locked}
            onSaveBank={bankBalanceCents =>
              updateMonth(m => ({ ...m, bankBalanceCents }), "Extrato salvo.")
            }
            onDelete={deleteMonth}
          />
        ) : tab === "despesas" ? (
          <DespesasTab
            key={tabKey}
            month={month}
            locked={locked}
            onSaveExpenses={(expenses, message) =>
              updateMonth(m => ({ ...m, expenses }), message)
            }
            onSaveReserve={reservePerUnitCents =>
              updateMonth(
                m => ({ ...m, reservePerUnitCents }),
                "Fundo de reserva salvo."
              )
            }
          />
        ) : tab === "leituras" ? (
          <LeiturasTab
            key={tabKey}
            month={month}
            units={units}
            locked={locked}
            onSave={readings =>
              updateMonth(m => ({ ...m, readings }), "Leituras salvas.")
            }
          />
        ) : (
          <PagamentosTab
            key={tabKey}
            report={report}
            locked={locked}
            onSave={payments =>
              updateMonth(m => ({ ...m, payments }), "Pagamentos salvos.")
            }
          />
        )}
      </main>
    </div>
  );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.error]);

  if (auth.loading || (auth.user && query.isLoading))
    return <p className="page muted">Carregando…</p>;
  if (!auth.user)
    return (
      <LoginGate
        loading={auth.loading}
        error={auth.error}
        onLogin={auth.login}
      />
    );
  if (query.error || !query.data)
    return (
      <div className="page">
        <Panel>
          <p>
            {isSessionError(query.error)
              ? "Sua sessão expirou. Entre novamente."
              : "Não foi possível carregar os dados."}
          </p>
          <Button onClick={() => void query.refetch()}>
            <RefreshCw size={16} /> Tentar de novo
          </Button>
        </Panel>
      </div>
    );
  return (
    <Workspace
      initial={query.data}
      refetch={async () => (await query.refetch()).data}
      logout={auth.logout}
    />
  );
}
