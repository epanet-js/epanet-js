//TODO: CHECK LINTER ERRORS
"use client";
import type { MapEngine } from "src/map";
import { MapCanvas } from "src/map/map-canvas";
import { MenuBarPlay } from "src/components/menu_bar";
import Drop from "src/components/drop";
import { Dialogs } from "src/components/dialogs";
import { CSS } from "@dnd-kit/utilities";
import React, {
  Suspense,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Resizer, useWindowResizeSplits } from "src/components/resizer";
import { BottomPanel, SidePanel } from "src/components/panels";
import { MapContext } from "src/map";
import Notifications from "src/components/notifications";
import { atom, useAtom } from "jotai";
import { defaultSplits, dialogAtom, splitsAtom } from "src/state/jotai";
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
import { Legends } from "./legends";
import { Toolbar } from "./toolbar/toolbar";
import { Footer } from "./footer";
import { useHydrateAtoms } from "jotai/utils";
import { isFeatureOn } from "src/infra/feature-flags";
import { settingsFromStorage } from "src/state/user-settings";
import { TabCloseGuard } from "./tab-close-guard";
import { CommandShortcuts } from "./commands-shortcuts";
import { useUserTracking } from "src/infra/user-tracking";
import { useAuth } from "src/auth";
import { dialogFromUrl } from "src/state/dialog";
import { OfflineGuard } from "./offline-guard";
import { useBreakpoint } from "src/hooks/use-breakpoint";

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
  const userTracking = useUserTracking();
  const { user, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn && user && !userTracking.isIdentified()) {
      userTracking.identify(user);
    }

    if (!isSignedIn && userTracking.isIdentified()) {
      userTracking.capture({ name: "logOut.completed" });
      userTracking.reset();
    }
  }, [isSignedIn, user, userTracking]);

  const isSmOrLarger = useBreakpoint("sm");
  const isMdOrLarger = useBreakpoint("md");

  const layout: ResolvedLayout = isSmOrLarger ? "HORIZONTAL" : "VERTICAL";

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

  useHydrateAtoms([
    [
      dialogAtom,
      isFeatureOn("FLAG_UPGRADE") && dialogFromUrl()
        ? dialogFromUrl()
        : settingsFromStorage().showWelcomeOnStart ||
            (isFeatureOn("FLAG_RESPONSIVE") && !isMdOrLarger)
          ? { type: "welcome" }
          : null,
    ],
    [
      splitsAtom,
      {
        ...defaultSplits,
        rightOpen: !isFeatureOn("FLAG_RESPONSIVE") || isMdOrLarger,
      },
    ],
  ]);

  return (
    <main className="h-dvh flex flex-col bg-white dark:bg-gray-800">
      <MapContext.Provider value={map}>
        <div className="h-24">
          <MenuBarPlay />
          <Toolbar />
        </div>
        <div
          className={clsx(
            layout === "VERTICAL" && "flex-col h-full",
            "flex flex-grow relative border-t border-gray-200 dark:border-gray-900",
            !isFeatureOn("FLAG_RESPONSIVE") || isSmOrLarger ? "pb-10" : "",
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
          {layout === "HORIZONTAL" && (
            <>
              <SidePanel />
              <Resizer side="right" />
            </>
          )}
          {layout === "VERTICAL" && <BottomPanel />}
        </div>
        <Drop />
        <Dialogs />
        <Suspense fallback={null}>
          <CommandShortcuts />
        </Suspense>
        <Notifications />
        <Footer />
      </MapContext.Provider>
      <TabCloseGuard />
      <OfflineGuard />
    </main>
  );
}

function DraggableMap({
  setMap,
  layout,
  persistentTransform,
}: {
  setMap: (arg0: MapEngine | null) => void;
  layout: ResolvedLayout;
  persistentTransform: Transform;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { setNodeRef, transform } = useDraggable({
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
      <Legends />
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
