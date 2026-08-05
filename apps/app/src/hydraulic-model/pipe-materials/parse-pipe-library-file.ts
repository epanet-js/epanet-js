import Papa from "papaparse";
import type { PipeMaterial, RoughnessEntry } from "@epanet-js/hydraulic-model";
import { validateEntry, validateMaterial } from "./validate-material";
import type { ImportError, ImportPipeLibraryResult } from "./import-result";

type ParsedFile = { materials: PipeMaterial[]; errors: ImportError[] };

class MaterialRows {
  private byKey = new Map<string, PipeMaterial>();
  private reportedLabels = new Set<string>();
  readonly errors: ImportError[] = [];

  add(label: string, entry: RoughnessEntry) {
    const key = label.toLowerCase();
    const material = this.byKey.get(key);

    if (!material) {
      this.byKey.set(key, { label, entries: [entry] });
      return;
    }

    if (material.label !== label) {
      if (!this.reportedLabels.has(label)) {
        this.reportedLabels.add(label);
        this.errors.push({
          material: label,
          message: "pipeLibrary.import.duplicateMaterial",
        });
      }
      return;
    }

    material.entries.push(entry);
  }

  get materials(): PipeMaterial[] {
    return [...this.byKey.values()];
  }
}

export const parsePipeLibraryFile = async (
  file: File,
): Promise<ImportPipeLibraryResult> => {
  const extension = file.name.slice(file.name.lastIndexOf("."));
  if (extension !== ".csv" && extension !== ".xlsx") {
    return {
      status: "error",
      errors: [{ message: "pipeLibrary.import.unsupportedFormat" }],
    };
  }

  const format: "csv" | "xlsx" = file.name.endsWith(".csv") ? "csv" : "xlsx";
  const parseMaterials = file.name.endsWith(".csv") ? parseCsv : parseXlsx;
  let parsed: ParsedFile = { materials: [], errors: [] };

  try {
    parsed = await parseMaterials(file);
  } catch (e) {
    return {
      status: "error",
      errors: [{ message: "pipeLibrary.import.exception" }],
    };
  }

  const materials = parsed.materials;

  if (materials.length === 0) {
    return {
      status: "error",
      format,
      errors: [
        { material: "", message: "pipeLibrary.import.emptyFile", value: "" },
      ],
    };
  }

  const errors: ImportError[] = [...parsed.errors];
  const sanitized: PipeMaterial[] = materials.map((material) => {
    const error = validateMaterial(material);
    if (error === null) return material;

    errors.push({
      material: material.label,
      message: error.message,
      value: error.value,
    });

    return {
      label: material.label,
      entries: material.entries.map((entry) => {
        const entryErrors = validateEntry(entry);
        if (entryErrors.length === 0) return entry;
        const patched = { ...entry };
        for (const e of entryErrors) {
          patched[e.field] = null;
        }
        return patched;
      }),
    };
  });

  if (errors.length > 0) {
    return { status: "partial", format, pipeLibrary: sanitized, errors };
  }

  return { status: "success", format, pipeLibrary: sanitized, errors: [] };
};

const parseCsv = async (file: File): Promise<ParsedFile> => {
  const text = await file.text();
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });
  const rows = result.data;

  if (rows.length <= 1) return { materials: [], errors: [] };

  const parsedRows = new MaterialRows();

  for (let i = 1; i < rows.length; i++) {
    const [name, ageStr, roughnessStr] = rows[i];
    if (!name) continue;

    parsedRows.add(name, {
      age: ageStr ? Number(ageStr) : null,
      roughness: roughnessStr ? Number(roughnessStr) : null,
    });
  }

  return { materials: parsedRows.materials, errors: parsedRows.errors };
};

const parseXlsx = async (file: File): Promise<ParsedFile> => {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { materials: [], errors: [] };

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
  });

  const parsedRows = new MaterialRows();

  for (const row of rows.slice(1)) {
    const name = row[0];
    if (!name) continue;

    parsedRows.add(String(name), {
      age: row[1] != null ? Number(row[1]) : null,
      roughness: row[2] != null ? Number(row[2]) : null,
    });
  }

  return { materials: parsedRows.materials, errors: parsedRows.errors };
};
