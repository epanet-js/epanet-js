import { useAtomValue } from "jotai";
import clsx from "clsx";
import { dialogAtom } from "src/state/dialog";
import Modes from "./modes";
import { MapToolbarPipeDrawing } from "./map-toolbar-pipe-drawing";

export const MapToolbar = ({ readonly = false }: { readonly?: boolean }) => {
  const dialogState = useAtomValue(dialogAtom);

  if (dialogState) return null;

  return (
    <div className="absolute top-2 inset-x-0 z-20 flex justify-center pointer-events-none">
      <div
        className={clsx(
          "pointer-events-auto flex flex-col bg-base",
          "rounded-sm border shadow-md",
        )}
      >
        <div className="flex items-center justify-center px-2 py-1">
          <Modes disabled={readonly} />
        </div>
        <MapToolbarPipeDrawing />
      </div>
    </div>
  );
};
