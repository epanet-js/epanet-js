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
    it("invokes vsp_step and vsp_solved with the pump row, its lagged pumps and its schedule", () => {
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

      expect(script).toContain("function vsp_step(pumps, schedules)");
      expect(script).toContain("function on_hydraulic_step()");
      expect(script).toContain("function on_hydraulics_solved()");

      const invocation =
        '{{"PU1","level","T1",4.5,0.3,1,{"PU2","PU3"},1}}, {["PU1"]={{0,3},{21600,4.5}}}';
      expect(script).not.toContain("on_open");
      expect(script).toContain(`vsp_step(${invocation})`);
      expect(script).toContain(`vsp_solved(${invocation})`);
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
      expect(script).toContain(`vsp_step(${invocation})`);
      expect(script).toContain(`vsp_solved(${invocation})`);
    });
  });

  describe("flow-modulating valves", () => {
    const linearValve = {
      valveId: "V1",
      points: [
        { flow: 3, pressure: 20 },
        { flow: 5, pressure: 24 },
        { flow: 7, pressure: 30 },
      ],
      interpolate: true,
      sensorLinkId: "V1",
      controlNodeId: "J1",
      isLocal: true,
      inletNodeId: "R1",
      outletNodeId: "J1",
    };

    it("emits the fragment, the valves table and the step handler call for a linear row", () => {
      const builder = LuaScriptBuilder();
      builder.withFlowModulatingValve(linearValve);

      const script = builder.build().join("\n");

      expect(script).toContain(
        "function fmvalveLookup(flow, flows, pressures, interpolate)",
      );
      expect(script).toContain(
        'FMVALVE_VALVES = {\n    {valve_id="V1",flows={3,5,7},pressures={20,24,30},interpolate=true,sensor_link_id="V1",control_node_id="J1",is_local=true,inlet_node_id="R1",outlet_node_id="J1"},\n}',
      );
      expect(script).toContain(
        "function on_hydraulic_step()\n    fmvalve_step(FMVALVE_VALVES)\nend",
      );
      expect(script).not.toContain("function on_hydraulics_solved()");
    });

    it("writes interpolate=false for a step row", () => {
      const builder = LuaScriptBuilder();
      builder.withFlowModulatingValve({ ...linearValve, interpolate: false });

      const script = builder.build().join("\n");

      expect(script).toContain(
        '{valve_id="V1",flows={3,5,7},pressures={20,24,30},interpolate=false,sensor_link_id="V1",control_node_id="J1",is_local=true,inlet_node_id="R1",outlet_node_id="J1"},',
      );
    });

    it("writes the sensor, the remote control node and is_local=false for a remote row", () => {
      const builder = LuaScriptBuilder();
      builder.withFlowModulatingValve({
        ...linearValve,
        sensorLinkId: "P3",
        controlNodeId: "J2",
        isLocal: false,
      });

      const script = builder.build().join("\n");

      expect(script).toContain(
        '{valve_id="V1",flows={3,5,7},pressures={20,24,30},interpolate=true,sensor_link_id="P3",control_node_id="J2",is_local=false,inlet_node_id="R1",outlet_node_id="J1"},',
      );
    });

    it("puts every valve in one table", () => {
      const builder = LuaScriptBuilder();
      builder.withFlowModulatingValve(linearValve);
      builder.withFlowModulatingValve({
        ...linearValve,
        valveId: "V2",
        sensorLinkId: "V2",
      });

      const script = builder.build().join("\n");

      expect(script).toContain(
        'FMVALVE_VALVES = {\n    {valve_id="V1",flows={3,5,7},pressures={20,24,30},interpolate=true,sensor_link_id="V1",control_node_id="J1",is_local=true,inlet_node_id="R1",outlet_node_id="J1"},\n    {valve_id="V2",flows={3,5,7},pressures={20,24,30},interpolate=true,sensor_link_id="V2",control_node_id="J1",is_local=true,inlet_node_id="R1",outlet_node_id="J1"},\n}',
      );
      expect(script.match(/fmvalve_step\(FMVALVE_VALVES\)/g)).toHaveLength(1);
    });

    it("emits the fragments in order and calls each from one pair of handlers", () => {
      const builder = LuaScriptBuilder();
      builder.withFlowModulatingValve(linearValve);
      builder.withVariableSpeedPump("PU1", "pressure", "J9", 30, 0.5, 1, [], 1);
      builder.withRemoteSetpointPrv("V5", "J5", 30, "J6");

      const script = builder.build().join("\n");

      const remotePrv = script.indexOf("function simulate_remote_setpoint_prv");
      const vsp = script.indexOf("function vsp_step(");
      const fmvalve = script.indexOf("function fmvalve_step(");
      expect(remotePrv).toBeGreaterThanOrEqual(0);
      expect(vsp).toBeGreaterThan(remotePrv);
      expect(fmvalve).toBeGreaterThan(vsp);
      expect(script.match(/function on_hydraulic_step\(\)/g)).toHaveLength(1);
      expect(script.match(/function on_hydraulics_solved\(\)/g)).toHaveLength(
        1,
      );
      expect(script).toContain(
        [
          "function on_hydraulic_step()",
          '    simulate_remote_setpoint_prv("V5", "J5", 30, "J6")',
          '    vsp_step({{"PU1","pressure","J9",30,0.5,1,{},1}}, {})',
          "    fmvalve_step(FMVALVE_VALVES)",
          "end",
        ].join("\n"),
      );
      expect(script).toContain(
        [
          "function on_hydraulics_solved()",
          '    vsp_solved({{"PU1","pressure","J9",30,0.5,1,{},1}}, {})',
          "end",
        ].join("\n"),
      );
    });

    it("emits no fragment without a valve", () => {
      const builder = LuaScriptBuilder();
      builder.withRemoteSetpointPrv("V5", "J5", 30, "J6");

      const script = builder.build().join("\n");

      expect(script).not.toContain("fmvalve");
      expect(script).not.toContain("FMVALVE");
    });
  });
});
