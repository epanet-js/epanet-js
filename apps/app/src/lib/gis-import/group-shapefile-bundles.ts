export type ShapefileBundle = { baseName: string; files: File[] };

const GEOJSON_EXTENSIONS = new Set([".geojson", ".json"]);
const SHAPEFILE_EXTENSIONS = new Set([".shp", ".dbf", ".prj", ".shx", ".cpg"]);

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

function getBaseName(name: string): string {
  const ext = getExtension(name);
  const base = ext ? name.slice(0, -ext.length) : name;
  return base.toLowerCase();
}

export function groupShapefileBundles(files: File[]): {
  shapefileBundles: ShapefileBundle[];
  geojsonFiles: File[];
} {
  const geojsonFiles: File[] = [];
  const bundleMap = new Map<string, File[]>();

  for (const file of files) {
    const ext = getExtension(file.name);
    if (GEOJSON_EXTENSIONS.has(ext)) {
      geojsonFiles.push(file);
    } else if (SHAPEFILE_EXTENSIONS.has(ext)) {
      const base = getBaseName(file.name);
      const existing = bundleMap.get(base);
      if (existing) {
        existing.push(file);
      } else {
        bundleMap.set(base, [file]);
      }
    }
    // other extensions are silently ignored
  }

  const shapefileBundles: ShapefileBundle[] = Array.from(
    bundleMap.entries(),
  ).map(([baseName, bundleFiles]) => ({ baseName, files: bundleFiles }));

  return { shapefileBundles, geojsonFiles };
}
