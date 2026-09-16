type RemoteSetpointPrv = {
  valveId: string;
  nodeId: string;
  setting: number;
  upstreamNodeId: string;
};

const REMOTE_SETPOINT_PRV_FUNCTION =
  `function simulate_remote_setpoint_prv(valveId, nodeId, target, upstreamId)
    local current_pressure = node(nodeId).pressure
    local diff = current_pressure - target

    if math.abs(diff) > 0.01 then
        local valve = link(valveId)
        local current_setting = valve.setting
        local proposed_setting = current_setting - diff

        local max_setting = node(upstreamId).pressure
        if proposed_setting > max_setting then
            proposed_setting = max_setting
            print(string.format("Can't regulate Node %s over %.4f\\n                   (requested %.4f)", nodeId, max_setting, target))
        end

        if math.abs(proposed_setting - current_setting) > 0.001 then
            valve.setting = proposed_setting
        end
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
