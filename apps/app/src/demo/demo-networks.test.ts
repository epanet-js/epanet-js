import fs from "fs";
import path from "path";
import { DEMO_NETWORKS } from "./demo-networks";

describe("demo networks", () => {
  it.each(DEMO_NETWORKS)("$path exists", ({ path: filePath }) => {
    expect(fs.existsSync(path.resolve(process.cwd(), filePath))).toBe(true);
  });

  it.each(DEMO_NETWORKS)(
    "$url is served from $path",
    ({ path: filePath, url }) => {
      expect(filePath).toBe(`public${url}`);
    },
  );
});
