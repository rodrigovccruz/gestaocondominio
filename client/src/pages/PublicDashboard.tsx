import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Brand,
  Metric,
  MonthStatus,
  Notice,
  Panel,
} from "@/components/condo/condo-ui";
import {
  CashLines,
  QuotaTable,
  ChargeRule,
} from "@/components/condo/quota-table";
import { BuildingBoard } from "@/components/condo/building-board";
import { trpc } from "@/lib/trpc";
import { formatMoney, formatMonth } from "@shared/calc";
import type { PublicDashboard as Board } from "@shared/public-dashboard";

function BoardContent({
  data,
  onSelect,
}: {
  data: Board;
  onSelect: (competence: string) => void;
}) {
  const month = data.month;
  if (!month)
    return (
      <Panel>
        <p>Nenhum mês lançado ainda.</p>
      </Panel>
    );

  return (
    <>
      <div className="month-bar">
        <select
          className="input month-select"
          aria-label="Mês"
          value={month.competence}
          onChange={event => onSelect(event.target.value)}
        >
          {data.competences.map(c => (
            <option key={c} value={c}>
              {formatMonth(c)}
            </option>
          ))}
        </select>
        <MonthStatus status={month.status} />
      </div>
      {month.status === "open" ? (
        <Notice>Mês em aberto: os valores podem mudar até o fechamento.</Notice>
      ) : null}

      <BuildingBoard
        title="Quanto cada apartamento paga"
        units={month.quotas.map(q => ({
          number: q.number,
          value: formatMoney(q.totalCents),
        }))}
        footer={`Cota de ${formatMonth(month.competence)}`}
      />

      <div className="metrics">
        <Metric
          label="Despesas do mês"
          value={formatMoney(month.totals.expensesCents)}
        />
        <Metric
          label="Dinheiro agora"
          value={formatMoney(month.cash.closingCents)}
        />
        <Metric label="A pagar" value={formatMoney(month.cash.toPayCents)} />
        <Metric
          label="Previsão fim do mês"
          value={formatMoney(month.cash.projectedCents)}
          detail="se todos pagarem"
        />
      </div>

      <Panel title="Composição da cota">
        <QuotaTable quotas={month.quotas} totals={month.totals} />
        <ChargeRule condoWater={month.totals.condoWaterCents !== null} />
      </Panel>

      <Panel title="Despesas">
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
                        {e.paid ? "" : " · a pagar"}
                      </small>
                    </td>
                    <td className="num">{formatMoney(e.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num">
                    {formatMoney(month.totals.expensesCents)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="muted">Nenhuma despesa lançada.</p>
        )}
      </Panel>

      <Panel title="Caixa do condomínio">
        <CashLines cash={month.cash} />
      </Panel>
    </>
  );
}

export default function PublicDashboard() {
  const [competence, setCompetence] = useState<string | undefined>();
  const query = trpc.publicDashboard.get.useQuery(
    competence ? { competence } : undefined,
    { retry: false, refetchOnWindowFocus: false, placeholderData: prev => prev }
  );

  return (
    <div className="page">
      <header className="topbar">
        <Brand name={query.data?.name} />
        <a className="topbar-link" href="/sindico">
          Área do síndico
        </a>
      </header>
      <main className="stack">
        {query.isLoading ? (
          <p className="muted">Carregando…</p>
        ) : query.error ? (
          <Panel>
            <p>Não foi possível carregar o quadro.</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              <RefreshCw size={16} /> Tentar de novo
            </Button>
          </Panel>
        ) : query.data ? (
          <BoardContent data={query.data} onSelect={setCompetence} />
        ) : null}
      </main>
    </div>
  );
}
