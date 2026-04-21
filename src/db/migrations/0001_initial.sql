CREATE TABLE project (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  settings TEXT NOT NULL
);

CREATE TABLE assets (
  id        INTEGER PRIMARY KEY,
  type      TEXT NOT NULL CHECK (type IN ('junction','reservoir','tank','pipe','pump','valve')),
  label     TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE node_properties (
  asset_id                    INTEGER PRIMARY KEY REFERENCES assets(id),
  coord_x                     REAL NOT NULL,
  coord_y                     REAL NOT NULL,
  elevation                   REAL,
  initial_quality             REAL,
  chemical_source_type        TEXT,
  chemical_source_strength    REAL,
  chemical_source_pattern_id  TEXT
);

CREATE TABLE link_properties (
  asset_id       INTEGER PRIMARY KEY REFERENCES assets(id),
  start_node_id  INTEGER NOT NULL REFERENCES assets(id),
  end_node_id    INTEGER NOT NULL REFERENCES assets(id),
  coords         TEXT NOT NULL CHECK (json_array_length(coords) >= 2),
  length         REAL,
  initial_status TEXT
);

CREATE TABLE junction_properties (
  asset_id            INTEGER PRIMARY KEY REFERENCES assets(id),
  emitter_coefficient REAL
);

CREATE TABLE reservoir_properties (
  asset_id        INTEGER PRIMARY KEY REFERENCES assets(id),
  head            REAL,
  head_pattern_id TEXT
);

CREATE TABLE tank_properties (
  asset_id            INTEGER PRIMARY KEY REFERENCES assets(id),
  initial_level       REAL,
  min_level           REAL,
  max_level           REAL,
  min_volume          REAL,
  diameter            REAL,
  overflow            INTEGER,
  mixing_model        TEXT,
  mixing_fraction     REAL,
  bulk_reaction_coeff REAL,
  volume_curve_id     TEXT
);

CREATE TABLE pipe_properties (
  asset_id            INTEGER PRIMARY KEY REFERENCES assets(id),
  diameter            REAL,
  roughness           REAL,
  minor_loss          REAL,
  bulk_reaction_coeff REAL,
  wall_reaction_coeff REAL
);

CREATE TABLE pump_properties (
  asset_id                INTEGER PRIMARY KEY REFERENCES assets(id),
  power                   REAL,
  speed                   REAL,
  speed_pattern_id        TEXT,
  efficiency_curve_id     TEXT,
  energy_price            REAL,
  energy_price_pattern_id TEXT,
  curve_id                TEXT
);

CREATE TABLE valve_properties (
  asset_id   INTEGER PRIMARY KEY REFERENCES assets(id),
  diameter   REAL,
  minor_loss REAL,
  valve_kind TEXT,
  setting    REAL,
  curve_id   TEXT
);

CREATE INDEX idx_assets_type ON assets(type);
CREATE INDEX idx_link_properties_start ON link_properties(start_node_id);
CREATE INDEX idx_link_properties_end   ON link_properties(end_node_id);

CREATE VIEW junctions_view AS
SELECT a.id, a.type, a.label, a.is_active,
       np.coord_x, np.coord_y, np.elevation,
       np.initial_quality,
       np.chemical_source_type, np.chemical_source_strength, np.chemical_source_pattern_id,
       jp.emitter_coefficient
FROM assets a
JOIN node_properties np      ON np.asset_id = a.id
JOIN junction_properties jp  ON jp.asset_id = a.id
WHERE a.type = 'junction';

CREATE VIEW reservoirs_view AS
SELECT a.id, a.type, a.label, a.is_active,
       np.coord_x, np.coord_y, np.elevation,
       np.initial_quality,
       np.chemical_source_type, np.chemical_source_strength, np.chemical_source_pattern_id,
       rp.head, rp.head_pattern_id
FROM assets a
JOIN node_properties np       ON np.asset_id = a.id
JOIN reservoir_properties rp  ON rp.asset_id = a.id
WHERE a.type = 'reservoir';

CREATE VIEW tanks_view AS
SELECT a.id, a.type, a.label, a.is_active,
       np.coord_x, np.coord_y, np.elevation,
       np.initial_quality,
       np.chemical_source_type, np.chemical_source_strength, np.chemical_source_pattern_id,
       tp.initial_level, tp.min_level, tp.max_level, tp.min_volume,
       tp.diameter, tp.overflow, tp.mixing_model, tp.mixing_fraction,
       tp.bulk_reaction_coeff, tp.volume_curve_id
FROM assets a
JOIN node_properties np    ON np.asset_id = a.id
JOIN tank_properties tp    ON tp.asset_id = a.id
WHERE a.type = 'tank';

CREATE VIEW pipes_view AS
SELECT a.id, a.type, a.label, a.is_active,
       lp.start_node_id, lp.end_node_id, lp.coords, lp.length, lp.initial_status,
       pp.diameter, pp.roughness, pp.minor_loss,
       pp.bulk_reaction_coeff, pp.wall_reaction_coeff
FROM assets a
JOIN link_properties lp    ON lp.asset_id = a.id
JOIN pipe_properties pp    ON pp.asset_id = a.id
WHERE a.type = 'pipe';

CREATE VIEW pumps_view AS
SELECT a.id, a.type, a.label, a.is_active,
       lp.start_node_id, lp.end_node_id, lp.coords, lp.length, lp.initial_status,
       pmp.power, pmp.speed, pmp.speed_pattern_id,
       pmp.efficiency_curve_id, pmp.energy_price, pmp.energy_price_pattern_id,
       pmp.curve_id
FROM assets a
JOIN link_properties lp     ON lp.asset_id = a.id
JOIN pump_properties pmp    ON pmp.asset_id = a.id
WHERE a.type = 'pump';

CREATE VIEW valves_view AS
SELECT a.id, a.type, a.label, a.is_active,
       lp.start_node_id, lp.end_node_id, lp.coords, lp.length, lp.initial_status,
       vp.diameter, vp.minor_loss, vp.valve_kind, vp.setting, vp.curve_id
FROM assets a
JOIN link_properties lp    ON lp.asset_id = a.id
JOIN valve_properties vp   ON vp.asset_id = a.id
WHERE a.type = 'valve';
