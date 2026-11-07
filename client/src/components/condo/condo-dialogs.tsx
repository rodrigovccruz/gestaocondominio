import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Check, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateCharge,
  formatMoney,
  formatReading,
  moneyInput,
  parseMoneyInput,
  parseReadingInput,
  parseSignedMoneyInput,
  readingInput,
  type Charge,
  type Expense,
  type Month,
  type Unit,
} from "./condo-utils";
import { FormField, MoneyLine, SaveButton, StatusBadge } from "./condo-ui";

function DialogFooterActions({
  onCancel,
  pending,
  submitLabel = "Salvar",
}: {
  onCancel: () => void;
  pending?: boolean;
  submitLabel?: string;
}) {
  return (
    <DialogFooter className="condo-dialog-footer">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={pending}
      >
        Cancelar
      </Button>
      <SaveButton pending={pending}>{submitLabel}</SaveButton>
    </DialogFooter>
  );
}

export type MonthDraft = {
  competence: string;
  waterRateCents: number;
  gasRateCents: number;
  openingBalanceCents: number;
  copyPrevious: boolean;
};

export function MonthDialog({
  open,
  onOpenChange,
  initial,
  previousCompetenceAvailable,
  onSubmit,
  pending,
  mode = "create",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<MonthDraft>;
  previousCompetenceAvailable?: boolean;
  onSubmit: (draft: MonthDraft) => void;
  pending?: boolean;
  mode?: "create" | "edit";
}) {
  const [competence, setCompetence] = useState(initial?.competence ?? "");
  const [waterRate, setWaterRate] = useState(
    moneyInput(initial?.waterRateCents ?? 0)
  );
  const [gasRate, setGasRate] = useState(
    moneyInput(initial?.gasRateCents ?? 0)
  );
  const [openingBalance, setOpeningBalance] = useState(
    moneyInput(initial?.openingBalanceCents ?? 0)
  );
  const [copyPrevious, setCopyPrevious] = useState(
    initial?.copyPrevious ?? false
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setCompetence(initial?.competence ?? "");
    setWaterRate(moneyInput(initial?.waterRateCents ?? 0));
    setGasRate(moneyInput(initial?.gasRateCents ?? 0));
    setOpeningBalance(moneyInput(initial?.openingBalanceCents ?? 0));
    setCopyPrevious(initial?.copyPrevious ?? false);
    setError("");
  }, [
    open,
    initial?.competence,
    initial?.waterRateCents,
    initial?.gasRateCents,
    initial?.openingBalanceCents,
    initial?.copyPrevious,
  ]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const waterRateCents = parseMoneyInput(waterRate);
    const gasRateCents = parseMoneyInput(gasRate);
    const openingBalanceCents = parseSignedMoneyInput(openingBalance);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competence))
      return setError("Escolha uma competência válida.");
    if (
      waterRateCents === null ||
      gasRateCents === null ||
      openingBalanceCents === null
    )
      return setError("Informe tarifas e saldo em valores numéricos válidos.");
    onSubmit({
      competence,
      waterRateCents,
      gasRateCents,
      openingBalanceCents,
      copyPrevious,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="condo-dialog">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Parâmetros da competência" : "Nova competência"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Atualize somente tarifas e saldo de abertura. Leituras, cobranças e despesas permanecem intactas."
              : "Abra um novo ciclo para as unidades ativas. Dados anteriores só serão usados se a competência imediatamente anterior existir."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="form-stack">
          <div className="form-grid form-grid-2">
            <FormField label="Competência" htmlFor="new-competence">
              <Input
                id="new-competence"
                type="month"
                value={competence}
                onChange={event => setCompetence(event.target.value)}
                disabled={mode === "edit"}
                required
              />
            </FormField>
            <FormField
              label="Saldo de abertura"
              hint="Pode ser negativo"
              htmlFor="opening-balance"
            >
              <Input
                id="opening-balance"
                inputMode="decimal"
                value={openingBalance}
                onChange={event => setOpeningBalance(event.target.value)}
                placeholder="0,00"
              />
            </FormField>
          </div>
          <div className="form-grid form-grid-2">
            <FormField label="Tarifa de água (R$/m³)" htmlFor="water-rate">
              <Input
                id="water-rate"
                inputMode="decimal"
                value={waterRate}
                onChange={event => setWaterRate(event.target.value)}
                placeholder="0,00"
              />
            </FormField>
            <FormField label="Tarifa de gás (R$/m³)" htmlFor="gas-rate">
              <Input
                id="gas-rate"
                inputMode="decimal"
                value={gasRate}
                onChange={event => setGasRate(event.target.value)}
                placeholder="0,00"
              />
            </FormField>
          </div>
          {mode === "create" &&
            (previousCompetenceAvailable ? (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={copyPrevious}
                  onChange={event => setCopyPrevious(event.target.checked)}
                />
                <span>
                  <strong>
                    Copiar condomínio e fundo de reserva anteriores
                  </strong>
                  <small>
                    Somente da competência imediatamente anterior. Pagamentos,
                    multas e outros adicionais começam em zero.
                  </small>
                </span>
              </label>
            ) : (
              <p className="dialog-note">
                Não há competência anterior cadastrada. As leituras começam em
                zero e as cobranças são criadas para as unidades ativas.
              </p>
            ))}
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooterActions
            onCancel={() => onOpenChange(false)}
            pending={pending}
            submitLabel={
              mode === "edit" ? "Salvar parâmetros" : "Criar competência"
            }
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type UnitDraft = {
  number: string;
  resident: string;
  fraction: number;
  includeInCurrentMonth: boolean;
};

export function UnitDialog({
  open,
  onOpenChange,
  unit,
  hasOpenMonth,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit?: Unit;
  hasOpenMonth: boolean;
  onSubmit: (draft: UnitDraft) => void;
  pending?: boolean;
}) {
  const [number, setNumber] = useState(unit?.number ?? "");
  const [resident, setResident] = useState(unit?.resident ?? "");
  const [fraction, setFraction] = useState(
    unit ? String(unit.fraction).replace(".", ",") : ""
  );
  const [include, setInclude] = useState(hasOpenMonth);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setNumber(unit?.number ?? "");
    setResident(unit?.resident ?? "");
    setFraction(unit ? String(unit.fraction).replace(".", ",") : "");
    setInclude(hasOpenMonth);
    setError("");
  }, [
    open,
    unit?.id,
    unit?.number,
    unit?.resident,
    unit?.fraction,
    hasOpenMonth,
  ]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = Number(fraction.replace(",", "."));
    if (!number.trim()) return setError("Informe o número da unidade.");
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100)
      return setError("A fração ideal deve estar entre 0 e 100.");
    onSubmit({
      number: number.trim(),
      resident: resident.trim(),
      fraction: parsed,
      includeInCurrentMonth: unit ? false : include,
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="condo-dialog">
        <DialogHeader>
          <DialogTitle>
            {unit ? "Editar unidade" : "Cadastrar unidade"}
          </DialogTitle>
          <DialogDescription>
            {unit
              ? "Atualize os dados sem alterar o histórico de cobranças."
              : "Unidades arquivadas continuam referenciadas no histórico."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="form-stack">
          <div className="form-grid form-grid-2">
            <FormField label="Apartamento / unidade" htmlFor="unit-number">
              <Input
                id="unit-number"
                value={number}
                onChange={event => setNumber(event.target.value)}
                placeholder="Ex.: 101"
                maxLength={30}
                required
              />
            </FormField>
            <FormField
              label="Fração ideal (%)"
              hint="Informativa; não calcula rateio automaticamente"
              htmlFor="unit-fraction"
            >
              <Input
                id="unit-fraction"
                inputMode="decimal"
                value={fraction}
                onChange={event => setFraction(event.target.value)}
                placeholder="0,00"
                required
              />
            </FormField>
          </div>
          <FormField label="Morador responsável" htmlFor="unit-resident">
            <Input
              id="unit-resident"
              value={resident}
              onChange={event => setResident(event.target.value)}
              placeholder="Nome do morador"
              maxLength={120}
            />
          </FormField>
          {!unit && hasOpenMonth ? (
            <label className="check-row">
              <input
                type="checkbox"
                checked={include}
                onChange={event => setInclude(event.target.checked)}
              />
              <span>
                <strong>Incluir na competência aberta</strong>
                <small>Uma cobrança vazia será criada para esta unidade.</small>
              </span>
            </label>
          ) : null}
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooterActions
            onCancel={() => onOpenChange(false)}
            pending={pending}
            submitLabel={unit ? "Salvar unidade" : "Cadastrar unidade"}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function fieldLabel(prefix: string, index: number) {
  return `${prefix}-${index}`;
}

export function ChargeDialog({
  open,
  onOpenChange,
  charge,
  unit,
  month,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charge?: Charge;
  unit: Unit;
  month: Month;
  onSubmit: (charge: Charge) => void;
  pending?: boolean;
}) {
  const base: Charge = charge ?? {
    unitId: unit.id,
    waterPrevious: 0,
    waterCurrent: 0,
    gasPrevious: 0,
    gasCurrent: 0,
    condoCents: 0,
    reserveCents: 0,
    fineCents: 0,
    otherCents: 0,
    paidCents: 0,
    notes: "",
  };
  const [waterPrevious, setWaterPrevious] = useState(
    readingInput(base.waterPrevious)
  );
  const [waterCurrent, setWaterCurrent] = useState(
    readingInput(base.waterCurrent)
  );
  const [gasPrevious, setGasPrevious] = useState(
    readingInput(base.gasPrevious)
  );
  const [gasCurrent, setGasCurrent] = useState(readingInput(base.gasCurrent));
  const [condo, setCondo] = useState(moneyInput(base.condoCents));
  const [reserve, setReserve] = useState(moneyInput(base.reserveCents));
  const [fine, setFine] = useState(moneyInput(base.fineCents));
  const [other, setOther] = useState(moneyInput(base.otherCents));
  const [paid, setPaid] = useState(moneyInput(base.paidCents));
  const [notes, setNotes] = useState(base.notes);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setWaterPrevious(readingInput(base.waterPrevious));
    setWaterCurrent(readingInput(base.waterCurrent));
    setGasPrevious(readingInput(base.gasPrevious));
    setGasCurrent(readingInput(base.gasCurrent));
    setCondo(moneyInput(base.condoCents));
    setReserve(moneyInput(base.reserveCents));
    setFine(moneyInput(base.fineCents));
    setOther(moneyInput(base.otherCents));
    setPaid(moneyInput(base.paidCents));
    setNotes(base.notes);
    setError("");
  }, [
    open,
    charge?.unitId,
    charge?.waterPrevious,
    charge?.waterCurrent,
    charge?.gasPrevious,
    charge?.gasCurrent,
    charge?.condoCents,
    charge?.reserveCents,
    charge?.fineCents,
    charge?.otherCents,
    charge?.paidCents,
    charge?.notes,
    charge?.unitSnapshot?.number,
    charge?.unitSnapshot?.resident,
  ]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const wp = parseReadingInput(waterPrevious),
      wc = parseReadingInput(waterCurrent),
      gp = parseReadingInput(gasPrevious),
      gc = parseReadingInput(gasCurrent);
    const values = [
      parseMoneyInput(condo),
      parseMoneyInput(reserve),
      parseMoneyInput(fine),
      parseMoneyInput(other),
      parseMoneyInput(paid),
    ];
    if ([wp, wc, gp, gc, ...values].some(value => value === null))
      return setError(
        "Preencha leituras e valores sem negativos ou caracteres inválidos."
      );
    if ((wc as number) < (wp as number))
      return setError(
        "A leitura atual de água não pode ser menor que a anterior."
      );
    if ((gc as number) < (gp as number))
      return setError(
        "A leitura atual de gás não pode ser menor que a anterior."
      );
    onSubmit({
      unitId: unit.id,
      waterPrevious: wp as number,
      waterCurrent: wc as number,
      gasPrevious: gp as number,
      gasCurrent: gc as number,
      condoCents: values[0] as number,
      reserveCents: values[1] as number,
      fineCents: values[2] as number,
      otherCents: values[3] as number,
      paidCents: values[4] as number,
      notes: notes.trim(),
      ...(base.unitSnapshot ? { unitSnapshot: base.unitSnapshot } : {}),
    });
  };
  const computed = useMemo(() => {
    const safe = {
      ...base,
      waterPrevious: parseReadingInput(waterPrevious) ?? base.waterPrevious,
      waterCurrent: parseReadingInput(waterCurrent) ?? base.waterCurrent,
      gasPrevious: parseReadingInput(gasPrevious) ?? base.gasPrevious,
      gasCurrent: parseReadingInput(gasCurrent) ?? base.gasCurrent,
      condoCents: parseMoneyInput(condo) ?? base.condoCents,
      reserveCents: parseMoneyInput(reserve) ?? base.reserveCents,
      fineCents: parseMoneyInput(fine) ?? base.fineCents,
      otherCents: parseMoneyInput(other) ?? base.otherCents,
      paidCents: parseMoneyInput(paid) ?? base.paidCents,
    };
    return calculateCharge(safe, month);
  }, [
    base,
    waterPrevious,
    waterCurrent,
    gasPrevious,
    gasCurrent,
    condo,
    reserve,
    fine,
    other,
    paid,
    month,
  ]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="condo-dialog condo-dialog-wide">
        <DialogHeader>
          <DialogTitle>Leituras e cobrança · unidade {unit.number}</DialogTitle>
          <DialogDescription>
            {unit.resident || "Morador não informado"}. Leituras em m³ com três
            casas decimais; valores em reais.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="form-stack">
          <div className="reading-grid">
            <div className="reading-block">
              <div className="reading-block-title">
                Água <span>m³</span>
              </div>
              <div className="form-grid form-grid-2">
                <FormField
                  label="Anterior"
                  htmlFor={fieldLabel("water-previous", 1)}
                >
                  <Input
                    id={fieldLabel("water-previous", 1)}
                    inputMode="decimal"
                    value={waterPrevious}
                    onChange={event => setWaterPrevious(event.target.value)}
                  />
                </FormField>
                <FormField
                  label="Atual"
                  htmlFor={fieldLabel("water-current", 1)}
                >
                  <Input
                    id={fieldLabel("water-current", 1)}
                    inputMode="decimal"
                    value={waterCurrent}
                    onChange={event => setWaterCurrent(event.target.value)}
                  />
                </FormField>
              </div>
            </div>
            <div className="reading-block">
              <div className="reading-block-title">
                Gás <span>m³</span>
              </div>
              <div className="form-grid form-grid-2">
                <FormField
                  label="Anterior"
                  htmlFor={fieldLabel("gas-previous", 1)}
                >
                  <Input
                    id={fieldLabel("gas-previous", 1)}
                    inputMode="decimal"
                    value={gasPrevious}
                    onChange={event => setGasPrevious(event.target.value)}
                  />
                </FormField>
                <FormField label="Atual" htmlFor={fieldLabel("gas-current", 1)}>
                  <Input
                    id={fieldLabel("gas-current", 1)}
                    inputMode="decimal"
                    value={gasCurrent}
                    onChange={event => setGasCurrent(event.target.value)}
                  />
                </FormField>
              </div>
            </div>
          </div>
          <div className="form-grid form-grid-3">
            {[
              ["Condomínio", condo, setCondo],
              ["Fundo reserva", reserve, setReserve],
              ["Multa", fine, setFine],
              ["Outros", other, setOther],
              ["Pago", paid, setPaid],
            ].map(([label, value, setter], index) => (
              <FormField
                key={String(label)}
                label={String(label)}
                htmlFor={fieldLabel("charge", index)}
              >
                <Input
                  id={fieldLabel("charge", index)}
                  inputMode="decimal"
                  value={String(value)}
                  onChange={event =>
                    (setter as (value: string) => void)(event.target.value)
                  }
                  placeholder="0,00"
                />
              </FormField>
            ))}
          </div>
          <FormField label="Observações" htmlFor="charge-notes">
            <Textarea
              id="charge-notes"
              value={notes}
              onChange={event => setNotes(event.target.value)}
              placeholder="Acordos, leituras estimadas ou recados"
              maxLength={500}
            />
          </FormField>
          <div className="dialog-total">
            <span>
              Total calculado{" "}
              <small>
                (água {formatMoney(computed.waterCents)} + gás{" "}
                {formatMoney(computed.gasCents)} + rateio{" "}
                {formatMoney(computed.sharedCents)} + fixos)
              </small>
            </span>
            <strong>{formatMoney(computed.totalCents)}</strong>
          </div>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooterActions
            onCancel={() => onOpenChange(false)}
            pending={pending}
            submitLabel="Salvar cobrança"
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function initialExpenseRateable(
  expense?: Partial<Pick<Expense, "rateable" | "category">>
) {
  return expense?.rateable === true;
}

export function rateableAfterExpenseCategoryChange(
  current: boolean,
  category: Expense["category"]
) {
  return category === "Água" || category === "Gás" ? false : current;
}

export function ExpenseDialog({
  open,
  onOpenChange,
  expense,
  competence,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense;
  competence: string;
  onSubmit: (expense: Omit<Expense, "id">) => void;
  pending?: boolean;
}) {
  const [description, setDescription] = useState(expense?.description ?? "");
  const [category, setCategory] = useState<Expense["category"]>(
    expense?.category ?? "Manutenção"
  );
  const [date, setDate] = useState(expense?.date ?? `${competence}-01`);
  const [amount, setAmount] = useState(moneyInput(expense?.amountCents ?? 0));
  const [rateable, setRateable] = useState(initialExpenseRateable(expense));
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setDescription(expense?.description ?? "");
    setCategory(expense?.category ?? "Manutenção");
    setDate(expense?.date ?? `${competence}-01`);
    setAmount(moneyInput(expense?.amountCents ?? 0));
    setRateable(initialExpenseRateable(expense));
    setError("");
  }, [
    open,
    expense?.id,
    expense?.description,
    expense?.category,
    expense?.date,
    expense?.amountCents,
    expense?.rateable,
    competence,
  ]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const amountCents = parseMoneyInput(amount);
    if (!description.trim()) return setError("Informe uma descrição.");
    if (!date.startsWith(competence))
      return setError("A data deve pertencer à competência selecionada.");
    if (amountCents === null)
      return setError("Informe um valor válido e não negativo.");
    onSubmit({
      description: description.trim(),
      category,
      date,
      amountCents,
      rateable,
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="condo-dialog">
        <DialogHeader>
          <DialogTitle>
            {expense ? "Editar despesa" : "Nova despesa"}
          </DialogTitle>
          <DialogDescription>
            Competência {competence}. Despesas ficam bloqueadas quando o mês é
            fechado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="form-stack">
          <FormField label="Descrição" htmlFor="expense-description">
            <Input
              id="expense-description"
              value={description}
              onChange={event => setDescription(event.target.value)}
              maxLength={200}
              placeholder="Ex.: manutenção do elevador"
              required
            />
          </FormField>
          <div className="form-grid form-grid-2">
            <FormField label="Categoria" htmlFor="expense-category">
              <Select
                value={category}
                onValueChange={value => {
                  const nextCategory = value as Expense["category"];
                  setCategory(nextCategory);
                  setRateable(current =>
                    rateableAfterExpenseCategoryChange(current, nextCategory)
                  );
                }}
              >
                <SelectTrigger id="expense-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Água",
                    "Gás",
                    "Manutenção",
                    "Limpeza",
                    "Administração",
                    "Outros",
                  ].map(item => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Data" htmlFor="expense-date">
              <Input
                id="expense-date"
                type="date"
                value={date}
                onChange={event => setDate(event.target.value)}
                required
              />
            </FormField>
          </div>
          <FormField label="Valor" hint="Em reais" htmlFor="expense-amount">
            <Input
              id="expense-amount"
              inputMode="decimal"
              value={amount}
              onChange={event => setAmount(event.target.value)}
              placeholder="0,00"
              required
            />
          </FormField>
          <label className="check-row">
            <input
              type="checkbox"
              checked={rateable}
              onChange={event => setRateable(event.target.checked)}
            />
            <span>
              <strong>Ratear entre as unidades</strong>
              <small>
                Nenhuma despesa entra sem marca explícita. Água e gás começam
                desmarcados para evitar duplicidade.
              </small>
            </span>
          </label>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooterActions
            onCancel={() => onOpenChange(false)}
            pending={pending}
            submitLabel={expense ? "Salvar despesa" : "Adicionar despesa"}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "default",
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
  pending?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="condo-dialog">
        <DialogHeader>
          <div className="confirm-icon">
            <AlertTriangle size={21} />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="condo-dialog-footer">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            variant={tone === "danger" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StatementDialog({
  open,
  onOpenChange,
  charge,
  unit,
  month,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charge?: Charge;
  unit?: Unit;
  month?: Month;
}) {
  if (!charge || !unit || !month) return null;
  const computed = calculateCharge(charge, month);
  const status =
    computed.outstandingCents < 0
      ? "credit"
      : computed.outstandingCents === 0
        ? "paid"
        : "pending";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="condo-dialog statement-dialog">
        <DialogHeader>
          <div className="statement-heading">
            <div className="statement-icon">
              <FileText size={19} />
            </div>
            <div>
              <DialogTitle>Extrato da unidade {unit.number}</DialogTitle>
              <DialogDescription>
                {unit.resident || "Morador não informado"} · {month.competence}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="statement-lines">
          <MoneyLine label="Consumo de água" cents={computed.waterCents} />
          <MoneyLine label="Consumo de gás" cents={computed.gasCents} />
          {computed.sharedCents > 0 ? (
            <MoneyLine
              label="Rateio de despesas compartilhadas"
              cents={computed.sharedCents}
            />
          ) : null}
          <MoneyLine label="Condomínio" cents={charge.condoCents} />
          <MoneyLine label="Fundo reserva" cents={charge.reserveCents} />
          <MoneyLine label="Multa" cents={charge.fineCents} />
          <MoneyLine label="Outros" cents={charge.otherCents} />
          <MoneyLine label="Total lançado" cents={computed.totalCents} strong />
          <MoneyLine
            label="Valor pago"
            cents={charge.paidCents}
            tone="positive"
          />
          <MoneyLine
            label={computed.outstandingCents < 0 ? "Crédito" : "Em aberto"}
            cents={Math.abs(computed.outstandingCents)}
            strong
            tone={computed.outstandingCents > 0 ? "negative" : "positive"}
          />
        </div>
        <div className="statement-footer">
          <StatusBadge status={status} />
          {charge.notes ? (
            <p>
              <strong>Observação:</strong> {charge.notes}
            </p>
          ) : (
            <p>Sem observações nesta competência.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
