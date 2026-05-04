import { readFileSync } from "fs";
import { fileURLToPath } from "url";

export const patchEpanetLoader = () => {
  vi.stubGlobal("fetch", (url: string) => {
    const filePath = fileURLToPath(url);
    const nodeBuffer = readFileSync(filePath);
    return new Response(nodeBuffer, {
      status: 200,
      headers: { "Content-Type": "application/wasm" },
    });
  });
};
