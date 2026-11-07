import { Building2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, StatusBadge } from "@/components/condo/condo-ui";
import { trpc } from "@/lib/trpc";
import type { PublicDashboard as PublicDashboardData } from "@shared/public-dashboard";
import {
  formatPublicDate,
  latestCompetenceLabel,
  publicStatusLabel,
} from "./public-dashboard-utils";

const logoUrl =
  "/manus-storage/async-images/30vFO89ur9tqpGbBC2ukR7/image-1.webp";

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

function PublicBrand() {
  return (
    <a className="public-brand" href="/" aria-label="San Gimignano — início">
      <span className="brand-mark">
        <img
          src={logoUrl}
          alt=""
          onError={event => {
            event.currentTarget.style.display = "none";
          }}
        />
        <Building2 size={20} strokeWidth={1.7} />
      </span>
      <span className="brand-copy">
        <small>Administração serena</small>
        <strong>San Gimignano</strong>
      </span>
    </a>
  );
}

function EmptyPublicDashboard({ apartmentCount }: { apartmentCount: number }) {
  return (
    <Panel className="public-empty-panel">
      <div className="public-empty-icon">
        <ShieldCheck size={25} strokeWidth={1.5} />
      </div>
      <h2>Nenhuma competência cadastrada</h2>
      <p>
        Ainda não há uma prestação de despesas disponível para consulta pública.
      </p>
      <small>{apartmentCount} apartamentos cadastrados</small>
    </Panel>
  );
}

function PublicDashboardContent({ data }: { data: PublicDashboardData }) {
  const latest = data.latest;

  if (!latest)
    return <EmptyPublicDashboard apartmentCount={data.apartmentCount} />;

  return (
    <>
      <section
        className="public-period-heading"
        aria-labelledby="public-period-title"
      >
        <div>
          <p className="section-eyebrow">Última competência cadastrada</p>
          <h2 id="public-period-title">{latestCompetenceLabel(latest)}</h2>
          <p className="public-period-meta">
            {data.apartmentCount} apartamentos · despesas consolidadas do
            período
          </p>
        </div>
        <StatusBadge
          status={latest.status}
          label={publicStatusLabel(latest.status)}
        />
      </section>

      <section className="public-summary" aria-label="Resumo da competência">
        <div>
          <span>Total de despesas</span>
          <strong>{money(latest.totalExpensesCents)}</strong>
          <small>{latest.expenses.length} lançamentos registrados</small>
        </div>
      </section>

      <div className="public-dashboard-grid">
        <Panel>
          <div className="public-section-heading">
            <div>
              <p className="section-eyebrow">Lançamentos</p>
              <h3>Despesas da competência</h3>
            </div>
            <span className="public-count">{latest.expenses.length} itens</span>
          </div>
          {latest.expenses.length ? (
            <div className="public-table-scroll">
              <table className="public-expense-table">
                <thead>
                  <tr>
                    <th scope="col">Data</th>
                    <th scope="col">Descrição</th>
                    <th scope="col">Categoria</th>
                    <th scope="col" className="public-amount-cell">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {latest.expenses.map(expense => (
                    <tr key={expense.id}>
                      <td>{formatPublicDate(expense.date)}</td>
                      <td className="public-description-cell">
                        {expense.description}
                      </td>
                      <td>{expense.category}</td>
                      <td className="public-amount-cell">
                        {money(expense.amountCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="public-inline-empty">
              Nenhuma despesa lançada nesta competência.
            </p>
          )}
        </Panel>

        <Panel>
          <div className="public-section-heading">
            <div>
              <p className="section-eyebrow">Composição</p>
              <h3>Por categoria</h3>
            </div>
          </div>
          {latest.categories.length ? (
            <ul className="public-category-list">
              {latest.categories.map(item => (
                <li key={item.category}>
                  <span>{item.category}</span>
                  <strong>{money(item.amountCents)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="public-inline-empty">Nenhuma categoria registrada.</p>
          )}
        </Panel>
      </div>
    </>
  );
}

export default function PublicDashboard() {
  const query = trpc.publicDashboard.get.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="public-dashboard-page">
      <header className="public-header">
        <PublicBrand />
        <a className="public-syndic-link" href="/sindico">
          Área do síndico
        </a>
      </header>
      <main className="public-main">
        <div className="public-title-block">
          <p className="section-eyebrow">Prestação de contas</p>
          <h1>Despesas consolidadas</h1>
          <p>Consulte a última competência cadastrada do condomínio.</p>
        </div>

        {query.isLoading ? (
          <Panel className="public-loading-panel">
            <div className="loading-state" role="status">
              <RefreshCw size={19} className="animate-spin" />
              <span>Carregando despesas…</span>
            </div>
          </Panel>
        ) : query.error ? (
          <Panel className="public-error-panel">
            <h2>Não foi possível carregar as despesas</h2>
            <p>Tente novamente em instantes.</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              <RefreshCw size={16} /> Tentar novamente
            </Button>
          </Panel>
        ) : query.data ? (
          <PublicDashboardContent data={query.data} />
        ) : null}
      </main>
      <footer className="public-footer">
        <span>San Gimignano · administração condominial</span>
        <a href="/sindico">Área do síndico</a>
      </footer>
    </div>
  );
}
