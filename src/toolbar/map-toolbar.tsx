import Modes from "./modes";
import { PipeDrawingFloatingPanel } from "src/components/pipe-drawing-floating-panel";

export const MapToolbar = ({ disabled = false }: { disabled?: boolean }) => {
  return (
    <div
      className="w-full flex flex-row items-center justify-between
                    bg-white dark:bg-gray-800
                    border-b border-gray-200 dark:border-gray-900
                    shadow-sm px-2 py-1 z-[2147483647]"
    >
      <Modes disabled={disabled} />
      <PipeDrawingFloatingPanel />
    </div>
  );
};
