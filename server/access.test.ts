import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { initialState, type CondoState } from "@shared/condo";
import { RESIDENT_INVITE_TOKEN_PATTERN } from "@shared/access";
import {
  acceptInviteForUser,
  createInviteForSyndic,
  filterCondoStateForResident,
  getInviteStatus,
  listAccessForSyndic,
  revokeMemberForSyndic,
} from "./access";
import { getCondoReadResponse } from "./condo";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db", () => ({ getDb: getDbMock }));

type SelectOptions = {
  selectRows?: unknown[][];
  insertResult?: unknown;
  insertError?: unknown;
  updateResult?: unknown;
  deleteResult?: unknown;
};

function makeDb(options: SelectOptions = {}) {
  const selectRows = [...(options.selectRows ?? [])];
  const insertedValues: unknown[] = [];
  const updateCalls: unknown[] = [];
  const db: any = {
    select: vi.fn(() => {
      const rows = selectRows.shift() ?? [];
      const query: any = {
        from: vi.fn(() => query),
        where: vi.fn(() => query),
        limit: vi.fn(async () => rows.slice(0, 1)),
        for: vi.fn(() => query),
        then: (
          resolve: (value: unknown[]) => unknown,
          reject: (error: unknown) => unknown
        ) => Promise.resolve(rows).then(resolve, reject),
      };
      return query;
    }),
    insert: vi.fn(() => ({
      values: vi.fn(async (values: unknown) => {
        insertedValues.push(values);
        if (options.insertError) throw options.insertError;
        return options.insertResult ?? [{ insertId: 77 }, []];
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => {
        updateCalls.push(values);
        return {
          where: vi.fn(
            async () => options.updateResult ?? [{ affectedRows: 1 }, []]
          ),
        };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(
        async () => options.deleteResult ?? [{ affectedRows: 1 }, []]
      ),
    })),
    transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) =>
      callback(db)
    ),
  };
  return { db, insertedValues, updateCalls };
}

function ownerState(): CondoState {
  return {
    name: "Condomínio",
    units: [
      { id: "u1", number: "101", resident: "Uma", fraction: 50, active: true },
      {
        id: "u2",
        number: "102",
        resident: "Outra",
        fraction: 50,
        active: true,
      },
    ],
    months: [
      {
        id: "m1",
        competence: "2026-01",
        status: "open",
        waterRateCents: 100,
        gasRateCents: 100,
        openingBalanceCents: 0,
        charges: [
          {
            unitId: "u1",
            waterPrevious: 0,
            waterCurrent: 0,
            gasPrevious: 0,
            gasCurrent: 0,
            condoCents: 10,
            reserveCents: 0,
            fineCents: 0,
            otherCents: 0,
            paidCents: 0,
            notes: "nota privada de Uma",
          },
          {
            unitId: "u2",
            waterPrevious: 0,
            waterCurrent: 0,
            gasPrevious: 0,
            gasCurrent: 0,
            condoCents: 20,
            reserveCents: 0,
            fineCents: 0,
            otherCents: 0,
            paidCents: 0,
            notes: "nota privada de Outra",
          },
        ],
        expenses: [
          {
            id: "e1",
            description: "Limpeza comum",
            category: "Limpeza",
            date: "2026-01-10",
            amountCents: 100,
            rateable: true,
          },
        ],
        allocation: {
          method: "equal",
          participants: [
            { unitId: "u1", weight: 1 },
            { unitId: "u2", weight: 1 },
          ],
        },
      },
    ],
  };
}

function stateRow(ownerId: number, state = ownerState()) {
  return {
    ownerId,
    revision: 3,
    state,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function pendingInvite(overrides: Record<string, unknown> = {}) {
  return {
    id: 12,
    ownerId: 1,
    email: "morador@example.com",
    unitId: "u1",
    tokenHash: createHash("sha256").update("a".repeat(64)).digest("hex"),
    expiresAt: new Date(Date.now() + 60_000),
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("acesso ao condomínio no servidor", () => {
  beforeEach(() => getDbMock.mockReset());

  it("retorna estado inicial e acesso unlinked sem linha do condomínio", async () => {
    const { db } = makeDb({ selectRows: [[]] });
    getDbMock.mockResolvedValue(db);

    await expect(getCondoReadResponse(99)).resolves.toEqual({
      state: initialState,
      revision: 0,
      access: { role: "unlinked", ownerId: null },
    });
  });

  it("deriva residente pelo vínculo e remove unidades/cobranças de terceiros", async () => {
    const state = ownerState();
    const { db } = makeDb({
      selectRows: [
        [],
        [{ ownerId: 1, userId: 7, unitId: "u1" }],
        [stateRow(1, state)],
      ],
    });
    getDbMock.mockResolvedValue(db);

    const result = await getCondoReadResponse(7);

    expect(result.access).toEqual({
      role: "resident",
      ownerId: 1,
      unitId: "u1",
    });
    expect(result.state.units.map(unit => unit.id)).toEqual(["u1"]);
    expect(
      result.state.months[0]?.charges.map(charge => charge.unitId)
    ).toEqual(["u1"]);
    expect(result.state.months[0]?.expenses).toHaveLength(1);
    expect(result.state.months[0]?.allocation?.participants).toEqual([
      { unitId: "u1", weight: 1 },
      { unitId: "u2", weight: 1 },
    ]);
    expect(result.state.months[0]?.charges[0]?.notes).toBe(
      "nota privada de Uma"
    );
    expect(
      result.state.months[0]?.charges.some(charge =>
        charge.notes.includes("Outra")
      )
    ).toBe(false);
  });

  it("normaliza e armazena somente hash ao criar convite do síndico", async () => {
    const { db, insertedValues } = makeDb({
      selectRows: [[stateRow(1)]],
      insertResult: [{ insertId: 31 }, []],
    });
    getDbMock.mockResolvedValue(db);

    const result = await createInviteForSyndic(1, "SINDICO@example.com", {
      email: " Morador@Example.COM ",
      unitId: "u1",
    });
    const stored = insertedValues[0] as Record<string, unknown>;

    expect(result.id).toBe(31);
    expect(RESIDENT_INVITE_TOKEN_PATTERN.test(result.token)).toBe(true);
    expect(stored.email).toBe("morador@example.com");
    expect(stored.tokenHash).toBe(
      createHash("sha256").update(result.token).digest("hex")
    );
    expect(stored.tokenHash).not.toBe(result.token);
    expect(result.expiresAt.getTime()).toBeGreaterThan(
      Date.now() + 6 * 24 * 60 * 60 * 1000
    );
  });

  it("recusa e-mail errado, convite expirado e token reutilizado", async () => {
    const wrongEmailDb = makeDb({ selectRows: [[pendingInvite()]] });
    getDbMock.mockResolvedValue(wrongEmailDb.db);
    await expect(
      acceptInviteForUser(7, "outra@example.com", "a".repeat(64))
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(wrongEmailDb.db.update).not.toHaveBeenCalled();

    const expiredDb = makeDb({
      selectRows: [[pendingInvite({ expiresAt: new Date(Date.now() - 1) })]],
    });
    getDbMock.mockResolvedValue(expiredDb.db);
    await expect(
      acceptInviteForUser(7, "morador@example.com", "a".repeat(64))
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const usedDb = makeDb({
      selectRows: [[pendingInvite({ acceptedAt: new Date() })]],
    });
    getDbMock.mockResolvedValue(usedDb.db);
    await expect(
      acceptInviteForUser(7, "morador@example.com", "a".repeat(64))
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const revokedDb = makeDb({
      selectRows: [[pendingInvite({ revokedAt: new Date() })]],
    });
    getDbMock.mockResolvedValue(revokedDb.db);
    await expect(
      acceptInviteForUser(7, "morador@example.com", "a".repeat(64))
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("converte corrida de vínculo único em conflito sem concluir o aceite", async () => {
    const dbState = makeDb({
      selectRows: [[pendingInvite()], []],
      insertError: { code: "ER_DUP_ENTRY", errno: 1062 },
    });
    getDbMock.mockResolvedValue(dbState.db);

    await expect(
      acceptInviteForUser(7, "morador@example.com", "a".repeat(64))
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(dbState.db.transaction).toHaveBeenCalledTimes(1);
    expect(dbState.insertedValues).toHaveLength(1);
  });

  it("não permite administrar sem estado próprio nem revogar vínculo de outro condomínio", async () => {
    const unlinkedDb = makeDb({ selectRows: [[]] });
    getDbMock.mockResolvedValue(unlinkedDb.db);
    await expect(listAccessForSyndic(2)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const crossOwnerDb = makeDb({
      selectRows: [[stateRow(1)]],
      deleteResult: [{ affectedRows: 0 }, []],
    });
    getDbMock.mockResolvedValue(crossOwnerDb.db);
    await expect(revokeMemberForSyndic(1, 99)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("expõe o status derivado do registro e não confia em status do cliente", () => {
    expect(getInviteStatus(pendingInvite())).toBe("pending");
    expect(getInviteStatus(pendingInvite({ acceptedAt: new Date() }))).toBe(
      "accepted"
    );
    expect(getInviteStatus(pendingInvite({ revokedAt: new Date() }))).toBe(
      "revoked"
    );
    expect(
      getInviteStatus(pendingInvite({ expiresAt: new Date(Date.now() - 1) }))
    ).toBe("expired");
  });

  it("mantém o filtro como subconjunto somente de resposta, sem validar referências ausentes", () => {
    const filtered = filterCondoStateForResident(ownerState(), "u1");
    expect(filtered.units).toHaveLength(1);
    expect(filtered.months[0]?.allocation?.participants).toHaveLength(2);
  });
});
