import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { ModelBuilderV2IframeDialog } from "./model-builder-v2-iframe";

const v2Url = vi.hoisted(() => "https://v2.example/?embedded=true");
const openProjectFile = vi.hoisted(() => vi.fn());

vi.mock("src/global-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("src/global-config")>()),
  modelBuilderV2Url: v2Url,
}));

vi.mock("src/commands/open-project", () => ({
  useOpenProjectFile: () => openProjectFile,
}));
vi.mock("src/commands/save-project", () => ({
  projectExtension: ".ejsdb",
}));
vi.mock("src/commands/check-unsaved-changes", () => ({
  // run the guarded callback immediately
  useUnsavedChangesCheck: () => (cb: () => void) => cb(),
}));
vi.mock("src/infra/user-tracking", () => ({
  useUserTracking: () => ({ capture: vi.fn() }),
}));

// The iframe envelope is { type, data: { source, ... } }.
const postMessageToWindow = (envelope: {
  type: string;
  data: Record<string, unknown>;
}) => {
  const event = new Event("message");
  (event as unknown as { data: unknown }).data = envelope;
  window.dispatchEvent(event);
};

const postFromModelBuilder = (type: string, data: Record<string, unknown>) =>
  postMessageToWindow({
    type,
    data: { ...data, source: "epanet-model-builder" },
  });

describe("ModelBuilderV2IframeDialog (v2)", () => {
  beforeEach(() => {
    openProjectFile.mockReset();
  });

  it("loads the v2 model-builder URL", () => {
    render(<ModelBuilderV2IframeDialog onClose={vi.fn()} />);

    expect(screen.getByTitle<HTMLIFrameElement>("Import from GIS").src).toBe(
      v2Url,
    );
  });

  it("opens the received .ejsdb as a project", async () => {
    render(<ModelBuilderV2IframeDialog onClose={vi.fn()} />);

    const ejsdbBytes = new Uint8Array([1, 2, 3, 4]);
    postFromModelBuilder("modelBuildEjsdbComplete", {
      ejsdbBytes,
      timestamp: "2026-06-03T00:00:00.000Z",
    });

    await waitFor(() => expect(openProjectFile).toHaveBeenCalledTimes(1));
    const [file, source] = openProjectFile.mock.calls[0];
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toMatch(/\.ejsdb$/);
    expect(source).toBe("modelBuilder");
  });

  it("ignores messages from other sources", () => {
    render(<ModelBuilderV2IframeDialog onClose={vi.fn()} />);

    postMessageToWindow({
      type: "modelBuildEjsdbComplete",
      data: {
        ejsdbBytes: new Uint8Array([1]),
        timestamp: "2026-06-03T00:00:00.000Z",
        source: "someone-else",
      },
    });

    expect(openProjectFile).not.toHaveBeenCalled();
  });
});
