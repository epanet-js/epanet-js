import { render, screen } from "@testing-library/react";
import { PumpLibrarySidebar } from "./pump-library-sidebar";
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

describe("PumpLibrarySidebar", () => {
  it("displays pump and efficiency curves in their sections", () => {
    const curves: Curves = new Map([
      [1, buildCurve(1, "PumpCurve1", "pump")],
      [2, buildCurve(2, "EffCurve", "efficiency")],
      [3, buildCurve(3, "PumpCurve2", "pump")],
    ]);

    render(
      <PumpLibrarySidebar
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

    expect(screen.getByText("PumpCurve1")).toBeInTheDocument();
    expect(screen.getByText("PumpCurve2")).toBeInTheDocument();
    expect(screen.getByText("EffCurve")).toBeInTheDocument();
  });

  it("does not display volume, valve, or headloss curves", () => {
    const curves: Curves = new Map([
      [1, buildCurve(1, "PumpCurve1", "pump")],
      [2, buildCurve(2, "VolumeCurve", "volume")],
      [3, buildCurve(3, "HeadlossCurve", "headloss")],
      [4, buildCurve(4, "ValveCurve", "valve")],
    ]);

    render(
      <PumpLibrarySidebar
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

    expect(screen.getByText("PumpCurve1")).toBeInTheDocument();
    expect(screen.queryByText("VolumeCurve")).not.toBeInTheDocument();
    expect(screen.queryByText("HeadlossCurve")).not.toBeInTheDocument();
    expect(screen.queryByText("ValveCurve")).not.toBeInTheDocument();
  });

  it("does not show Uncategorized section when there are no untyped curves", () => {
    const curves: Curves = new Map([[1, buildCurve(1, "PumpCurve1", "pump")]]);

    render(
      <PumpLibrarySidebar
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

    expect(screen.getByText("PumpCurve1")).toBeInTheDocument();
    expect(screen.queryByText("Uncategorized")).not.toBeInTheDocument();
  });

  it("shows Uncategorized section for untyped curves", () => {
    const curves: Curves = new Map([
      [1, buildCurve(1, "UntypedCurve", undefined)],
    ]);

    render(
      <PumpLibrarySidebar
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
