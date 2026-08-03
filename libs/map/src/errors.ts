export class MapBackendUnavailableError extends Error {
  readonly backend: string;

  constructor(backend: string, options?: { cause?: unknown }) {
    super(`Map backend "${backend}" is unavailable`, options);
    this.name = "MapBackendUnavailableError";
    this.backend = backend;
  }
}
