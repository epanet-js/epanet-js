import fs from "fs";
import path from "path";
import { checksum } from "src/infra/checksum";
import { DEMO_NETWORKS, DEMO_NETWORK_HASHES } from "./demo-networks";

describe("demo network hashes", () => {
  it.each(DEMO_NETWORKS)(
    "$path matches its hash",
    ({ path: filePath, hash }) => {
      const content = fs.readFileSync(
        path.resolve(process.cwd(), filePath),
        "utf-8",
      );

      expect(checksum(content)).toBe(hash);
    },
  );

  it("has no stale hashes", () => {
    expect(DEMO_NETWORK_HASHES.size).toBe(DEMO_NETWORKS.length);
  });
});
