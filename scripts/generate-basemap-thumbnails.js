#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const https = require("https");

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

if (!MAPBOX_TOKEN) {
  console.error(
    "ERROR: NEXT_PUBLIC_MAPBOX_TOKEN environment variable is required",
  );
  process.exit(1);
}

// Basemap configurations from src/map/basemaps.ts
const BASEMAPS = {
  monochrome: "mapbox://styles/mapbox/light-v10",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  outdoors: "mapbox://styles/mapbox/outdoors-v12",
  streets: "mapbox://styles/mapbox/navigation-guidance-day-v4",
};

// Constants from src/lib/constants.ts and mapbox-static-url.ts
const TARGET_SIZE = [160, 160];
const BOUNDING_BOX = "[-136.3106,-35.8527,-22.7311,59.8357]";

function generateMapboxStaticURL(styleUrl) {
  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    attribution: "false",
    logo: "false",
  }).toString();

  const u = new URL(styleUrl);
  const p = u.pathname.replace("//styles", "");

  return `https://api.mapbox.com/styles/v1${p}/static/${BOUNDING_BOX}/${TARGET_SIZE.join("x")}@2x?${params}`;
}

function downloadImage(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);

    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(
            new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`),
          );
          return;
        }

        response.pipe(file);

        file.on("finish", () => {
          file.close();
          resolve();
        });

        file.on("error", (err) => {
          fs.unlink(filePath, () => {}); // Delete the file on error
          reject(err);
        });
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

async function generateThumbnails() {
  // Create directory if it doesn't exist
  const outputDir = path.join(__dirname, "..", "public", "images", "basemaps");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created directory: ${outputDir}`);
  }

  console.log("Generating basemap thumbnails...\n");

  for (const [name, styleUrl] of Object.entries(BASEMAPS)) {
    try {
      const thumbnailUrl = generateMapboxStaticURL(styleUrl);
      const fileName = `${name}-thumbnail.png`;
      const filePath = path.join(outputDir, fileName);

      console.log(`Downloading ${name}...`);
      console.log(`  URL: ${thumbnailUrl}`);
      console.log(`  File: ${filePath}`);

      await downloadImage(thumbnailUrl, filePath);
      console.log(`  ✅ Downloaded ${fileName}\n`);
    } catch (error) {
      console.error(`  ❌ Failed to download ${name}: ${error.message}\n`);
    }
  }

  console.log("Thumbnail generation complete!");
}

generateThumbnails().catch(console.error);
