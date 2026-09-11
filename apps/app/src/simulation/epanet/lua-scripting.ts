type RemoteSetpointPrv = {
  valveId: string;
  nodeId: string;
  setting: number;
};

const REMOTE_SETPOINT_PRV_FUNCTION =
  `function simulate_remote_setpoint_prv(valveId, nodeId, setting)
    local diff = node(nodeId).pressure - setting
    if math.abs(diff) > 0.01 then
        link(valveId).setting = link(valveId).setting - diff
    end
end`.split("\n");

const onHydraulicStepCallback = (
  inner: string[],
) => `function on_hydraulic_step()
${inner.join("\n")}
end`;

const remoteSetpointPrvInvocation = ({
  valveId,
  nodeId,
  setting,
}: RemoteSetpointPrv) =>
  `simulate_remote_setpoint_prv(${valveId}, ${nodeId}, ${setting})`;

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
    withRemoteSetpointPrv: (valveId: string, nodeId: string, setting: number) =>
      remoteSetpointPrvs.push({ valveId, nodeId, setting }),
    build,
  };
};
