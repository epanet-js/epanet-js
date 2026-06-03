import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ModelBuilderIframeDialog } from "./model-builder-iframe";

const v1Url = vi.hoisted(
  () => "https://v1.example/model-builder?embedded=true",
);

vi.mock("src/global-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("src/global-config")>()),
  modelBuilderUrl: v1Url,
}));

vi.mock("src/commands/import-inp", () => ({
  useImportInp: () => vi.fn(),
}));
vi.mock("src/commands/check-unsaved-changes", () => ({
  useUnsavedChangesCheck: () => vi.fn(),
}));
vi.mock("src/commands/toggle-network-review", () => ({
  useToggleNetworkReview: () => vi.fn(),
}));
vi.mock("src/infra/user-tracking", () => ({
  useUserTracking: () => ({ capture: vi.fn() }),
}));

describe("ModelBuilderIframeDialog (v1)", () => {
  it("loads the legacy model-builder URL", () => {
    render(<ModelBuilderIframeDialog onClose={vi.fn()} />);

    expect(screen.getByTitle<HTMLIFrameElement>("Import from GIS").src).toBe(
      v1Url,
    );
  });
});
