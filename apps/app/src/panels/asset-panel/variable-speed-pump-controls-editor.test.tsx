import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import {
  Control,
  NodeAsset,
  Pipe,
  Pump,
  VariableSpeedPumpControl,
} from "@epanet-js/hydraulic-model";
import type { UnitsSpec } from "@epanet-js/project-settings";
import {
  resolvePermissions,
  type Permissions,
} from "src/hooks/use-permissions";
import { PumpControlsEditor } from "./pump-controls-editor";
import { VariableSpeedPumpTargets } from "./variable-speed-pump-controls-editor";

const entitledPermissions = resolvePermissions("pro", false, false, false);
const permissionsRef: { current: Permissions } = {
  current: entitledPermissions,
};
const showPriorityAccessMock = vi.fn();

vi.mock("src/hooks/use-permissions", async () => {
  const actual = await vi.importActual<
    typeof import("src/hooks/use-permissions")
  >("src/hooks/use-permissions");
  return {
    ...actual,
    usePermissions: () => permissionsRef.current,
  };
});

vi.mock("src/hooks/use-priority-access", () => ({
  useShowPriorityAccessDialog: () => showPriorityAccessMock,
}));

beforeEach(() => {
  permissionsRef.current = entitledPermissions;
  showPriorityAccessMock.mockClear();
});

const IDS = { J1: 1, J2: 2, T1: 3, PU1: 4, PU2: 5, PU3: 6, P1: 7 } as const;

const aNode = (id: number, label: string, type: NodeAsset["type"]) =>
  ({ id, label, type, isNode: true }) as unknown as NodeAsset;

const aLink = <T,>(id: number, label: string, type: string) =>
  ({ id, label, type, isNode: false }) as unknown as T;

const TARGETS: VariableSpeedPumpTargets = {
  nodes: [
    aNode(IDS.J1, "J1", "junction"),
    aNode(IDS.J2, "J2", "junction"),
    aNode(IDS.T1, "T1", "tank"),
  ],
  pipes: [aLink<Pipe>(IDS.P1, "P1", "pipe")],
  pumps: [
    aLink<Pump>(IDS.PU1, "PU1", "pump"),
    aLink<Pump>(IDS.PU2, "PU2", "pump"),
    aLink<Pump>(IDS.PU3, "PU3", "pump"),
  ],
  outletNodeId: IDS.J2,
  units: {
    pressure: "m",
    flow: "l/s",
    minLevel: "m",
  } as unknown as UnitsSpec,
};

const Harness = ({
  targets = TARGETS,
  onChange,
}: {
  targets?: VariableSpeedPumpTargets | null;
  onChange?: (control: Control | null) => void;
}) => {
  const [control, setControl] = useState<Control | null>(null);
  return (
    <PumpControlsEditor
      linkId={IDS.PU1}
      initialStatus="on"
      initialSpeed={1}
      control={control}
      tanks={[]}
      variableSpeedPumpTargets={targets ?? undefined}
      onControlChange={(next) => {
        onChange?.(next);
        setControl(next);
      }}
    />
  );
};

const lastControl = (onChange: ReturnType<typeof vi.fn>) =>
  onChange.mock.calls[
    onChange.mock.calls.length - 1
  ][0] as VariableSpeedPumpControl | null;

const selectOption = async (
  user: ReturnType<typeof userEvent.setup>,
  combobox: string,
  option: string,
) => {
  await user.click(screen.getByRole("combobox", { name: combobox }));
  await user.click(await screen.findByRole("option", { name: option }));
};

describe("VariableSpeedPumpControlsEditor", () => {
  it("edits a pressure target", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Type" }));
    expect(
      await screen.findByRole("option", { name: "Flow target" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Pressure target" }));
    expect(lastControl(onChange)).toMatchObject({
      type: "variable-speed-pump",
      linkId: IDS.PU1,
      quantity: "pressure",
      targetId: IDS.J2,
      minSpeed: 0,
      maxSpeed: 1,
      laggedPumpIds: [],
      schedule: [],
    });
    expect(screen.getByRole("combobox", { name: "At node" })).toHaveTextContent(
      "J2 (outlet of this pump)",
    );

    await selectOption(user, "At node", "T1 (tank)");
    expect(lastControl(onChange)).toMatchObject({
      quantity: "level",
      targetId: IDS.T1,
    });
    expect(screen.getByText("Level (m)")).toBeInTheDocument();

    await user.click(
      screen.getByRole("checkbox", { name: "Vary by time of day" }),
    );
    expect(lastControl(onChange)!.schedule).toEqual([{ time: 0, target: 0 }]);
    expect(screen.getByText("Set by schedule")).toBeInTheDocument();
    await user.click(
      screen.getByRole("checkbox", { name: "Vary by time of day" }),
    );
    expect(lastControl(onChange)!.schedule).toEqual([]);

    await user.click(screen.getByRole("checkbox", { name: "Lag pumps" }));
    expect(lastControl(onChange)!.laggedPumpIds).toEqual([IDS.PU2]);

    const minSpeed = screen.getByRole("textbox", {
      name: "Value for: Min speed",
    });
    await user.clear(minSpeed);
    await user.type(minSpeed, "1.2{Enter}");
    expect(lastControl(onChange)!.minSpeed).toBe(1.2);
    expect(
      screen.getByText("Min speed must not be above max speed."),
    ).toBeInTheDocument();

    await selectOption(user, "Type", "Flow target");
    expect(lastControl(onChange)).toMatchObject({
      quantity: "flow",
      minSpeed: 1.2,
      maxSpeed: 1,
      laggedPumpIds: [IDS.PU2],
    });
  });

  it("edits a flow target", async () => {
    permissionsRef.current = resolvePermissions("free", false, false, false);
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { unmount } = render(<Harness onChange={onChange} />);

    await selectOption(user, "Type", "Flow target");
    expect(showPriorityAccessMock).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    unmount();

    permissionsRef.current = entitledPermissions;
    render(
      <Harness
        onChange={onChange}
        targets={{
          ...TARGETS,
          pumps: [aLink<Pump>(IDS.PU1, "PU1", "pump")],
        }}
      />,
    );

    await selectOption(user, "Type", "Flow target");
    expect(lastControl(onChange)).toMatchObject({
      type: "variable-speed-pump",
      quantity: "flow",
      targetId: IDS.PU1,
      laggedPumpIds: [],
      schedule: [],
    });
    expect(screen.getByText("Flow (l/s)")).toBeInTheDocument();

    await selectOption(user, "Flow through", "P1");
    expect(lastControl(onChange)).toMatchObject({
      quantity: "flow",
      targetId: IDS.P1,
    });

    await user.click(
      screen.getByRole("checkbox", { name: "Vary by time of day" }),
    );
    expect(lastControl(onChange)!.schedule).toEqual([{ time: 0, target: 0 }]);
    expect(screen.getByText("Set by schedule")).toBeInTheDocument();

    expect(screen.getByRole("checkbox", { name: "Lag pumps" })).toBeDisabled();
  });
});
