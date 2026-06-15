import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const createCurrentGameMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260612152050_create_signed_in_solo_current_games.sql",
    import.meta.url,
  ),
  "utf8",
);
const tightenCurrentGameGrantsMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260614232532_tighten_signed_in_solo_current_games_grants.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Supabase migration surface", () => {
  it("creates signed-in current games with RLS and account-owned policies", () => {
    assert.match(createCurrentGameMigration, /create table if not exists public\.signed_in_solo_current_games/);
    assert.match(createCurrentGameMigration, /references auth\.users \(id\) on delete cascade/);
    assert.match(createCurrentGameMigration, /game jsonb not null/);
    assert.match(createCurrentGameMigration, /revision integer not null default 1 check \(revision >= 1\)/);
    assert.match(createCurrentGameMigration, /enable row level security/);
    assert.match(createCurrentGameMigration, /from anon/);
    assert.match(createCurrentGameMigration, /to authenticated/);

    for (const operation of ["view", "create", "update", "delete"]) {
      assert.match(
        createCurrentGameMigration,
        new RegExp(`Account holders can ${operation} their current signed-in Solo Game`),
      );
    }
  });

  it("tightens API role grants to the minimum table privileges", () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      assert.match(
        tightenCurrentGameGrantsMigration,
        new RegExp(`revoke all on table public\\.signed_in_solo_current_games from ${role}`),
      );
    }

    assert.match(tightenCurrentGameGrantsMigration, /grant select, insert, update, delete/);
    assert.doesNotMatch(tightenCurrentGameGrantsMigration, /grant all/i);
    assert.doesNotMatch(tightenCurrentGameGrantsMigration, /truncate/i);
    assert.doesNotMatch(tightenCurrentGameGrantsMigration, /trigger/i);
    assert.doesNotMatch(tightenCurrentGameGrantsMigration, /references/i);
  });
});
