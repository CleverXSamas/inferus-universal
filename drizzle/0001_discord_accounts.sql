CREATE TABLE edge_discord_accounts (
  owner_id TEXT PRIMARY KEY NOT NULL,
  discord_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  active_kind TEXT,
  active_id TEXT
);
--> statement-breakpoint
CREATE TABLE edge_discord_pairing (
  token_hash TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  discord_id TEXT,
  display_name TEXT
);
--> statement-breakpoint
CREATE INDEX edge_discord_pairing_expiry ON edge_discord_pairing(expires_at);
