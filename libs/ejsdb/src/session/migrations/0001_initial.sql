CREATE TABLE sess.session_meta (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  app_version INTEGER NOT NULL,
  pointer     INTEGER NOT NULL CHECK (pointer >= -1),
  created_at  INTEGER NOT NULL
);

CREATE TABLE sess.history (
  seq        INTEGER PRIMARY KEY,
  state_id   TEXT NOT NULL,
  note       TEXT NOT NULL,
  byte_size  INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  changeset  BLOB
);

CREATE UNIQUE INDEX sess.history_state_id ON history (state_id);
