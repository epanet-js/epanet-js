import { TranslateFn } from "@epanet-js/i18n";
import { HydraulicModel, Projection } from "src/hydraulic-model";
import { AssetExporters } from "./asset-exporters";
import { FileSystemHelpers } from "./file-system-helpers";
import type { AssetExportOptions, ExportFormat } from "./types";

export const exportAssetData = async (
  fileName: string,
  format: ExportFormat,
  hydraulicModel: HydraulicModel,
  projection: Projection,
  translate: TranslateFn,
  options?: AssetExportOptions,
) => {
  if (format === "xlsx") {
    await handleXlsx(fileName, hydraulicModel, projection, translate, options);
    return;
  }

  const exporters = {
    geojson: AssetExporters.exportGeoJson,
    csv: AssetExporters.exportCsv,
    shapefile: AssetExporters.exportShapefiles,
  };

  const exportedFiles = await exporters[format](
    hydraulicModel,
    projection,
    translate,
    options,
  );

  const zipFileName = `${fileName}.zip`;
  const handle = FileSystemHelpers.isFileSystemAccessSupported()
    ? await FileSystemHelpers.openFileInFileSystem(
        zipFileName,
        "ZIP File",
        "application/zip",
        ".zip",
      )
    : await FileSystemHelpers.openFileInOpfs(zipFileName);

  await AssetExporters.exportZip(handle, exportedFiles);

  if (!FileSystemHelpers.isFileSystemAccessSupported()) {
    await FileSystemHelpers.triggerDownload(zipFileName, handle);
  }
};

const handleXlsx = async (
  fileName: string,
  hydraulicModel: HydraulicModel,
  projection: Projection,
  translate: TranslateFn,
  options?: AssetExportOptions,
) => {
  const xlsxFileName = `${fileName}.xlsx`;
  const handle = FileSystemHelpers.isFileSystemAccessSupported()
    ? await FileSystemHelpers.openFileInFileSystem(
        xlsxFileName,
        "XLSX Spreadsheet",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xlsx",
      )
    : await FileSystemHelpers.openFileInOpfs(fileName);

  await AssetExporters.exportXlsx(
    handle,
    hydraulicModel,
    projection,
    translate,
    options,
  );

  if (!FileSystemHelpers.isFileSystemAccessSupported()) {
    await FileSystemHelpers.triggerDownload(xlsxFileName, handle);
  }
};
