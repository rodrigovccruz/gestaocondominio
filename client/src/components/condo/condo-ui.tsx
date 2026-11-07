import { type ReactNode } from "react";
import {
  Check,
  ChevronRight,
  CircleDollarSign,
  Calculator,
  FileText,
  Info,
  Loader2,
  Plus,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney, type TabKey } from "./condo-utils";

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <section className={cn("condo-panel", className)}>{children}</section>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
      <div>
        {eyebrow ? <p className="section-eyebrow">{eyebrow}</p> : null}
        <h2 className="section-title">{title}</h2>
        {description ? (
          <p className="section-description">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function TabNav({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (key: TabKey) => void;
}) {
  const tabs: { key: TabKey; label: string; icon?: typeof Calculator }[] = [
    { key: "overview", label: "Visão geral" },
    { key: "units", label: "Unidades" },
    { key: "readings", label: "Leituras e cobranças" },
    { key: "expenses", label: "Despesas" },
    { key: "allocation", label: "Rateio", icon: Calculator },
    { key: "history", label: "Histórico e relatórios" },
  ];
  return (
    <nav className="condo-tabs" aria-label="Seções do condomínio">
      {tabs.map(tab => (
        <button
          key={tab.key}
          type="button"
          className={cn("condo-tab", active === tab.key && "is-active")}
          onClick={() => onChange(tab.key)}
          aria-current={active === tab.key ? "page" : undefined}
        >
          {tab.icon ? <tab.icon size={14} strokeWidth={1.8} /> : null}
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export function StatusBadge({
  status,
  label,
}: {
  status: "open" | "closed" | "paid" | "pending" | "credit";
  label?: string;
}) {
  const labels = {
    open: "Em aberto",
    closed: "Fechado",
    paid: "Pago",
    pending: "Pendente",
    credit: "Crédito",
  };
  return (
    <span className={cn("status-badge", `status-${status}`)}>
      <span className="status-dot" />
      {label ?? labels[status]}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
  icon: Icon = CircleDollarSign,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "green" | "terracotta" | "blue";
  icon?: typeof CircleDollarSign;
}) {
  return (
    <article className={cn("metric-card", `metric-${tone}`)}>
      <div className="metric-card-top">
        <span className="metric-label">{label}</span>
        <span className="metric-icon">
          <Icon size={17} strokeWidth={1.8} />
        </span>
      </div>
      <strong className="metric-value">{value}</strong>
      {detail ? <p className="metric-detail">{detail}</p> : null}
    </article>
  );
}

export function EmptyState({
  icon: Icon = UsersRound,
  title,
  description,
  action,
  secondary,
}: {
  icon?: typeof UsersRound;
  title: string;
  description: string;
  action?: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={24} strokeWidth={1.5} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
        {action}
        {secondary}
      </div>
    </div>
  );
}

export function LoadingState({
  label = "Carregando seus dados",
}: {
  label?: string;
}) {
  return (
    <div className="loading-state" role="status">
      <Loader2 className="animate-spin" size={21} />
      <span>{label}…</span>
    </div>
  );
}

export function FormField({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="form-field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error ? <span className="field-hint">{hint}</span> : null}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function SaveButton({
  pending,
  children = "Salvar",
}: {
  pending?: boolean;
  children?: ReactNode;
}) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Check size={16} />
      )}
      {children}
    </Button>
  );
}

export function PrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <FileText size={15} /> Imprimir relatório
    </Button>
  );
}

export function AddButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button size="sm" onClick={onClick} disabled={disabled}>
      <Plus size={16} />
      {children}
    </Button>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="inline-notice">
      <Info size={16} /> <span>{children}</span>
    </div>
  );
}

export function MoneyLine({
  label,
  cents,
  strong = false,
  tone,
}: {
  label: string;
  cents: number;
  strong?: boolean;
  tone?: "positive" | "negative";
}) {
  return (
    <div
      className={cn(
        "money-line",
        strong && "font-semibold",
        tone && `money-${tone}`
      )}
    >
      <span>{label}</span>
      <span>{formatMoney(cents)}</span>
    </div>
  );
}

export function BreadcrumbTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="page-intro">
      <div className="page-kicker">
        <ChevronRight size={14} /> Administração
      </div>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}

export function FormulaSafeHint() {
  return (
    <span className="field-hint">
      Textos são protegidos contra fórmulas ao exportar.
    </span>
  );
}
