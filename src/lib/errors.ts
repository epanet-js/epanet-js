import { Either } from "purify-ts/Either";
import { JsonValue } from "type-fest";
import { ERROR_CODES } from "src/lib/constants";

export class PlacemarkError extends Error {
  name = "PlacemarkError";
}

export class ConvertError extends PlacemarkError {
  name = "ConvertError";
}

export class GeometryError extends PlacemarkError {
  name = "GeometryError";
}

export class QuotaError extends PlacemarkError {
  name = "QuotaError";
}

export class SSOError {
  code: keyof typeof ERROR_CODES;
  constructor(code: keyof typeof ERROR_CODES) {
    this.code = code;
  }
}

export function parseOrError<T = JsonValue>(str: string) {
  return Either.encase(() => {
    return JSON.parse(str) as T;
  });
}

export const formatErrorDetails = (e: unknown): string => {
  if (!(e instanceof Error)) return String(e);
  const head = e.stack ?? `${e.name}: ${e.message}`;
  if (e.cause !== undefined) {
    return `${head}\nCaused by: ${formatErrorDetails(e.cause)}`;
  }
  return head;
};
