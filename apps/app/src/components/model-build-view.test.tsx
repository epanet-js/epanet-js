import { act, render } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { vi } from "vitest";
import { contentViewAtom } from "src/state/content-view";
import { ModelBuildView } from "./model-build-view";

vi.mock("src/hooks/use-feature-flags", () => ({
  useEnabledFeatureFlags: () => [],
  useFeatureFlag: () => false,
}));
vi.mock("src/commands/open-project", () => ({
  useOpenProjectFile: () => vi.fn(),
}));
vi.mock("src/infra/user-tracking", () => ({
  useUserTracking: () => ({ capture: vi.fn() }),
}));

const postStepFromModelBuilder = (step: string) => {
  const event = new Event("message");
  (event as unknown as { data: unknown }).data = {
    type: "contextChanged",
    data: { source: "epanet-model-builder", context: { step } },
  };
  window.dispatchEvent(event);
};

describe("ModelBuildView", () => {
  it("does not reopen on a step change sent after exiting", () => {
    const store = createStore();
    store.set(contentViewAtom, { type: "modelBuild", step: null });
    render(
      <JotaiProvider store={store}>
        <ModelBuildView />
      </JotaiProvider>,
    );

    act(() => postStepFromModelBuilder("dataSources"));
    expect(store.get(contentViewAtom)).toEqual({
      type: "modelBuild",
      step: "dataSources",
    });

    act(() => store.set(contentViewAtom, null));
    act(() => postStepFromModelBuilder("layerAssignment"));

    expect(store.get(contentViewAtom)).toBeNull();
  });
});
