import { afterEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { rpcPrivacyHeaders } from "./_core/privacy";
import { logoutSyndic, SYNDIC_SESSION_COOKIE_NAME } from "./syndic-auth";
const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("./db", () => ({ getDb: getDbMock }));
afterEach(() => getDbMock.mockReset());

describe("privacidade de autenticação", () => {
  it("proíbe cache HTTP das respostas RPC e diferencia cookies", () => {
    const headers: Record<string, unknown> = {};
    const next = vi.fn();
    const response = {
      setHeader: (name: string, value: unknown) => {
        headers[name] = value;
      },
      vary: vi.fn(),
    };
    rpcPrivacyHeaders({} as Request, response as unknown as Response, next);
    expect(headers["Cache-Control"]).toContain("no-store");
    expect(headers["Pragma"]).toBe("no-cache");
    expect(response.vary).toHaveBeenCalledWith("Cookie");
    expect(next).toHaveBeenCalledOnce();
  });
  it.each([null, new Error("fixture-db-failure")])(
    "limpa cookies e informa falha sem declarar revogação quando o banco está indisponível",
    async failure => {
      if (failure instanceof Error) getDbMock.mockRejectedValue(failure);
      else getDbMock.mockResolvedValue(failure);
      const response = { clearCookie: vi.fn() };
      await expect(
        logoutSyndic(
          {
            headers: {
              cookie: `${SYNDIC_SESSION_COOKIE_NAME}=${"a".repeat(64)}`,
            },
          },
          response
        )
      ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
      expect(response.clearCookie).toHaveBeenCalledWith(
        SYNDIC_SESSION_COOKIE_NAME,
        expect.objectContaining({ maxAge: -1, httpOnly: true })
      );
    }
  );
  it("não anuncia sucesso se a exclusão da sessão falhar", async () => {
    getDbMock.mockResolvedValue({
      delete: () => ({
        where: () => Promise.reject(new Error("fixture-delete-failure")),
      }),
    });
    const response = { clearCookie: vi.fn() };
    await expect(
      logoutSyndic(
        {
          headers: {
            cookie: `${SYNDIC_SESSION_COOKIE_NAME}=${"b".repeat(64)}`,
          },
        },
        response
      )
    ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(response.clearCookie).toHaveBeenCalledTimes(2);
  });
});
