export type CollectedError = {
  reportLine: string;
  reason: string;
  match: string;
  id: string;
  regexp: string;
};

export class ReportErrorCollector {
  private linesWithIssues: CollectedError[] = [];

  collectMissingAssetId(
    reportLine: string,
    match: string,
    id: string,
    regexp: string,
  ) {
    this.linesWithIssues.push({
      reportLine,
      reason: "missing_asset",
      match,
      id,
      regexp,
    });
  }

  getErrors(): CollectedError[] {
    return this.linesWithIssues;
  }

  hasErrors(): boolean {
    return this.linesWithIssues.length > 0;
  }
}
