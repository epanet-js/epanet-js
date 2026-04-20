const m0001 = `
CREATE TABLE project (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  settings TEXT NOT NULL
);
`;

export const migrations: string[] = [m0001];

export const APP_VERSION = migrations.length;
