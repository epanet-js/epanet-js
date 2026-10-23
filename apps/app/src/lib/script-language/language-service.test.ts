import { createScriptLanguageService } from "./language-service";

describe("script language service", () => {
  const service = createScriptLanguageService();

  const completionsAtEnd = (source: string) =>
    service.completionsAt(source, source.length);

  it("completes the members of a global", () => {
    const completions = completionsAtEnd("network.");

    expect(completions).toContainEqual(
      expect.objectContaining({ name: "pipes", kind: "property" }),
    );
    expect(completions).toContainEqual(
      expect.objectContaining({ name: "trace", kind: "method" }),
    );
  });

  it("completes the members of a loop variable", () => {
    const completions = completionsAtEnd(
      "for (const pipe of network.pipes) {\n  pipe.",
    );

    expect(completions.map((completion) => completion.name)).toContain(
      "diameter",
    );
  });

  it("completes the members of a value returned by a call", () => {
    const completions = completionsAtEnd(
      'const zone = network.trace("J1");\nzone.',
    );

    expect(completions.map((completion) => completion.name)).toContain(
      "stoppedAt",
    );
  });

  it("completes built-in methods", () => {
    const completions = completionsAtEnd("network.pipes.");

    expect(completions.map((completion) => completion.name)).toContain(
      "filter",
    );
  });

  it("offers nothing after a member the API does not have", () => {
    const completions = completionsAtEnd(
      "const junctions = network.junctions;\nnetworks.",
    );

    expect(completions).toEqual([]);
  });

  it("offers the globals at the top level", () => {
    const completions = completionsAtEnd("");

    expect(completions.map((completion) => completion.name)).toEqual(
      expect.arrayContaining(["network", "selection", "zones", "console"]),
    );
  });

  it("describes a completion with its signature and documentation", () => {
    const source = "network.";

    const details = service.completionDetails(source, source.length, "pipes");

    expect(details).toEqual({
      signature: "(property) Network.pipes: Pipe[]",
      documentation: "Every pipe.",
    });
  });
});
