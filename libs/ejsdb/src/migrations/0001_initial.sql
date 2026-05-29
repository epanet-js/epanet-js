CREATE TABLE project (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  settings TEXT NOT NULL
);

CREATE TABLE junctions (
  id                          INTEGER PRIMARY KEY,
  label                       TEXT,
  is_active                   INTEGER NOT NULL DEFAULT 1,
  coord_x                     REAL NOT NULL,
  coord_y                     REAL NOT NULL,
  elevation                   REAL,
  initial_quality             REAL,
  chemical_source_type        TEXT,
  chemical_source_strength    REAL,
  chemical_source_pattern_id  INTEGER,
  emitter_coefficient         REAL
);

CREATE TABLE reservoirs (
  id                          INTEGER PRIMARY KEY,
  label                       TEXT,
  is_active                   INTEGER NOT NULL DEFAULT 1,
  coord_x                     REAL NOT NULL,
  coord_y                     REAL NOT NULL,
  elevation                   REAL,
  initial_quality             REAL,
  chemical_source_type        TEXT,
  chemical_source_strength    REAL,
  chemical_source_pattern_id  INTEGER,
  head                        REAL,
  head_pattern_id             INTEGER
);

CREATE TABLE tanks (
  id                          INTEGER PRIMARY KEY,
  label                       TEXT,
  is_active                   INTEGER NOT NULL DEFAULT 1,
  coord_x                     REAL NOT NULL,
  coord_y                     REAL NOT NULL,
  elevation                   REAL,
  initial_quality             REAL,
  chemical_source_type        TEXT,
  chemical_source_strength    REAL,
  chemical_source_pattern_id  INTEGER,
  initial_level               REAL,
  min_level                   REAL,
  max_level                   REAL,
  min_volume                  REAL,
  diameter                    REAL,
  overflow                    INTEGER,
  mixing_model                TEXT,
  mixing_fraction             REAL,
  bulk_reaction_coeff         REAL,
  volume_curve_id             INTEGER
);

CREATE TABLE pipes (
  id                   INTEGER PRIMARY KEY,
  label                TEXT,
  is_active            INTEGER NOT NULL DEFAULT 1,
  start_node_id        INTEGER NOT NULL,
  end_node_id          INTEGER NOT NULL,
  coords               TEXT NOT NULL CHECK (json_array_length(coords) >= 2),
  length               REAL,
  initial_status       TEXT,
  diameter             REAL,
  roughness            REAL,
  minor_loss           REAL,
  bulk_reaction_coeff  REAL,
  wall_reaction_coeff  REAL
);

CREATE TABLE pumps (
  id                       INTEGER PRIMARY KEY,
  label                    TEXT,
  is_active                INTEGER NOT NULL DEFAULT 1,
  start_node_id            INTEGER NOT NULL,
  end_node_id              INTEGER NOT NULL,
  coords                   TEXT NOT NULL CHECK (json_array_length(coords) >= 2),
  length                   REAL,
  initial_status           TEXT,
  definition_type          TEXT NOT NULL CHECK (definition_type IN ('power','curve','curveId')),
  power                    REAL,
  speed                    REAL,
  speed_pattern_id         INTEGER,
  efficiency_curve_id      INTEGER,
  energy_price             REAL,
  energy_price_pattern_id  INTEGER,
  curve_id                 INTEGER,
  curve_points             TEXT
);

CREATE TABLE valves (
  id              INTEGER PRIMARY KEY,
  label           TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  start_node_id   INTEGER NOT NULL,
  end_node_id     INTEGER NOT NULL,
  coords          TEXT NOT NULL CHECK (json_array_length(coords) >= 2),
  length          REAL,
  initial_status  TEXT,
  diameter        REAL,
  minor_loss      REAL,
  valve_kind      TEXT,
  setting         REAL,
  curve_id        INTEGER
);

CREATE TABLE customer_points (
  id          INTEGER PRIMARY KEY,
  label       TEXT NOT NULL,
  coord_x     REAL NOT NULL,
  coord_y     REAL NOT NULL,
  pipe_id     INTEGER,
  junction_id INTEGER,
  snap_x      REAL,
  snap_y      REAL
);

CREATE TABLE customer_point_demands (
  customer_point_id INTEGER NOT NULL REFERENCES customer_points(id),
  ordinal           INTEGER NOT NULL,
  base_demand       REAL NOT NULL,
  pattern_id        INTEGER,
  PRIMARY KEY (customer_point_id, ordinal)
);

CREATE TABLE patterns (
  id          INTEGER PRIMARY KEY,
  label       TEXT NOT NULL,
  type        TEXT CHECK (type IS NULL OR type IN ('demand','reservoirHead','pumpSpeed','qualitySourceStrength','energyPrice')),
  multipliers TEXT NOT NULL
);

CREATE TABLE junction_demands (
  junction_id INTEGER NOT NULL,
  ordinal     INTEGER NOT NULL,
  base_demand REAL NOT NULL,
  pattern_id  INTEGER,
  PRIMARY KEY (junction_id, ordinal)
);

CREATE TABLE curves (
  id     INTEGER PRIMARY KEY,
  label  TEXT NOT NULL,
  type   TEXT CHECK (type IS NULL OR type IN ('pump','efficiency','volume','valve','headloss')),
  points TEXT NOT NULL
);

CREATE TABLE controls (
  id   INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL
);

CREATE TABLE simulation_settings (
  id   INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL
);
