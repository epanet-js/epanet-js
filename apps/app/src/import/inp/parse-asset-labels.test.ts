import { Junction, Pipe } from "src/hydraulic-model";
import { parseInp } from "./parse-inp";

describe("asset label length on import", () => {
  const longId = "J" + "x".repeat(69); // 70 chars
  const inp = `
    [JUNCTIONS]
    ${longId}\t10
    J2\t20
    [PIPES]
    P1\t${longId}\tJ2\t10\t100\t0.1\t0\tOpen
    [COORDINATES]
    ${longId}\t10\t20
    J2\t30\t40
  `;

  const junctionsOf = (assets: Junction[]) =>
    assets.filter((a) => a.type === "junction");

  it("caps asset labels at the caller-provided limit while keeping references intact", () => {
    const { hydraulicModel } = parseInp(inp, { labelMaxLength: 64 });

    const assets = Array.from(hydraulicModel.assets.values());
    const longJunction = junctionsOf(assets as Junction[]).find(
      (j) => j.label !== "J2",
    )!;
    expect(longJunction.label).toEqual(longId.slice(0, 64));

    const pipe = assets.find((a) => a.type === "pipe") as Pipe;
    expect(pipe.connections).toContain(longJunction.id);
    expect(hydraulicModel.topology.hasLink(pipe.id)).toBeTruthy();
  });

  it("preserves the full label when no limit is provided", () => {
    const { hydraulicModel } = parseInp(inp);

    const assets = Array.from(hydraulicModel.assets.values());
    const longJunction = junctionsOf(assets as Junction[]).find(
      (j) => j.label !== "J2",
    )!;
    expect(longJunction.label).toEqual(longId);
  });
});
