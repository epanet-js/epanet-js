export class MapBackendUnavailableError extends Error {
  readonly backend: string;

  constructor(backend: string, options?: { cause?: unknown }) {
    super(`Map backend "${backend}" is unavailable`, options);
    this.name = "MapBackendUnavailableError";
    this.backend = backend;
  }
}

export class SourceTypeMismatchError extends Error {
  readonly source: string;
  readonly sourceType: string;

  constructor(source: string, sourceType: string) {
    super(
      `Map source "${source}" is a "${sourceType}" source; expected "geojson"`,
    );
    this.name = "SourceTypeMismatchError";
    this.source = source;
    this.sourceType = sourceType;
  }
}
