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
  useMemo,
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
import { MapContext } from "src/map";
import Notifications from "src/components/notifications";
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
import toast from "react-hot-toast";
import { DEFAULT_IMPORT_OPTIONS, detectType } from "src/lib/convert";
import { match } from "ts-pattern";
import {Legends} from './legends';
import {Toolbar} from './toolbar/toolbar';
import {translate} from 'src/infra/i18n';
import {Footer} from './footer';
import {useHydrateAtoms} from 'jotai/utils';
import {isFeatureOn} from 'src/infra/feature-flags';
import {settingsFromStorage} from 'src/state/user-settings';
import {TabCloseGuard} from './tab-close-guard';
import {CommandShortcuts} from './commands-shortcuts';
import {useUserTracking} from 'src/infra/user-tracking';
import {useAuth} from 'src/auth';
import {dialogFromUrl} from 'src/state/dialog';

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
  const userTracking = useUserTracking()
  const { user, isSignedIn } = useAuth()

  useEffect(() => {
    if (isSignedIn && user && !userTracking.isIdentified()) {
      userTracking.identify(user)
    }

    if (!isSignedIn && userTracking.isIdentified()) {
      userTracking.capture({ name: "logOut.completed" })
      userTracking.reset()
    }
  }, [isSignedIn, user, userTracking])

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


  useHydrateAtoms([
    [dialogAtom,
    isFeatureOn('FLAG_UPGRADE') &&  dialogFromUrl()
      ? dialogFromUrl()
      : settingsFromStorage().showWelcomeOnStart
        ? { type: "welcome" }
        : null,
  ]])

  return (
    <main className="h-screen flex flex-col bg-white dark:bg-gray-800">
      <MapContext.Provider value={map}>
          <div className="h-24">
            <MenuBarPlay />
            <Toolbar />
          </div>
        <div
          className={clsx(
            layout === "VERTICAL" && "flex-col",
              "flex flex-grow pb-10 relative border-t border-gray-200 dark:border-gray-900"
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
          <CommandShortcuts />
        </Suspense>
        <Notifications />
        <Footer />
      </MapContext.Provider>
      <TabCloseGuard />
    </main>
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
