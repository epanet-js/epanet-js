//TODO: CHECK LINTER ERRORS
"use client";
import type { MapEngine } from "src/map";
import { MapCanvas } from "src/map/map-canvas";
import { MenuBarPlay } from "src/components/menu-bar";
import Drop from "src/components/drop";
import { Dialogs } from "src/dialogs";
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
import {
  BottomPanel,
  LeftSidePanel,
  RelocatedSidePanel,
  SidePanel,
} from "src/panels";
import { MapContext } from "src/map";
import Notifications from "src/components/notifications";
import { atom, useAtom } from "jotai";
import type { WritableAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import type { DialogState } from "src/state/dialog";
import { defaultSplits, splitsAtom } from "src/state/layout";
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
import { TimestepSpeedWarning } from "./timestep-selector";
import { MapLoading } from "src/map/map-loader";
import { Toolbar } from "src/toolbar/";
import { MapToolbar } from "src/toolbar/map-toolbar";
import { Footer } from "./footer";
import { useHydrateAtoms } from "jotai/utils";
import { TabCloseGuard } from "./tab-close-guard";
import { CommandShortcuts } from "./commands-shortcuts";
import { PanelRegistrations } from "src/panels/panel-registrations";
import { CommandBar } from "./command-bar/command-bar";
import { SimulationPlaybackController } from "./simulation-playback-controller";
import { useUserTracking } from "src/infra/user-tracking";
import { useAuth } from "src/hooks/use-auth";
import { dialogFromUrl } from "src/state/dialog";
import { OfflineGuard } from "./offline-guard";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import { NotificationFromUrl } from "./notification-from-url";
import { setUserContext } from "src/infra/error-tracking";
import { useAppReady } from "src/hooks/use-app-ready";
import { AppLoader } from "./app-loader";
import { PrivacyBanner } from "./privacy-banner";
import { usePrivacySettings } from "src/hooks/use-privacy-settings";
import { initStorage } from "src/infra/storage";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { useIsCustomerAllocationDisabled } from "src/hooks/use-is-customer-allocation-disabled";
import { useSeedDefaultProjectDb } from "src/hooks/persistence/use-start-new-project";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { configureDbStorage } from "src/lib/db/commands/configure-storage";

type ResolvedLayout = "HORIZONTAL" | "VERTICAL" | "FLOATING";

interface Transform {
  x: number;
  y: number;
}

const persistentTransformAtom = atom<Transform>({
  x: 5,
  y: 5,
});

export function EpanetApp() {
  const { isReady, progress } = useAppReady();
  const [map, setMap] = useState<MapEngine | null>(null);
  useWindowResizeSplits();
  const userTracking = useUserTracking();
  const { user, isSignedIn } = useAuth();
  const { enableAllTracking } = usePrivacySettings();
  const hasIdentifiedRef = useRef(false);

  const isEditionBlocked = useIsEditionBlocked();
  const isCustomerAllocationDisabled = useIsCustomerAllocationDisabled();
  const seedDefaultProjectDb = useSeedDefaultProjectDb();
  const isDbInOpfsOn = useFeatureFlag("FLAG_DB_IN_OPFS");
  const dbInitializedRef = useRef(false);

  useEffect(() => {
    void initStorage();
  }, []);

  useEffect(() => {
    if (dbInitializedRef.current) return;
    if (!isReady) return;
    dbInitializedRef.current = true;
    void configureDbStorage(isDbInOpfsOn).then(() => seedDefaultProjectDb());
  }, [isReady, seedDefaultProjectDb, isDbInOpfsOn]);

  useEffect(() => {
    if (isSignedIn && user && !hasIdentifiedRef.current) {
      if (!userTracking.isIdentified()) {
        enableAllTracking();
        userTracking.identify(user);
        userTracking.reloadFeatureFlags();
        setUserContext({
          id: user.id as string,
          email: user.email,
          plan: user.plan,
        });
        hasIdentifiedRef.current = true;
      }
    }

    if (!isSignedIn && hasIdentifiedRef.current) {
      if (userTracking.isIdentified()) {
        userTracking.capture({ name: "logOut.completed" });
        userTracking.reset();
        localStorage.clear();
        setUserContext(null);
        hasIdentifiedRef.current = false;
      }
    }
  }, [isSignedIn, user, userTracking, enableAllTracking]);

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
      dialogAtom as WritableAtom<DialogState, [DialogState], void>,
      (dialogFromUrl() ?? { type: "welcome" }) as DialogState,
    ],
    [splitsAtom, { ...defaultSplits, rightOpen: isMdOrLarger }],
  ] as const);

  if (!isReady) {
    return <AppLoader progress={progress} />;
  }

  return (
    <main className={"custom-cursor-family h-dvh flex flex-col bg-popover"}>
      <MapContext.Provider value={map}>
        <div className="h-24">
          <MenuBarPlay />
          <Toolbar
            readonly={isEditionBlocked}
            customerAllocationDisabled={isCustomerAllocationDisabled}
          />
        </div>
        <div
          className={clsx(
            layout === "VERTICAL" && "flex-col h-full",
            "flex grow relative border-t dark:border-gray-900",
            "pb-10",
          )}
        >
          {layout === "HORIZONTAL" && <LeftSidePanel />}
          <div className="flex-auto flex flex-col relative min-w-0">
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
                readonly={isEditionBlocked}
              />
            </DndContext>
            {layout === "HORIZONTAL" && <BottomPanel />}
            {layout === "VERTICAL" && <RelocatedSidePanel />}
          </div>
          {layout === "HORIZONTAL" && (
            <>
              <SidePanel />
              <Resizer side="left" isToggleAllowed={false} />
              <Resizer side="right" isToggleAllowed={false} />
            </>
          )}
        </div>
        <Drop />
        <Dialogs />
        <CommandBar />
        <PanelRegistrations />
        <Suspense fallback={null}>
          <CommandShortcuts />
          <SimulationPlaybackController />
        </Suspense>
        <Notifications />
        <Footer />
      </MapContext.Provider>
      <TabCloseGuard />
      <OfflineGuard />
      <NotificationFromUrl />
      <PrivacyBanner />
    </main>
  );
}

function DraggableMap({
  setMap,
  layout,
  persistentTransform,
  readonly = false,
}: {
  setMap: (arg0: MapEngine | null) => void;
  layout: ResolvedLayout;
  persistentTransform: Transform;
  readonly?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { setNodeRef, transform } = useDraggable({
    id: "map",
  });
  const isSmOrLarger = useBreakpoint("sm");

  useMapResize(containerRef.current, layout);

  return (
    <div
      className={clsx(
        layout === "FLOATING"
          ? "overflow-hidden absolute w-64 h-64 flex z-50 rounded-sm border border-gray-500 shadow-lg"
          : "relative flex-auto flex flex-col",
        "drawing-toolbar-controls",
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
      <div className="absolute flex flex-col gap-1 items-end top-2 right-2">
        <TimestepSpeedWarning />
        <MapLoading />
      </div>
      {isSmOrLarger && <MapToolbar readonly={readonly} />}
    </div>
  );
}

function useMapResize(element: HTMLElement | null, layout: ResolvedLayout) {
  const mapEngine = useContext(MapContext);

  useLayoutEffect(() => {
    if (element) {
      element.style.width = "";
      element.style.height = "";
    }
    mapEngine?.safeResize();
  }, [element, mapEngine, layout]);

  useLayoutEffect(() => {
    if (element) {
      const callback = debounce((entries: ResizeObserverEntry[]) => {
        if (!Array.isArray(entries)) {
          return;
        }

        if (!entries.length) {
          return;
        }

        mapEngine?.safeResize();
      }, 50);

      const resizeObserver = new ResizeObserver(callback);
      resizeObserver.observe(element, { box: "border-box" });
      return () => resizeObserver.unobserve(element);
    } else {
      // Nothing
    }
  }, [element, mapEngine, layout]);
}
