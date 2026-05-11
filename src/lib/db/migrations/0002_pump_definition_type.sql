-- Rename existing table to a temporary name
ALTER TABLE pumps RENAME TO pumps_old;

-- Recreate the table to migrate definition_type values
CREATE TABLE pumps (
  id                       INTEGER PRIMARY KEY,
  label                    TEXT,
  is_active                INTEGER NOT NULL DEFAULT 1,
  start_node_id            INTEGER NOT NULL,
  end_node_id              INTEGER NOT NULL,
  coords                   TEXT NOT NULL CHECK (json_array_length(coords) >= 2),
  length                   REAL,
  initial_status           TEXT,
  definition_type          TEXT NOT NULL,
  power                    REAL,
  speed                    REAL,
  speed_pattern_id         INTEGER,
  efficiency_curve_id      INTEGER,
  energy_price             REAL,
  energy_price_pattern_id  INTEGER,
  curve_id                 INTEGER,
  curve_points             TEXT
);

-- Copy rows, migrating 'curve' → 'designPointCurve' (1 point) or 'standardCurve' (otherwise)
INSERT INTO pumps SELECT
  id,
  label,
  is_active,
  start_node_id,
  end_node_id,
  coords,
  length,
  initial_status,
  CASE definition_type
    WHEN 'curve' THEN
      CASE WHEN json_array_length(curve_points) = 1 THEN 'designPointCurve'
           ELSE 'standardCurve'
      END
    ELSE definition_type
  END,
  power,
  speed,
  speed_pattern_id,
  efficiency_curve_id,
  energy_price,
  energy_price_pattern_id,
  curve_id,
  curve_points
FROM pumps_old;

DROP TABLE pumps_old;
