VSP2_TOL         = 0.005   -- acceptable error in a held pressure, in metres of water
VSP2_FLOW_TOL    = 0.001   -- acceptable error in a held flow, and in a level row's net inflow, in L/s
VSP2_LEVEL_TOL   = 0.01   -- how close a level row lands its tank on the target at the end of a step, in metres
VSP2_SPEED_TOL   = 0.0001   -- smallest speed change worth writing
VSP2_MIN_STEP    = 0.0002   -- the step taken outside the tolerance when the search's own is too small to write
VSP2_RATIO_STEP  = 0.1      -- largest speed change a step without a slope takes
VSP2_WARM_STEP   = 0.25     -- largest speed change a step on the slope learned earlier takes
VSP2_TRIAL_SPEED_DROP = 0.01   -- how far the speed falls below a failed trial's before a lag is tried closed again
VSP2_SCHEDULE_FROM = 0   -- the run time a schedule is in force from, s; before it a row holds its own target

-- Per units().flow: the tank_volume one unit of flow moves in a second
-- (m^3 under SI flow units, ft^3 under US ones), the units in one L/s, and
-- the length units in one metre (feet under US flow units).
-- Built on EPANET's own factors per CFS
VSP2_UNIT_FACTORS = {
    lps  = { 0.001,       1,                1 },
    lpm  = { 0.001 / 60,  60,               1 },
    mld  = { 1 / 86.4,    0.0864,           1 },
    cmh  = { 1 / 3600,    3.6,              1 },
    cmd  = { 1 / 86400,   86.4,             1 },
    cfs  = { 1,           1 / 28.317,       1 / 0.3048 },
    gpm  = { 1 / 448.831, 448.831 / 28.317, 1 / 0.3048 },
    mgd  = { 1 / 0.64632, 0.64632 / 28.317, 1 / 0.3048 },
    imgd = { 1 / 0.5382,  0.5382 / 28.317,  1 / 0.3048 },
    afd  = { 1 / 1.9837,  1.9837 / 28.317,  1 / 0.3048 },
}

-- Per units().pressure: the pressure units in one metre of water, on
-- EPANET's own factors (psi per ft, kPa per psi)
VSP2_PRESSURE_PER_METER = {
    psi = 0.4333 / 0.3048,
    kpa = 0.4333 / 0.3048 * 6.895,
    m   = 1,
    bar = 0.4333 / 0.3048 * 6.895 / 100,
    ft  = 1 / 0.3048,
}
-- ================================================================

vsp2_flow_to_volume = 0.001  -- VSP2_UNIT_FACTORS' first column for the run's flow units
vsp2_flow_tol    = VSP2_FLOW_TOL   -- VSP2_FLOW_TOL in the run's flow units
vsp2_pressure_tol = VSP2_TOL       -- VSP2_TOL in the run's pressure units
vsp2_level_tol   = VSP2_LEVEL_TOL  -- VSP2_LEVEL_TOL in the run's length units
vsp2_state       = {}     -- per row: the search's memory
vsp2_step_time   = -1     -- the clock at the latest on_hydraulic_step
vsp2_solved_time = 0      -- the time of the step on_hydraulics_solved reports next
vsp2_step_skips  = 0      -- steps on_hydraulic_step did not run on (diagnostic only)
vsp2_calls       = 0      -- on_hydraulic_step calls on the current step

-- The time of day at t, from the settings block or the .inp's Start ClockTime
function vsp2Clock(t)
    local start = times().start_time
    return (t + start) % 86400
end

-- The target in force at time t: the schedule's latest entry at or before
-- the time of day, the day wrapping to its last entry; the row's own
-- target for a row with no schedule, or before VSP2_SCHEDULE_FROM
function vsp2Target(p, t, schedules)
    local s = schedules[p[1]]
    if s == nil or t < VSP2_SCHEDULE_FROM then return p[4] end
    local clock  = vsp2Clock(t)
    local target = s[#s][2]
    for _, entry in ipairs(s) do
        if entry[1] > clock then break end
        target = entry[2]
    end
    return target
end

-- The measured quantity: a junction's pressure, a tank's net inflow (positive
-- when filling), or a link's flow in the pump's direction
function vsp2Value(p)
    if p[2] == "level" then return node(p[3]).demand end
    if p[2] == "flow" then
        if p[3] == "" then return link(p[1]).flow end
        return link(p[3]).flow * p[8]
    end
    return node(p[3]).pressure
end

-- A tank's level above its base: its pressure is in psi under US units
function vsp2Level(tank)
    return tank.head - tank.elevation
end

-- A level row's target, kept inside the tank's own levels
function vsp2LevelTarget(p, tank, t, schedules)
    local target = vsp2Target(p, t, schedules)
    if target > tank.max_level then target = tank.max_level end
    if target < tank.min_level then target = tank.min_level end
    return target
end

-- The tank's area near its level. A cylinder's from its diameter; for a
-- tank with a volume curve EPANET's diameter gives the mean area, refined
-- here to the volume the tank gained per unit of level over the last step
-- it moved on, which is the curve's own slope while both levels lie on one
-- of its segments
function vsp2Area(st, tank, level)
    local volume = tank.tank_volume
    if st.area == nil then st.area = math.pi * tank.tank_diameter ^ 2 / 4 end
    if tank.volume_curve ~= 0 and st.prev_level ~= nil and math.abs(level - st.prev_level) > 1e-6 then
        local a = (volume - st.prev_volume) / (level - st.prev_level)
        if a > 0 then st.area = a end
    end
    st.prev_level, st.prev_volume = level, volume
    return st.area
end

-- What a level row searches for: the net inflow that lands the level on the
-- target at the end of the step (Δt is the hydraulic step: the engine's
-- next_event holds only a tank limit's cut, not a control's or a pattern
-- boundary's, and an advance shorter than Δt lands short, which the next
-- step corrects), and the inflow tolerance that keeps the landing within
-- VSP2_LEVEL_TOL. It is never looser than half the flow tolerance: a held
-- step's inflow is the search's error plus the correction of the last
-- landing, itself within a tolerance, so the inflow at a held level stays
-- within the flow tolerance of zero
function vsp2Required(p, st, t, schedules)
    local tank   = node(p[3])
    local level  = vsp2Level(tank)
    local target = vsp2LevelTarget(p, tank, t, schedules)
    local area   = vsp2Area(st, tank, level)
    local per_unit = area / (times().hydraulic_step * vsp2_flow_to_volume)
    local tol = vsp2_level_tol * per_unit
    if tol > vsp2_flow_tol / 2 then tol = vsp2_flow_tol / 2 end
    return (target - level) * per_unit, tol
end

-- The held value, its target and its tolerance at this call
function vsp2Read(p, st, t, schedules)
    local value = vsp2Value(p)
    if p[2] == "level" then
        local required, tol = vsp2Required(p, st, t, schedules)
        st.required = required
        return value, required, tol
    end
    if p[2] == "flow" then return value, vsp2Target(p, t, schedules), vsp2_flow_tol end
    return value, vsp2Target(p, t, schedules), vsp2_pressure_tol
end

-- A head an isolated node reports is not a measurement
function vsp2Usable(value)
    return value > -1e5 and value < 1e5
end

-- Lags open in order, so the running ones are the first n
function vsp2RunningLags(p)
    local n = 0
    for _, id in ipairs(p[7]) do
        if link(id).setting == 0 then break end
        n = n + 1
    end
    return n
end

-- One speed for the lead and its first n lags, remembered as this
-- fragment's write so a speed found different on the next call is known
-- to be a control's
function vsp2SetSpeed(p, st, speed, n)
    link(p[1]).setting = speed
    for i = 1, n do link(p[7][i]).setting = speed end
    st.written = speed
end

-- The speeds the held value is known to lie between: below the target at
-- lo, above it at hi. Forgotten when the step or the running pumps change.
function vsp2ResetBracket(p, st)
    st.lo, st.hi = 0, p[6] + VSP2_SPEED_TOL
    st.halved = 0
end

-- Close the last running lag and run the rest at maximum speed, to see
-- whether they hold the target without it
function vsp2Trial(p, st, running, value, speed)
    link(p[7][running]).setting = 0
    vsp2SetSpeed(p, st, p[6], running - 1)
    st.trial = running
    st.trial_speed = speed
    st.last_speed, st.last_value = p[6], value
    vsp2ResetBracket(p, st)
end

function vsp2Hold(p, schedules)
    local pump  = link(p[1])
    local speed = pump.setting
    local lags  = p[7]

    local st = vsp2_state[p[1]]
    if st == nil then
        st = { last_speed = speed, last_value = nil, time = -1, trial = 0, trial_speed = speed, fail_speed = -1, slope = nil,
               settled = speed, written = nil, forced = false, restored = false, fresh = false, required = 0 }
        vsp2ResetBracket(p, st)
        vsp2_state[p[1]] = st
    end

    -- A new step: nothing written yet, the secant pair restarts (the demand
    -- moved the value, not the speed), the slope learned so far is kept
    if st.time ~= vsp2_step_time then
        st.time   = vsp2_step_time
        st.trial  = 0
        st.written  = nil
        st.forced   = false
        st.restored = false
        st.fresh    = true
        st.last_speed, st.last_value = speed, nil
        vsp2ResetBracket(p, st)
    end

    -- A closed pump stays closed, and its lags close with it: writing a
    -- speed would reopen it
    if speed == 0 then
        for _, id in ipairs(lags) do
            if link(id).setting ~= 0 then link(id).setting = 0 end
        end
        return
    end

    -- A speed this fragment did not write is a control's. Within a step, a
    -- write that was undone before the re-solve means a control holds the
    -- pump at its own speed on every solve (OPEN writes 1 while its
    -- condition holds): the step is the control's, and the search stops
    -- rather than running to the call cap. At a step's first call, a speed
    -- that differs from the one the search last settled at (1 after a
    -- control's OPEN) is replaced by that settled speed, and the search goes
    -- on from there with the slope it learned
    if st.forced then return end
    local value, target, tol = vsp2Read(p, st, vsp2_step_time, schedules)
    local running = vsp2RunningLags(p)
    if st.written ~= nil then
        if math.abs(speed - st.written) > VSP2_SPEED_TOL then
            st.forced = true
            return
        end
    elseif st.fresh and st.settled > 0 and math.abs(speed - st.settled) > VSP2_SPEED_TOL then
        vsp2SetSpeed(p, st, st.settled, running)
        st.restored = true
        st.last_speed, st.last_value = speed, value
        return
    end

    -- The first call the search runs on in a step: with lags running and
    -- the pumps settled below the speed of the last trial that failed, the
    -- last lag is tried closed
    if st.fresh then
        st.fresh = false
        if running > 0 and (st.fail_speed < 0 or speed < st.fail_speed - VSP2_TRIAL_SPEED_DROP) then
            vsp2Trial(p, st, running, value, speed)
            return
        end
    end

    -- The trial's answer: below the target without it, the lag opens again
    -- and the pumps go back to the speed they ran at before the trial;
    -- holding the target, the next running lag is tried in the same step
    if st.trial > 0 then
        local lag = st.trial
        st.trial = 0
        if value < target - tol then
            vsp2SetSpeed(p, st, st.trial_speed, lag)
            st.fail_speed = st.trial_speed
            st.last_speed, st.last_value = st.trial_speed, value
            vsp2ResetBracket(p, st)
            return
        end
        st.fail_speed = -1
        if running > 0 then
            vsp2Trial(p, st, running, value, st.trial_speed)
            return
        end
    end

    if math.abs(value - target) <= tol then return end

    -- Every running pump at maximum speed and still below the target: the
    -- next lag opens at that speed
    if value < target and speed >= p[6] - VSP2_SPEED_TOL and running < #lags then
        link(lags[running + 1]).setting = p[6]
        st.fail_speed = -1
        st.last_speed, st.last_value = p[6], value
        vsp2ResetBracket(p, st)
        return
    end

    -- A head the engine cannot give (the control node is cut off from every
    -- source) measures nothing: run at maximum speed, which is what opens a
    -- check valve or a pump that stopped below its shutoff head, and if the
    -- node stays cut off there, leave it
    if not vsp2Usable(value) then
        if speed < p[6] - VSP2_SPEED_TOL then
            vsp2SetSpeed(p, st, p[6], running)
            st.last_speed, st.last_value = speed, nil
        end
        return
    end

    -- More speed, more head, more flow and more inflow: this speed bounds
    -- the answer
    if value < target then
        if speed > st.lo then st.lo = speed end
    elseif speed < st.hi then
        st.hi = speed
    end

    -- The pair of points this step has made, when the value rose with the
    -- speed: a secant step, and its slope kept for the next step. A pair
    -- whose value fell as the speed rose was moved by something else (another
    -- row's write, a valve switching) and says nothing about this pump
    local slope = nil
    if st.last_value ~= nil and math.abs(st.last_speed - speed) >= VSP2_SPEED_TOL
       and math.abs(value - st.last_value) >= 1e-6 then
        slope = (value - st.last_value) / (speed - st.last_speed)
        if slope <= 0 then slope = nil end
    end

    local new_speed
    if slope ~= nil then
        st.slope = slope
        new_speed = speed + (target - value) / slope
    elseif st.slope ~= nil then
        -- One point: the slope learned earlier (on this step or the steps
        -- before) gives a Newton step, capped
        new_speed = speed + (target - value) / st.slope
        if new_speed > speed + VSP2_WARM_STEP then new_speed = speed + VSP2_WARM_STEP end
        if new_speed < speed - VSP2_WARM_STEP then new_speed = speed - VSP2_WARM_STEP end
    else
        -- No slope at all: the speed/value ratio, capped, because a ratio
        -- is not a slope (a head holds its suction side, a pump below its
        -- shutoff head passes nothing, and a net inflow can be negative)
        if value > 0 and target > 0 then new_speed = speed * (target / value)
        elseif value < target then new_speed = speed + VSP2_RATIO_STEP
        else new_speed = speed - VSP2_RATIO_STEP end
        if new_speed > speed + VSP2_RATIO_STEP then new_speed = speed + VSP2_RATIO_STEP end
        if new_speed < speed - VSP2_RATIO_STEP then new_speed = speed - VSP2_RATIO_STEP end
    end

    -- Still outside the tolerance, a step too small to write would leave the
    -- value there: take the smallest step that is written, towards the target
    if math.abs(new_speed - speed) <= VSP2_SPEED_TOL then
        if value < target then new_speed = speed + VSP2_MIN_STEP else new_speed = speed - VSP2_MIN_STEP end
    end

    if new_speed > p[6] then new_speed = p[6] end
    if new_speed < p[5] then new_speed = p[5] end
    -- A step that leaves the bracket (a pump stopped below its shutoff
    -- head, a secant over a bend) halves it instead. A bracket end the
    -- search keeps halving towards was set while something else moved the
    -- value (another row's write, a valve another handler opened on the
    -- same call): the second halving in a row, or a halving too small to
    -- write while the value is still outside the tolerance, forgets that
    -- end and lets the step through
    if not (new_speed > st.lo and new_speed < st.hi) then
        local mid = (st.lo + math.min(st.hi, p[6])) / 2
        if mid < p[5] then mid = p[5] end
        if st.halved >= 1 or math.abs(mid - speed) <= VSP2_SPEED_TOL then
            if new_speed <= st.lo then st.lo = 0 else st.hi = p[6] + VSP2_SPEED_TOL end
            st.halved = 0
        else
            new_speed = mid
            st.halved = st.halved + 1
        end
    else
        st.halved = 0
    end

    -- At a limit on the wrong side of the target there is nothing to search
    if math.abs(new_speed - speed) > VSP2_SPEED_TOL then
        vsp2SetSpeed(p, st, new_speed, running)
        st.last_speed, st.last_value = speed, value
    end
end

-- One report line for a pump of the row
function vsp2Print(p, id, t, speed, shown, target, extra, running, skipped)
    local st = vsp2_state[p[1]]
    local forced, restored = 0, 0
    if st ~= nil and st.forced then forced = 1 end
    if st ~= nil and st.restored then restored = 1 end
    print(string.format("VSP2 t=%d pump=%s speed=%.7f %s=%.4f target=%.4f%s calls=%d running=%d forced=%d restored=%d skipped=%d skips=%d",
          t, id, speed, p[2], shown, target, extra, vsp2_calls, running, forced, restored, skipped, vsp2_step_skips))
end

-- End-of-step bookkeeping: log every pump of the row, keep the speed the
-- search settled at (never one a control forced), and restart the secant
-- pair on the settled point
function vsp2Refresh(p, t, skipped, schedules)
    local speed = link(p[1]).setting
    local value = vsp2Value(p)
    local st = vsp2_state[p[1]]
    local target, tol = vsp2Target(p, t, schedules), vsp2_pressure_tol
    if p[2] == "flow" then tol = vsp2_flow_tol end
    local shown, extra = value, ""
    if p[2] == "level" then
        -- The tank's head has already moved to the end of the step here, so
        -- the level printed is where the step landed
        local tank = node(p[3])
        shown  = vsp2Level(tank)
        target = vsp2LevelTarget(p, tank, t, schedules)
        local required = 0
        if st then required = st.required end
        extra = string.format(" inflow=%.4f required=%.4f", value, required)
        tol = vsp2_level_tol
    end
    if st then
        st.last_speed, st.last_value = speed, value
        if speed > 0 and not st.forced then st.settled = speed end
    end
    local running = 0
    if speed ~= 0 then running = 1 + vsp2RunningLags(p) end
    --vsp2Print(p, p[1], t, speed, shown, target, extra, running, skipped)
    --for _, id in ipairs(p[7]) do
    --    vsp2Print(p, id, t, link(id).setting, shown, target, extra, running, skipped)
    --end
    local short = shown < target - tol
    if p[2] == "level" and st then short = value < st.required - vsp2_flow_tol end
    if speed > 0 and speed >= p[6] - VSP2_SPEED_TOL and running > #p[7] and short then
        print(string.format("WARNING: VSP run for pump %s: maximum pump capacity insufficient to meet target", p[1]))
    end
end

-- The flow, pressure and level tolerances, and the volume one unit of flow
-- moves, in the run's own units
function vsp2SetUnits()
    local u = units()
    local factors = VSP2_UNIT_FACTORS[u.flow]
    if factors == nil then error("VSP2: unknown flow units " .. tostring(u.flow)) end
    local per_meter = VSP2_PRESSURE_PER_METER[u.pressure]
    if per_meter == nil then error("VSP2: unknown pressure units " .. tostring(u.pressure)) end
    vsp2_flow_to_volume = factors[1]
    vsp2_flow_tol = VSP2_FLOW_TOL * factors[2]
    vsp2_pressure_tol = VSP2_TOL * per_meter
    vsp2_level_tol = VSP2_LEVEL_TOL * factors[3]
end

function vsp2_step(pumps, schedules)
    vsp2SetUnits()
    local t = times().hydraulic_time
    if t ~= vsp2_step_time then vsp2_calls = 0 end
    vsp2_calls = vsp2_calls + 1
    vsp2_step_time = t
    for _, p in ipairs(pumps) do vsp2Hold(p, schedules) end
end

-- The clock here has already moved on to the next step, so this step's
-- time is the one read at the step before
function vsp2_solved(pumps, schedules)
    vsp2SetUnits()
    local t = vsp2_solved_time
    local skipped = 0
    if vsp2_step_time ~= t then
        skipped = 1
        vsp2_step_skips = vsp2_step_skips + 1
    end
    for _, p in ipairs(pumps) do vsp2Refresh(p, t, skipped, schedules) end
    vsp2_solved_time = times().hydraulic_time
end

-- ================================================================
-- What the generated handlers pass in: on_hydraulic_step calls
-- vsp2_step(pumps, schedules) and on_hydraulics_solved calls
-- vsp2_solved(pumps, schedules), both with the same two tables,
-- written in the .inp's units. The functions above read nothing
-- else about the model.
-- ================================================================

-- pumps holds one row per pump the script controls. A row is a list of
-- 8 fields. Taking an example row field by field:
--
--     { "PU1", "level", "T1", 4.5, 0.3, 1, {}, 1 }
--
--   1. pump id        "PU1"    EPANET link id of the lead pump the search drives.
--   2. control type   "level"  what to hold: "pressure", "level", or "flow".
--   3. measured       "T1"     where the controlled value is read: a junction id
--      element                 for "pressure", a tank id for "level", or a link
--                              id for "flow" ("" means the lead pump's own flow).
--   4. target         4.5      value to hold, in the .inp's units: a pressure, a
--                              level above the tank's base, or a flow. Ignored
--                              when this pump has a schedules entry.
--   5. minimum speed  0.3      lowest relative speed the search may set (1.0 is
--                              the pump's rated speed).
--   6. maximum speed  1        highest relative speed the search may set.
--   7. lag pumps      {}       link ids of follower pumps, e.g. { "PU2", "PU3" },
--                              opened in this order behind the lead once every
--                              running pump is at max speed and still short of
--                              the target. {} means the lead pump runs alone.
--   8. direction      1        only matters for a "flow" row measured on another
--                              link: 1 if that link's positive flow (node1 ->
--                              node2) is the way the pump feeds it, -1 if the
--                              opposite. Use 1 for every other row.
--
-- The example row holds tank "T1" at 4.5 m by varying pump "PU1" between 0.3 and
-- 1.0 speed, with no lag pumps.
--
-- schedules gives time-of-day targets, keyed by pump id. A pump listed here
-- ignores its row's own target (field 4) and follows the schedule instead. Each
-- schedule is a list of { time-of-day in seconds, target } pairs in clock order:
-- the latest pair at or before the current time of day is in force, every day of
-- the run, and a time of day before the first pair wraps to the last one. {}
-- when no pump is scheduled. Example holding "PU1" at 3.0 from midnight, 4.5
-- from 06:00 (21600 s), then 3.5 from 20:00 (72000 s):
--
--     { ["PU1"] = { { 0, 3.0 }, { 21600, 4.5 }, { 72000, 3.5 } } }
