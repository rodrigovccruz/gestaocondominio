import { MySqlDialect } from "drizzle-orm/mysql-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOGIN_RATE_LIMIT_MAX_FAILURES,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  reserveLoginAttempt,
} from "./syndic-auth";
const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db", () => ({ getDb: getDbMock }));

function transactionalFakeDb() {
  type Row = {
    scope: string;
    failures: number;
    windowStartedAt: Date;
    blockedUntil: Date | null;
    updatedAt: Date;
  };
  const rows = new Map<string, Row>();
  const dialect = new MySqlDialect();
  let tail: Promise<unknown> = Promise.resolve();
  const scopeFrom = (condition: Parameters<MySqlDialect["sqlToQuery"]>[0]) =>
    String(dialect.sqlToQuery(condition).params[0]);
  const tx = {
    insert: () => ({
      values: (row: Omit<Row, "updatedAt">) => ({
        onDuplicateKeyUpdate: async () => {
          if (!rows.has(row.scope))
            rows.set(row.scope, { ...row, updatedAt: row.windowStartedAt });
        },
      }),
    }),
    select: () => {
      let scope = "";
      const query = {
        from: () => query,
        where: (condition: Parameters<MySqlDialect["sqlToQuery"]>[0]) => {
          scope = scopeFrom(condition);
          return query;
        },
        limit: () => query,
        for: () => query,
        then: <T>(success: (value: Row[]) => T) =>
          Promise.resolve(
            rows.has(scope) ? [{ ...rows.get(scope)! }] : []
          ).then(success),
      };
      return query;
    },
    update: () => ({
      set: (fields: Partial<Row>) => ({
        where: async (condition: Parameters<MySqlDialect["sqlToQuery"]>[0]) => {
          const scope = scopeFrom(condition);
          const row = rows.get(scope);
          if (row) rows.set(scope, { ...row, ...fields });
        },
      }),
    }),
  };
  const db = {
    ...tx,
    transaction: <T>(fn: (transaction: typeof tx) => Promise<T>) => {
      const run = tail.then(() => fn(tx));
      tail = run.catch(() => {});
      return run;
    },
  };
  return db;
}

beforeEach(() => getDbMock.mockResolvedValue(transactionalFakeDb()));

describe("reserva atômica de tentativas", () => {
  it("autoriza no máximo a cota mesmo quando requisições chegam em paralelo", async () => {
    const now = new Date("2026-11-07T12:00:00Z");
    const decisions = await Promise.all(
      Array.from({ length: 20 }, () =>
        reserveLoginAttempt({ ip: "127.0.0.1" }, now)
      )
    );
    expect(decisions.filter(decision => decision.allowed)).toHaveLength(
      LOGIN_RATE_LIMIT_MAX_FAILURES
    );
    expect(decisions.filter(decision => !decision.allowed)).toHaveLength(
      20 - LOGIN_RATE_LIMIT_MAX_FAILURES
    );
  });
  it("libera uma nova janela somente após o prazo do bloqueio", async () => {
    const now = new Date("2026-11-07T12:00:00Z");
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_FAILURES; i++)
      expect(
        (await reserveLoginAttempt({ ip: "127.0.0.1" }, now)).allowed
      ).toBe(true);
    expect((await reserveLoginAttempt({ ip: "127.0.0.1" }, now)).allowed).toBe(
      false
    );
    expect(
      (
        await reserveLoginAttempt(
          { ip: "127.0.0.1" },
          new Date(now.getTime() + LOGIN_RATE_LIMIT_WINDOW_MS + 1)
        )
      ).allowed
    ).toBe(true);
  });
});
