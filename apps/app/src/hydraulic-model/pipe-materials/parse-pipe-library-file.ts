import Papa from "papaparse";
import type { PipeMaterial, RoughnessEntry } from "@epanet-js/hydraulic-model";
import { validateEntry, validateMaterial } from "./validate-material";
import type { ImportError, ImportPipeLibraryResult } from "./import-result";

// A material spans as many rows as it has entries, so each entry remembers
// the row it came from and problems can be reported against it.
type RowedMaterial = { material: PipeMaterial; rows: number[] };

type ParsedFile = {
  materials: RowedMaterial[];
  errors: ImportError[];
  dataRows: number;
  unreadableRows: number;
};

// A blank cell is a missing value; a cell holding something that is not a
// number at all says the column is not what we think it is.
const isUnreadable = (cell: string): boolean =>
  cell !== "" && Number.isNaN(Number(cell));

// Spacing between materials, rather than a row we failed to read.
const isBlankRow = (cells: (string | number | null | undefined)[]): boolean =>
  cells.every((cell) => cell == null || String(cell).trim() === "");

class MaterialRows {
  private byKey = new Map<string, RowedMaterial>();
  private reportedLabels = new Set<string>();
  readonly errors: ImportError[] = [];

  add(label: string, entry: RoughnessEntry, row: number) {
    const key = label.toLowerCase();
    const existing = this.byKey.get(key);

    if (!existing) {
      this.byKey.set(key, {
        material: { label, entries: [entry] },
        rows: [row],
      });
      return;
    }

    if (existing.material.label !== label) {
      if (!this.reportedLabels.has(label)) {
        this.reportedLabels.add(label);
        this.errors.push({
          material: label,
          code: "import.duplicateMaterial",
          row,
        });
      }
      return;
    }

    existing.material.entries.push(entry);
    existing.rows.push(row);
  }

  get materials(): RowedMaterial[] {
    return [...this.byKey.values()];
  }
}

// An entry-level problem points at the row that carries it; anything about
// the material as a whole is anchored to where it starts.
const rowOfError = ({ material, rows }: RowedMaterial): number | undefined => {
  const index = material.entries.findIndex(
    (entry) => validateEntry(entry).length > 0,
  );
  return index === -1 ? rows[0] : rows[index];
};

export const parsePipeLibraryFile = async (
  file: File,
): Promise<ImportPipeLibraryResult> => {
  const extension = file.name.slice(file.name.lastIndexOf("."));
  if (extension !== ".csv" && extension !== ".xlsx") {
    return {
      status: "error",
      errors: [{ code: "import.unsupportedFormat" }],
    };
  }

  const format: "csv" | "xlsx" = file.name.endsWith(".csv") ? "csv" : "xlsx";
  const parseMaterials = file.name.endsWith(".csv") ? parseCsv : parseXlsx;
  let parsed: ParsedFile = {
    materials: [],
    errors: [],
    dataRows: 0,
    unreadableRows: 0,
  };

  try {
    parsed = await parseMaterials(file);
  } catch (e) {
    return {
      status: "error",
      errors: [{ code: "import.exception" }],
    };
  }

  const materials = parsed.materials;

  if (materials.length === 0) {
    return {
      status: "error",
      format,
      errors: [{ material: "", code: "import.emptyFile", value: "" }],
    };
  }

  // Most rows unreadable means this is the wrong kind of file, and importing
  // its rows as materials would be worse than refusing it.
  if (parsed.dataRows >= 2 && parsed.unreadableRows * 2 > parsed.dataRows) {
    return {
      status: "error",
      format,
      errors: [{ code: "import.notAValidPipeLibraryFile" }],
    };
  }

  const errors: ImportError[] = [...parsed.errors];
  const sanitized: PipeMaterial[] = materials.map((rowed) => {
    const { material } = rowed;
    const error = validateMaterial(material);
    if (error === null) return material;

    errors.push({
      material: material.label,
      code: error.code,
      value: error.value,
      row: rowOfError(rowed),
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
  // Blank lines are kept so the row numbers we report match the file.
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: false,
  });
  const rows = result.data;

  if (rows.length <= 1)
    return { materials: [], errors: [], dataRows: 0, unreadableRows: 0 };

  const parsedRows = new MaterialRows();
  const rowErrors: ImportError[] = [];
  let dataRows = 0;
  let unreadableRows = 0;
  // A material takes one row per age, so a blank name carries on the one above.
  let previousLabel: string | undefined;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isBlankRow(row)) continue;

    const [name, ageStr, roughnessStr] = row;
    dataRows += 1;

    const label = name || previousLabel;
    if (!label) {
      rowErrors.push({ code: "import.missingLabel", row: i + 1 });
      continue;
    }
    previousLabel = label;

    if (isUnreadable(ageStr ?? "") || isUnreadable(roughnessStr ?? "")) {
      unreadableRows += 1;
    }

    parsedRows.add(
      label,
      {
        age: ageStr ? Number(ageStr) : null,
        roughness: roughnessStr ? Number(roughnessStr) : null,
      },
      i + 1,
    );
  }

  return {
    materials: parsedRows.materials,
    errors: [...rowErrors, ...parsedRows.errors],
    dataRows,
    unreadableRows,
  };
};

const parseXlsx = async (file: File): Promise<ParsedFile> => {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName)
    return { materials: [], errors: [], dataRows: 0, unreadableRows: 0 };

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
  });

  const parsedRows = new MaterialRows();

  const rowErrors: ImportError[] = [];
  let dataRows = 0;
  let unreadableRows = 0;
  // A material takes one row per age, so a blank name carries on the one above.
  let previousLabel: string | undefined;

  rows.slice(1).forEach((row, index) => {
    if (isBlankRow(row)) return;

    const name = row[0];
    dataRows += 1;

    const label = name != null && name !== "" ? String(name) : previousLabel;
    if (!label) {
      rowErrors.push({ code: "import.missingLabel", row: index + 2 });
      return;
    }
    previousLabel = label;

    if (
      isUnreadable(row[1] != null ? String(row[1]) : "") ||
      isUnreadable(row[2] != null ? String(row[2]) : "")
    ) {
      unreadableRows += 1;
    }

    parsedRows.add(
      label,
      {
        age: row[1] != null ? Number(row[1]) : null,
        roughness: row[2] != null ? Number(row[2]) : null,
      },
      index + 2,
    );
  });

  return {
    materials: parsedRows.materials,
    errors: [...rowErrors, ...parsedRows.errors],
    dataRows,
    unreadableRows,
  };
};
