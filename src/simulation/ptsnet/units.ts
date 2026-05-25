import { convertTo, type Unit } from "src/quantity";

// ptsnet works in SI: head/elevation in metres, gauge pressure in metres of
// water column, flow in m³/s. The app's readers return values in the project's
// native units (the .inp is built in those units), and the display layer only
// adds unit labels — it does not rescale. So we convert at the reader boundary.

/** Hydraulic head: ptsnet metres -> project head unit (m / ft). */
export const siHeadTo = (metres: number, headUnit: Unit): number =>
  convertTo({ value: metres, unit: "m" }, headUnit);

/**
 * Gauge pressure: ptsnet metres-of-water-column -> project pressure unit
 * (mwc / psi / kPa / bar / fwc). `m^3/s` head and pressure share the metre
 * magnitude but different dimensions, so pressure must convert from `mwc`.
 */
export const siPressureTo = (
  metresOfWater: number,
  pressureUnit: Unit,
): number => convertTo({ value: metresOfWater, unit: "mwc" }, pressureUnit);

/** Flow: ptsnet m³/s -> project flow unit. `m^3/s` isn't in the app's Unit set,
 * so express as l/s first. */
export const siFlowTo = (
  cubicMetresPerSecond: number,
  flowUnit: Unit,
): number =>
  convertTo({ value: cubicMetresPerSecond * 1000, unit: "l/s" }, flowUnit);

/** Human label for a transient timestamp (sub-second steps are common). */
export const formatTransientTime = (seconds: number): string =>
  seconds < 1 ? `${(seconds * 1000).toFixed(0)} ms` : `${seconds.toFixed(3)} s`;
