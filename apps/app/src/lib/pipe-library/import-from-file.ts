import * as XLSX from "xlsx";
import Papa from "papaparse";
import { fileOpen } from "browser-fs-access";
import type { PipeMaterial } from "@epanet-js/pipe-library";
import { validateEntry, validateMaterial } from "./validate-material";

export type ImportError = {
  material: string;
  message: string;
  value?: string;
};

export type ImportPipeLibraryResult = {
  status: "success" | "error" | "partial";
  format: "csv" | "xlsx";
  pipeLibrary?: PipeMaterial[];
  errors: ImportError[];
};

export const importFromFile =
  async (): Promise<ImportPipeLibraryResult | null> => {
    const file = await openFilePicker();
    if (!file) return null;

    const format: "csv" | "xlsx" = file.name.endsWith(".csv") ? "csv" : "xlsx";
    const materials =
      format === "csv" ? await parseCsv(file) : await parseXlsx(file);

    if (materials.length === 0) {
      return {
        status: "error",
        format,
        errors: [
          { material: "", message: "pipeLibrary.import.emptyFile", value: "" },
        ],
      };
    }

    const errors: ImportError[] = [];
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

const openFilePicker = async (): Promise<File | null> => {
  try {
    return await fileOpen({
      extensions: [".csv", ".xlsx"],
      description: "Pipe library file",
      mimeTypes: [
        "text/csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ],
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") return null;
    throw error;
  }
};

const parseCsv = async (file: File): Promise<PipeMaterial[]> => {
  const text = await file.text();
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });
  const rows = result.data;

  if (rows.length <= 1) return [];

  const materialsMap = new Map<string, PipeMaterial>();

  for (let i = 1; i < rows.length; i++) {
    const [name, ageStr, roughnessStr] = rows[i];
    if (!name) continue;

    let material = materialsMap.get(name);
    if (!material) {
      material = { label: name, entries: [] };
      materialsMap.set(name, material);
    }

    material.entries.push({
      age: ageStr ? Number(ageStr) : null,
      roughness: roughnessStr ? Number(roughnessStr) : null,
    });
  }

  return [...materialsMap.values()];
};

const parseXlsx = async (file: File): Promise<PipeMaterial[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
    });

    const entries = rows.slice(1).map((row) => ({
      age: row[0] != null ? Number(row[0]) : null,
      roughness: row[1] != null ? Number(row[1]) : null,
    }));

    return { label: sheetName, entries };
  });
};
