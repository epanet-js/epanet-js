import {
  emptyCustomAttributesDefinition,
  setAttributes,
} from "@epanet-js/hydraulic-model";
import { buildPropertyNameResolver } from "./property-names";

const translations: Record<string, string> = {
  elevation: "Elevación",
  flow: "Caudal",
  simulation: "Simulación",
  isEnabled: "Activo",
  libraryCurve: "Curva",
};

const translate = (key: string) => translations[key] ?? key;

const customAttributes = setAttributes(
  emptyCustomAttributesDefinition(),
  "junction",
  [{ id: "custom-1", label: "Zone", type: "text" }],
);

describe("buildPropertyNameResolver", () => {
  it("translates built-in properties", () => {
    const resolve = buildPropertyNameResolver(customAttributes, translate);

    expect(resolve("junction", "elevation")).toBe("Elevación");
  });

  it("applies the alias keys used by the UI", () => {
    const resolve = buildPropertyNameResolver(customAttributes, translate);

    expect(resolve("junction", "isActive")).toBe("Activo");
    expect(resolve("pump", "curveId")).toBe("Curva");
  });

  it("marks simulation properties", () => {
    const resolve = buildPropertyNameResolver(customAttributes, translate);

    expect(resolve("pipe", "sim_flow")).toBe("Caudal (Simulación)");
  });

  it("keeps the raw key for unknown custom attributes", () => {
    const resolve = buildPropertyNameResolver(customAttributes, translate);

    expect(resolve("pipe", "custom-99")).toBe("custom-99");
  });
});
