import type { Either } from "purify-ts/Either";
import { EitherAsync } from "purify-ts/EitherAsync";
import { Promisable } from "type-fest";
import { SafeParseReturnType, z } from "zod";
import { Just, Maybe, Nothing } from "purify-ts/Maybe";
import { ILayerConfig } from "src/types";
import { zTileJSON } from "./tile-json";

/**
 * Used for the "title" tag so that if we change
 * the style in the future it can be changed in one place.
 */
export function formatTitle(title: string): string {
  return `${title} | epanet-js`;
}

/**
 * Interpolate between v0 and v1 based on t.
 * t should be between 0 and 1 (inclusive).
 * https://github.com/mattdesl/lerp
 */
export function lerp(v0: number, v1: number, t: number): number {
  return v0 * (1 - t) + v1 * t;
}

const RECEIVERS = new Set(["INPUT", "TEXTAREA"]);

/**
 * Compare two arrays, which are expected to change
 * but by their contents, shallowly.
 * Sensitive to order.
 *
 * @returns True if they are equal.
 */
export function shallowArrayEqual<T>(a: T[] | undefined, b: T[] | undefined) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export function allowNativeCopy(e: Pick<ClipboardEvent, "target">) {
  const target = e.target;
  const tagName = target instanceof HTMLElement ? target?.tagName || "" : "";
  if (RECEIVERS.has(tagName)) return true;
  if (window.getSelection()?.toString()) return true;
  return false;
}

/**
 * If the user is currently focused on a textarea,
 * allow the native paste function to happen instead
 * of intercepting it in JavaScript.
 */
export function allowNativePaste(e: Pick<ClipboardEvent, "target">) {
  const target = e.target;
  const tagName = target instanceof HTMLElement ? target?.tagName || "" : "";
  if (RECEIVERS.has(tagName)) return true;
  return false;
}

type ClipboardInput = Promisable<string>;

async function writeToClipboardItem(input: ClipboardInput) {
  return navigator.clipboard.write([
    new ClipboardItem({
      "text/plain": Promise.resolve(input).then((text) => {
        return new Blob([text], { type: "text/plain" });
      }),
    }),
  ]);
}

async function writeToClipboardFallback(input: ClipboardInput) {
  return navigator.clipboard.writeText(await input);
}

/**
 * A safe-ish way to write to clipboards.
 *
 * Given user activation rules in Safari, calling `navigator.clipboard.writeText`
 * >1s after user activation will fail.
 *
 * Between browsers:
 *
 * - Firefox does not support ClipboardItem so it falls into the 'fallback' condition.
 * - Chrome does not support ClipboardItem with string as the awaited value,
 *   so we construct a Blob instead.
 * - Safari supports ClipboardItem and has very strict user activation rules so
 *   we need to use it.
 */
export async function writeToClipboard(input: ClipboardInput) {
  if (typeof ClipboardItem === "undefined") {
    return await writeToClipboardFallback(input);
  } else {
    return await writeToClipboardItem(input);
  }
}

export function eitherToAsync<L, R>(either: Either<L, R>): EitherAsync<L, R> {
  return EitherAsync<L, R>(({ liftEither }) => {
    return liftEither(either);
  });
}

/**
 * Truncate a text string on the JavaScript side.
 */
export function truncate(str: string, len = 48): string {
  if (str.length < len) return str;
  return str.substring(0, len) + "…";
}

const IRREGS: { [key: string]: string } = {
  geometry: "geometries",
} as const;
/**
 * Pluralize or singularize a word based on the passed in count.
 *
 * @param word      The word to pluralize
 * @param count     How many of the word exist
 * @param inclusive Whether to prefix with the number (e.g. 3 ducks)
 * @param irregular Irregular form, if any
 */
export function pluralize(
  translateFn: (key: string) => string,
  word: string,
  count: number,
  inclusive = true,
  irregular: string | undefined = undefined,
) {
  if (!irregular && word in IRREGS) irregular = IRREGS[word];
  const pluralized = count === 1 ? word : irregular ? irregular : word + "s";
  return (
    (inclusive ? count.toLocaleString() + " " : "") +
    translateFn(pluralized).toLowerCase()
  );
}

export const formatCount = (n: number) =>
  new Intl.NumberFormat("en-US", {}).format(n);

export const formatCapitalize = (str: string) =>
  str.replace(/^\w/, (c) => c.toUpperCase());

export function safeParseMaybe<T>(
  parsed: SafeParseReturnType<unknown, T>,
): Maybe<T> {
  if (parsed.success) {
    return Just(parsed.data);
  }
  return Nothing;
}

const TILEJSON_CACHE = new Map<string, z.infer<typeof zTileJSON>>();

export async function getTileJSON(url: string) {
  const cached = TILEJSON_CACHE.get(url);
  if (cached) return cached;

  const resp = await get(url, zTileJSON);

  TILEJSON_CACHE.set(url, resp);

  return resp;
}

export async function get<T extends z.ZodType<unknown>>(
  url: string,
  type: T,
): Promise<z.infer<T>> {
  const resp = await fetch(url);
  const json = await resp.json();
  const parsed = type.parse(json);
  return parsed;
}

export function getMapboxLayerURL(layer: ILayerConfig) {
  if (layer.type !== "MAPBOX") return "";
  return (
    layer.url.replace("mapbox://styles/", "https://api.mapbox.com/styles/v1/") +
    `?optimize=true&access_token=${layer.token}`
  );
}
