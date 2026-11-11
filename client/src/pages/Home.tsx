import { useEffect, useMemo, useState } from "react";
import {
  Check,
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
  type ExtraCharge,
  type Tariffs,
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
  formatPercent,
  chargesFromTariffs,
  tariffFeeCents,
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
  ChargeRule,
  QuotaTable,
} from "@/components/condo/quota-table";
import {
  createId,
  currentCompetence,
  formatDate,
  todayDate,
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
type Tab =
  | "painel"
  | "cobranca"
  | "despesas"
  | "leituras"
  | "pagamentos"
  | "cadastro";

const TABS: { key: Tab; label: string }[] = [
  { key: "painel", label: "Painel" },
  { key: "cobranca", label: "Cobrança" },
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
  const owing = statements.filter(s => s.balanceCents > 0).length;

  return (
    <>
      <div className="metrics">
        <Metric
          label="Recebido"
          value={formatMoney(cash.receivedCents)}
          detail={owing ? `${owing} apto(s) com saldo devedor` : "Todos em dia"}
          tone={owing ? "bad" : "good"}
        />
        <Metric label="A receber" value={formatMoney(cash.toReceiveCents)} />
        <Metric label="Dinheiro agora" value={formatMoney(cash.closingCents)} />
        <Metric label="A pagar" value={formatMoney(cash.toPayCents)} />
        <Metric
          label="Previsão fim do mês"
          value={formatMoney(cash.projectedCents)}
          detail="se todos pagarem"
        />
      </div>

      {!report.month.expenses.length ? (
        <Notice>Nenhuma despesa lançada neste mês ainda.</Notice>
      ) : null}
      {report.month.feeCents === 0 &&
      report.month.waterPriceCents === 0 &&
      report.month.gasPriceCents === 0 ? (
        <Notice tone="warn">
          Taxa e preços do m³ ainda não definidos. Preencha na aba Cobrança.
        </Notice>
      ) : null}
      {(totals.waterMilli > 0 && report.month.waterPriceCents === 0) ||
      (totals.gasMilli > 0 && report.month.gasPriceCents === 0) ? (
        <Notice tone="warn">
          Tem consumo lançado sem preço do m³: confira a aba Cobrança.
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
        <QuotaTable quotas={quotas} totals={totals} />
        <ChargeRule />
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

/* ---------- Cobrança ---------- */

type ChargeValues = Pick<
  Month,
  | "feeCents"
  | "maintenanceBp"
  | "reserveBp"
  | "adminCents"
  | "waterPriceCents"
  | "gasPriceCents"
>;

const percentInput = (bp: number) => String(bp / 100).replace(".", ",");

function CobrancaTab({
  month,
  units,
  tariffs,
  locked,
  onSaveValues,
  onSaveExtras,
}: {
  month: Month;
  units: Unit[];
  tariffs: Tariffs;
  locked: boolean;
  onSaveValues: (values: ChargeValues) => Promise<boolean>;
  onSaveExtras: (extras: ExtraCharge[], message: string) => Promise<boolean>;
}) {
  const [fee, setFee] = useState(moneyInput(month.feeCents));
  const [maintenance, setMaintenance] = useState(
    percentInput(month.maintenanceBp)
  );
  const [reserve, setReserve] = useState(percentInput(month.reserveBp));
  const [admin, setAdmin] = useState(moneyInput(month.adminCents));
  const [water, setWater] = useState(moneyInput(month.waterPriceCents));
  const [gas, setGas] = useState(moneyInput(month.gasPriceCents));
  const [waterBill, setWaterBill] = useState("");
  const [extraUnit, setExtraUnit] = useState("");
  const [extraDescription, setExtraDescription] = useState("");
  const [extraAmount, setExtraAmount] = useState("");

  const numberOf = new Map(units.map(u => [u.id, u.number]));
  const monthUnits = sortUnits(
    units.filter(u => month.readings.some(r => r.unitId === u.id))
  );
  const waterMilli = month.readings.reduce(
    (sum, r) => sum + r.waterCurrent - r.waterPrevious,
    0
  );

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    // Percentual usa o mesmo formato do dinheiro: "15" → 1500, "7,5" → 750.
    const values = {
      feeCents: parseMoneyInput(fee || "0"),
      maintenanceBp: parseMoneyInput(maintenance || "0"),
      reserveBp: parseMoneyInput(reserve || "0"),
      adminCents: parseMoneyInput(admin || "0"),
      waterPriceCents: parseMoneyInput(water || "0"),
      gasPriceCents: parseMoneyInput(gas || "0"),
    };
    if (Object.values(values).some(v => v === null))
      return void toast.error("Algum valor está inválido.");
    if (values.maintenanceBp! > 10000 || values.reserveBp! > 10000)
      return void toast.error("Percentual acima de 100%.");
    void onSaveValues(values as ChargeValues);
  };

  const fromBill = () => {
    const cents = parseMoneyInput(waterBill);
    if (cents === null || waterMilli <= 0)
      return void toast.error(
        waterMilli <= 0
          ? "Digite as leituras de água antes."
          : "Valor da conta inválido."
      );
    setWater(moneyInput(Math.round((cents * 1000) / waterMilli)));
  };

  const addExtra = (event: React.FormEvent) => {
    event.preventDefault();
    const amountCents = parseMoneyInput(extraAmount);
    if (!extraUnit) return void toast.error("Escolha o apartamento.");
    if (!extraDescription.trim())
      return void toast.error("Informe a descrição.");
    if (amountCents === null || amountCents === 0)
      return void toast.error("Valor inválido.");
    void onSaveExtras(
      [
        ...month.extraCharges,
        {
          id: createId("avulso"),
          unitId: extraUnit,
          description: extraDescription.trim(),
          amountCents,
        },
      ],
      "Cobrança avulsa lançada."
    ).then(ok => {
      if (!ok) return;
      setExtraDescription("");
      setExtraAmount("");
    });
  };

  const field = (
    label: string,
    value: string,
    onChange: (value: string) => void
  ) => (
    <label className="field">
      <span>{label}</span>
      <input
        className="input"
        inputMode="decimal"
        placeholder="0"
        value={value}
        onChange={event => onChange(event.target.value)}
        disabled={locked}
      />
    </label>
  );

  return (
    <>
      <Panel title="Valores do mês">
        <form className="stack" onSubmit={save}>
          <div className="form-grid">
            {field("Taxa de condomínio por apto (R$)", fee, setFee)}
            {field(
              "Fundo de manutenção (% da taxa)",
              maintenance,
              setMaintenance
            )}
            {field("Fundo de reserva (% da taxa)", reserve, setReserve)}
            {field("Taxa de administração por apto (R$)", admin, setAdmin)}
            {field("Preço do m³ de água (R$)", water, setWater)}
            {field("Preço do m³ de gás (R$)", gas, setGas)}
          </div>
          {!locked ? (
            <div className="form-row">
              <label className="field grow">
                <span>
                  Calcular o preço da água pela conta da Copasa dos aptos (
                  {formatM3(waterMilli)} m³ no mês)
                </span>
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="Valor da conta, ex.: 438,93"
                  value={waterBill}
                  onChange={event => setWaterBill(event.target.value)}
                />
              </label>
              <Button type="button" variant="outline" onClick={fromBill}>
                Calcular
              </Button>
            </div>
          ) : null}
          <div className="form-row">
            <Button type="submit" disabled={locked}>
              Salvar valores
            </Button>
            {!locked ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const c = chargesFromTariffs(tariffs);
                  setFee(moneyInput(c.feeCents));
                  setMaintenance(percentInput(c.maintenanceBp));
                  setReserve(percentInput(c.reserveBp));
                  setAdmin(moneyInput(c.adminCents));
                  setWater(moneyInput(c.waterPriceCents));
                  setGas(moneyInput(c.gasPriceCents));
                  toast.message(
                    "Tarifas do cadastro preenchidas. Salve para aplicar."
                  );
                }}
              >
                Usar tarifas do cadastro
              </Button>
            ) : null}
          </div>
        </form>
        <p className="muted small">
          Estes valores valem só para este mês (vieram das tarifas do Cadastro
          quando o mês foi criado). Taxa de {formatMoney(month.feeCents)},
          manutenção {formatPercent(month.maintenanceBp)}% e reserva{" "}
          {formatPercent(month.reserveBp)}% da taxa. Isentos pagam só consumo,
          fundo de reserva e avulsos.
        </p>
      </Panel>

      <Panel title="Cobranças avulsas">
        {month.extraCharges.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <tbody>
                {month.extraCharges.map(e => (
                  <tr key={e.id}>
                    <td>
                      <strong>{numberOf.get(e.unitId) ?? "?"}</strong>
                      <small>{e.description}</small>
                    </td>
                    <td className="num">{formatMoney(e.amountCents)}</td>
                    {!locked ? (
                      <td className="actions">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remover ${e.description}`}
                          onClick={() => {
                            if (!window.confirm(`Remover "${e.description}"?`))
                              return;
                            void onSaveExtras(
                              month.extraCharges.filter(x => x.id !== e.id),
                              "Cobrança avulsa removida."
                            );
                          }}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Nenhuma cobrança avulsa neste mês.</p>
        )}
        {!locked ? (
          <form className="form-row" onSubmit={addExtra}>
            <label className="field">
              <span>Apto</span>
              <select
                className="input"
                value={extraUnit}
                onChange={event => setExtraUnit(event.target.value)}
              >
                <option value="">Escolha</option>
                {monthUnits.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.number}
                  </option>
                ))}
              </select>
            </label>
            <label className="field grow">
              <span>Descrição</span>
              <input
                className="input"
                maxLength={200}
                placeholder="Ex.: Multa, reembolso"
                value={extraDescription}
                onChange={event => setExtraDescription(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Valor (R$)</span>
              <input
                className="input"
                inputMode="decimal"
                placeholder="0,00"
                value={extraAmount}
                onChange={event => setExtraAmount(event.target.value)}
              />
            </label>
            <Button type="submit">
              <Plus size={16} /> Lançar
            </Button>
          </form>
        ) : null}
      </Panel>
    </>
  );
}

/* ---------- Despesas ---------- */

function DespesasTab({
  month,
  locked,
  onSaveExpenses,
}: {
  month: Month;
  locked: boolean;
  onSaveExpenses: (expenses: Expense[], message: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("Água");
  const [amount, setAmount] = useState("");
  const [fromReserve, setFromReserve] = useState(false);
  const [paid, setPaid] = useState(false);
  const [paidOn, setPaidOn] = useState(todayDate());

  const reset = () => {
    setEditing(null);
    setDescription("");
    setAmount("");
    setFromReserve(false);
    setPaid(false);
    setPaidOn(todayDate());
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
      fromReserve,
      paid,
      paidOn: paid && paidOn ? paidOn : null,
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
    setFromReserve(e.fromReserve);
    setPaid(e.paid);
    setPaidOn(e.paidOn ?? todayDate());
  };
  const markPaid = (e: Expense) =>
    void onSaveExpenses(
      month.expenses.map(x =>
        x.id === e.id ? { ...x, paid: true, paidOn: todayDate() } : x
      ),
      `Paga em ${formatDate(todayDate())}. Para outra data, use o lápis.`
    );
  const remove = (e: Expense) => {
    if (!window.confirm(`Remover "${e.description}"?`)) return;
    void onSaveExpenses(
      month.expenses.filter(x => x.id !== e.id),
      "Despesa removida."
    );
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
            <label className="field">
              <span>Situação</span>
              <select
                className="input"
                value={paid ? "paid" : "open"}
                onChange={event => setPaid(event.target.value === "paid")}
              >
                <option value="open">A pagar</option>
                <option value="paid">Paga</option>
              </select>
            </label>
            {paid ? (
              <label className="field">
                <span>Paga em</span>
                <input
                  className="input"
                  type="date"
                  value={paidOn}
                  onChange={event => setPaidOn(event.target.value)}
                />
              </label>
            ) : null}
            <label className="check">
              <input
                type="checkbox"
                checked={fromReserve}
                onChange={event => setFromReserve(event.target.checked)}
              />
              Pago pelo fundo de reserva
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
            A despesa só sai do dinheiro quando está paga. Enquanto estiver a
            pagar, ela entra na previsão do fim do mês. A cota de cada
            apartamento é definida na aba Cobrança.
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
                      <small>
                        {e.category}
                        {e.fromReserve ? " · fundo de reserva" : ""}
                      </small>
                      {e.paid ? (
                        <Badge tone="ok">
                          {e.paidOn
                            ? `Paga em ${formatDate(e.paidOn)}`
                            : "Paga"}
                        </Badge>
                      ) : (
                        <Badge tone="open">A pagar</Badge>
                      )}
                    </td>
                    <td className="num">{formatMoney(e.amountCents)}</td>
                    {!locked ? (
                      <td className="actions">
                        {!e.paid ? (
                          <Button
                            variant="outline"
                            size="icon-sm"
                            aria-label={`Marcar ${e.description} como paga`}
                            title="Marcar como paga hoje"
                            onClick={() => markPaid(e)}
                          >
                            <Check size={15} />
                          </Button>
                        ) : null}
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
  exempt: boolean;
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
  const [openingDate, setOpeningDate] = useState(state.openingDate ?? "");
  const [openingReserve, setOpeningReserve] = useState(
    moneyInput(state.openingReserveCents)
  );
  const t = state.tariffs;
  const [wage, setWage] = useState(moneyInput(t.minimumWageCents));
  const [feePct, setFeePct] = useState(percentInput(t.feeBp));
  const [maintPct, setMaintPct] = useState(percentInput(t.maintenanceBp));
  const [reservePct, setReservePct] = useState(percentInput(t.reserveBp));
  const [adminValue, setAdminValue] = useState(moneyInput(t.adminCents));
  const [waterValue, setWaterValue] = useState(moneyInput(t.waterPriceCents));
  const [gasValue, setGasValue] = useState(moneyInput(t.gasPriceCents));
  // Percentual usa o mesmo formato do dinheiro: "22" → 2200, "7,5" → 750.
  const tariffs = {
    minimumWageCents: parseMoneyInput(wage || "0"),
    feeBp: parseMoneyInput(feePct || "0"),
    maintenanceBp: parseMoneyInput(maintPct || "0"),
    reserveBp: parseMoneyInput(reservePct || "0"),
    adminCents: parseMoneyInput(adminValue || "0"),
    waterPriceCents: parseMoneyInput(waterValue || "0"),
    gasPriceCents: parseMoneyInput(gasValue || "0"),
  };
  const tariffsValid = Object.values(tariffs).every(v => v !== null);
  const feePreview = tariffsValid ? tariffFeeCents(tariffs as Tariffs) : null;
  const [units, setUnits] = useState<UnitDraft[]>(() => sortUnits(state.units));

  const update = (id: string, patch: Partial<UnitDraft>) =>
    setUnits(current =>
      current.map(u => (u.id === id ? { ...u, ...patch } : u))
    );

  const save = () => {
    const openingBalanceCents = parseSignedMoneyInput(opening);
    const openingReserveCents = parseSignedMoneyInput(openingReserve || "0");
    if (!name.trim()) return void toast.error("Informe o nome do condomínio.");
    if (openingBalanceCents === null || openingReserveCents === null)
      return void toast.error("Saldo inicial inválido.");
    if (!tariffsValid) return void toast.error("Alguma tarifa está inválida.");
    if (
      tariffs.feeBp! > 10000 ||
      tariffs.maintenanceBp! > 10000 ||
      tariffs.reserveBp! > 10000
    )
      return void toast.error("Percentual acima de 100%.");
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
      openingDate: openingDate || null,
      openingReserveCents,
      tariffs: tariffs as Tariffs,
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
            <span>Saldo no banco nessa data (R$)</span>
            <input
              className="input"
              inputMode="decimal"
              value={opening}
              onChange={event => setOpening(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Data do saldo (saldo do dia no extrato)</span>
            <input
              className="input"
              type="date"
              value={openingDate}
              onChange={event => setOpeningDate(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Desse saldo, quanto é do fundo de reserva (R$)</span>
            <input
              className="input"
              inputMode="decimal"
              value={openingReserve}
              onChange={event => setOpeningReserve(event.target.value)}
            />
          </label>
        </div>
        <p className="muted small">
          O app conta o dinheiro a partir dessa data: despesa paga até o dia do
          saldo já está dentro dele, e despesa sem data de pagamento vale o
          último dia do mês. O saldo inclui o fundo de reserva; o caixa do
          condomínio é o saldo menos o fundo.
        </p>
      </Panel>

      <Panel title="Tarifas vigentes">
        <div className="form-grid">
          {[
            ["Salário mínimo (R$)", wage, setWage],
            ["Taxa de condomínio (% do salário mínimo)", feePct, setFeePct],
            ["Fundo de manutenção (% da taxa)", maintPct, setMaintPct],
            ["Fundo de reserva (% da taxa)", reservePct, setReservePct],
            ["Taxa de administração por apto (R$)", adminValue, setAdminValue],
            ["Preço do m³ de água (R$)", waterValue, setWaterValue],
            ["Preço do m³ de gás (R$)", gasValue, setGasValue],
          ].map(([label, value, set]) => (
            <label className="field" key={label as string}>
              <span>{label as string}</span>
              <input
                className="input"
                inputMode="decimal"
                placeholder="0"
                value={value as string}
                onChange={event =>
                  (set as (v: string) => void)(event.target.value)
                }
              />
            </label>
          ))}
        </div>
        <p className="muted small">
          Taxa de condomínio por apto:{" "}
          <strong>{feePreview === null ? "–" : formatMoney(feePreview)}</strong>
          . Cada mês novo copia estas tarifas e guarda a cópia: mudar o salário
          mínimo não altera meses já criados. A água pode ser ajustada em cada
          mês pela conta da Copasa (aba Cobrança).
        </p>
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
                  exempt: false,
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
                <th>Isento</th>
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
                  <td>
                    <input
                      type="checkbox"
                      checked={u.exempt}
                      aria-label={`Apto ${u.number} isento`}
                      onChange={event =>
                        update(u.id, { exempt: event.target.checked })
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
          não mudam. Isento (ex.: síndico) não paga taxa de condomínio,
          manutenção nem administração; paga consumo, fundo de reserva e
          avulsos.
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
        ) : tab === "cobranca" ? (
          <CobrancaTab
            key={tabKey}
            month={month}
            units={units}
            tariffs={state.tariffs}
            locked={locked}
            onSaveValues={values =>
              updateMonth(m => ({ ...m, ...values }), "Valores salvos.")
            }
            onSaveExtras={(extraCharges, message) =>
              updateMonth(m => ({ ...m, extraCharges }), message)
            }
          />
        ) : tab === "despesas" ? (
          <DespesasTab
            key={tabKey}
            month={month}
            locked={locked}
            onSaveExpenses={(expenses, message) =>
              updateMonth(m => ({ ...m, expenses }), message)
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
