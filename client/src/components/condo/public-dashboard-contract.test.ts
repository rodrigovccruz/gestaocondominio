import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(
  new URL("../../App.tsx", import.meta.url),
  "utf8"
);
const publicSource = readFileSync(
  new URL("../../pages/PublicDashboard.tsx", import.meta.url),
  "utf8"
);
const routeManifest = JSON.parse(
  readFileSync(
    new URL("../../../public/manus-routes.json", import.meta.url),
    "utf8"
  )
) as { routes: { path: string }[] };

describe("public dashboard source contract", () => {
  it("keeps the root public and the syndic workspace separate", () => {
    expect(appSource).toContain(
      '<Route path={"/"} component={PublicDashboard} />'
    );
    expect(appSource).toContain('<Route path={"/sindico"} component={Home} />');
    expect(appSource).not.toContain("/" + "convite" + "/");
    expect(routeManifest.routes.map(route => route.path)).toEqual([
      "/",
      "/sindico",
    ]);
  });

  it("uses only the public dashboard procedure and no auth identity", () => {
    expect(publicSource).toContain("trpc.publicDashboard.get.useQuery");
    expect(publicSource).not.toContain("useAuth");
    expect(publicSource).not.toContain("trpc.condo.get");
    expect(publicSource).not.toContain("email");
    expect(publicSource).not.toContain("resident");
  });

  it("keeps public expense fields limited to the approved DTO", () => {
    const expense = {
      id: "expense-1",
      description: "Limpeza",
      category: "Limpeza",
      date: "2026-10-04",
      amountCents: 1000,
    };
    expect(Object.keys(expense)).toEqual([
      "id",
      "description",
      "category",
      "date",
      "amountCents",
    ]);
    expect(expense).not.toHaveProperty("resident");
    expect(expense).not.toHaveProperty("email");
    expect(expense).not.toHaveProperty("unit");
  });
});
