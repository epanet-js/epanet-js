import { describe, it, expect } from "vitest";
import { exampleScripts } from "@epanet-js/scripting-docs";
import { exampleNameKey } from "./example-names";
import i18n from "src/infra/i18n/i18next-config";

describe("example script translations", () => {
  it("has a translation for every example script", () => {
    const missing = exampleScripts
      .map((example) => example.id)
      .filter((id) => !i18n.exists(exampleNameKey(id)));

    expect(missing).toEqual([]);
  });

  it("reports an example id that has no translation as missing", () => {
    expect(i18n.exists(exampleNameKey("nonexistent-example"))).toBe(false);
  });
});
