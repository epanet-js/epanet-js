import remoteSetpointPrvScript from "./remote-setpoint-prv.lua?raw";

type RemoteSetpointPrv = {
  valveId: string;
  nodeId: string;
  setting: number;
  upstreamNodeId: string;
};

const REMOTE_SETPOINT_PRV_FUNCTION = remoteSetpointPrvScript
  .trimEnd()
  .split("\n");

const onHydraulicStepCallback = (
  inner: string[],
) => `function on_hydraulic_step()
${inner.join("\n")}
end`;

const remoteSetpointPrvInvocation = ({
  valveId,
  nodeId,
  setting,
  upstreamNodeId,
}: RemoteSetpointPrv) =>
  `simulate_remote_setpoint_prv("${valveId}", "${nodeId}", ${setting}, "${upstreamNodeId}")`;

export const LuaScriptBuilder = () => {
  const remoteSetpointPrvs: RemoteSetpointPrv[] = [];

  const generateRemoteSetpointPrvLines = () =>
    remoteSetpointPrvs.map((prv) => `    ${remoteSetpointPrvInvocation(prv)}`);

  const build = () => {
    const script = [];
    const hasRemoteSetpointPrvs = remoteSetpointPrvs.length > 0;

    if (hasRemoteSetpointPrvs) {
      script.push(...REMOTE_SETPOINT_PRV_FUNCTION);
    }

    const onHydraulicStepInner = hasRemoteSetpointPrvs
      ? generateRemoteSetpointPrvLines()
      : [];

    if (onHydraulicStepInner.length > 0) {
      script.push(onHydraulicStepCallback(onHydraulicStepInner));
    }

    return script;
  };

  return {
    withRemoteSetpointPrv: (
      valveId: string,
      nodeId: string,
      setting: number,
      upstreamNodeId: string,
    ) => remoteSetpointPrvs.push({ valveId, nodeId, setting, upstreamNodeId }),
    build,
  };
};
