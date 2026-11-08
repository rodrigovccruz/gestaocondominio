import { describe, expect, it } from "vitest";
import type { CondoState, Month } from "./condo";
import { buildReports, calculateQuotas, newMonth } from "./calc";
import { upgradeState } from "./upgrade";

const units = [
  "101",
  "102",
  "201",
  "202",
  "301",
  "302",
  "401",
  "402",
  "501",
  "502",
].map((number, i) => ({
  id: `u${9 - i}`,
  number,
  resident: "",
  active: true,
  exempt: false,
}));

function month(over: Partial<Month> = {}): Month {
  return {
    id: "m1",
    competence: "2026-10",
    status: "open",
    feeCents: 0,
    maintenanceBp: 0,
    reserveBp: 0,
    adminCents: 0,
    waterPriceCents: 0,
    gasPriceCents: 0,
    readings: units.map((u, i) => ({
      unitId: u.id,
      waterPrevious: 1000,
      waterCurrent: 1000 + (i + 1) * 1000, // 1 a 10 m³
      gasPrevious: 0,
      gasCurrent: i < 5 ? 500 : 0, // só os 5 primeiros usam gás
    })),
    expenses: [],
    payments: [],
    extraCharges: [],
    bankBalanceCents: null,
    ...over,
  };
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

describe("cota do mês", () => {
  it("consumo × preço, taxa fixa, fundos em % e isento", () => {
    const exemptUnits = units.map(u =>
      u.number === "101" ? { ...u, exempt: true } : u
    );
    const m = month({
      feeCents: 30000,
      maintenanceBp: 1500,
      reserveBp: 2000,
      adminCents: 2000,
      waterPriceCents: 500,
      gasPriceCents: 2000,
      extraCharges: [
        {
          id: "x",
          unitId: units[1].id,
          description: "Multa",
          amountCents: 5000,
        },
      ],
      expenses: [
        {
          id: "e1",
          description: "Copasa",
          category: "Água",
          amountCents: 99999,
          fromReserve: false,
        },
      ],
    });
    const { quotas, totals } = calculateQuotas(m, exemptUnits);
    expect(quotas.map(q => q.number)).toEqual(units.map(u => u.number));
    // 101: 1 m³ de água, 0,5 m³ de gás; isento: só consumo e fundo de reserva
    expect(quotas[0]).toMatchObject({
      waterCents: 500,
      gasCents: 1000,
      feeCents: 0,
      maintenanceCents: 0,
      reserveCents: 6000,
      adminCents: 0,
      totalCents: 500 + 1000 + 6000,
    });
    // 102: 2 m³, gás 0,5 m³, taxa + 15% + 20% + adm + multa
    expect(quotas[1].totalCents).toBe(
      1000 + 1000 + 30000 + 4500 + 6000 + 2000 + 5000
    );
    // quem não usou gás não paga gás; a conta da Copasa não entra na cota
    expect(quotas.slice(5).every(q => q.gasCents === 0)).toBe(true);
    expect(totals.reserveCents).toBe(10 * 6000);
    expect(totals.expensesCents).toBe(99999);
  });

  it("arredonda só o total do apartamento, como a planilha", () => {
    const m = month({
      feeCents: 35662,
      maintenanceBp: 1500, // 53,493
      reserveBp: 2000, // 71,324
      adminCents: 2675,
      readings: [
        {
          unitId: units[0].id,
          waterPrevious: 0,
          waterCurrent: 0,
          gasPrevious: 0,
          gasCurrent: 0,
        },
      ],
    });
    const [q] = calculateQuotas(m, units).quotas;
    expect(q.maintenanceCents + q.reserveCents).toBe(5349 + 7132);
    expect(q.totalCents).toBe(50819); // 508,187 → 508,19
  });
});

describe("encadeamento entre meses", () => {
  it("leva o saldo do caixa e o débito de quem não pagou", () => {
    const oct = month({
      feeCents: 10000,
      expenses: [
        {
          id: "e1",
          description: "Faxina",
          category: "Limpeza",
          amountCents: 100000,
          fromReserve: false,
        },
      ],
      payments: units.slice(1).map(u => ({ unitId: u.id, amountCents: 10000 })), // 101 não pagou
      bankBalanceCents: 40000,
    });
    const state: CondoState = {
      name: "X",
      openingBalanceCents: 50000,
      openingReserveCents: 0,
      units,
      months: [oct],
    };
    const nov = newMonth(state, "2026-11", "m2");
    expect(nov.readings[0].waterPrevious).toBe(oct.readings[0].waterCurrent);
    expect(nov.feeCents).toBe(10000);
    nov.expenses = [
      {
        id: "e9",
        description: "Faxina",
        category: "Limpeza",
        amountCents: 100000,
        fromReserve: false,
      },
    ];
    nov.payments = [{ unitId: units[0].id, amountCents: 20000 }]; // 101 paga outubro e novembro

    const [r1, r2] = buildReports({ ...state, months: [nov, oct] });
    expect(r1.month.competence).toBe("2026-10");
    expect(r1.cash.closingCents).toBe(40000);
    expect(r1.cash.differenceCents).toBe(0);
    expect(r1.statements[0].balanceCents).toBe(10000);
    expect(r2.cash.openingCents).toBe(40000);
    expect(r2.statements[0]).toMatchObject({
      previousCents: 10000,
      dueCents: 20000,
      balanceCents: 0,
    });
    expect(r2.statements[1].balanceCents).toBe(10000);
    expect(r2.cash.closingCents).toBe(40000 + 20000 - 100000);
    expect(r2.cash.differenceCents).toBeNull();
  });

  it("apartamento fora do mês continua aparecendo enquanto tiver saldo", () => {
    const oct = month({
      readings: [month().readings[0]],
      extraCharges: [
        { id: "e", unitId: units[0].id, description: "x", amountCents: 500 },
      ],
    });
    const nov = month({ id: "m2", competence: "2026-11", readings: [] });
    const reports = buildReports({
      name: "X",
      openingBalanceCents: 0,
      openingReserveCents: 0,
      units,
      months: [oct, nov],
    });
    expect(reports[1].statements).toHaveLength(1);
    expect(reports[1].statements[0].previousCents).toBe(500);
  });
});

describe("formato antigo", () => {
  it("converte o estado atual de produção (só apartamentos)", () => {
    const up = upgradeState({
      name: "Condomínio San Gimignano",
      units: [
        { id: "a", number: "101", resident: "", fraction: 0, active: true },
      ],
      months: [],
    }) as CondoState;
    expect(up.openingBalanceCents).toBe(0);
    expect(up.months).toEqual([]);
  });

  it("converte cobranças antigas em leituras e pagamentos", () => {
    const up = upgradeState({
      name: "X",
      units: [
        { id: "a", number: "101", resident: "", fraction: 0, active: true },
      ],
      months: [
        {
          id: "m",
          competence: "2026-09",
          status: "closed",
          waterRateCents: 900,
          gasRateCents: 0,
          openingBalanceCents: 1234,
          charges: [
            {
              unitId: "a",
              waterPrevious: 1,
              waterCurrent: 2,
              gasPrevious: 3,
              gasCurrent: 4,
              condoCents: 0,
              reserveCents: 0,
              fineCents: 0,
              otherCents: 0,
              paidCents: 700,
              notes: "",
            },
          ],
          expenses: [
            {
              id: "e",
              description: "Copasa",
              category: "Água",
              date: "2026-09-10",
              amountCents: 700,
              rateable: false,
            },
          ],
        },
      ],
    }) as CondoState;
    expect(up.openingBalanceCents).toBe(1234);
    expect(up.months[0].readings[0]).toEqual({
      unitId: "a",
      waterPrevious: 1,
      waterCurrent: 2,
      gasPrevious: 3,
      gasCurrent: 4,
    });
    expect(up.months[0].payments).toEqual([{ unitId: "a", amountCents: 700 }]);
    expect(upgradeState(up)).toBe(up);
  });
});
