#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Fetches ESRI WKT for all projections in public/projections.json from epsg.io
 * and writes individual JSON files to public/projection-data/.
 *
 * Each file is named after the projection id (e.g. epsg_8678.json) and contains:
 * { "wkt": "PROJCS[...]" }
 *
 * Usage: node scripts/fetch-esri-wkt.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECTIONS_PATH = resolve(__dirname, "../public/projections.json");
const OUTPUT_DIR = resolve(__dirname, "../public/projection-data");
const CONCURRENCY = 10;
const RETRY_DELAY_MS = 1000;
const MAX_RETRIES = 3;

async function fetchWkt(epsgCode) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`https://epsg.io/${epsgCode}.esriwkt`);
      if (!response.ok) {
        console.warn(`  [${response.status}] EPSG:${epsgCode}`);
        return null;
      }
      const text = await response.text();
      return text.trim() || null;
    } catch (err) {
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      } else {
        console.warn(`  [FAIL] EPSG:${epsgCode}: ${err.message}`);
        return null;
      }
    }
  }
  return null;
}

async function processInBatches(projections, batchSize) {
  let completed = 0;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < projections.length; i += batchSize) {
    const batch = projections.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (proj) => {
        const code = proj.id.split(":")[1];
        if (!code) {
          failCount++;
          return;
        }

        const wkt = await fetchWkt(code);
        if (wkt) {
          const fileName = proj.id.replace(":", "_").toLowerCase();
          writeFileSync(
            resolve(OUTPUT_DIR, `${fileName}.json`),
            JSON.stringify({ wkt }) + "\n",
          );
          successCount++;
        } else {
          failCount++;
        }
      }),
    );

    completed += batch.length;
    if (completed % 100 === 0 || completed === projections.length) {
      console.log(`Progress: ${completed}/${projections.length}`);
    }
  }

  return { successCount, failCount };
}

async function main() {
  const raw = readFileSync(PROJECTIONS_PATH, "utf-8");
  const projections = JSON.parse(raw);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(
    `Fetching ESRI WKT for ${projections.length} projections into ${OUTPUT_DIR}...`,
  );

  const { successCount, failCount } = await processInBatches(
    projections,
    CONCURRENCY,
  );

  console.log(`\nDone: ${successCount} succeeded, ${failCount} failed`);
}

main().catch(console.error);
