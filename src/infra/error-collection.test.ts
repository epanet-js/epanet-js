import { ErrorCollector } from "./error-collection";
import * as errorTracking from "./error-tracking";
import { vi } from "vitest";

describe("ErrorCollector", () => {
  it("collects and batches multiple errors into single Sentry report", () => {
    const captureErrorSpy = vi.spyOn(errorTracking, "captureError");
    const setErrorContextSpy = vi.spyOn(errorTracking, "setErrorContext");
    const collector = new ErrorCollector();

    collector.collectMissingAssetError(
      "123",
      "Node 123",
      "Error: Node 123 missing",
    );
    collector.collectMissingAssetError(
      "456",
      "Pipe 456",
      "Error: Pipe 456 missing",
    );
    collector.collectMissingAssetError(
      "789",
      "Junction 789",
      "Error: Junction 789 missing",
    );

    expect(captureErrorSpy).not.toHaveBeenCalled();
    expect(setErrorContextSpy).not.toHaveBeenCalled();

    collector.flushErrors();

    expect(setErrorContextSpy).toHaveBeenCalledWith(
      "Report Processing Errors",
      {
        totalMissingAssets: 3,
        missingAssets: [
          {
            assetId: "123",
            context: "Node 123",
            reportLine: "Error: Node 123 missing",
          },
          {
            assetId: "456",
            context: "Pipe 456",
            reportLine: "Error: Pipe 456 missing",
          },
          {
            assetId: "789",
            context: "Junction 789",
            reportLine: "Error: Junction 789 missing",
          },
        ],
      },
    );

    expect(captureErrorSpy).toHaveBeenCalledOnce();
    const errorCall = captureErrorSpy.mock.calls[0][0];
    expect(errorCall.message).toBe(
      "Report processing found 3 missing asset reference(s): 123, 456, 789",
    );
  });

  it("does nothing when no errors collected", () => {
    const captureErrorSpy = vi.spyOn(errorTracking, "captureError");
    const collector = new ErrorCollector();

    collector.flushErrors();

    expect(captureErrorSpy).not.toHaveBeenCalled();
  });

  it("resets errors after flushing", () => {
    const captureErrorSpy = vi.spyOn(errorTracking, "captureError");
    const collector = new ErrorCollector();

    collector.collectMissingAssetError(
      "123",
      "Node 123",
      "Error: Node 123 missing",
    );
    collector.flushErrors();

    expect(captureErrorSpy).toHaveBeenCalledOnce();

    collector.flushErrors();

    expect(captureErrorSpy).toHaveBeenCalledOnce();
  });

  it("tracks error state correctly", () => {
    const collector = new ErrorCollector();

    expect(collector.hasErrors()).toBe(false);

    collector.collectMissingAssetError(
      "123",
      "Node 123",
      "Error: Node 123 missing",
    );

    expect(collector.hasErrors()).toBe(true);

    collector.flushErrors();

    expect(collector.hasErrors()).toBe(false);
  });
});
