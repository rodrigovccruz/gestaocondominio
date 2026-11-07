import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

let _db: ReturnType<typeof drizzle> | null = null;

/** URL do Postgres. Na Vercel (Neon) vem em DATABASE_URL ou POSTGRES_URL. */
export function databaseUrl(env: NodeJS.ProcessEnv = process.env) {
  return env.DATABASE_URL || env.POSTGRES_URL || "";
}

// Cria a conexão sob demanda para que ferramentas locais rodem sem banco.
export async function getDb() {
  const url = databaseUrl();
  if (!_db && url) {
    try {
      // prepare: false funciona com o pooler do Neon (PgBouncer).
      _db = drizzle(
        postgres(url, { max: 3, prepare: false, onnotice: () => {} })
      );
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
