//TODO: CHECK LINTER ERRORS
/* eslint-disable */
"use client";
import type { MapEngine } from 'src/map'
import { MapCanvas } from "src/map/MapCanvas";
import { Divider, MenuBarPlay } from "src/components/menu_bar";
import Drop from "src/components/drop";
import Modes from "src/components/modes";
import { Dialogs } from "src/components/dialogs";
import { CSS } from "@dnd-kit/utilities";
import ContextActions from "src/components/context_actions";
import React, {
  Suspense,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  BottomResizer,
  Resizer,
  useBigScreen,
  useWindowResizeSplits,
} from "src/components/resizer";
import { BottomPanel, SidePanel } from "src/components/panels";
import { Keybindings } from "src/components/keybindings";
import { MapContext } from "src/map";
import Notifications from "src/components/notifications";
import { Visual } from "./visual";
import { ErrorBoundary } from "@sentry/nextjs";
import { CheckCircledIcon, CheckIcon, CrossCircledIcon, DividerVerticalIcon, MoveIcon, ShadowInnerIcon, UpdateIcon } from "@radix-ui/react-icons";
import { Button } from "./elements";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { dataAtom, dialogAtom, splitsAtom } from "src/state/jotai";
import clsx from "clsx";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import debounce from "lodash/debounce";
import { useSearchParams } from "next/navigation";
import { useImportFile, useImportString } from "src/hooks/use_import";
import toast from "react-hot-toast";
import { DEFAULT_IMPORT_OPTIONS, detectType } from "src/lib/convert";
import { match } from "ts-pattern";
import {SimulationButton, SimulationStatusText} from './simulation-components';
import {isFeatureOn} from 'src/infra/feature-flags';
import {AnalysisLegends} from './AnalysisLegends';
import {Toolbar} from './toolbar/Toolbar';

type ResolvedLayout = "HORIZONTAL" | "VERTICAL" | "FLOATING";

interface Transform {
  x: number;
  y: number;
}

const persistentTransformAtom = atom<Transform>({
  x: 5,
  y: 5,
});


export function PlacemarkPlay() {
  const [map, setMap] = useState<MapEngine | null>(null);
  useWindowResizeSplits();
  const splits = useAtomValue(splitsAtom);
  const isBigScreen = useBigScreen();

  let layout: ResolvedLayout = "HORIZONTAL";

  switch (splits.layout) {
    case "VERTICAL":
      layout = "VERTICAL";
      break;
    case "AUTO":
      layout = isBigScreen ? "HORIZONTAL" : "VERTICAL";
      break;
    case "FLOATING": {
      layout = "FLOATING";
      break;
    }
  }

  const sensor = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 2,
      },
    }),
  );

  const [persistentTransform, setPersistentTransform] = useAtom(
    persistentTransformAtom,
  );

  return (
    <main className="h-screen flex flex-col bg-white dark:bg-gray-800">
      <MapContext.Provider value={map}>
        <ErrorBoundary
          fallback={(props) => {
            return (
              <div className="h-20 flex items-center justify-center px-2 gap-x-2">
                An error occurred
                <Button onClick={() => props.resetError()}>
                  <UpdateIcon /> Try again
                </Button>
              </div>
            );
          }}
        >
          <div className="h-24">
            <MenuBarPlay />
            <Toolbar />
          </div>
        </ErrorBoundary>
        <div
          className={clsx(
            layout === "VERTICAL" && "flex-col",
            "flex flex-grow pb-8 relative border-t border-gray-200 dark:border-gray-900",
          )}
        >
          <DndContext
            sensors={sensor}
            modifiers={[restrictToWindowEdges]}
            onDragEnd={(end) => {
              setPersistentTransform((transform) => {
                return {
                  x: transform.x + end.delta.x,
                  y: transform.y + end.delta.y,
                };
              });
            }}
          >
            <DraggableMap
              persistentTransform={persistentTransform}
              setMap={setMap}
              layout={layout}
            />
          </DndContext>
          <SidePanel />
          <Resizer side="right" />
        </div>
        <Drop />
        <Dialogs />
        <Suspense fallback={null}>
          <Keybindings />
        </Suspense>
        <Notifications />
        {isFeatureOn('FLAG_HEADLOSS') && <BottomBar />}
      </MapContext.Provider>
    </main>
  );
}

const BottomBar = () => {
  const { hydraulicModel, modelMetadata } = useAtomValue(dataAtom)

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-300 shadow-md ">
      <div className="flex flex-row items-center text-xs text-gray-500 space-x-1">
        <span className="px-4">Auto-Length: On</span>
        <div className="border-r-2 border-gray-100 h-8"></div>
        <span className="px-4">Units: {modelMetadata.quantities.specName}</span>
        <div className="border-r-2 border-gray-100 h-8"></div>
        <span className="px-4">Headloss: {hydraulicModel.headlossFormula}</span>
        <div className="border-r-2 border-gray-100 h-8"></div>
        <span className="px-1"><SimulationStatusText /></span>
      </div>
    </nav>
  );
}

function DraggableMap({
  setMap,
  layout,
  persistentTransform,
}: {
  setMap: (arg0:  MapEngine | null) => void;
  layout: ResolvedLayout;
  persistentTransform: Transform;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: "map",
  });

  useMapResize(containerRef.current, layout);

  return (
    <div
      className={clsx(
        layout === "FLOATING"
          ? "overflow-hidden absolute w-64 h-64 flex z-50 rounded border border-gray-500 shadow-lg"
          : "relative flex-auto flex flex-col",
      )}
      ref={(elem) => {
        setNodeRef(elem);
        containerRef.current = elem;
      }}
      style={
        layout === "FLOATING"
          ? {
              resize: "both",
              transform: CSS.Transform.toString(transform),
              top: persistentTransform.y,
              left: persistentTransform.x,
            }
          : {}
      }
    >
      <div className="flex-auto relative">
        <MapCanvas setMap={setMap} />
      </div>
      <AnalysisLegends />
    </div>
  );
}

function useMapResize(element: HTMLElement | null, layout: ResolvedLayout) {
  const pmap = useContext(MapContext);

  useLayoutEffect(() => {
    if (element) {
      element.style.width = "";
      element.style.height = "";
    }
    pmap?.map?.resize();
  }, [element, pmap, layout]);

  useLayoutEffect(() => {
    if (element) {
      const callback = debounce((entries: ResizeObserverEntry[]) => {
        if (!Array.isArray(entries)) {
          return;
        }

        if (!entries.length) {
          return;
        }

        pmap?.map?.resize();
      }, 50);

      const resizeObserver = new ResizeObserver(callback);
      resizeObserver.observe(element, { box: "border-box" });
      return () => resizeObserver.unobserve(element);
    } else {
      // Nothing
    }
  }, [element, pmap, layout]);
}
