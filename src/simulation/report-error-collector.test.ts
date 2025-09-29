import { ReportErrorCollector } from "./report-error-collector";
import * as errorTracking from "src/infra/error-tracking";
import { vi } from "vitest";

describe("ReportErrorCollector", () => {
  it("collects and batches multiple lines with issues into single Sentry report", () => {
    const captureErrorSpy = vi.spyOn(errorTracking, "captureError");
    const setErrorContextSpy = vi.spyOn(errorTracking, "setErrorContext");
    const collector = new ReportErrorCollector();

    collector.collectLineWithIssue("Error: Node 123 missing", "missing_asset");
    collector.collectLineWithIssue("Error: Pipe 456 missing", "missing_asset");
    collector.collectLineWithIssue("Malformed line xyz", "parse_error");

    expect(captureErrorSpy).not.toHaveBeenCalled();
    expect(setErrorContextSpy).not.toHaveBeenCalled();

    collector.flushErrors();

    expect(setErrorContextSpy).toHaveBeenCalledWith(
      "Report Processing Issues",
      {
        totalLinesWithIssues: 3,
        reportLines: [
          "Error: Node 123 missing",
          "Error: Pipe 456 missing",
          "Malformed line xyz",
        ],
        reasons: ["missing_asset", "missing_asset", "parse_error"],
      },
    );

    expect(captureErrorSpy).toHaveBeenCalledOnce();
    const errorCall = captureErrorSpy.mock.calls[0][0];
    expect(errorCall.message).toBe(
      "Report processing encountered 3 lines with issues",
    );
  });

  it("does nothing when no lines with issues collected", () => {
    const captureErrorSpy = vi.spyOn(errorTracking, "captureError");
    const collector = new ReportErrorCollector();

    collector.flushErrors();

    expect(captureErrorSpy).not.toHaveBeenCalled();
  });

  it("resets lines after flushing", () => {
    const captureErrorSpy = vi.spyOn(errorTracking, "captureError");
    const collector = new ReportErrorCollector();

    collector.collectLineWithIssue("Error: Node 123 missing", "missing_asset");
    collector.flushErrors();

    expect(captureErrorSpy).toHaveBeenCalledOnce();

    collector.flushErrors();

    expect(captureErrorSpy).toHaveBeenCalledOnce();
  });

  it("tracks error state correctly", () => {
    const collector = new ReportErrorCollector();

    expect(collector.hasErrors()).toBe(false);

    collector.collectLineWithIssue("Error: Node 123 missing", "missing_asset");

    expect(collector.hasErrors()).toBe(true);

    collector.flushErrors();

    expect(collector.hasErrors()).toBe(false);
  });
});
