// Build para a Vercel (Build Output API v3): site estático + função /api.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const out = ".vercel/output";
const fn = `${out}/functions/api.func`;
rmSync(out, { recursive: true, force: true });

execSync("pnpm exec vite build", { stdio: "inherit" });
mkdirSync(fn, { recursive: true });
cpSync("dist/public", `${out}/static`, { recursive: true });

await build({
  entryPoints: ["server/vercel.ts"],
  outfile: `${fn}/index.js`,
  platform: "node",
  target: "node22",
  format: "cjs",
  bundle: true,
  // Tudo dentro do bundle: a função não tem node_modules.
  footer: { js: "module.exports = module.exports.default;" },
  logLevel: "info",
});
cpSync("drizzle", `${fn}/drizzle`, {
  recursive: true,
  filter: src => !src.endsWith(".ts"),
});
// O package.json da raiz é "type": "module"; a função é CommonJS.
writeFileSync(`${fn}/package.json`, JSON.stringify({ type: "commonjs" }));
writeFileSync(
  `${fn}/.vc-config.json`,
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.js",
      launcherType: "Nodejs",
      maxDuration: 30,
    },
    null,
    2
  )
);
writeFileSync(
  `${out}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "^/api/(.*)$", dest: "/api?__path=$1" },
        { handle: "filesystem" },
        { src: "^/(.*)$", dest: "/index.html" },
      ],
    },
    null,
    2
  )
);
console.log("Vercel output pronto em .vercel/output");
