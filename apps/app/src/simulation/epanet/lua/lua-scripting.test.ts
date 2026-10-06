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
            print(string.format("Can't regulate Node %s over %.4f\\n                   (requested %.4f)", nodeId, max_setting, target))
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

  describe("variable speed pumps", () => {
    it("invokes vsp2_step and vsp2_solved with the pump row, its lagged pumps and its schedule", () => {
      const builder = LuaScriptBuilder();
      builder.withVariableSpeedPump(
        "PU1",
        "level",
        "T1",
        4.5,
        0.3,
        1,
        ["PU2", "PU3"],
        1,
        [
          { time: 0, target: 3 },
          { time: 21600, target: 4.5 },
        ],
      );

      const script = builder.build().join("\n");

      expect(script).toContain("function vsp2_step(pumps, schedules)");
      expect(script).toContain("function on_hydraulic_step()");
      expect(script).toContain("function on_hydraulics_solved()");

      const invocation =
        '{{"PU1","level","T1",4.5,0.3,1,{"PU2","PU3"},1}}, {["PU1"]={{0,3},{21600,4.5}}}';
      expect(script).not.toContain("on_open");
      expect(script).toContain(`vsp2_step(${invocation})`);
      expect(script).toContain(`vsp2_solved(${invocation})`);
    });

    it("combines every pump into one call and passes empty tables when there are no lagged pumps or schedules", () => {
      const builder = LuaScriptBuilder();
      builder.withVariableSpeedPump("PU1", "level", "T1", 4.5, 0.3, 1, [], 1);
      builder.withVariableSpeedPump(
        "PU4",
        "pressure",
        "J9",
        30,
        0.5,
        1,
        ["PU5"],
        -1,
      );

      const script = builder.build().join("\n");

      const invocation =
        '{{"PU1","level","T1",4.5,0.3,1,{},1},{"PU4","pressure","J9",30,0.5,1,{"PU5"},-1}}, {}';
      expect(script).toContain(`vsp2_step(${invocation})`);
      expect(script).toContain(`vsp2_solved(${invocation})`);
    });
  });
});
