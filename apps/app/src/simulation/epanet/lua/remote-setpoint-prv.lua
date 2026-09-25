function simulate_remote_setpoint_prv(valveId, nodeId, target, upstreamId)
    local current_pressure = node(nodeId).pressure
    local diff = current_pressure - target

    if math.abs(diff) > 0.01 then
        local valve = link(valveId)
        local current_setting = valve.setting
        local proposed_setting = current_setting - diff

        local max_setting = node(upstreamId).pressure
        if proposed_setting > max_setting then
            proposed_setting = max_setting
            print(string.format("Can't regulate Node %s over %.4f\n                   (requested %.4f)", nodeId, max_setting, target))
        end

        if math.abs(proposed_setting - current_setting) > 0.001 then
            valve.setting = proposed_setting
        end
    end
end
