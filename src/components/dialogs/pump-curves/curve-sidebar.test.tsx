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
  assetIds: new Set(),
});

const buildLabelManager = (curves: Curves): LabelManager => {
  const lm = new LabelManager();
  for (const curve of curves.values()) {
    lm.register(curve.label, "curve", curve.id);
  }
  return lm;
};

describe("CurveSidebar", () => {
  it("only displays curves of type pump", () => {
    const curves: Curves = new Map([
      [1, buildCurve(1, "PumpCurve1", "pump")],
      [2, buildCurve(2, "VolumeCurve", "volume")],
      [3, buildCurve(3, "PumpCurve2", "pump")],
      [4, buildCurve(4, "HeadlossCurve", "headloss")],
      [5, buildCurve(5, "ValveCurve", "valve")],
    ]);

    render(
      <CurveSidebar
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
    expect(screen.queryByText("VolumeCurve")).not.toBeInTheDocument();
    expect(screen.queryByText("HeadlossCurve")).not.toBeInTheDocument();
    expect(screen.queryByText("ValveCurve")).not.toBeInTheDocument();
  });

  it("shows no items when there are no pump curves", () => {
    const curves: Curves = new Map([
      [1, buildCurve(1, "VolumeCurve", "volume")],
      [2, buildCurve(2, "HeadlossCurve", "headloss")],
    ]);

    render(
      <CurveSidebar
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

    expect(screen.queryByText("VolumeCurve")).not.toBeInTheDocument();
    expect(screen.queryByText("HeadlossCurve")).not.toBeInTheDocument();
    const list = screen.getByRole("list");
    expect(list.querySelectorAll("li")).toHaveLength(0);
  });
});
