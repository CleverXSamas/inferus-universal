CREATE TABLE edge_campaigns (
  id TEXT PRIMARY KEY NOT NULL,
  invite_hash TEXT NOT NULL UNIQUE,
  revision INTEGER NOT NULL DEFAULT 1,
  document TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE edge_sheets (
  owner_id TEXT NOT NULL,
  id TEXT NOT NULL,
  document TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(owner_id, id)
);
--> statement-breakpoint
CREATE TABLE edge_rolls (
  owner_id TEXT NOT NULL,
  id TEXT NOT NULL,
  document TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(owner_id, id)
);
--> statement-breakpoint
CREATE INDEX edge_rolls_owner_created ON edge_rolls(owner_id, created_at DESC);
--> statement-breakpoint
CREATE TABLE edge_trees (
  owner_id TEXT NOT NULL,
  character TEXT NOT NULL,
  level INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  document TEXT NOT NULL,
  PRIMARY KEY(owner_id, character, level)
);
