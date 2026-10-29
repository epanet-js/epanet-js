FMVALVE_TOL_M         = 0.01
FMVALVE_REMOTE_TOL_M  = 0.01
FMVALVE_SETTING_TOL_M = 0.001
FMVALVE_MIN_SETTING_M = 0.01

FMVALVE_PRESSURE_PER_METER = {
    psi = 0.4333 / 0.3048,
    kpa = 0.4333 / 0.3048 * 6.895,
    m   = 1,
    bar = 0.4333 / 0.3048 * 6.895 / 100,
    ft  = 1 / 0.3048,
}

FMVALVE_US_FLOW_UNITS = { cfs = true, gpm = true, mgd = true, imgd = true, afd = true }

fmvalve_tol            = FMVALVE_TOL_M
fmvalve_remote_tol     = FMVALVE_REMOTE_TOL_M
fmvalve_setting_tol    = FMVALVE_SETTING_TOL_M
fmvalve_min_setting    = FMVALVE_MIN_SETTING_M
fmvalve_pressure_per_length = 1

function fmvalveSetRunUnits()
    local u = units()
    local pressure_per_meter = FMVALVE_PRESSURE_PER_METER[u.pressure]
    if pressure_per_meter == nil then error("FMVALVE: unknown pressure units " .. tostring(u.pressure)) end
    fmvalve_tol = FMVALVE_TOL_M * pressure_per_meter
    fmvalve_remote_tol = FMVALVE_REMOTE_TOL_M * pressure_per_meter
    fmvalve_setting_tol = FMVALVE_SETTING_TOL_M * pressure_per_meter
    fmvalve_min_setting = FMVALVE_MIN_SETTING_M * pressure_per_meter
    fmvalve_pressure_per_length = pressure_per_meter
    if FMVALVE_US_FLOW_UNITS[u.flow] then fmvalve_pressure_per_length = pressure_per_meter * 0.3048 end
end

function fmvalveLookup(flow, flows, pressures, interpolate)
    if flow <= flows[1] then return pressures[1] end
    if flow >= flows[#flows] then return pressures[#flows] end
    if not interpolate then
        local held = pressures[1]
        for i = 1, #flows do if flow >= flows[i] then held = pressures[i] end end
        return held
    end
    for i = 1, #flows - 1 do
        if flow <= flows[i + 1] then
            local span = flows[i + 1] - flows[i]
            if span <= 0 then return pressures[i + 1] end
            return pressures[i] + (flow - flows[i]) / span * (pressures[i + 1] - pressures[i])
        end
    end
    return pressures[#pressures]
end

function fmvalveTarget(v)
    return fmvalveLookup(math.abs(link(v.sensor_link_id).flow), v.flows, v.pressures, v.interpolate)
end

function fmvalveCap(v)
    return (node(v.inlet_node_id).head - node(v.outlet_node_id).elevation) * fmvalve_pressure_per_length
end

function fmvalveHoldLocal(valve, setting, target)
    if math.abs(target - setting) > fmvalve_tol then
        valve.setting = target
    end
end

function fmvalveHoldRemote(v, valve, setting, target)
    local diff = node(v.control_node_id).pressure - target
    if math.abs(diff) <= fmvalve_remote_tol then return end

    local proposed = setting - diff
    local cap = fmvalveCap(v)
    if proposed > cap then proposed = cap end
    if proposed < fmvalve_min_setting then proposed = fmvalve_min_setting end

    if math.abs(proposed - setting) > fmvalve_setting_tol then
        valve.setting = proposed
    end
end

function fmvalveHold(v)
    local valve   = link(v.valve_id)
    local setting = valve.setting

    if setting == 0 then return end

    local target = fmvalveTarget(v)
    if v.is_local then
        fmvalveHoldLocal(valve, setting, target)
    else
        fmvalveHoldRemote(v, valve, setting, target)
    end
end

function fmvalve_step(valves)
    fmvalveSetRunUnits()
    for _, v in ipairs(valves) do fmvalveHold(v) end
end
