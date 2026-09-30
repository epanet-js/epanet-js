import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { getDefaultStore } from "jotai";
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
import { highlightsAtom } from "src/state/highlights";
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

const aNode = (
  id: number,
  label: string,
  type: NodeAsset["type"],
  levels: { minLevel?: number; maxLevel?: number } = {},
) =>
  ({
    id,
    label,
    type,
    isNode: true,
    coordinates: [0, 0],
    feature: { properties: { type } },
    ...levels,
  }) as unknown as NodeAsset;

const aLink = <T,>(id: number, label: string, type: string) =>
  ({ id, label, type, isNode: false }) as unknown as T;

const TARGETS: VariableSpeedPumpTargets = {
  nodes: [
    aNode(IDS.J1, "J1", "junction"),
    aNode(IDS.J2, "J2", "junction"),
    aNode(IDS.T1, "T1", "tank", { minLevel: 1, maxLevel: 5 }),
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

const typeValue = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  value: string,
) => {
  const input = screen.getByRole("textbox", { name: `Value for: ${label}` });
  await user.clear(input);
  await user.type(input, `${value}{Enter}`);
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

    const atNode = screen.getByRole("combobox", { name: "At node" });
    await user.hover(atNode);
    expect(getDefaultStore().get(highlightsAtom)).toEqual([
      { type: "marker", coordinates: [0, 0], nodeType: "tank" },
    ]);
    await user.unhover(atNode);
    expect(getDefaultStore().get(highlightsAtom)).toEqual([]);

    await user.click(
      screen.getByRole("checkbox", { name: "Start/stop at tank level" }),
    );
    expect(lastControl(onChange)!.tankLevels).toEqual({
      tankId: IDS.T1,
      offLevel: 5,
      onLevel: 1,
    });
    expect(
      screen.queryByRole("combobox", { name: "Tank" }),
    ).not.toBeInTheDocument();

    const callsBeforeInvalid = onChange.mock.calls.length;
    await typeValue(user, "On below (m)", "6");
    expect(onChange.mock.calls.length).toBe(callsBeforeInvalid);
    expect(
      screen.getByText("On level must be below the off level.", {
        exact: false,
      }),
    ).toBeInTheDocument();
    await typeValue(user, "On below (m)", "2");
    expect(lastControl(onChange)!.tankLevels).toEqual({
      tankId: IDS.T1,
      offLevel: 5,
      onLevel: 2,
    });

    await user.click(atNode);
    await user.click(
      await screen.findByRole("button", { name: "J2 (outlet of this pump)" }),
    );
    expect(lastControl(onChange)).toMatchObject({
      quantity: "pressure",
      targetId: IDS.J2,
      tankLevels: undefined,
    });
    expect(
      screen.queryByRole("checkbox", { name: "Start/stop at tank level" }),
    ).not.toBeInTheDocument();

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
    expect(lastControl(onChange)!.laggedPumpIds).toEqual([]);
    expect(screen.getByRole("checkbox", { name: "Lag pumps" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "None" }));
    await user.click(await screen.findByRole("option", { name: "PU2" }));
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

    await user.click(
      screen.getByRole("checkbox", { name: "Start/stop at tank level" }),
    );
    expect(lastControl(onChange)!.tankLevels).toEqual({
      tankId: IDS.T1,
      offLevel: 5,
      onLevel: 1,
    });
    expect(screen.getByRole("combobox", { name: "Tank" })).toHaveTextContent(
      "T1",
    );

    await selectOption(user, "Flow through", "P1");
    expect(lastControl(onChange)).toMatchObject({
      quantity: "flow",
      targetId: IDS.P1,
    });

    const flowThrough = screen.getByRole("combobox", { name: "Flow through" });
    await user.hover(flowThrough);
    expect(getDefaultStore().get(highlightsAtom)).toEqual([
      { type: "asset", assetId: IDS.P1 },
    ]);

    await user.click(flowThrough);
    await user.click(await screen.findByRole("button", { name: "This pump" }));
    expect(lastControl(onChange)).toMatchObject({ targetId: IDS.PU1 });

    await user.click(
      screen.getByRole("checkbox", { name: "Vary by time of day" }),
    );
    expect(lastControl(onChange)!.schedule).toEqual([{ time: 0, target: 0 }]);
    expect(screen.getByText("Set by schedule")).toBeInTheDocument();

    expect(screen.getByRole("checkbox", { name: "Lag pumps" })).toBeDisabled();
  });
});
