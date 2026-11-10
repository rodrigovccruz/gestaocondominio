import {
  formatM3,
  formatMoney,
  type MonthTotals,
  type UnitQuota,
} from "@shared/calc";
import type { PublicCash } from "@shared/public-dashboard";

type QuotaRow = Omit<UnitQuota, "unitId">;

const COLUMNS: { key: keyof QuotaRow; label: string }[] = [
  { key: "feeCents", label: "Taxa" },
  { key: "maintenanceCents", label: "Manutenção" },
  { key: "reserveCents", label: "Reserva" },
  { key: "adminCents", label: "Adm." },
  { key: "extraCents", label: "Avulsos" },
];

/** Quanto cada apartamento paga no mês, aberto em consumo, taxa e fundos. */
export function QuotaTable({
  quotas,
  totals,
}: {
  quotas: QuotaRow[];
  totals: MonthTotals;
}) {
  if (!quotas.length)
    return <p className="muted">Nenhum apartamento neste mês.</p>;
  const sum = (pick: (q: QuotaRow) => number) =>
    quotas.reduce((total, q) => total + pick(q), 0);
  const columns = COLUMNS.filter(c => sum(q => Number(q[c.key])) !== 0);

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Apto</th>
            <th className="num">Total</th>
            <th className="num">Água</th>
            <th className="num">Gás</th>
            {columns.map(c => (
              <th key={c.key} className="num">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {quotas.map(q => (
            <tr key={q.number}>
              <td>
                <strong>{q.number}</strong>
                {q.exempt ? <small>isento</small> : null}
              </td>
              <td className="num">
                <strong>{formatMoney(q.totalCents)}</strong>
              </td>
              <td className="num">
                {formatMoney(q.waterCents)}
                <small>{formatM3(q.waterMilli)} m³</small>
              </td>
              <td className="num">
                {formatMoney(q.gasCents)}
                <small>{formatM3(q.gasMilli)} m³</small>
              </td>
              {columns.map(c => (
                <td key={c.key} className="num">
                  {formatMoney(Number(q[c.key]))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="num">{formatMoney(totals.quotasCents)}</td>
            <td className="num">
              {formatMoney(totals.waterCents)}
              <small>{formatM3(sum(q => q.waterMilli))} m³</small>
            </td>
            <td className="num">
              {formatMoney(totals.gasCents)}
              <small>{formatM3(sum(q => q.gasMilli))} m³</small>
            </td>
            {columns.map(c => (
              <td key={c.key} className="num">
                {formatMoney(
                  c.key in totals
                    ? totals[c.key as keyof MonthTotals]
                    : sum(q => Number(q[c.key]))
                )}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * Caixa do mês: o dinheiro que existe agora e a previsão ao fim do mês se
 * todos pagarem, com a parte do fundo de reserva e a do condomínio.
 */
export function CashLines({ cash }: { cash: PublicCash }) {
  return (
    <dl className="lines">
      <div>
        <dt>Saldo anterior</dt>
        <dd>{formatMoney(cash.openingCents)}</dd>
      </div>
      <div>
        <dt>Recebido dos apartamentos</dt>
        <dd className="good">+ {formatMoney(cash.receivedCents)}</dd>
      </div>
      <div>
        <dt>Despesas pagas</dt>
        <dd className="bad">− {formatMoney(cash.expensesCents)}</dd>
      </div>
      <div className="lines-total">
        <dt>Dinheiro agora</dt>
        <dd>{formatMoney(cash.closingCents)}</dd>
      </div>
      <div>
        <dt>A receber dos apartamentos</dt>
        <dd className="good">+ {formatMoney(cash.toReceiveCents)}</dd>
      </div>
      <div>
        <dt>A pagar (despesas ainda não pagas)</dt>
        <dd className="bad">− {formatMoney(cash.toPayCents)}</dd>
      </div>
      <div className="lines-total">
        <dt>Previsão ao fim do mês (se todos pagarem)</dt>
        <dd>{formatMoney(cash.projectedCents)}</dd>
      </div>
      <div>
        <dt>
          Fundo de reserva
          <small>
            {" "}
            (+ {formatMoney(cash.reserveInCents)}
            {cash.reserveOutCents
              ? ` − ${formatMoney(cash.reserveOutCents)}`
              : ""}{" "}
            no mês)
          </small>
        </dt>
        <dd>{formatMoney(cash.reserveClosingCents)}</dd>
      </div>
      <div>
        <dt>Condomínio (previsão − fundo)</dt>
        <dd className={cash.projectedCondoCents < 0 ? "bad" : undefined}>
          {formatMoney(cash.projectedCondoCents)}
        </dd>
      </div>
    </dl>
  );
}

export function ChargeRule() {
  return (
    <p className="muted small">
      Água e gás: consumo × preço do m³. Taxa de condomínio e administração:
      valor fixo. Manutenção e reserva: percentual da taxa. Isento paga só
      consumo, fundo de reserva e avulsos.
    </p>
  );
}
