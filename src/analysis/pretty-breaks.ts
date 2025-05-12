// Constants from C
const C_DBL_EPSILON: number = Number.EPSILON;
const C_DBL_MIN_NORM: number = 2.2250738585072014e-308;
const C_DBL_MAX: number = Number.MAX_VALUE;
const ROUNDING_EPS: number = 1e-10;
const MAX_F_CONST: number = 1.25;

export interface PrettyBreaksResult {
  breaks: number[];
  unit: number;
}

/**
 * Calculates pretty breaks for a dataset using R's pretty algorithm
 */
export function calculatePrettyBreaks(
  sortedValues: number[],
  numBreaks: number,
): PrettyBreaksResult {
  if (!sortedValues.length) {
    return { breaks: [], unit: 0 };
  }

  const minVal = sortedValues[0];
  const maxVal = sortedValues[sortedValues.length - 1];

  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
    return { breaks: [], unit: 0 };
  }

  const result = rPrettyNative({
    lo_in: minVal,
    up_in: maxVal,
    ndiv_in: numBreaks - 1, // Convert from number of breaks to number of intervals
    min_n_in: Math.max(0, Math.floor((numBreaks - 1) / 3)),
    shrink_sml_in: numBreaks > 5 ? 0.75 : 0.5,
    high_u_fact_in: [1.5, 0.5 + 1.5 * 1.5, Math.pow(2, -20)],
    eps_correction_in: 2,
    return_bounds_in: true,
  });

  return {
    breaks: result.ticks,
    unit: result.unit,
  };
}

/**
 * @file R_pretty_native.ts
 * @description TypeScript implementation of R's internal 'R_pretty' C function.
 */

interface RPrettyNativeParams {
  /** Minimum of the data range */
  lo_in: number;
  /** Maximum of the data range */
  up_in: number;
  /** Approximate number of axis intervals desired (R's 'n') */
  ndiv_in?: number;
  /** Minimal number of intervals (R's 'min.n') */
  min_n_in?: number;
  /** Factor by which scale is shrunk when range is very small (R's 'shrink.sml') */
  shrink_sml_in?: number;
  /**
   * Array of 3 numbers: [h, h5, f_min]
   * h: high.u.bias (favors larger units)
   * h5: u5.bias (favors factor 5 over 2)
   * f_min: factor for minimum cell clamping (default 2^-20 in R)
   */
  high_u_fact_in?: [number, number, number];
  /**
   * Epsilon correction level (R's 'eps.correct').
   * C uses int, 0=off, 1=on for i_small=F, >1 always on.
   */
  eps_correction_in?: number;
  /**
   * Whether to return actual data bounds or ns/nu indices in lo_out/up_out.
   * (R's 'return.bounds')
   */
  return_bounds_in?: boolean;
}

interface RPrettyNativeResult {
  /** The calculated interval unit size */
  unit: number;
  /** The lower bound output (meaning depends on return_bounds_in) */
  lo_out: number;
  /** The upper bound output (meaning depends on return_bounds_in) */
  up_out: number;
  /** The actual number of intervals calculated */
  ndiv_out: number;
  /** The calculated 'ns' value (start index for sequence) */
  ns: number;
  /** The calculated 'nu' value (end index for sequence) */
  nu: number;
  /** The generated sequence of "pretty" tick values */
  ticks: number[];
}

/**
 * TypeScript implementation of R's internal 'R_pretty' C function.
 * This function calculates "pretty" axis tick marks.
 *
 * @param params - {@link RPrettyNativeParams}
 * @returns {@link RPrettyNativeResult}
 */
function rPrettyNative(params: RPrettyNativeParams): RPrettyNativeResult {
  // --- Setup parameters with defaults similar to R's pretty.default ---
  const ndiv_param = params.ndiv_in === undefined ? 5 : params.ndiv_in;
  const min_n =
    params.min_n_in === undefined
      ? Math.max(0, Math.floor(ndiv_param / 3))
      : params.min_n_in;
  const shrink_sml =
    params.shrink_sml_in === undefined
      ? ndiv_param > 5
        ? 0.75
        : 0.5
      : params.shrink_sml_in;

  const h_default = 1.5; // R's high.u.bias
  const h5_default = 0.5 + 1.5 * h_default; // R's u5.bias
  const f_min_default = Math.pow(2, -20); // R's f.min
  const high_u_fact =
    params.high_u_fact_in === undefined
      ? [h_default, h5_default, f_min_default]
      : params.high_u_fact_in;

  const eps_correction =
    params.eps_correction_in === undefined ? 2 : params.eps_correction_in;
  const return_bounds =
    params.return_bounds_in === undefined ? true : params.return_bounds_in;

  const h_bias = high_u_fact[0];
  const h5_bias = high_u_fact[1];
  const f_min_val = high_u_fact[2];

  // Internal mutable state corresponding to C pointers/variables
  let current_lo = params.lo_in; // Will be modified by eps_correction
  let current_up = params.up_in; // Will be modified by eps_correction
  let current_ndiv = ndiv_param; // Will be modified to ndiv_out

  // Save input boundaries (original, unmodified lo_in, up_in)
  const lo_orig = params.lo_in;
  const up_orig = params.up_in;

  const dx = up_orig - lo_orig;
  let cell: number;
  let U_calc: number; // For i_small calculation, distinct from temp U in unit selection
  let i_small: boolean;

  /* cell := "scale" here */
  if (dx === 0 && up_orig === 0) {
    /* up == lo == 0 */
    cell = 1;
    i_small = true;
  } else {
    cell = Math.max(Math.abs(lo_orig), Math.abs(up_orig));
    /* U_calc = upper bound on cell/unit */
    U_calc =
      1 +
      (h5_bias >= 1.5 * h_bias + 0.5 ? 1 / (1 + h_bias) : 1.5 / (1 + h5_bias));
    U_calc *= Math.max(1, current_ndiv) * C_DBL_EPSILON; // avoid overflow for large ndiv
    /* added times 3, as several calculations here */
    i_small = dx < cell * U_calc * 3;
  }

  if (i_small) {
    if (cell > 10) {
      cell = 9 + cell / 10;
    }
    cell *= shrink_sml;
    if (min_n > 1) {
      cell /= min_n;
    }
  } else {
    cell = dx;
    if (Number.isFinite(dx)) {
      if (current_ndiv > 1) {
        cell /= current_ndiv;
      }
    } else {
      // up - lo = +Inf (overflow; both are finite)
      if (current_ndiv < 2) {
        // eslint-disable-next-line no-console
        console.warn(
          `rPrettyNative: infinite range; ndiv_in=${current_ndiv}, should have ndiv_in >= 2`,
        );
        // R sets cell to Inf too if ndiv < 2, or if up_ or lo_ were Inf.
        // Here, if dx is Inf but lo/up are finite, it means huge difference.
        // The C code calculates cell = up_/(ndiv) - lo_/(ndiv).
        // This can still be Inf if up_ is large.
        // If ndiv < 2, cell remains dx (Inf).
        cell = up_orig / current_ndiv - lo_orig / current_ndiv; // if up_/lo_ are huge, this can be Inf or NaN
        if (!Number.isFinite(cell)) cell = C_DBL_MAX / current_ndiv; // Fallback if calculation leads to non-finite
      } else {
        cell = up_orig / current_ndiv - lo_orig / current_ndiv;
      }
    }
  }

  let subsmall = f_min_val * C_DBL_MIN_NORM;
  if (subsmall === 0) {
    // subnormals underflowing to zero
    subsmall = C_DBL_MIN_NORM;
  }

  if (cell < subsmall) {
    // possibly subnormal
    // eslint-disable-next-line no-console
    console.warn(
      `rPrettyNative: very small range 'cell'=${cell}, corrected to ${subsmall}`,
    );
    cell = subsmall;
  } else if (cell > C_DBL_MAX / MAX_F_CONST) {
    // eslint-disable-next-line no-console
    console.warn(
      `rPrettyNative: very large range 'cell'=${cell}, corrected to ${C_DBL_MAX / MAX_F_CONST}`,
    );
    cell = C_DBL_MAX / MAX_F_CONST;
  }
  if (!Number.isFinite(cell) || cell === 0) {
    // Ensure cell is a usable finite positive number
    cell =
      cell === 0 && dx === 0 && up_orig === 0
        ? shrink_sml // specific case of (0,0) range.
        : (Number.isFinite(dx) && dx > 0 ? dx / current_ndiv : undefined) || // if dx is usable
          subsmall; // Ultimate fallback
    if (cell <= 0) cell = subsmall; // ensure positive
  }

  const base = Math.pow(
    10.0,
    Math.floor(Math.log10(cell)),
  ); /* base <= cell < 10*base */
  let unit = base;
  let U_temp: number; // Temporary variable for candidate unit values

  if ((U_temp = 2 * base) - cell < h_bias * (cell - unit)) {
    unit = U_temp;
    if ((U_temp = 5 * base) - cell < h5_bias * (cell - unit)) {
      unit = U_temp;
      if ((U_temp = 10 * base) - cell < h_bias * (cell - unit)) {
        unit = U_temp;
      }
    }
  }

  let ns = Math.floor(lo_orig / unit + ROUNDING_EPS);
  let nu = Math.ceil(up_orig / unit - ROUNDING_EPS);

  if (eps_correction && (eps_correction > 1 || !i_small)) {
    // Modify current_lo and current_up (which were copies of lo_in, up_in)
    if (lo_orig !== 0) current_lo = lo_orig * (1 - C_DBL_EPSILON);
    else current_lo = -C_DBL_MIN_NORM;
    if (up_orig !== 0) current_up = up_orig * (1 + C_DBL_EPSILON);
    else current_up = +C_DBL_MIN_NORM;
  } else {
    // If no eps_correction, current_lo/up remain lo_orig/up_orig for the while loops.
    current_lo = lo_orig;
    current_up = up_orig;
  }

  while (ns * unit > current_lo + ROUNDING_EPS * unit) ns--;
  while (!Number.isFinite(ns * unit) && Number.isFinite(ns) && ns < nu + 1e6)
    ns++; // Check ns also finite, add guard for ns runaway
  if (!Number.isFinite(ns * unit)) ns = Math.ceil(current_lo / unit); // Fallback if still not finite

  while (nu * unit < current_up - ROUNDING_EPS * unit) nu++;
  while (!Number.isFinite(nu * unit) && Number.isFinite(nu) && nu > ns - 1e6)
    nu--; // Check nu also finite, add guard
  if (!Number.isFinite(nu * unit)) nu = Math.floor(current_up / unit); // Fallback

  // Ensure ns <= nu after adjustments
  if (ns > nu) {
    // This can happen if unit is very large or range is zero/tiny.
    // Reset to a single point or minimal interval.
    if (dx === 0) {
      ns = Math.floor(lo_orig / unit);
      nu = ns;
    } else {
      // swap them or average them if bounds were crossed
      const temp = ns;
      ns = nu;
      nu = temp; // simple swap
      if (ns > nu) {
        // if still crossed after swap (e.g. both became non-finite and reset badly)
        const avg_idx = Math.floor((lo_orig / unit + up_orig / unit) / 2);
        ns = avg_idx;
        nu = avg_idx;
      }
    }
  }

  let k_int = Math.round(nu - ns); // (int)(0.5 + nu - ns) in C, equivalent to Math.round for positive nu-ns

  if (k_int < min_n) {
    const k_adj = min_n - k_int; // This is 'k' in the C code's if block
    if (lo_orig === 0 && ns === 0 && up_orig !== 0) {
      nu += k_adj;
    } else if (up_orig === 0 && nu === 0 && lo_orig !== 0) {
      ns -= k_adj;
    } else if (ns >= 0) {
      // C: ns was double, comparison is fine.
      nu += Math.floor(k_adj / 2);
      ns -= Math.floor(k_adj / 2) + (k_adj % 2);
    } else {
      ns -= Math.floor(k_adj / 2);
      nu += Math.floor(k_adj / 2) + (k_adj % 2);
    }
    current_ndiv = min_n;
  } else {
    current_ndiv = k_int;
  }

  let final_lo_out: number;
  let final_up_out: number;

  if (return_bounds) {
    // C: *lo and *up are modified. These started as lo_in, up_in.
    // The C code uses *lo and *up which could have been changed by eps_correction.
    // Here we use `current_lo` and `current_up` for the comparison values.
    final_lo_out = current_lo; // Start with (eps_corrected) original or raw original
    final_up_out = current_up;

    if (ns * unit < final_lo_out) final_lo_out = ns * unit;
    if (nu * unit > final_up_out) final_up_out = nu * unit;
  } else {
    // used in graphics
    final_lo_out = ns;
    final_up_out = nu;
  }

  // --- Generate the ticks sequence ---
  // The ticks are generated from ns*unit to nu*unit
  const graphMin = ns * unit;
  const graphMax = nu * unit;
  const ticks: number[] = [];

  if (
    !Number.isFinite(graphMin) ||
    !Number.isFinite(graphMax) ||
    !Number.isFinite(unit) ||
    unit === 0
  ) {
    // If critical values are non-finite, return a minimal or empty sequence.
    if (
      Number.isFinite(lo_orig) &&
      Number.isFinite(up_orig) &&
      lo_orig === up_orig
    ) {
      ticks.push(lo_orig);
    }
    // else, ticks remains empty, or could push lo_orig, up_orig if finite.
  } else {
    const count = Math.floor((graphMax - graphMin) / unit + ROUNDING_EPS); // Use ROUNDING_EPS for float comparisons
    if (count < -1) {
      // count should be >= -1 (for single point)
      // This implies graphMax is significantly less than graphMin
      if (Math.abs(graphMax - graphMin) < ROUNDING_EPS * Math.abs(unit) * 2) {
        // effectively a single point
        ticks.push(graphMin);
      } // else ticks remains empty
    } else {
      for (let i = 0; i <= count; i++) {
        ticks.push(graphMin + i * unit);
      }
      // Ensure the last point is graphMax if it was meant to be.
      if (ticks.length > 0) {
        const lastVal = ticks[ticks.length - 1];
        if (
          lastVal !== graphMax &&
          Math.abs(graphMax - lastVal) < ROUNDING_EPS * Math.abs(unit)
        ) {
          ticks[ticks.length - 1] = graphMax;
        } else if (lastVal > graphMax + ROUNDING_EPS * Math.abs(unit)) {
          // Overran graphMax
          ticks.pop(); // Remove last if it significantly overshot
        } else if (
          lastVal < graphMax - ROUNDING_EPS * Math.abs(unit) && // Undershot significantly
          Math.abs(graphMin + (count + 1) * unit - graphMax) <
            ROUNDING_EPS * Math.abs(unit)
        ) {
          // and next point would be graphMax
          ticks.push(graphMax);
        }
      }
      if (
        ticks.length === 0 &&
        Math.abs(graphMax - graphMin) < ROUNDING_EPS * Math.abs(unit) * 2
      ) {
        // single point case
        ticks.push(graphMin);
      }
    }
  }

  return {
    unit: unit,
    lo_out: final_lo_out,
    up_out: final_up_out,
    ndiv_out: current_ndiv,
    ns: ns,
    nu: nu,
    ticks: ticks,
  };
}
