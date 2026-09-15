import { LuaScriptBuilder } from "./lua-scripting";

const luaScriptWithRemoteSetpointPrvs = `function simulate_remote_setpoint_prv(valveId, nodeId, target, upstreamId)
    local current_pressure = node(nodeId).pressure
    local diff = current_pressure - target

    if math.abs(diff) > 0.01 then
        local valve = link(valveId)
        local current_setting = valve.setting
        local proposed_setting = current_setting - diff

        local max_setting = node(upstreamId).pressure
        if proposed_setting > max_setting then
            proposed_setting = max_setting
            print(string.format("WARNING: Can't regulate Node %s\\n                          over %f (requested %f)", nodeId, max_setting, target))
        end

        if math.abs(proposed_setting - current_setting) > 0.001 then
            valve.setting = proposed_setting
        end
    end
end
function on_hydraulic_step()
    simulate_remote_setpoint_prv("1", "2", 30, "3")
    simulate_remote_setpoint_prv("4", "5", 40, "6")
end`;

describe("LuaScriptBuilder", () => {
  it("emits an empty script when no remote setpoint PRVs are added", () => {
    const builder = LuaScriptBuilder();

    expect(builder.build()).toEqual([]);
  });

  it("emits the function and both invocations inside on_hydraulic_step", () => {
    const builder = LuaScriptBuilder();
    builder.withRemoteSetpointPrv("1", "2", 30, "3");
    builder.withRemoteSetpointPrv("4", "5", 40, "6");

    const script = builder.build();

    expect(script.join("\n")).toBe(luaScriptWithRemoteSetpointPrvs);
  });
});
