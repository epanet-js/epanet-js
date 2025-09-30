import { captureError, setErrorContext } from "src/infra/error-tracking";

export class ReportErrorCollector {
  private linesWithIssues: string[] = [];

  collectMissingAssetId(
    reportLine: string,
    match: string,
    id: string,
    regexp: string,
  ) {
    this.linesWithIssues.push(
      JSON.stringify({
        reportLine,
        reason: "missing_asset",
        match,
        id,
        regexp,
      }),
    );
  }

  flushErrors() {
    if (this.linesWithIssues.length === 0) return;

    setErrorContext("Report Processing Issues", this.linesWithIssues);

    const errorMessage = `Report processing encountered ${this.linesWithIssues.length} lines with issues`;

    captureError(new Error(errorMessage));
    this.linesWithIssues = [];
  }

  hasErrors(): boolean {
    return this.linesWithIssues.length > 0;
  }
}
