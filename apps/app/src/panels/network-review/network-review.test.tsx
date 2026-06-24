import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { createStore, Provider as JotaiProvider } from "jotai";
import { stubFeatureOn, stubFeatureOff } from "src/__helpers__/feature-flags";
import { dialogAtom } from "src/state/dialog";
import { selectedReviewCheckAtom } from "src/state/network-review";
import { CheckType } from "./common";
import { NetworkReview } from "./network-review";

vi.mock("./model-attributes-validation", () => ({
  ModelAttributesValidation: () => <div>model-attributes-validation-panel</div>,
}));
vi.mock("./orphan-assets", () => ({ OrphanAssets: () => null }));
vi.mock("./proximity-anomalies", () => ({ ProximityAnomalies: () => null }));
vi.mock("./crossing-pipes", () => ({ CrossingPipes: () => null }));
vi.mock("./connectivity-trace", () => ({ ConnectivityTrace: () => null }));
vi.mock("src/components/early-access-badge", () => ({
  EarlyAccessBadge: () => null,
}));
vi.mock("src/hooks/use-early-access", () => ({
  useEarlyAccess: () => (cb: () => void) => cb(),
}));
vi.mock("src/infra/user-tracking", () => ({
  useUserTracking: () => ({ capture: vi.fn() }),
}));

let canValidateModelAttributes = false;
vi.mock("src/hooks/use-permissions", () => ({
  usePermissions: () => ({ canValidateModelAttributes }),
}));

const renderPanel = (store = createStore()) => {
  render(
    <JotaiProvider store={store}>
      <NetworkReview />
    </JotaiProvider>,
  );
  return store;
};

describe("NetworkReview", () => {
  beforeEach(() => {
    canValidateModelAttributes = false;
    stubFeatureOff("FLAG_ATTRIBUTES_VALIDATION");
  });

  it("lists the model validation check when the flag and permission are on", () => {
    canValidateModelAttributes = true;
    stubFeatureOn("FLAG_ATTRIBUTES_VALIDATION");

    renderPanel();

    expect(
      screen.getByRole("button", { name: "Model attributes" }),
    ).toBeInTheDocument();
  });

  it("hides the model validation check when the flag is off", () => {
    stubFeatureOff("FLAG_ATTRIBUTES_VALIDATION");
    canValidateModelAttributes = true;

    renderPanel();

    expect(
      screen.queryByRole("button", { name: "Model attributes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Orphan assets" }),
    ).toBeInTheDocument();
  });

  it("opens the (paywalled) panel when the permission is missing", () => {
    stubFeatureOn("FLAG_ATTRIBUTES_VALIDATION");
    canValidateModelAttributes = false;

    const store = renderPanel();
    const check = screen.getByRole("button", { name: "Model attributes" });
    expect(check).toBeInTheDocument();

    fireEvent.click(check);

    // The panel opens (the paywall lives inside it); no upgrade dialog here.
    expect(
      screen.getByText("model-attributes-validation-panel"),
    ).toBeInTheDocument();
    expect(store.get(dialogAtom)).toBeNull();
  });

  it("deep-links to the model validation panel from the atom", () => {
    const store = createStore();
    store.set(selectedReviewCheckAtom, CheckType.modelAttributesValidation);

    renderPanel(store);

    expect(
      screen.getByText("model-attributes-validation-panel"),
    ).toBeInTheDocument();
  });
});
