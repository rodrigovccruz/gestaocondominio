import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  forgetPrivateAuthData,
  isPrivateQueryKey,
} from "../../_core/hooks/auth-cache";

describe("limpeza de autenticação", () => {
  it("identifica as chaves aninhadas do tRPC", () => {
    expect(isPrivateQueryKey([["condo", "get"], { type: "query" }])).toBe(true);
    expect(isPrivateQueryKey([["auth", "me"], { type: "query" }])).toBe(true);
    expect(
      isPrivateQueryKey([["publicDashboard", "get"], { type: "query" }])
    ).toBe(false);
  });
  it("remove dados privados e mutações mas preserva despesas públicas", async () => {
    const client = new QueryClient();
    const privateKey = [["condo", "get"], { type: "query" }];
    const publicKey = [["publicDashboard", "get"], { type: "query" }];
    client.setQueryData(privateKey, { private: true });
    client.setQueryData(publicKey, { public: true });
    client
      .getMutationCache()
      .build(client, { mutationKey: [["auth", "login"]] });
    await forgetPrivateAuthData(client);
    expect(client.getQueryData(privateKey)).toBeUndefined();
    expect(client.getQueryData(publicKey)).toEqual({ public: true });
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    client.clear();
  });
});
