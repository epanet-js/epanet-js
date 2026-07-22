import { describe, expect, it } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { defaultProjectSettings } from "src/lib/project-settings";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { ensureUniqueId } from "./ensure-unique-id";
import { exportDb } from "./export-db";
import { fetchProject } from "./fetch-project";
import { importProject } from "./import-project";
import { openProject } from "./open-project";
import { useInProcessDb } from "../__test-helpers__/in-process-db";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const seedProject = async () => {
  await importProject({
    newDb: true,
    hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
    projectSettings: defaultProjectSettings,
    simulationSettings: defaultSimulationSettings,
  });
};

describe("ensure-unique-id integration", () => {
  useInProcessDb();

  it("stamps a uniqueId into project settings and is idempotent", async () => {
    await seedProject();

    const first = await ensureUniqueId();
    expect(first).toMatch(UUID_REGEX);

    const second = await ensureUniqueId();
    expect(second).toBe(first);

    const project = await fetchProject();
    expect(project.projectSettings.uniqueId).toBe(first);
  });

  it("persists the uniqueId across export and reopen", async () => {
    await seedProject();
    const id = await ensureUniqueId();

    const blob = await exportDb();
    const file = new File([blob], "with-id.ejsdb", {
      type: "application/octet-stream",
    });

    const openResult = await openProject(file);
    expect(openResult.status).toBe("ok");

    const project = await fetchProject();
    expect(project.projectSettings.uniqueId).toBe(id);
    expect(await ensureUniqueId()).toBe(id);
  });
});
