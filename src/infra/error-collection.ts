import { captureError, setErrorContext } from "./error-tracking";

type CollectedError = {
  assetId: string;
  match: string;
  reportLine: string;
};

export class ErrorCollector {
  private errors: CollectedError[] = [];

  collectMissingAssetError(assetId: string, match: string, reportLine: string) {
    this.errors.push({ assetId, match, reportLine });
  }

  flushErrors() {
    if (this.errors.length === 0) return;

    const errorContext = {
      totalMissingAssets: this.errors.length,
      missingAssets: this.errors.map((e) => ({
        assetId: e.assetId,
        context: e.match,
        reportLine: e.reportLine,
      })),
    };

    setErrorContext("Report Processing Errors", errorContext);

    const errorMessage = `Report processing found ${this.errors.length} missing asset reference(s): ${this.errors.map((e) => e.assetId).join(", ")}`;

    captureError(new Error(errorMessage));
    this.errors = [];
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }
}
