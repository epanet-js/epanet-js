import { afterEach, describe, expect, it } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { getWorker } from "@epanet-js/ejsdb";
import type { FileTagger } from "@epanet-js/ejsdb-tag";
import { importProject } from "./import-project";
import { openProject } from "./open-project";
import { fetchProject } from "./fetch-project";
import { useInProcessDb } from "../__test-helpers__/in-process-db";

const readHeader = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  return { pageSize: view.getUint16(16), pageCount: view.getUint32(28) };
};

const databaseLength = (bytes: Uint8Array) => {
  const { pageSize, pageCount } = readHeader(bytes);
  return pageSize * pageCount;
};

const fakeTagger = (): FileTagger & { tagged: string[] } => {
  const tagger = {
    tagged: [] as string[],
    tag: (database: Uint8Array, label: string) => {
      tagger.tagged.push(label);
      const file = new Uint8Array(
        database.length + readHeader(database).pageSize,
      );
      file.set(database);
      file.set(new TextEncoder().encode(label), database.length);
      return Promise.resolve(file);
    },
    verify: (file: Uint8Array) => {
      const bodyEnd = databaseLength(file);
      if (file.length === bodyEnd) {
        return Promise.resolve({
          body: file,
          integrity: "untagged" as const,
          label: null,
        });
      }
      const trailer = file.subarray(bodyEnd);
      const labelEnd = trailer.indexOf(0);
      return Promise.resolve({
        body: file.subarray(0, bodyEnd),
        integrity: "intact" as const,
        label: new TextDecoder().decode(trailer.subarray(0, labelEnd)),
      });
    },
  };
  return tagger;
};

describe("file tag integration", () => {
  useInProcessDb();

  afterEach(async () => {
    await configureTagging();
  });

  const configureTagging = (tagger?: FileTagger) =>
    getWorker().configure({ mode: "memory", sahpoolId: "test", tagger });

  const saveProject = async (label?: string): Promise<Uint8Array> => {
    await importProject({
      newDb: true,
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction(1, { label: "J1", elevation: 10 })
        .aReservoir(2, { label: "R1", elevation: 100 })
        .aPipe(3, { label: "P1", startNodeId: 2, endNodeId: 1 })
        .build(),
      projectSettings: { ...defaultProjectSettings, name: "tagged" },
      simulationSettings: defaultSimulationSettings,
    });
    return getWorker().exportDb(label);
  };

  const open = (bytes: Uint8Array) =>
    openProject(
      new File([bytes], "tagged.ejsdb", { type: "application/octet-stream" }),
    );

  it("leaves files alone without a tagger", async () => {
    const bytes = await saveProject("pro");
    const result = await open(bytes);

    expect(bytes.length).toBe(databaseLength(bytes));
    expect(result).toMatchObject({
      status: "ok",
      integrity: "untagged",
      label: null,
    });
  });

  it("tags on export and verifies on open with a tagger", async () => {
    const tagger = fakeTagger();
    await configureTagging(tagger);

    const bytes = await saveProject("education");
    const result = await open(bytes);

    expect(bytes.length).toBe(
      databaseLength(bytes) + readHeader(bytes).pageSize,
    );
    expect(tagger.tagged).toEqual(["education"]);
    expect(result).toMatchObject({
      status: "ok",
      integrity: "intact",
      label: "education",
    });
    const project = await fetchProject();
    expect(project.projectSettings.name).toBe("tagged");
    expect(project.hydraulicModel.assets.size).toBe(3);
  });

  it("opens a file another writer stripped as untagged", async () => {
    await configureTagging(fakeTagger());

    const bytes = await saveProject("free");
    const stripped = bytes.subarray(0, databaseLength(bytes));
    const result = await open(stripped);

    expect(result).toMatchObject({ status: "ok", integrity: "untagged" });
    expect((await fetchProject()).hydraulicModel.assets.size).toBe(3);
  });
});
