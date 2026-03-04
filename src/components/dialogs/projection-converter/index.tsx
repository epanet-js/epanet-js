import { useEffect, useState } from "react";
import type { FileWithHandle } from "browser-fs-access";
import {
  DialogContainer,
  DialogHeader,
  DialogButtons,
} from "src/components/dialog";
import { Button } from "src/components/elements";
import { useImportInp } from "src/commands/import-inp";
import { reprojectInpCoordinates } from "src/lib/geojson-utils/reproject-inp";
import { useConverter } from "./use-converter";
import { ProjectionList } from "./projection-list";
import { ProjectionMap, type MapBounds } from "./projection-map";
import type { ProjectionConverterDialogState } from "src/state/dialog";

type Props = {
  onImportNonProjected: ProjectionConverterDialogState["onImportNonProjected"];
  initialFile?: File;
  onClose: () => void;
};

export function ProjectionConverterDialog({
  onImportNonProjected,
  initialFile,
  onClose,
}: Props) {
  const importInp = useImportInp();
  const { state, readInitialFile, selectProjection, clearProjection } =
    useConverter(initialFile);

  const [zoom, setZoom] = useState(4);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);

  // Read initial file once mounted
  useEffect(() => {
    void readInitialFile();
  }, [readInitialFile]);

  const handleConfirm = async () => {
    if (!state.rawInpText || !state.selectedProjection || !state.file) return;

    const reprojected = reprojectInpCoordinates(
      state.rawInpText,
      state.selectedProjection.code,
    );

    const syntheticFile = Object.assign(
      new File([reprojected], state.file.name, { type: "text/plain" }),
      { handle: undefined },
    ) as FileWithHandle;

    await importInp([syntheticFile]);
  };

  const canConfirm =
    !!state.file && !!state.selectedProjection && !state.isLoading;

  return (
    <DialogContainer
      size="xl"
      height="xl"
      disableOutsideClick
      onClose={onClose}
    >
      <DialogHeader title="Map projection converter" />

      <div className="flex flex-1 overflow-hidden gap-0 -mx-6 px-0 border-t border-gray-100 dark:border-gray-700">
        {/* Sidebar */}
        <aside className="w-72 flex-shrink-0 flex flex-col gap-4 p-4 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          {/* File name display */}
          {state.file && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <svg
                className="w-4 h-4 text-gray-400 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                {state.file.name}
              </span>
            </div>
          )}

          {state.rawCoordinates.length > 0 && (
            <ProjectionList
              zoom={zoom}
              mapBounds={mapBounds}
              rawCoordinates={state.rawCoordinates}
              selectedProjection={state.selectedProjection}
              onSelect={selectProjection}
              onClear={clearProjection}
            />
          )}

          {state.file &&
            state.rawCoordinates.length === 0 &&
            !state.isLoading && (
              <div className="flex-1 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 min-h-[80px]">
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center px-4">
                  No coordinates found in this file
                </p>
              </div>
            )}
        </aside>

        {/* Map area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ProjectionMap
            previewPoints={state.previewPoints}
            onZoomChange={setZoom}
            onBoundsChange={setMapBounds}
          />
        </div>
      </div>

      <DialogButtons>
        <Button
          variant="primary"
          disabled={!canConfirm}
          onClick={handleConfirm}
        >
          Convert &amp; import
        </Button>
        <Button variant="default" onClick={onImportNonProjected}>
          Load in XY grid
        </Button>
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
      </DialogButtons>
    </DialogContainer>
  );
}
