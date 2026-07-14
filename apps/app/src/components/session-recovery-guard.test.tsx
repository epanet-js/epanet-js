import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { projectFileInfoAtom } from "src/state/file-system";
import { sessionRecoveryActiveAtom } from "src/state/session-recovery";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import * as sessionRecovery from "src/infra/session-recovery";
import { SessionRecoveryGuard } from "./session-recovery-guard";

describe("session recovery guard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rewrites the fingerprint on every model change", () => {
    const writeFingerprint = vi
      .spyOn(sessionRecovery, "writeRecoveryFingerprint")
      .mockImplementation(() => {});
    stubClock([1000, 2000]);

    const hydraulicModel = HydraulicModelBuilder.with().aJunction(1).build();
    const store = setInitialState({ hydraulicModel });
    store.set(sessionRecoveryActiveAtom, true);
    store.set(projectFileInfoAtom, {
      name: "my-project.ejsdb",
      modelVersion: hydraulicModel.version,
      lastSavedAt: 500,
    });

    render(
      <JotaiProvider store={store}>
        <SessionRecoveryGuard />
      </JotaiProvider>,
    );

    expect(writeFingerprint).not.toHaveBeenCalled();

    act(() => {
      store.set(stagingModelDerivedAtom, {
        ...hydraulicModel,
        version: "first-edit",
      });
    });

    act(() => {
      store.set(stagingModelDerivedAtom, {
        ...hydraulicModel,
        version: "second-edit",
      });
    });

    expect(writeFingerprint).toHaveBeenCalledTimes(2);
    expect(writeFingerprint.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        projectName: "my-project.ejsdb",
        timestampLastModelChange: 1000,
        timestampLastSave: 500,
      }),
    );
    expect(writeFingerprint.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        timestampLastModelChange: 2000,
        timestampLastSave: 500,
      }),
    );
  });

  it("keeps the last save undefined for a project never saved", () => {
    const writeFingerprint = vi
      .spyOn(sessionRecovery, "writeRecoveryFingerprint")
      .mockImplementation(() => {});
    stubClock([1000]);

    const hydraulicModel = HydraulicModelBuilder.with().aJunction(1).build();
    const store = setInitialState({ hydraulicModel });
    store.set(sessionRecoveryActiveAtom, true);
    store.set(projectFileInfoAtom, {
      name: "my-project.ejsdb",
      modelVersion: "already-stale",
    });

    render(
      <JotaiProvider store={store}>
        <SessionRecoveryGuard />
      </JotaiProvider>,
    );

    expect(writeFingerprint).toHaveBeenCalledTimes(1);
    expect(writeFingerprint.mock.calls[0][0].timestampLastSave).toBeUndefined();
  });
});

const stubClock = (timestamps: number[]) => {
  let call = 0;
  vi.spyOn(Date, "now").mockImplementation(
    () => timestamps[Math.min(call++, timestamps.length - 1)],
  );
};
