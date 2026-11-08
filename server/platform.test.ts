import { afterEach, describe, expect, it, vi } from "vitest";
import {
  publicPlatformConfig,
  publicPlatformScript,
} from "./_core/publicConfig";
import { getSessionCookieOptions } from "./_core/cookies";
import { COOKIE_NAME } from "../shared/const";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("current platform integration", () => {
  it("exposes only named public runtime configuration", () => {
    const env = {
      MANUS_PROJECT_ID: "project-test",
      MANUS_API_KEY: "server-only-test",
      MANUS_JWT_SECRET: "signing-only-test",
      DATABASE_URL: "db-only-test",
      MANUS_API_BROWSER_KEY: "public-browser-test",
      MANUS_ANALYTICS_ENDPOINT: "https://analytics.example",
      MANUS_ANALYTICS_WEBSITE_ID: "site-test",
    };
    expect(publicPlatformConfig(env)).toMatchObject({
      projectId: "project-test",
      apiBrowserKey: "public-browser-test",
    });
    const script = publicPlatformScript(env);
    for (const value of [
      env.MANUS_API_KEY,
      env.MANUS_JWT_SECRET,
      env.DATABASE_URL,
    ])
      expect(script).not.toContain(value);
    const appended: unknown[] = [];
    const fakeDocument = {
      createElement: () => ({ setAttribute() {} }),
      head: { appendChild: (node: unknown) => appended.push(node) },
    };
    new Function("window", "document", script)({}, fakeDocument);
    expect(appended).toHaveLength(0);
    new Function("window", "document", publicPlatformScript({}))(
      {},
      fakeDocument
    );
    expect(appended).toHaveLength(0);
  });
  it("uses a distinct secure app cookie behind the HTTPS Preview proxy", () => {
    expect(COOKIE_NAME).not.toBe("app_session_id");
    expect(
      getSessionCookieOptions({ protocol: "http", headers: {} } as never)
    ).toMatchObject({ secure: true, httpOnly: true, sameSite: "none" });
  });
});
