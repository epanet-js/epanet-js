import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
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
  id: "ctrl-1",
  type: "level-setting",
  linkId: PUMP_ID,
  tankId: 10,
  on: { level: 2, setting: INITIAL_SPEED },
  off: { level: 9 },
});

const Harness = ({
  onChange,
}: {
  onChange?: (control: LevelSettingControl) => void;
}) => {
  const [control, setControl] = useState<LevelSettingControl>(aControl);
  return (
    <PumpLevelBasedControls
      control={control}
      tanks={TANKS}
      onControlChange={(next) => {
        onChange?.(next);
        setControl(next);
      }}
    />
  );
};

const renderControls = (onChange = vi.fn()) => {
  render(<Harness onChange={onChange} />);
  return onChange;
};

const onLevelInput = () => screen.getByRole("textbox", { name: /On Level/ });
const offLevelInput = () => screen.getByRole("textbox", { name: /Off Level/ });

const editValue = async (
  user: ReturnType<typeof userEvent.setup>,
  input: HTMLElement,
  value: string,
) => {
  await user.clear(input);
  await user.type(input, `${value}{Enter}`);
};

describe("PumpLevelBasedControls", () => {
  it("renders the on level/speed and off level as editable, off speed empty", () => {
    renderControls();

    expect(onLevelInput()).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: /On Speed/ }),
    ).toBeInTheDocument();
    expect(offLevelInput()).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: /Off Speed/ }),
    ).not.toBeInTheDocument();
  });

  it("emits an updated control when a valid on level is entered", async () => {
    const user = userEvent.setup();
    const onChange = renderControls();

    await editValue(user, onLevelInput(), "4");

    expect(onChange).toHaveBeenLastCalledWith({
      id: "ctrl-1",
      type: "level-setting",
      linkId: PUMP_ID,
      tankId: 10,
      on: { level: 4, setting: INITIAL_SPEED },
      off: { level: 9 },
    });
  });

  describe("validation", () => {
    it("saves an out-of-range on level and flags only that field", async () => {
      const user = userEvent.setup();
      const onChange = renderControls();

      await editValue(user, onLevelInput(), "1");

      expect(onLevelInput()).toHaveClass("border-orange-500");
      expect(offLevelInput()).not.toHaveClass("border-orange-500");
      expect(screen.getByText(/must be between/i)).toBeInTheDocument();
      expect(onChange).toHaveBeenLastCalledWith({
        id: "ctrl-1",
        type: "level-setting",
        linkId: PUMP_ID,
        tankId: 10,
        on: { level: 1, setting: INITIAL_SPEED },
        off: { level: 9 },
      });
    });

    it("highlights both levels and saves when on is not below off", async () => {
      const user = userEvent.setup();
      const onChange = renderControls();

      await editValue(user, onLevelInput(), "9");

      expect(onLevelInput()).toHaveClass("border-orange-500");
      expect(offLevelInput()).toHaveClass("border-orange-500");
      expect(
        screen.getByText(/on level must be below the off level/i),
      ).toBeInTheDocument();
      expect(onChange).toHaveBeenLastCalledWith({
        id: "ctrl-1",
        type: "level-setting",
        linkId: PUMP_ID,
        tankId: 10,
        on: { level: 9, setting: INITIAL_SPEED },
        off: { level: 9 },
      });
    });

    it("highlights both levels when off is dropped to the on level", async () => {
      const user = userEvent.setup();
      const onChange = renderControls();

      await editValue(user, offLevelInput(), "2");

      expect(onLevelInput()).toHaveClass("border-orange-500");
      expect(offLevelInput()).toHaveClass("border-orange-500");
      expect(
        screen.getByText(/on level must be below the off level/i),
      ).toBeInTheDocument();
      expect(onChange).toHaveBeenLastCalledWith({
        id: "ctrl-1",
        type: "level-setting",
        linkId: PUMP_ID,
        tankId: 10,
        on: { level: 2, setting: INITIAL_SPEED },
        off: { level: 2 },
      });
    });

    it("clears the warning once the value becomes valid", async () => {
      const user = userEvent.setup();
      const onChange = renderControls();

      await editValue(user, onLevelInput(), "1");
      expect(screen.getByText(/must be between/i)).toBeInTheDocument();

      await editValue(user, onLevelInput(), "3");

      expect(screen.queryByText(/must be between/i)).not.toBeInTheDocument();
      expect(onLevelInput()).not.toHaveClass("border-orange-500");
      expect(onChange).toHaveBeenLastCalledWith({
        id: "ctrl-1",
        type: "level-setting",
        linkId: PUMP_ID,
        tankId: 10,
        on: { level: 3, setting: INITIAL_SPEED },
        off: { level: 9 },
      });
    });
  });

  it("rebuilds the levels from the newly selected tank, keeping the on-speed", async () => {
    const user = userEvent.setup();
    const onChange = renderControls();

    await user.click(screen.getByRole("combobox", { name: "Tank" }));
    await user.click(await screen.findByRole("option", { name: "Tank 2" }));

    expect(onChange).toHaveBeenLastCalledWith({
      id: "ctrl-1",
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
  });
});
