import { createStore } from "jotai";
import { stubUserTracking } from "src/__helpers__/user-tracking";
import { ephemeralStateAtom } from "src/state/drawing";
import { hglProfileAtom } from "src/state/hgl-profile";
import { Mode, modeAtom } from "src/state/mode";
import { createHglProfilePanel } from "./create-panel";
import { hglProfilePanel } from "./panel";

const aProfile = () => ({
  id: "p1",
  anchors: [1, 2],
  terrain: null,
  isUnprojected: false,
});

const contextFor = (store: ReturnType<typeof createStore>) => ({
  get: store.get,
  set: store.set,
  userTracking: stubUserTracking(),
});

describe("hglProfilePanel.onDeactivate", () => {
  it("clears the in-progress selection from the map", () => {
    const store = createStore();
    store.set(ephemeralStateAtom, { type: "hglProfile" });
    store.set(modeAtom, { mode: Mode.HGL_PROFILE });

    hglProfilePanel.onDeactivate?.(contextFor(store), createHglProfilePanel());

    expect(store.get(ephemeralStateAtom)).toEqual({ type: "none" });
    expect(store.get(modeAtom).mode).toBe(Mode.NONE);
  });

  it("leaves an unrelated draft alone", () => {
    const store = createStore();
    store.set(ephemeralStateAtom, {
      type: "drawLink",
      startNodeId: 1,
    } as never);

    hglProfilePanel.onDeactivate?.(contextFor(store), createHglProfilePanel());

    expect(store.get(ephemeralStateAtom)).toMatchObject({ type: "drawLink" });
  });

  it("keeps the committed profile so it returns on the way back", () => {
    const store = createStore();
    store.set(hglProfileAtom, aProfile());

    hglProfilePanel.onDeactivate?.(contextFor(store), createHglProfilePanel());

    expect(store.get(hglProfileAtom)).not.toBeNull();
  });
});

describe("hglProfilePanel.onClose", () => {
  it("discards the committed profile", () => {
    const store = createStore();
    store.set(hglProfileAtom, aProfile());

    hglProfilePanel.onClose?.(contextFor(store), createHglProfilePanel());

    expect(store.get(hglProfileAtom)).toBeNull();
  });
});
