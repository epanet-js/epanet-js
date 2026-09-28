import type { EpanetUnitSystem } from "@epanet-js/project-settings";
import remoteSetpointPrvScript from "./remote-setpoint-prv.lua?raw";
import variableSpeedPumpsScript from "./variable-speed-pumps.lua?raw";

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

const REMOTE_SETPOINT_PRV_FUNCTION = remoteSetpointPrvScript
  .trimEnd()
  .split("\n");

const VARIABLE_SPEED_PUMPS_FUNCTION = variableSpeedPumpsScript
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

export const LuaScriptBuilder = (flowUnits: EpanetUnitSystem) => {
  const remoteSetpointPrvs: RemoteSetpointPrv[] = [];
  const variableSpeedPumps: VariableSpeedPump[] = [];

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
    `${generateVspPumps()}, ${generateVspSchedules()}, "${flowUnits}"`;

  const generateVspOnHydraulicStepLine = () =>
    `    vsp2_step(${generateVspArguments()})`;

  const generateVspOnHydraulicsSolvedLine = () =>
    `    vsp2_solved(${generateVspArguments()})`;

  const build = () => {
    const script = [];
    const onHydraulicStepInner = [];
    const onHydraulicsSolvedInner = [];
    const hasRemoteSetpointPrvs = remoteSetpointPrvs.length > 0;
    const hasVariableSpeedPumps = variableSpeedPumps.length > 0;

    if (hasRemoteSetpointPrvs) {
      script.push(...REMOTE_SETPOINT_PRV_FUNCTION);
      onHydraulicStepInner.push(...generateRemoteSetpointPrvLines());
    }

    if (hasVariableSpeedPumps) {
      script.push(...VARIABLE_SPEED_PUMPS_FUNCTION);
      onHydraulicStepInner.push(generateVspOnHydraulicStepLine());
      onHydraulicsSolvedInner.push(generateVspOnHydraulicsSolvedLine());
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

  return {
    withRemoteSetpointPrv,
    withVariableSpeedPump,
    build,
  };
};
