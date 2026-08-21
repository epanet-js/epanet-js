import { useCallback, useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import type { SessionHistoryDiagnostics } from "@epanet-js/ejsdb";
import { sessionHistoryPanelOpenAtom } from "src/state/session-history-panel";
import { fetchSessionHistory } from "src/lib/db";
import { captureError } from "src/infra/error-tracking";
import { CloseIcon, RefreshIcon } from "src/icons";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

const REFRESH_MS = 1000;
const PANEL_WIDTH = 460;

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatTime = (epochMs: number): string =>
  new Date(epochMs).toLocaleTimeString();

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col min-w-0">
    <span className="text-[10px] uppercase tracking-wide text-gray-500">
      {label}
    </span>
    <span className="text-xs font-mono truncate">{value}</span>
  </div>
);

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

const useDraggable = (initial: { x: number; y: number }) => {
  const [position, setPosition] = useState(initial);
  const offset = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      dragging.current = true;
      offset.current = {
        x: event.clientX - position.x,
        y: event.clientY - position.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [position],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      setPosition({
        x: clamp(event.clientX - offset.current.x, window.innerWidth - 80),
        y: clamp(event.clientY - offset.current.y, window.innerHeight - 40),
      });
    },
    [],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      dragging.current = false;
      event.currentTarget.releasePointerCapture(event.pointerId);
    },
    [],
  );

  return { position, onPointerDown, onPointerMove, onPointerUp };
};

export const SessionHistoryDebugPanel = () => {
  const isPersistHistoryOn = useFeatureFlag("FLAG_PERSIST_SESSION_HISTORY");
  const [isOpen, setIsOpen] = useAtom(sessionHistoryPanelOpenAtom);
  const [data, setData] = useState<SessionHistoryDiagnostics | null>(null);
  const drag = useDraggable({ x: 24, y: 96 });

  const refresh = useCallback(() => {
    fetchSessionHistory(50)
      .then(setData)
      .catch((error) => captureError(error as Error));
  }, []);

  const isVisible = isOpen && isPersistHistoryOn;

  useEffect(() => {
    if (!isVisible) return;
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [isVisible, refresh]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed z-50 flex flex-col rounded-md border border-gray-300 bg-white shadow-xl"
      style={{
        left: drag.position.x,
        top: drag.position.y,
        width: PANEL_WIDTH,
      }}
    >
      <div
        className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 bg-gray-50 rounded-t-md cursor-move select-none touch-none"
        onPointerDown={drag.onPointerDown}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
      >
        <span className="text-xs font-semibold flex-auto">Session history</span>
        <button
          aria-label="Refresh"
          className="p-1 text-gray-500 hover:text-gray-900"
          onClick={refresh}
        >
          <RefreshIcon size="sm" />
        </button>
        <button
          aria-label="Close session history"
          className="p-1 text-gray-500 hover:text-gray-900"
          onClick={() => setIsOpen(false)}
        >
          <CloseIcon size="sm" />
        </button>
      </div>

      {!data ? (
        <p className="p-3 text-xs text-gray-500">Reading…</p>
      ) : (
        <div className="flex flex-col gap-2 p-2">
          {data.failure && (
            <p className="text-xs text-red-700 bg-red-50 p-2 rounded">
              Disabled after a {data.failure.stage} failure: {data.failure.name}
              : {data.failure.message}
            </p>
          )}

          <div className="grid grid-cols-4 gap-x-3 gap-y-1">
            <Stat label="Enabled" value={data.enabled ? "yes" : "no"} />
            <Stat label="Attached" value={data.attached ? "yes" : "no"} />
            <Stat label="Entries" value={String(data.entryCount)} />
            <Stat label="Pointer" value={String(data.pointer)} />
            <Stat
              label="Oldest"
              value={data.oldestSeq === null ? "—" : String(data.oldestSeq)}
            />
            <Stat label="Changesets" value={formatBytes(data.totalBytes)} />
            <Stat label="File" value={formatBytes(data.dbBytes)} />
            <Stat label="Dropped" value={String(data.droppedCount)} />
          </div>

          <div className="text-[10px] font-mono text-gray-500 break-all">
            pool: [{data.poolFiles.join(", ") || "—"}]
          </div>

          <div className="max-h-72 overflow-y-auto border border-gray-200 rounded">
            <table className="w-full text-[11px] font-mono">
              <thead className="sticky top-0 bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-2 py-1">seq</th>
                  <th className="text-left px-2 py-1">note</th>
                  <th className="text-right px-2 py-1">bytes</th>
                  <th className="text-left px-2 py-1">at</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry) => (
                  <tr
                    key={entry.seq}
                    className={
                      entry.seq === data.pointer ? "bg-purple-100" : undefined
                    }
                  >
                    <td className="px-2 py-1">{entry.seq}</td>
                    <td className="px-2 py-1 font-sans truncate max-w-[160px]">
                      {entry.note}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {entry.hasChangeset
                        ? formatBytes(entry.byteSize)
                        : `${formatBytes(entry.byteSize)} ✕`}
                    </td>
                    <td className="px-2 py-1">{formatTime(entry.createdAt)}</td>
                  </tr>
                ))}
                {data.entries.length === 0 && (
                  <tr>
                    <td
                      className="px-2 py-1 text-gray-500 font-sans"
                      colSpan={4}
                    >
                      No entries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
