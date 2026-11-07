import { formatMonth } from "@shared/condo";
import type { PublicDashboard } from "@shared/public-dashboard";

export function latestCompetenceLabel(latest: PublicDashboard["latest"]) {
  if (!latest) return "Nenhuma competência cadastrada";
  const label = formatMonth(latest.competence);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function publicStatusLabel(status: "open" | "closed") {
  return status === "open" ? "Em aberto" : "Fechado";
}

export function formatPublicDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return value;
  }
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day))
  );
}
