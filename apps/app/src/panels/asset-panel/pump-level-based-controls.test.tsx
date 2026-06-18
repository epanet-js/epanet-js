import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LevelSettingControl, Tank } from "@epanet-js/hydraulic-model";
import { PumpLevelBasedControls } from "./pump-level-based-controls";

const PUMP_ID = 3;
const INITIAL_SPEED = 1.5;

const makeTank = (
  id: number,
  label: string,
  minLevel: number,
  maxLevel: number,
): Tank => ({ id, label, type: "tank", minLevel, maxLevel }) as unknown as Tank;

const TANKS = [makeTank(10, "Tank 1", 2, 9), makeTank(11, "Tank 2", 1, 5)];

const aControl = (): LevelSettingControl => ({
  type: "level-setting",
  linkId: PUMP_ID,
  tankId: 10,
  on: { level: 2, setting: INITIAL_SPEED },
  off: { level: 9 },
});

const renderControls = (onControlChange = vi.fn()) => {
  render(
    <PumpLevelBasedControls
      control={aControl()}
      tanks={TANKS}
      onControlChange={onControlChange}
    />,
  );
  return onControlChange;
};

describe("PumpLevelBasedControls", () => {
  it("renders the on level/speed and off level as editable, off speed empty", () => {
    renderControls();

    expect(
      screen.getByRole("textbox", { name: /On Level/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /On Speed/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /Off Level/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /Off Speed/ }),
    ).not.toBeInTheDocument();
  });

  it("emits an updated control when the on level changes", async () => {
    const user = userEvent.setup();
    const onControlChange = renderControls();

    const input = screen.getByRole("textbox", { name: /On Level/ });
    await user.clear(input);
    await user.type(input, "4{Enter}");

    expect(onControlChange).toHaveBeenLastCalledWith({
      type: "level-setting",
      linkId: PUMP_ID,
      tankId: 10,
      on: { level: 4, setting: INITIAL_SPEED },
      off: { level: 9 },
    });
  });

  it("rebuilds the levels from the newly selected tank, keeping the on-speed", async () => {
    const user = userEvent.setup();
    const onControlChange = renderControls();

    await user.click(screen.getByRole("combobox", { name: "Tank" }));
    await user.click(await screen.findByRole("option", { name: "Tank 2" }));

    expect(onControlChange).toHaveBeenLastCalledWith({
      type: "level-setting",
      linkId: PUMP_ID,
      tankId: 11,
      on: { level: 1, setting: INITIAL_SPEED },
      off: { level: 5 },
    });
  });

  it("shows the tank label read-only without a combobox", () => {
    render(
      <PumpLevelBasedControls
        control={aControl()}
        tanks={TANKS}
        onControlChange={vi.fn()}
        readOnly
      />,
    );

    expect(
      screen.queryByRole("combobox", { name: "Tank" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Tank 1")).toBeInTheDocument();
    const offSpeed = screen.queryByRole("textbox", { name: /Speed/ });
    expect(offSpeed).not.toBeInTheDocument();
  });
});
