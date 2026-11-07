import { formatM3, formatMoney, type UnitQuota } from "@shared/calc";

type QuotaRow = Omit<UnitQuota, "unitId">;

/** Quanto cada apartamento paga no mês, aberto por água, gás e despesas comuns. */
export function QuotaTable({ quotas }: { quotas: QuotaRow[] }) {
  if (!quotas.length)
    return <p className="muted">Nenhum apartamento neste mês.</p>;
  const showReserve = quotas.some(q => q.reserveCents > 0);
  const sum = (pick: (q: QuotaRow) => number) =>
    quotas.reduce((total, q) => total + pick(q), 0);

  return (
    <div className="table-wrap">
      <table className="grid">
        <thead>
          <tr>
            <th>Apto</th>
            <th className="num">Total</th>
            <th className="num">Água</th>
            <th className="num">Gás</th>
            <th className="num">Comuns</th>
            {showReserve ? <th className="num">Fundo</th> : null}
          </tr>
        </thead>
        <tbody>
          {quotas.map(q => (
            <tr key={q.number}>
              <td>
                <strong>{q.number}</strong>
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
              <td className="num">{formatMoney(q.commonCents)}</td>
              {showReserve ? (
                <td className="num">{formatMoney(q.reserveCents)}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="num">{formatMoney(sum(q => q.totalCents))}</td>
            <td className="num">
              {formatMoney(sum(q => q.waterCents))}
              <small>{formatM3(sum(q => q.waterMilli))} m³</small>
            </td>
            <td className="num">
              {formatMoney(sum(q => q.gasCents))}
              <small>{formatM3(sum(q => q.gasMilli))} m³</small>
            </td>
            <td className="num">{formatMoney(sum(q => q.commonCents))}</td>
            {showReserve ? (
              <td className="num">{formatMoney(sum(q => q.reserveCents))}</td>
            ) : null}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function CashLines({
  cash,
}: {
  cash: {
    openingCents: number;
    receivedCents: number;
    expensesCents: number;
    closingCents: number;
  };
}) {
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
        <dt>Saldo em caixa</dt>
        <dd>{formatMoney(cash.closingCents)}</dd>
      </div>
    </dl>
  );
}

export function SplitRule({ count }: { count: number }) {
  return (
    <p className="muted small">
      Água e gás divididos pelo consumo de cada medidor. Demais despesas
      divididas igualmente entre os {count} apartamentos.
    </p>
  );
}
