// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./lua-raw.d.ts" />
import remoteSetpointPrvScript from "./remote-setpoint-prv.lua?raw";
import variableSpeedPumpsScript from "./variable-speed-pumps.lua?raw";
import flowModulatingValvesScript from "./flow-modulating-valves.lua?raw";

type RemoteSetpointPrv = {
  valveId: string;
  nodeId: string;
  setting: number;
  upstreamNodeId: string;
};

type VspSchedulePoint = {
  time: number;
  target: number;
};

type VariableSpeedPump = {
  pumpId: string;
  type: "pressure" | "level" | "flow";
  targetId: string;
  target: number;
  minSpeed: number;
  maxSpeed: number;
  laggedPumpIds: string[];
  remoteFlowDirection: 1 | -1;
  schedule: VspSchedulePoint[];
};

type FlowModulatingValvePoint = {
  flow: number;
  pressure: number;
};

type FlowModulatingValve = {
  valveId: string;
  points: FlowModulatingValvePoint[];
  interpolate: boolean;
  sensorLinkId: string;
  controlNodeId: string;
  isLocal: boolean;
  inletNodeId: string;
  outletNodeId: string;
};

const REMOTE_SETPOINT_PRV_FUNCTION = remoteSetpointPrvScript
  .trimEnd()
  .split("\n");

const VARIABLE_SPEED_PUMPS_FUNCTION = variableSpeedPumpsScript
  .trimEnd()
  .split("\n");

const FLOW_MODULATING_VALVES_FUNCTION = flowModulatingValvesScript
  .trimEnd()
  .split("\n");

const onHydraulicStepCallback = (
  inner: string[],
) => `function on_hydraulic_step()
${inner.join("\n")}
end`;

const onHydraulicsSolvedCallback = (
  inner: string[],
) => `function on_hydraulics_solved()
${inner.join("\n")}
end`;

const remoteSetpointPrvInvocation = ({
  valveId,
  nodeId,
  setting,
  upstreamNodeId,
}: RemoteSetpointPrv) =>
  `simulate_remote_setpoint_prv("${valveId}", "${nodeId}", ${setting}, "${upstreamNodeId}")`;

const luaStringList = (ids: string[]) =>
  `{${ids.map((id) => `"${id}"`).join(",")}}`;

const variableSpeedPumpStruct = ({
  pumpId,
  type,
  targetId,
  target,
  minSpeed,
  maxSpeed,
  laggedPumpIds,
  remoteFlowDirection,
}: VariableSpeedPump) =>
  `{"${pumpId}","${type}","${targetId}",${target},${minSpeed},${maxSpeed},${luaStringList(laggedPumpIds)},${remoteFlowDirection}}`;

const variableSpeedPumpSchedule = (schedule: VspSchedulePoint[]) =>
  `{${schedule.map(({ time, target }) => `{${time},${target}}`).join(",")}}`;

const luaNumberList = (values: number[]) => `{${values.join(",")}}`;

const flowModulatingValveStruct = ({
  valveId,
  points,
  interpolate,
  sensorLinkId,
  controlNodeId,
  isLocal,
  inletNodeId,
  outletNodeId,
}: FlowModulatingValve) =>
  "{" +
  [
    `valve_id="${valveId}"`,
    `flows=${luaNumberList(points.map((p) => p.flow))}`,
    `pressures=${luaNumberList(points.map((p) => p.pressure))}`,
    `interpolate=${interpolate}`,
    `sensor_link_id="${sensorLinkId}"`,
    `control_node_id="${controlNodeId}"`,
    `is_local=${isLocal}`,
    `inlet_node_id="${inletNodeId}"`,
    `outlet_node_id="${outletNodeId}"`,
  ].join(",") +
  "}";

export const LuaScriptBuilder = () => {
  const remoteSetpointPrvs: RemoteSetpointPrv[] = [];
  const variableSpeedPumps: VariableSpeedPump[] = [];
  const flowModulatingValves: FlowModulatingValve[] = [];

  const generateRemoteSetpointPrvLines = () =>
    remoteSetpointPrvs.map((prv) => `    ${remoteSetpointPrvInvocation(prv)}`);

  const generateVspPumps = () =>
    `{${variableSpeedPumps.map(variableSpeedPumpStruct).join(",")}}`;

  const generateVspSchedules = () => {
    const entries = variableSpeedPumps
      .filter((vsp) => vsp.schedule.length > 0)
      .map(
        (vsp) => `["${vsp.pumpId}"]=${variableSpeedPumpSchedule(vsp.schedule)}`,
      );
    return `{${entries.join(",")}}`;
  };

  const generateVspArguments = () =>
    `${generateVspPumps()}, ${generateVspSchedules()}`;

  const generateVspOnHydraulicStepLine = () =>
    `    vsp_step(${generateVspArguments()})`;

  const generateVspOnHydraulicsSolvedLine = () =>
    `    vsp_solved(${generateVspArguments()})`;

  const generateFlowModulatingValvesTable = () => [
    "FMVALVE_VALVES = {",
    ...flowModulatingValves.map(
      (valve) => `    ${flowModulatingValveStruct(valve)},`,
    ),
    "}",
  ];

  const build = () => {
    const script = [];
    const onHydraulicStepInner = [];
    const onHydraulicsSolvedInner = [];
    const hasRemoteSetpointPrvs = remoteSetpointPrvs.length > 0;
    const hasVariableSpeedPumps = variableSpeedPumps.length > 0;
    const hasFlowModulatingValves = flowModulatingValves.length > 0;

    if (hasRemoteSetpointPrvs) {
      script.push(...REMOTE_SETPOINT_PRV_FUNCTION);
      onHydraulicStepInner.push(...generateRemoteSetpointPrvLines());
    }

    if (hasVariableSpeedPumps) {
      script.push(...VARIABLE_SPEED_PUMPS_FUNCTION);
      onHydraulicStepInner.push(generateVspOnHydraulicStepLine());
      onHydraulicsSolvedInner.push(generateVspOnHydraulicsSolvedLine());
    }

    if (hasFlowModulatingValves) {
      script.push(...FLOW_MODULATING_VALVES_FUNCTION);
      script.push(...generateFlowModulatingValvesTable());
      onHydraulicStepInner.push("    fmvalve_step(FMVALVE_VALVES)");
    }

    if (onHydraulicStepInner.length > 0) {
      script.push(onHydraulicStepCallback(onHydraulicStepInner));
    }

    if (onHydraulicsSolvedInner.length > 0) {
      script.push(onHydraulicsSolvedCallback(onHydraulicsSolvedInner));
    }

    return script;
  };

  const withRemoteSetpointPrv = (
    valveId: string,
    nodeId: string,
    setting: number,
    upstreamNodeId: string,
  ) => remoteSetpointPrvs.push({ valveId, nodeId, setting, upstreamNodeId });

  const withVariableSpeedPump = (
    pumpId: string,
    type: "pressure" | "level" | "flow",
    targetId: string,
    target: number,
    minSpeed: number,
    maxSpeed: number,
    laggedPumpIds: string[],
    remoteFlowDirection: 1 | -1,
    schedule: VspSchedulePoint[] = [],
  ) =>
    variableSpeedPumps.push({
      pumpId,
      type,
      targetId,
      target,
      minSpeed,
      maxSpeed,
      laggedPumpIds,
      remoteFlowDirection,
      schedule,
    });

  const withFlowModulatingValve = (valve: FlowModulatingValve) =>
    flowModulatingValves.push(valve);

  return {
    withRemoteSetpointPrv,
    withVariableSpeedPump,
    withFlowModulatingValve,
    build,
  };
};
