import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Logo: a fachada do prédio com a coluna de pastilha verde-água. */
export function Brand({ name = "San Gimignano" }: { name?: string }) {
  return (
    <span className="brand">
      <img className="brand-mark" src="/favicon.svg" alt="" />
      <strong>{name}</strong>
    </span>
  );
}

export function Panel({
  title,
  action,
  className,
  children,
}: {
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("panel", className)}>
      {title || action ? (
        <div className="panel-head">
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className={cn("metric", tone && `metric-${tone}`)}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export function Badge({
  tone,
  children,
}: {
  tone: "open" | "closed" | "ok" | "due" | "credit";
  children: ReactNode;
}) {
  return <span className={cn("badge", `badge-${tone}`)}>{children}</span>;
}

export function MonthStatus({ status }: { status: "open" | "closed" }) {
  return status === "open" ? (
    <Badge tone="open">Em aberto</Badge>
  ) : (
    <Badge tone="closed">Fechado</Badge>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "ok" | "warn";
  children: ReactNode;
}) {
  return <p className={cn("notice", `notice-${tone}`)}>{children}</p>;
}
