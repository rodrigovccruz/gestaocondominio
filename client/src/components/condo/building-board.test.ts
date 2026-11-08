import { describe, expect, it } from "vitest";
import { groupByFloor } from "./building-board";

const u = (number: string) => ({ number, value: "R$ 1,00" });

describe("prédio: apartamentos por andar", () => {
  it("põe o andar mais alto em cima e 01 à esquerda, 02 à direita", () => {
    const floors = groupByFloor(["102", "501", "101", "502"].map(u));
    expect(floors?.map(f => f.floor)).toEqual(["5", "1"]);
    expect(floors?.[1].left.map(x => x.number)).toEqual(["101"]);
    expect(floors?.[1].right.map(x => x.number)).toEqual(["102"]);
  });

  it("não desenha o prédio se a numeração não for andar + posição", () => {
    expect(groupByFloor(["A", "101"].map(u))).toBeNull();
    expect(groupByFloor([])).toBeNull();
  });

  it("não desenha o prédio com mais de 4 aptos no mesmo andar", () => {
    expect(groupByFloor(["101", "102", "103", "104", "105"].map(u))).toBeNull();
  });
});
