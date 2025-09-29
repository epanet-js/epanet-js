import { captureError, setErrorContext } from "src/infra/error-tracking";

type LineWithIssue = {
  reportLine: string;
  reason: string;
};

export class ReportErrorCollector {
  private linesWithIssues: LineWithIssue[] = [];

  collectLineWithIssue(reportLine: string, reason: string) {
    this.linesWithIssues.push({ reportLine, reason });
  }

  flushErrors() {
    if (this.linesWithIssues.length === 0) return;

    const errorContext = {
      totalLinesWithIssues: this.linesWithIssues.length,
      reportLines: this.linesWithIssues.map((line) => line.reportLine),
      reasons: this.linesWithIssues.map((line) => line.reason),
    };

    setErrorContext("Report Processing Issues", errorContext);

    const errorMessage = `Report processing encountered ${this.linesWithIssues.length} lines with issues`;

    captureError(new Error(errorMessage));
    this.linesWithIssues = [];
  }

  hasErrors(): boolean {
    return this.linesWithIssues.length > 0;
  }
}
