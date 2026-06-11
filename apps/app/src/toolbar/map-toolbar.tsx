import Modes from "./modes";
import { PipeDrawingFloatingPanel } from "src/components/pipe-drawing-floating-panel";

export const MapToolbar = ({ readonly = false }: { readonly?: boolean }) => {
  return (
    <div className="absolute top-3 inset-x-0 z-20 flex justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-2 pointer-events-auto">
        <div className="flex items-center bg-base border rounded-xs shadow-[0_2px_10px_2px_rgba(0,0,0,0.1)] px-1 py-1">
          <Modes disabled={readonly} />
        </div>
        <PipeDrawingFloatingPanel variant="attached" />
      </div>
    </div>
  );
};
