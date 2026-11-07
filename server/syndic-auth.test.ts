import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  getSyndicSessionFromRequest,
  SYNDIC_SESSION_COOKIE_NAME,
  verifySyndicPassword,
} from "./syndic-auth";

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db", () => ({ getDb: getDbMock }));

afterEach(() => {
  vi.unstubAllEnvs();
  getDbMock.mockReset();
});

function requestWithCookie(cookie?: string) {
  return {
    headers: cookie ? { cookie } : {},
    ip: "127.0.0.1",
    socket: { remoteAddress: "127.0.0.1" },
  };
}

function selectDb(rows: unknown[]) {
  const query: any = {
    from: vi.fn(() => query),
    where: vi.fn(() => query),
    limit: vi.fn(async () => rows),
  };
  return { select: vi.fn(() => query) };
}

describe("autenticação exclusiva do síndico", () => {
  beforeEach(() =>
    vi.stubEnv("CONDO_ADMIN_PASSWORD", "fixture-password-not-real")
  );

  it("compara credenciais por hashes e não aceita username diferente de admin", async () => {
    await expect(
      verifySyndicPassword(
        "admin",
        "fixture-password-not-real",
        "fixture-password-not-real"
      )
    ).resolves.toBe(true);
    await expect(
      verifySyndicPassword(
        "admin",
        "wrong-password",
        "fixture-password-not-real"
      )
    ).resolves.toBe(false);
    await expect(
      verifySyndicPassword(
        "ADMIN",
        "fixture-password-not-real",
        "fixture-password-not-real"
      )
    ).resolves.toBe(false);
  });

  it("falha com indisponibilidade quando o segredo não está configurado", async () => {
    vi.stubEnv("CONDO_ADMIN_PASSWORD", "");
    const res = { cookie: vi.fn() };

    await expect(
      appRouter
        .createCaller({
          user: null,
          syndic: null,
          req: requestWithCookie() as TrpcContext["req"],
          res: res as unknown as TrpcContext["res"],
        })
        .auth.login({
          username: "admin",
          password: "fixture-password-not-real",
        })
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("não concede sessão para cookie expirado nem para token revogado/removido", async () => {
    const expiredToken = "a".repeat(64);
    getDbMock.mockResolvedValue(
      selectDb([
        {
          ownerId: 1,
          tokenHash: "hash",
          expiresAt: new Date(Date.now() - 1),
        },
      ])
    );
    await expect(
      getSyndicSessionFromRequest(
        requestWithCookie(`${SYNDIC_SESSION_COOKIE_NAME}=${expiredToken}`)
      )
    ).resolves.toBeNull();

    getDbMock.mockResolvedValue(selectDb([]));
    await expect(
      getSyndicSessionFromRequest(
        requestWithCookie(`${SYNDIC_SESSION_COOKIE_NAME}=${"b".repeat(64)}`)
      )
    ).resolves.toBeNull();
  });

  it("não deixa JWT Manus ou User.role conceder acesso administrativo", async () => {
    const legacyUser = {
      id: 1,
      openId: "legacy",
      name: "Legacy admin",
      email: "legacy@example.com",
      loginMethod: "manus",
      role: "admin" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const ctx: TrpcContext = {
      user: legacyUser,
      syndic: null,
      req: {
        headers: { authorization: "Bearer injected-manus-jwt" },
      } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(caller.auth.me()).resolves.toBeNull();
    await expect(
      caller.system.notifyOwner({ title: "x", content: "y" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      (appRouter as unknown as { access?: unknown }).access
    ).toBeUndefined();
  });
});
