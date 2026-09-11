import { LuaScriptBuilder } from "./lua-scripting";

const luaScriptWithRemoteSetpointPrvs = `function simulate_remote_setpoint_prv(valveId, nodeId, setting)
    local diff = node(nodeId).pressure - setting
    if math.abs(diff) > 0.01 then
        link(valveId).setting = link(valveId).setting - diff
    end
end
function on_hydraulic_step()
    simulate_remote_setpoint_prv(1, 2, 30)
    simulate_remote_setpoint_prv(3, 4, 40)
end`;

describe("LuaScriptBuilder", () => {
  it("emits an empty script when no remote setpoint PRVs are added", () => {
    const builder = LuaScriptBuilder();

    expect(builder.build()).toEqual([]);
  });

  it("emits the function and both invocations inside on_hydraulic_step", () => {
    const builder = LuaScriptBuilder();
    builder.withRemoteSetpointPrv("1", "2", 30);
    builder.withRemoteSetpointPrv("3", "4", 40);

    const script = builder.build();

    expect(script.join("\n")).toBe(luaScriptWithRemoteSetpointPrvs);
  });
});
