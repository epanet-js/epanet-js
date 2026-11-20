LOVALVE_SETTING_TOL = 0.01

lovalve_closed = {}

function lovalveOpening(v)
    local tank = node(v.tank_id)
    local level = tank.head - tank.elevation
    if level >= v.close_level then return 0 end
    if level <= v.open_level then return 100 end
    return 100 * (v.close_level - level) / (v.close_level - v.open_level)
end

function lovalveHold(v)
    local valve = link(v.valve_id)
    local closed_here = lovalve_closed[v.valve_id]

    if valve.status == 0 and not closed_here then return end

    local opening = lovalveOpening(v)
    if opening <= 0 then
        if valve.status ~= 0 then valve.status = 0 end
        lovalve_closed[v.valve_id] = true
        return
    end

    if closed_here or math.abs(valve.setting - opening) > LOVALVE_SETTING_TOL then
        valve.setting = opening
        lovalve_closed[v.valve_id] = false
    end
end

function lovalve_step(valves)
    for _, v in ipairs(valves) do lovalveHold(v) end
end
