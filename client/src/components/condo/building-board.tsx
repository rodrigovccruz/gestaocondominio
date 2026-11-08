import { cn } from "@/lib/utils";

export type BuildingUnit = {
  number: string;
  value: string;
  note?: string;
  tone?: "ok" | "due" | "credit";
};

export type BuildingFloor = {
  floor: string;
  left: BuildingUnit[];
  right: BuildingUnit[];
};

const MAX_UNITS_PER_FLOOR = 4;

/**
 * Agrupa os apartamentos por andar pelo número (101 → andar 1, posição 01).
 * Devolve null quando a numeração não segue esse padrão: aí o prédio não é
 * desenhado e a tabela continua mostrando tudo.
 */
export function groupByFloor(units: BuildingUnit[]): BuildingFloor[] | null {
  if (!units.length) return null;
  const floors = new Map<string, { position: number; unit: BuildingUnit }[]>();
  for (const unit of units) {
    const match = /^(\d+)(\d{2})$/.exec(unit.number.trim());
    if (!match) return null;
    const list = floors.get(match[1]) ?? [];
    list.push({ position: Number(match[2]), unit });
    floors.set(match[1], list);
  }
  if ([...floors.values()].some(list => list.length > MAX_UNITS_PER_FLOOR))
    return null;
  return [...floors.entries()]
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([floor, list]) => {
      const ordered = list
        .sort((a, b) => a.position - b.position)
        .map(item => item.unit);
      const half = Math.ceil(ordered.length / 2);
      return {
        floor,
        left: ordered.slice(0, half),
        right: ordered.slice(half),
      };
    });
}

function Window({ unit }: { unit: BuildingUnit }) {
  return (
    <div
      className={cn("window", unit.tone && `window-${unit.tone}`)}
      role="listitem"
    >
      <b>{unit.number}</b>
      <span>{unit.value}</span>
      {unit.note ? <small>{unit.note}</small> : null}
    </div>
  );
}

/** O prédio desenhado: cada janela é um apartamento, de cima para baixo. */
export function BuildingBoard({
  title,
  units,
  footer,
}: {
  title: string;
  units: BuildingUnit[];
  footer?: string;
}) {
  const floors = groupByFloor(units);
  if (!floors) return null;
  return (
    <section className="building" aria-label={title}>
      <h2>{title}</h2>
      <div className="building-body" role="list">
        {floors.map(f => (
          <div className="floor" key={f.floor}>
            <div className="floor-side">
              {f.left.map(u => (
                <Window key={u.number} unit={u} />
              ))}
            </div>
            <span className="floor-gap" aria-hidden="true" />
            <div className="floor-side">
              {f.right.map(u => (
                <Window key={u.number} unit={u} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="building-base">{footer ?? "Térreo"}</div>
    </section>
  );
}
