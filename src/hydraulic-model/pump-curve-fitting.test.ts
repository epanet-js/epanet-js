import {
  fitPumpCurve,
  synthesizeThreePoints,
  generateSmoothPumpCurvePoints,
} from "./pump-curve-fitting";

describe("synthesizeThreePoints", () => {
  it("generates shutoff, design, and max flow points from a design point", () => {
    const result = synthesizeThreePoints({ x: 500, y: 100 });

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ x: 0, y: 100 * 1.33334 });
    expect(result[1]).toEqual({ x: 500, y: 100 });
    expect(result[2]).toEqual({ x: 1000, y: 0 });
  });
});

describe("fitPumpCurve", () => {
  it("computes correct coefficients for a 3-point curve with q0=0", () => {
    const points = [
      { x: 0, y: 120 },
      { x: 100, y: 100 },
      { x: 200, y: 40 },
    ];

    const result = fitPumpCurve(points);

    expect(result).not.toBeNull();
    expect(result!.a).toBeCloseTo(120, 1);

    // Verify the curve passes through the input points
    const h1 = result!.a - result!.b * Math.pow(100, result!.c);
    const h2 = result!.a - result!.b * Math.pow(200, result!.c);
    expect(h1).toBeCloseTo(100, 1);
    expect(h2).toBeCloseTo(40, 1);
  });

  it("computes correct coefficients for synthesized 1-point curve", () => {
    const threePoints = synthesizeThreePoints({ x: 150, y: 75 });
    const result = fitPumpCurve(threePoints);

    expect(result).not.toBeNull();
    expect(result!.a).toBeCloseTo(75 * 1.33334, 1);

    // Verify the curve passes through the design point
    const h = result!.a - result!.b * Math.pow(150, result!.c);
    expect(h).toBeCloseTo(75, 1);
  });

  it("returns null when head does not decrease", () => {
    const points = [
      { x: 0, y: 50 },
      { x: 100, y: 60 },
      { x: 200, y: 70 },
    ];
    expect(fitPumpCurve(points)).toBeNull();
  });

  it("returns null when flows do not increase", () => {
    const points = [
      { x: 0, y: 100 },
      { x: 100, y: 80 },
      { x: 50, y: 60 },
    ];
    expect(fitPumpCurve(points)).toBeNull();
  });

  it("returns null for a flat curve (h0 == h1)", () => {
    const points = [
      { x: 0, y: 100 },
      { x: 500, y: 100 },
      { x: 1000, y: 50 },
    ];
    expect(fitPumpCurve(points)).toBeNull();
  });

  it("returns null when shutoff head is zero", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: -10 },
      { x: 200, y: -20 },
    ];
    expect(fitPumpCurve(points)).toBeNull();
  });

  it("returns null for fewer than 3 points", () => {
    expect(fitPumpCurve([{ x: 0, y: 100 }])).toBeNull();
    expect(
      fitPumpCurve([
        { x: 0, y: 100 },
        { x: 50, y: 80 },
      ]),
    ).toBeNull();
  });
});

describe("generateSmoothPumpCurvePoints", () => {
  it("returns null for multi-point curves", () => {
    const points = [
      { x: 0, y: 120 },
      { x: 50, y: 110 },
      { x: 100, y: 90 },
      { x: 150, y: 60 },
    ];
    expect(generateSmoothPumpCurvePoints(points, "multiPointCurve")).toBeNull();
  });

  it("generates 25 smooth points for a valid 1-point (design-point) curve", () => {
    const points = [{ x: 500, y: 100 }];
    const result = generateSmoothPumpCurvePoints(points, "designPointCurve");

    expect(result).not.toBeNull();
    expect(result).toHaveLength(25);

    // First point should be at q=0 with head close to shutoff
    expect(result![0].x).toBe(0);
    expect(result![0].y).toBeCloseTo(100 * 1.33334, 1);

    // Last point should be near q_max with head near 0
    expect(result![24].y).toBeCloseTo(0, 1);

    // X values should be monotonically increasing
    for (let i = 1; i < result!.length; i++) {
      expect(result![i].x).toBeGreaterThan(result![i - 1].x);
    }

    // Y values should be monotonically decreasing
    for (let i = 1; i < result!.length; i++) {
      expect(result![i].y).toBeLessThanOrEqual(result![i - 1].y);
    }
  });

  it("generates 25 smooth points for a valid 3-point (standard) curve", () => {
    const points = [
      { x: 0, y: 120 },
      { x: 100, y: 100 },
      { x: 200, y: 40 },
    ];
    const result = generateSmoothPumpCurvePoints(points, "standardCurve");

    expect(result).not.toBeNull();
    expect(result).toHaveLength(25);

    // First point at q=0
    expect(result![0].x).toBe(0);
    expect(result![0].y).toBeCloseTo(120, 1);

    // Last point near 0 head
    expect(result![24].y).toBeCloseTo(0, 1);
  });

  it("returns null for an empty points array", () => {
    expect(generateSmoothPumpCurvePoints([], "designPointCurve")).toBeNull();
  });

  it("returns null when curve fitting fails for invalid design-point input", () => {
    // Zero head means synthesized shutoff = 0, which fails fitting
    expect(
      generateSmoothPumpCurvePoints([{ x: 100, y: 0 }], "designPointCurve"),
    ).toBeNull();
  });

  it("returns null when curve fitting fails for invalid standard curve", () => {
    const points = [
      { x: 0, y: 50 },
      { x: 100, y: 60 },
      { x: 200, y: 70 },
    ];
    expect(generateSmoothPumpCurvePoints(points, "standardCurve")).toBeNull();
  });
});
