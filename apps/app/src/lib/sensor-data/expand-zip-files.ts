import { unzipSync } from "fflate";

const MAX_ZIP_DEPTH = 2;

export type SkippedZip = { name: string; reason: "unreadable" | "tooDeep" };

export type ExpandedFiles = { files: File[]; skipped: SkippedZip[] };

export const isZipFile = (file: File): boolean => isZipName(file.name);

const isHiddenFile = (name: string): boolean => name.startsWith(".");

export const expandZipFiles = async (files: File[]): Promise<ExpandedFiles> => {
  const expanded: File[] = [];
  const skipped: SkippedZip[] = [];
  for (const file of files) {
    if (isHiddenFile(file.name)) continue;
    if (!isZipFile(file)) {
      expanded.push(file);
      continue;
    }
    try {
      collectZipEntries(
        new Uint8Array(await file.arrayBuffer()),
        expanded,
        skipped,
        0,
        "",
      );
    } catch {
      skipped.push({ name: file.name, reason: "unreadable" });
    }
  }
  return { files: expanded, skipped };
};

const collectZipEntries = (
  bytes: Uint8Array,
  entries: File[],
  skipped: SkippedZip[],
  depth: number,
  prefix: string,
): void => {
  for (const [entryPath, data] of Object.entries(unzipSync(bytes))) {
    if (entryPath.endsWith("/") || entryPath.startsWith("__MACOSX/")) continue;
    const baseName = entryPath.split("/").pop();
    if (!baseName || isHiddenFile(baseName)) continue;
    const name = `${prefix}${entryPath}`;
    if (!isZipName(name)) {
      entries.push(new File([data], name));
      continue;
    }
    if (depth + 1 >= MAX_ZIP_DEPTH) {
      skipped.push({ name, reason: "tooDeep" });
      continue;
    }
    try {
      collectZipEntries(data, entries, skipped, depth + 1, `${name}/`);
    } catch {
      skipped.push({ name, reason: "unreadable" });
    }
  }
};

const isZipName = (name: string): boolean =>
  name.toLowerCase().endsWith(".zip");
