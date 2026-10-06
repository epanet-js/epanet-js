VSP_PRESSURE_TOL_M = 0.005
VSP_FLOW_TOL_LPS = 0.001
VSP_LEVEL_TOL_M = 0.01
VSP_SPEED_TOL = 0.0001
VSP_MIN_WRITTEN_STEP = 0.0002
VSP_MAX_STEP_WITHOUT_SLOPE = 0.1
VSP_MAX_STEP_ON_LEARNED_SLOPE = 0.25
VSP_LAG_RETRY_SPEED_DROP = 0.01
VSP_SCHEDULE_FROM_S = 0
VSP_UNMEASURED_HEAD = 1e5
VSP_SECONDS_PER_DAY = 86400
VSP_TRACE = false

VSP_FLOW_UNIT_FACTORS = {
    lps  = { tank_volume_per_second = 0.001,       per_lps = 1,                length_per_meter = 1 },
    lpm  = { tank_volume_per_second = 0.001 / 60,  per_lps = 60,               length_per_meter = 1 },
    mld  = { tank_volume_per_second = 1 / 86.4,    per_lps = 0.0864,           length_per_meter = 1 },
    cmh  = { tank_volume_per_second = 1 / 3600,    per_lps = 3.6,              length_per_meter = 1 },
    cmd  = { tank_volume_per_second = 1 / 86400,   per_lps = 86.4,             length_per_meter = 1 },
    cfs  = { tank_volume_per_second = 1,           per_lps = 1 / 28.317,       length_per_meter = 1 / 0.3048 },
    gpm  = { tank_volume_per_second = 1 / 448.831, per_lps = 448.831 / 28.317, length_per_meter = 1 / 0.3048 },
    mgd  = { tank_volume_per_second = 1 / 0.64632, per_lps = 0.64632 / 28.317, length_per_meter = 1 / 0.3048 },
    imgd = { tank_volume_per_second = 1 / 0.5382,  per_lps = 0.5382 / 28.317,  length_per_meter = 1 / 0.3048 },
    afd  = { tank_volume_per_second = 1 / 1.9837,  per_lps = 1.9837 / 28.317,  length_per_meter = 1 / 0.3048 },
}

VSP_PRESSURE_PER_METER = {
    psi = 0.4333 / 0.3048,
    kpa = 0.4333 / 0.3048 * 6.895,
    m   = 1,
    bar = 0.4333 / 0.3048 * 6.895 / 100,
    ft  = 1 / 0.3048,
}

vsp_volume_per_flow_second = 0.001
vsp_flow_tol = VSP_FLOW_TOL_LPS
vsp_pressure_tol = VSP_PRESSURE_TOL_M
vsp_level_tol = VSP_LEVEL_TOL_M
vsp_states = {}
vsp_step_time = -1
vsp_solving_step_time = 0
vsp_skipped_steps = 0
vsp_calls_this_step = 0

function vspRow(fields)
    return {
        pump_id = fields[1],
        kind = fields[2],
        element_id = fields[3],
        target = fields[4],
        min_speed = fields[5],
        max_speed = fields[6],
        lag_ids = fields[7],
        remote_flow_direction = fields[8],
    }
end

function vspSetRunUnits()
    local u = units()
    local flow = VSP_FLOW_UNIT_FACTORS[u.flow]
    if flow == nil then error("VSP: unknown flow units " .. tostring(u.flow)) end
    local pressure_per_meter = VSP_PRESSURE_PER_METER[u.pressure]
    if pressure_per_meter == nil then error("VSP: unknown pressure units " .. tostring(u.pressure)) end
    vsp_volume_per_flow_second = flow.tank_volume_per_second
    vsp_flow_tol = VSP_FLOW_TOL_LPS * flow.per_lps
    vsp_pressure_tol = VSP_PRESSURE_TOL_M * pressure_per_meter
    vsp_level_tol = VSP_LEVEL_TOL_M * flow.length_per_meter
end

function vspClockAt(run_time)
    return (run_time + times().start_time) % VSP_SECONDS_PER_DAY
end

function vspScheduledTarget(schedule, run_time)
    local clock = vspClockAt(run_time)
    local target = schedule[#schedule][2]
    for _, entry in ipairs(schedule) do
        if entry[1] > clock then break end
        target = entry[2]
    end
    return target
end

function vspTarget(row, run_time, schedules)
    local schedule = schedules[row.pump_id]
    if schedule == nil or run_time < VSP_SCHEDULE_FROM_S then return row.target end
    return vspScheduledTarget(schedule, run_time)
end

function vspTankNetInflow(tank_id)
    return node(tank_id).demand
end

function vspTankLevel(tank)
    return tank.head - tank.elevation
end

function vspMeasuredValue(row)
    if row.kind == "level" then return vspTankNetInflow(row.element_id) end
    if row.kind == "flow" then
        if row.element_id == "" then return link(row.pump_id).flow end
        return link(row.element_id).flow * row.remote_flow_direction
    end
    return node(row.element_id).pressure
end

function vspIsMeasured(value)
    return math.abs(value) < VSP_UNMEASURED_HEAD
end

function vspClampedLevelTarget(row, tank, run_time, schedules)
    local target = vspTarget(row, run_time, schedules)
    return math.max(tank.min_level, math.min(tank.max_level, target))
end

function vspTankAreaNearLevel(st, tank, level)
    local volume = tank.tank_volume
    if st.tank_area == nil then st.tank_area = math.pi * tank.tank_diameter ^ 2 / 4 end
    local has_volume_curve = tank.volume_curve ~= 0
    local level_moved = st.previous_level ~= nil and math.abs(level - st.previous_level) > 1e-6
    if has_volume_curve and level_moved then
        local curve_slope = (volume - st.previous_volume) / (level - st.previous_level)
        if curve_slope > 0 then st.tank_area = curve_slope end
    end
    st.previous_level, st.previous_volume = level, volume
    return st.tank_area
end

-- Over times().hydraulic_step, not next_event: a step the engine cuts at a
-- tank limit lands short, and the next step corrects it
function vspRequiredInflow(row, st, run_time, schedules)
    local tank = node(row.element_id)
    local level = vspTankLevel(tank)
    local target = vspClampedLevelTarget(row, tank, run_time, schedules)
    local area = vspTankAreaNearLevel(st, tank, level)
    local flow_per_level = area / (times().hydraulic_step * vsp_volume_per_flow_second)
    local tol = math.min(vsp_level_tol * flow_per_level, vsp_flow_tol / 2)
    return (target - level) * flow_per_level, tol
end

function vspReading(row, st, run_time, schedules)
    local value = vspMeasuredValue(row)
    if row.kind == "level" then
        local required, tol = vspRequiredInflow(row, st, run_time, schedules)
        st.required_inflow = required
        return value, required, tol
    end
    if row.kind == "flow" then return value, vspTarget(row, run_time, schedules), vsp_flow_tol end
    return value, vspTarget(row, run_time, schedules), vsp_pressure_tol
end

function vspRunningLagCount(row)
    local count = 0
    for _, id in ipairs(row.lag_ids) do
        if link(id).setting == 0 then break end
        count = count + 1
    end
    return count
end

function vspCloseLags(row)
    for _, id in ipairs(row.lag_ids) do
        if link(id).setting ~= 0 then link(id).setting = 0 end
    end
end

function vspWriteSpeed(row, st, speed, running_lags)
    link(row.pump_id).setting = speed
    for i = 1, running_lags do link(row.lag_ids[i]).setting = speed end
    st.written_speed = speed
end

function vspResetBracket(row, st)
    st.bracket_low, st.bracket_high = 0, row.max_speed + VSP_SPEED_TOL
    st.halvings = 0
end

function vspTryLagClosed(row, st, running_lags, value, speed)
    link(row.lag_ids[running_lags]).setting = 0
    vspWriteSpeed(row, st, row.max_speed, running_lags - 1)
    st.lag_on_trial = running_lags
    st.speed_before_trial = speed
    st.previous_speed, st.previous_value = row.max_speed, value
    vspResetBracket(row, st)
end

function vspNewState(speed)
    return {
        previous_speed = speed,
        previous_value = nil,
        step_time = -1,
        lag_on_trial = 0,
        speed_before_trial = speed,
        failed_trial_speed = -1,
        slope = nil,
        settled_speed = speed,
        written_speed = nil,
        held_by_control = false,
        restored_settled_speed = false,
        first_call_of_step = false,
        required_inflow = 0,
    }
end

function vspStateFor(row, speed)
    local st = vsp_states[row.pump_id]
    if st == nil then
        st = vspNewState(speed)
        vspResetBracket(row, st)
        vsp_states[row.pump_id] = st
    end
    return st
end

function vspStartStep(row, st, speed)
    st.step_time = vsp_step_time
    st.lag_on_trial = 0
    st.written_speed = nil
    st.held_by_control = false
    st.restored_settled_speed = false
    st.first_call_of_step = true
    st.previous_speed, st.previous_value = speed, nil
    vspResetBracket(row, st)
end

-- An OPEN control writes 1 on every solve while its condition holds, so a
-- write it undoes is its step; a differing speed at a step's first call is
-- its leftover, replaced by the speed the search last settled at
function vspYieldedToControl(row, st, speed, value, running_lags)
    if st.written_speed ~= nil then
        local write_undone = math.abs(speed - st.written_speed) > VSP_SPEED_TOL
        if write_undone then st.held_by_control = true end
        return write_undone
    end
    local control_moved_speed = st.first_call_of_step and st.settled_speed > 0
        and math.abs(speed - st.settled_speed) > VSP_SPEED_TOL
    if not control_moved_speed then return false end
    vspWriteSpeed(row, st, st.settled_speed, running_lags)
    st.restored_settled_speed = true
    st.previous_speed, st.previous_value = speed, value
    return true
end

function vspStartedLagTrial(row, st, speed, value, running_lags)
    if not st.first_call_of_step then return false end
    st.first_call_of_step = false
    if running_lags == 0 then return false end
    local no_failed_trial = st.failed_trial_speed < 0
    local well_below_failed_trial = speed < st.failed_trial_speed - VSP_LAG_RETRY_SPEED_DROP
    if not (no_failed_trial or well_below_failed_trial) then return false end
    vspTryLagClosed(row, st, running_lags, value, speed)
    return true
end

function vspJudgedLagTrial(row, st, value, target, tol, running_lags)
    if st.lag_on_trial == 0 then return false end
    local lag = st.lag_on_trial
    st.lag_on_trial = 0
    local short_without_lag = value < target - tol
    if short_without_lag then
        vspWriteSpeed(row, st, st.speed_before_trial, lag)
        st.failed_trial_speed = st.speed_before_trial
        st.previous_speed, st.previous_value = st.speed_before_trial, value
        vspResetBracket(row, st)
        return true
    end
    st.failed_trial_speed = -1
    if running_lags == 0 then return false end
    vspTryLagClosed(row, st, running_lags, value, st.speed_before_trial)
    return true
end

function vspOpenedNextLag(row, st, speed, value, target, running_lags)
    local at_max_speed = speed >= row.max_speed - VSP_SPEED_TOL
    local has_lag_to_open = running_lags < #row.lag_ids
    if not (value < target and at_max_speed and has_lag_to_open) then return false end
    link(row.lag_ids[running_lags + 1]).setting = row.max_speed
    st.failed_trial_speed = -1
    st.previous_speed, st.previous_value = row.max_speed, value
    vspResetBracket(row, st)
    return true
end

-- Maximum speed is what reopens a check valve or a pump stopped below its
-- shutoff head
function vspRunAtMaxSpeed(row, st, speed, running_lags)
    if speed >= row.max_speed - VSP_SPEED_TOL then return end
    vspWriteSpeed(row, st, row.max_speed, running_lags)
    st.previous_speed, st.previous_value = speed, nil
end

function vspNarrowBracket(st, speed, value, target)
    if value < target then
        st.bracket_low = math.max(st.bracket_low, speed)
    else
        st.bracket_high = math.min(st.bracket_high, speed)
    end
end

function vspSlopeFromLastPair(st, speed, value)
    if st.previous_value == nil then return nil end
    if math.abs(st.previous_speed - speed) < VSP_SPEED_TOL then return nil end
    if math.abs(value - st.previous_value) < 1e-6 then return nil end
    local slope = (value - st.previous_value) / (speed - st.previous_speed)
    if slope <= 0 then return nil end
    return slope
end

function vspClampedStep(speed, new_speed, max_step)
    return math.max(speed - max_step, math.min(speed + max_step, new_speed))
end

function vspProposedSpeed(st, speed, value, target)
    local slope = vspSlopeFromLastPair(st, speed, value)
    if slope ~= nil then
        st.slope = slope
        return speed + (target - value) / slope
    end
    if st.slope ~= nil then
        return vspClampedStep(speed, speed + (target - value) / st.slope, VSP_MAX_STEP_ON_LEARNED_SLOPE)
    end
    local new_speed
    if value > 0 and target > 0 then new_speed = speed * (target / value)
    elseif value < target then new_speed = speed + VSP_MAX_STEP_WITHOUT_SLOPE
    else new_speed = speed - VSP_MAX_STEP_WITHOUT_SLOPE end
    return vspClampedStep(speed, new_speed, VSP_MAX_STEP_WITHOUT_SLOPE)
end

function vspNextSpeed(row, st, speed, value, target)
    local new_speed = vspProposedSpeed(st, speed, value, target)
    local too_small_to_write = math.abs(new_speed - speed) <= VSP_SPEED_TOL
    if too_small_to_write then
        if value < target then new_speed = speed + VSP_MIN_WRITTEN_STEP else new_speed = speed - VSP_MIN_WRITTEN_STEP end
    end
    return math.max(row.min_speed, math.min(row.max_speed, new_speed))
end

-- A bracket end the search keeps halving towards was set while something
-- else moved the value (another row's write, a valve another handler opened)
function vspForgetBracketEnd(row, st, new_speed)
    if new_speed <= st.bracket_low then
        st.bracket_low = 0
    else
        st.bracket_high = row.max_speed + VSP_SPEED_TOL
    end
end

function vspKeptInsideBracket(row, st, speed, new_speed)
    local inside = new_speed > st.bracket_low and new_speed < st.bracket_high
    if inside then
        st.halvings = 0
        return new_speed
    end
    local midpoint = math.max(row.min_speed, (st.bracket_low + math.min(st.bracket_high, row.max_speed)) / 2)
    local halving_too_small = math.abs(midpoint - speed) <= VSP_SPEED_TOL
    if st.halvings >= 1 or halving_too_small then
        vspForgetBracketEnd(row, st, new_speed)
        st.halvings = 0
        return new_speed
    end
    st.halvings = st.halvings + 1
    return midpoint
end

function vspHold(row, schedules)
    local speed = link(row.pump_id).setting
    local st = vspStateFor(row, speed)
    if st.step_time ~= vsp_step_time then vspStartStep(row, st, speed) end

    if speed == 0 then
        vspCloseLags(row)
        return
    end
    if st.held_by_control then return end

    local value, target, tol = vspReading(row, st, vsp_step_time, schedules)
    local running_lags = vspRunningLagCount(row)
    if vspYieldedToControl(row, st, speed, value, running_lags) then return end
    if vspStartedLagTrial(row, st, speed, value, running_lags) then return end
    if vspJudgedLagTrial(row, st, value, target, tol, running_lags) then return end
    if math.abs(value - target) <= tol then return end
    if vspOpenedNextLag(row, st, speed, value, target, running_lags) then return end
    if not vspIsMeasured(value) then
        vspRunAtMaxSpeed(row, st, speed, running_lags)
        return
    end

    vspNarrowBracket(st, speed, value, target)
    local new_speed = vspKeptInsideBracket(row, st, speed, vspNextSpeed(row, st, speed, value, target))
    if math.abs(new_speed - speed) > VSP_SPEED_TOL then
        vspWriteSpeed(row, st, new_speed, running_lags)
        st.previous_speed, st.previous_value = speed, value
    end
end

function vspPrint(row, pump_id, run_time, speed, reported_value, target, level_fields, running_pumps, step_skipped)
    local st = vsp_states[row.pump_id]
    local held_by_control, restored = 0, 0
    if st ~= nil and st.held_by_control then held_by_control = 1 end
    if st ~= nil and st.restored_settled_speed then restored = 1 end
    print(string.format("VSP t=%d pump=%s speed=%.7f %s=%.4f target=%.4f%s calls=%d running=%d forced=%d restored=%d skipped=%d skips=%d",
          run_time, pump_id, speed, row.kind, reported_value, target, level_fields, vsp_calls_this_step, running_pumps,
          held_by_control, restored, step_skipped, vsp_skipped_steps))
end

function vspRefresh(row, run_time, step_skipped, schedules)
    local speed = link(row.pump_id).setting
    local value = vspMeasuredValue(row)
    local st = vsp_states[row.pump_id]
    local target, tol = vspTarget(row, run_time, schedules), vsp_pressure_tol
    if row.kind == "flow" then tol = vsp_flow_tol end
    local reported_value, level_fields = value, ""
    if row.kind == "level" then
        local tank = node(row.element_id)
        reported_value = vspTankLevel(tank)
        target = vspClampedLevelTarget(row, tank, run_time, schedules)
        local required = 0
        if st then required = st.required_inflow end
        level_fields = string.format(" inflow=%.4f required=%.4f", value, required)
        tol = vsp_level_tol
    end
    if st then
        st.previous_speed, st.previous_value = speed, value
        if speed > 0 and not st.held_by_control then st.settled_speed = speed end
    end
    local running_pumps = 0
    if speed ~= 0 then running_pumps = 1 + vspRunningLagCount(row) end
    if VSP_TRACE then
        vspPrint(row, row.pump_id, run_time, speed, reported_value, target, level_fields, running_pumps, step_skipped)
        for _, id in ipairs(row.lag_ids) do
            vspPrint(row, id, run_time, link(id).setting, reported_value, target, level_fields, running_pumps, step_skipped)
        end
    end
    local short_of_target = reported_value < target - tol
    if row.kind == "level" and st then short_of_target = value < st.required_inflow - vsp_flow_tol end
    local every_pump_at_max = speed > 0 and speed >= row.max_speed - VSP_SPEED_TOL and running_pumps > #row.lag_ids
    if every_pump_at_max and short_of_target then
        print(string.format("WARNING: VSP run for pump %s: maximum pump capacity insufficient to meet target", row.pump_id))
    end
end

function vsp_step(pumps, schedules)
    vspSetRunUnits()
    local run_time = times().hydraulic_time
    if run_time ~= vsp_step_time then vsp_calls_this_step = 0 end
    vsp_calls_this_step = vsp_calls_this_step + 1
    vsp_step_time = run_time
    for _, fields in ipairs(pumps) do vspHold(vspRow(fields), schedules) end
end

function vsp_solved(pumps, schedules)
    vspSetRunUnits()
    local run_time = vsp_solving_step_time
    local step_skipped = 0
    if vsp_step_time ~= run_time then
        step_skipped = 1
        vsp_skipped_steps = vsp_skipped_steps + 1
    end
    for _, fields in ipairs(pumps) do vspRefresh(vspRow(fields), run_time, step_skipped, schedules) end
    vsp_solving_step_time = times().hydraulic_time
end
