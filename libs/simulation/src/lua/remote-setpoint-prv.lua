RMPRV_MIN_SETTING = 0.01
RMPRV_PRESSURE_TOL = 0.01
RMPRV_SETTING_TOL = 0.001

function simulate_remote_setpoint_prv(valveId, nodeId, target, upstreamId)
    local current_pressure = node(nodeId).pressure
    local diff = current_pressure - target

    if math.abs(diff) > RMPRV_PRESSURE_TOL then
        local valve = link(valveId)
        local current_setting = valve.setting
        local proposed_setting = current_setting - diff

        local max_setting = node(upstreamId).pressure
        if proposed_setting > max_setting then
            proposed_setting = max_setting
            print(string.format("Can't regulate Node %s over %.4f\n                   (requested %.4f)", nodeId, max_setting, target))
        elseif proposed_setting < RMPRV_MIN_SETTING then
            proposed_setting = RMPRV_MIN_SETTING
        end

        if math.abs(proposed_setting - current_setting) > RMPRV_SETTING_TOL then
            valve.setting = proposed_setting
        end
    end
end
