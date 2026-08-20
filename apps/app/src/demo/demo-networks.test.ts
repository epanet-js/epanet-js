import fs from "fs";
import path from "path";
import * as db from "src/lib/db";
import { useInProcessDb } from "src/lib/db/__test-helpers__/in-process-db";
import { getAttributes } from "@epanet-js/hydraulic-model";
import { DEMO_NETWORKS } from "./demo-networks";

describe("demo networks", () => {
  useInProcessDb();

  it.each(DEMO_NETWORKS)("$path exists", ({ path: filePath }) => {
    expect(fs.existsSync(path.resolve(process.cwd(), filePath))).toBe(true);
  });

  it.each(DEMO_NETWORKS)(
    "$url is served from $path",
    ({ path: filePath, url }) => {
      expect(filePath).toBe(`public${url}`);
    },
  );

  it.each(DEMO_NETWORKS)(
    "$name opens with this version of the app",
    async ({ path: filePath }) => {
      const result = await db.openProject(readProjectFile(filePath));

      expect(result.status).toMatch(/^(ok|migrated)$/);

      const { hydraulicModel, zones, customAttributes } = await db.fetchProject(
        {},
      );

      expect(hydraulicModel.assets.size).toBeGreaterThan(0);
      expect(zones.size).toBeGreaterThan(0);
      expect(hydraulicModel.pipeMaterials.length).toBeGreaterThan(0);
      expect(getAttributes(customAttributes, "pipe").length).toBeGreaterThan(0);
    },
  );

  const readProjectFile = (filePath: string): File => {
    const contents = fs.readFileSync(path.resolve(process.cwd(), filePath));
    return new File([contents], path.basename(filePath));
  };
});
