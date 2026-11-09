import { describe, expect, it } from "vitest";
import {
  buildReports,
  calculateQuotas,
  newMonth,
  tariffFeeCents,
} from "./calc";
import { condoStateSchema, type CondoState } from "./condo";

/** Outubro/2026 da planilha do condomínio (revisada), para conferir o cálculo. */
const rows = [
  // apto, água ant., água atual, gás ant., gás atual, total da planilha
  ["101", 1448.958, 1464.165, 249.548, 252.6, 62446],
  ["102", 1231.922, 1248.368, 373.332, 377.559, 68487],
  ["201", 101.224, 101.224, 7.307, 7.307, 50819],
  ["202", 766.05, 774.353, 91.444, 91.891, 55752],
  ["301", 853.519, 866.352, 75.104, 75.747, 58331],
  ["302", 589.268, 594.955, 119.413, 119.741, 54250],
  ["401", 543.634, 554.281, 101.025, 101.567, 57072],
  ["402", 95.894, 100.506, 22.436, 22.931, 54142],
  ["501", 1099.163, 1109.434, 56.043, 56.106, 55764],
  ["502", 826.113, 836.097, 231.18, 234.667, 63721],
] as const;
const milli = (m3: number) => Math.round(m3 * 1000);
const expenses: [string, number, "Água" | "Gás" | "Outros"][] = [
  ["Copasa arrecadação aptos", 43893, "Água"],
  ["Copasa condomínio", 5714, "Água"],
  ["Cemig", 36558, "Outros"],
  ["Serviço zeladoria", 162100, "Outros"],
  ["Volts elevadores", 26720, "Outros"],
  ["NetClaro", 13600, "Outros"],
  ["Contabilidade", 14300, "Outros"],
  ["Taxa de adm do síndico", 24075, "Outros"],
  ["Leroy Merlin materiais", 40135, "Outros"],
  ["Theodoro gás 2/2", 47500, "Gás"],
  ["Villefort odorizador", 10580, "Outros"],
  ["Dular cola", 1290, "Outros"],
  ["Escada 5 degraus", 26500, "Outros"],
  ["Serralheiro portão", 40000, "Outros"],
  ["AC Paisagismo", 21250, "Outros"],
];

const state: CondoState = condoStateSchema.parse({
  name: "Condomínio San Gimignano",
  // Fim de setembro: condomínio −10.140,23 e fundo de reserva 11.355,81.
  openingBalanceCents: -1014023 + 1135581,
  openingReserveCents: 1135581,
  units: rows.map(([n]) => ({
    id: `apto-${n}`,
    number: n,
    resident: "",
    active: true,
    exempt: n === "101",
  })),
  months: [
    {
      id: "out",
      competence: "2026-10",
      status: "open",
      feeCents: 35662, // 22% do salário mínimo de R$ 1.621
      maintenanceBp: 1500,
      reserveBp: 2000,
      adminCents: 2675,
      waterPriceCents: 467,
      gasPriceCents: 2363,
      readings: rows.map(([n, wp, wc, gp, gc]) => ({
        unitId: `apto-${n}`,
        waterPrevious: milli(wp),
        waterCurrent: milli(wc),
        gasPrevious: milli(gp),
        gasCurrent: milli(gc),
      })),
      expenses: expenses.map(([description, amountCents, category], i) => ({
        id: `d${i}`,
        description,
        category,
        amountCents,
      })),
      extraCharges: [
        {
          id: "x1",
          unitId: "apto-101",
          description: "Reembolso fundo reserva",
          amountCents: 41000,
        },
      ],
      payments: [],
      bankBalanceCents: null,
    },
  ],
});

describe("outubro/2026 igual à planilha", () => {
  const { quotas, totals } = calculateQuotas(state.months[0], state.units);

  it("cota de cada apartamento bate centavo por centavo", () => {
    expect(quotas.map(q => [q.number, q.totalCents])).toEqual(
      rows.map(([n, , , , , total]) => [n, total])
    );
  });

  it("totais do mês batem com a planilha", () => {
    expect(totals.quotasCents).toBe(580784); // R$ 5.807,84
    expect(totals.reserveCents).toBe(71324); // fundo de reserva R$ 713,24
    expect(totals.feeCents).toBe(320958); // taxa R$ 3.209,58
    expect(totals.maintenanceCents).toBe(48144); // manutenção R$ 481,44
    expect(totals.adminCents).toBe(24075); // administração R$ 240,75
    expect(totals.waterCents).toBe(43893); // água R$ 438,93
    expect(totals.gasCents).toBe(31390); // gás R$ 313,90
    expect(totals.expensesCents).toBe(514215); // despesas R$ 5.142,15
    expect(quotas.find(q => q.number === "101")).toMatchObject({
      exempt: true,
      feeCents: 0,
      maintenanceCents: 0,
      adminCents: 0,
      reserveCents: 7132,
      extraCents: 41000,
    });
  });

  it("caixa: condomínio e fundo de reserva como na planilha, se todos pagarem", () => {
    const paid = {
      ...state,
      months: [
        {
          ...state.months[0],
          payments: quotas.map(q => ({
            unitId: q.unitId,
            amountCents: q.totalCents,
          })),
        },
      ],
    };
    const { cash } = buildReports(paid)[0];
    expect(cash.reserveClosingCents).toBe(1206905); // R$ 12.069,05
    expect(cash.condoClosingCents).toBe(-1018778); // −R$ 10.187,78
    expect(cash.closingCents).toBe(1206905 - 1018778);
  });
});

describe("previsão do caixa sem pagamentos lançados", () => {
  it("dinheiro agora, a receber e previsão batem com a planilha", () => {
    const { cash } = buildReports(state)[0];
    expect(cash.closingCents).toBe(121558 - 514215); // −R$ 3.926,57
    expect(cash.toReceiveCents).toBe(580784); // R$ 5.807,84
    expect(cash.projectedCents).toBe(188127); // R$ 1.881,27
    expect(cash.reserveClosingCents).toBe(1206905); // R$ 12.069,05
    expect(cash.projectedCondoCents).toBe(-1018778); // −R$ 10.187,78
  });
});

describe("tarifas vigentes no cadastro", () => {
  const tariffs = {
    minimumWageCents: 162100, // R$ 1.621,00
    feeBp: 2200, // 22% do salário mínimo
    maintenanceBp: 1500,
    reserveBp: 2000,
    adminCents: 2675,
    waterPriceCents: 467,
    gasPriceCents: 2363,
  };

  it("taxa de condomínio = 22% do salário mínimo = R$ 356,62", () => {
    expect(tariffFeeCents(tariffs)).toBe(35662);
  });

  it("mês novo copia as tarifas e guarda a cópia", () => {
    const withTariffs = { ...state, tariffs };
    const nov = newMonth(withTariffs, "2026-11", "nov");
    expect(nov).toMatchObject({
      feeCents: 35662,
      maintenanceBp: 1500,
      reserveBp: 2000,
      adminCents: 2675,
      waterPriceCents: 467,
      gasPriceCents: 2363,
    });
    // leitura anterior de novembro = atual de outubro
    expect(nov.readings[0].waterPrevious).toBe(1464165);
    // salário mínimo novo não muda o mês já criado
    const jan = newMonth(
      { ...withTariffs, tariffs: { ...tariffs, minimumWageCents: 170000 } },
      "2027-01",
      "jan"
    );
    expect(jan.feeCents).toBe(37400);
    expect(nov.feeCents).toBe(35662);
  });

  it("sem tarifas cadastradas, o mês novo copia o mês anterior", () => {
    const nov = newMonth(state, "2026-11", "nov");
    expect(nov.feeCents).toBe(35662);
    expect(nov.gasPriceCents).toBe(2363);
  });
});
