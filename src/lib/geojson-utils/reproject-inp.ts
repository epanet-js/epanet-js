// eslint-disable-next-line no-restricted-imports
import proj4 from "proj4";

const WGS84 = "EPSG:4326";

/**
 * Extracts raw [x, y] coordinate pairs from an INP file's [COORDINATES]
 * section without full parsing, for preview purposes.
 */
export function extractRawCoordinates(
  inpText: string,
): Array<{ name: string; x: number; y: number }> {
  const result: Array<{ name: string; x: number; y: number }> = [];
  let inCoordinates = false;

  for (const line of inpText.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) {
      inCoordinates = trimmed.toUpperCase() === "[COORDINATES]";
      continue;
    }
    if (!inCoordinates || trimmed.startsWith(";") || !trimmed) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 3) {
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      if (!isNaN(x) && !isNaN(y)) {
        result.push({ name: parts[0], x, y });
      }
    }
  }
  return result;
}

/**
 * Reprojects coordinates in an INP file's [COORDINATES] and [VERTICES]
 * sections from the given source proj4 string to WGS84 (EPSG:4326).
 * Returns the modified INP text.
 */
export function reprojectInpCoordinates(
  inpText: string,
  sourceProjCode: string,
): string {
  const converter = proj4(sourceProjCode, WGS84);
  const lines = inpText.split("\n");
  let currentSection: string | null = null;
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      currentSection = trimmed.slice(1, -1).toUpperCase();
      result.push(line);
      continue;
    }

    if (trimmed.startsWith(";") || trimmed === "") {
      result.push(line);
      continue;
    }

    if (currentSection === "COORDINATES" || currentSection === "VERTICES") {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 3) {
        const name = parts[0];
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);

        if (!isNaN(x) && !isNaN(y)) {
          try {
            const [lng, lat] = converter.forward([x, y]);
            const leadingSpace = line.match(/^(\s*)/)?.[1] ?? "";
            result.push(`${leadingSpace}${name}\t${lng}\t${lat}`);
            continue;
          } catch {
            // If reprojection fails for this point, keep original
          }
        }
      }
    }

    result.push(line);
  }

  return result.join("\n");
}
