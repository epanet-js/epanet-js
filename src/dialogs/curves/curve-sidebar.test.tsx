import { render, screen } from "@testing-library/react";
import { CurveSidebar } from "./curve-sidebar";
import { Curves, ICurve } from "src/hydraulic-model/curves";
import { LabelManager } from "src/hydraulic-model/label-manager";

const buildCurve = (
  id: number,
  label: string,
  type: ICurve["type"],
): ICurve => ({
  id,
  label,
  type,
  points: [{ x: 1, y: 1 }],
});

const buildLabelManager = (curves: Curves): LabelManager => {
  const lm = new LabelManager();
  for (const curve of curves.values()) {
    lm.register(curve.label, "curve", curve.id);
  }
  return lm;
};

describe("CurveSidebar (Curve Library)", () => {
  it("displays volume, valve, and headloss curves in their sections", () => {
    const curves: Curves = new Map([
      [1, buildCurve(1, "VolumeCurve", "volume")],
      [2, buildCurve(2, "ValveCurve", "valve")],
      [3, buildCurve(3, "HeadlossCurve", "headloss")],
    ]);

    render(
      <CurveSidebar
        width={224}
        curves={curves}
        selectedCurveId={null}
        labelManager={buildLabelManager(curves)}
        onSelectCurve={vi.fn()}
        onAddCurve={vi.fn()}
        onChangeCurve={vi.fn()}
        onDeleteCurve={vi.fn()}
        invalidCurveIds={new Set()}
      />,
    );

    expect(screen.getByText("VolumeCurve")).toBeInTheDocument();
    expect(screen.getByText("ValveCurve")).toBeInTheDocument();
    expect(screen.getByText("HeadlossCurve")).toBeInTheDocument();
  });

  it("does not display pump or efficiency curves", () => {
    const curves: Curves = new Map([
      [1, buildCurve(1, "VolumeCurve", "volume")],
      [2, buildCurve(2, "PumpCurve", "pump")],
      [3, buildCurve(3, "EffCurve", "efficiency")],
    ]);

    render(
      <CurveSidebar
        width={224}
        curves={curves}
        selectedCurveId={null}
        labelManager={buildLabelManager(curves)}
        onSelectCurve={vi.fn()}
        onAddCurve={vi.fn()}
        onChangeCurve={vi.fn()}
        onDeleteCurve={vi.fn()}
        invalidCurveIds={new Set()}
      />,
    );

    expect(screen.getByText("VolumeCurve")).toBeInTheDocument();
    expect(screen.queryByText("PumpCurve")).not.toBeInTheDocument();
    expect(screen.queryByText("EffCurve")).not.toBeInTheDocument();
  });

  it("does not show Uncategorized section when there are no untyped curves", () => {
    const curves: Curves = new Map([
      [1, buildCurve(1, "VolumeCurve", "volume")],
    ]);

    render(
      <CurveSidebar
        width={224}
        curves={curves}
        selectedCurveId={null}
        labelManager={buildLabelManager(curves)}
        onSelectCurve={vi.fn()}
        onAddCurve={vi.fn()}
        onChangeCurve={vi.fn()}
        onDeleteCurve={vi.fn()}
        invalidCurveIds={new Set()}
      />,
    );

    expect(screen.getByText("VolumeCurve")).toBeInTheDocument();
    expect(screen.queryByText("Uncategorized")).not.toBeInTheDocument();
  });

  it("shows Uncategorized section for untyped curves", () => {
    const curves: Curves = new Map([
      [1, buildCurve(1, "UntypedCurve", undefined)],
    ]);

    render(
      <CurveSidebar
        width={224}
        curves={curves}
        selectedCurveId={null}
        labelManager={buildLabelManager(curves)}
        onSelectCurve={vi.fn()}
        onAddCurve={vi.fn()}
        onChangeCurve={vi.fn()}
        onDeleteCurve={vi.fn()}
        invalidCurveIds={new Set()}
      />,
    );

    expect(screen.getByText("Uncategorized")).toBeInTheDocument();
  });
});
