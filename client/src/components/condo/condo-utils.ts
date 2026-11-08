/** Entrada de valores em português (1.234,56) e utilidades da tela. */

export function safeNumber(value: string) {
  const raw = value.trim().replace(/\s/g, "");
  if (!/^-?(?:\d+(?:[.,]\d+)?|\d{1,3}(?:\.\d{3})+,\d+)$/.test(raw)) return null;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseMoneyInput(value: string) {
  const parsed = safeNumber(value);
  if (parsed === null || parsed < 0) return null;
  const cents = Math.round(parsed * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function parseSignedMoneyInput(value: string) {
  const parsed = safeNumber(value);
  if (parsed === null) return null;
  const cents = Math.round(parsed * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function parseReadingInput(value: string) {
  const parsed = safeNumber(value);
  if (parsed === null || parsed < 0) return null;
  const milli = Math.round(parsed * 1000);
  return Number.isSafeInteger(milli) ? milli : null;
}

export const moneyInput = (cents: number) =>
  (cents / 100).toFixed(2).replace(".", ",");

export const readingInput = (milli: number) =>
  (milli / 1000).toFixed(3).replace(".", ",");

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Mês seguinte no formato AAAA-MM. */
export function nextCompetence(competence: string) {
  const [year, month] = competence.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1, 12));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Mês atual no fuso de Brasília. */
export function currentCompetence(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find(p => p.type === "year")?.value;
  const month = parts.find(p => p.type === "month")?.value;
  return `${year}-${month}`;
}

export function isConflictError(error: unknown) {
  const maybe = error as { data?: { code?: string } } | null;
  return maybe?.data?.code === "CONFLICT";
}

export function parseApiError(error: unknown) {
  const maybe = error as {
    message?: string;
    data?: { code?: string };
  } | null;
  const code = maybe?.data?.code;
  if (code === "UNAUTHORIZED")
    return "Sua sessão expirou. Entre novamente para continuar.";
  const raw = maybe?.message ?? "";
  if (code === "BAD_REQUEST" && raw.startsWith("[")) {
    try {
      const issues = JSON.parse(raw) as { code?: string; message?: string }[];
      const custom = issues.find(i => i.code === "custom" && i.message);
      if (custom?.message) return custom.message;
    } catch {
      // segue para a mensagem genérica
    }
  }
  if (
    code === "BAD_REQUEST" &&
    raw &&
    raw.length <= 200 &&
    !raw.startsWith("[")
  )
    return raw;
  if (code === "CONFLICT") return raw || "Os dados mudaram. Recarregue.";
  if (code === "BAD_REQUEST") return "Revise os valores informados.";
  return "Não foi possível salvar agora. Tente de novo.";
}
