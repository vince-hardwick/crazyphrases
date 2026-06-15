import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

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
const maintainCurrentGameUpdatedAtMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260615132432_maintain_signed_in_solo_current_games_updated_at.sql",
    import.meta.url,
  ),
  "utf8",
);
const createPrivatePhraseFavouritesMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260615153000_create_private_phrase_favourites.sql",
    import.meta.url,
  ),
  "utf8",
);
const createPrivateBatchFavouritesMigrationUrl = new URL(
  "../supabase/migrations/20260615172000_create_private_batch_favourites.sql",
  import.meta.url,
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

  it("maintains updated_at for signed-in current game updates", () => {
    assert.match(maintainCurrentGameUpdatedAtMigration, /create schema if not exists private/);
    assert.match(
      maintainCurrentGameUpdatedAtMigration,
      /create or replace function private\.set_signed_in_solo_current_games_updated_at\(\)/,
    );
    assert.match(maintainCurrentGameUpdatedAtMigration, /returns trigger/);
    assert.match(maintainCurrentGameUpdatedAtMigration, /set search_path = ''/);
    assert.match(
      maintainCurrentGameUpdatedAtMigration,
      /new\.updated_at = pg_catalog\.timezone\('utc', pg_catalog\.now\(\)\)/,
    );
    assert.match(
      maintainCurrentGameUpdatedAtMigration,
      /before update on public\.signed_in_solo_current_games/,
    );
    assert.match(
      maintainCurrentGameUpdatedAtMigration,
      /execute function private\.set_signed_in_solo_current_games_updated_at\(\)/,
    );
    assert.doesNotMatch(maintainCurrentGameUpdatedAtMigration, /security definer/i);
  });

  it("creates private Phrase Favourites with account-owned RLS and immutable snapshots", () => {
    assert.match(
      createPrivatePhraseFavouritesMigration,
      /create table if not exists public\.private_phrase_favourites/,
    );
    assert.match(
      createPrivatePhraseFavouritesMigration,
      /account_id uuid not null references auth\.users \(id\) on delete cascade/,
    );
    assert.match(createPrivatePhraseFavouritesMigration, /favourite jsonb not null/);
    assert.match(
      createPrivatePhraseFavouritesMigration,
      /source_fingerprint text not null/,
    );
    assert.match(
      createPrivatePhraseFavouritesMigration,
      /unique \(account_id, source_fingerprint\)/,
    );
    assert.match(
      createPrivatePhraseFavouritesMigration,
      /favourite ->> 'type' = 'phrase'/,
    );
    assert.match(createPrivatePhraseFavouritesMigration, /enable row level security/);

    for (const role of ["anon", "authenticated", "service_role"]) {
      assert.match(
        createPrivatePhraseFavouritesMigration,
        new RegExp(`revoke all on table public\\.private_phrase_favourites from ${role}`),
      );
    }

    assert.match(createPrivatePhraseFavouritesMigration, /grant select, insert, delete/);
    assert.doesNotMatch(createPrivatePhraseFavouritesMigration, /grant all/i);
    assert.doesNotMatch(createPrivatePhraseFavouritesMigration, /update/i);

    for (const operation of ["view", "create", "delete"]) {
      assert.match(
        createPrivatePhraseFavouritesMigration,
        new RegExp(`Account holders can ${operation} their private Phrase Favourites`),
      );
    }
  });

  it("creates private Batch Favourites with account-owned RLS and immutable snapshots", () => {
    assert.equal(existsSync(createPrivateBatchFavouritesMigrationUrl), true);

    const createPrivateBatchFavouritesMigration = readFileSync(
      createPrivateBatchFavouritesMigrationUrl,
      "utf8",
    );

    assert.match(
      createPrivateBatchFavouritesMigration,
      /create table if not exists public\.private_batch_favourites/,
    );
    assert.match(
      createPrivateBatchFavouritesMigration,
      /account_id uuid not null references auth\.users \(id\) on delete cascade/,
    );
    assert.match(createPrivateBatchFavouritesMigration, /favourite jsonb not null/);
    assert.match(
      createPrivateBatchFavouritesMigration,
      /source_fingerprint text not null/,
    );
    assert.match(
      createPrivateBatchFavouritesMigration,
      /unique \(account_id, source_fingerprint\)/,
    );
    assert.match(
      createPrivateBatchFavouritesMigration,
      /favourite ->> 'type' = 'batch'/,
    );
    assert.match(
      createPrivateBatchFavouritesMigration,
      /jsonb_array_length\(favourite -> 'phrases'\) = \(favourite ->> 'rowCount'\)::integer/,
    );
    assert.match(createPrivateBatchFavouritesMigration, /enable row level security/);

    for (const role of ["anon", "authenticated", "service_role"]) {
      assert.match(
        createPrivateBatchFavouritesMigration,
        new RegExp(`revoke all on table public\\.private_batch_favourites from ${role}`),
      );
    }

    assert.match(createPrivateBatchFavouritesMigration, /grant select, insert, delete/);
    assert.doesNotMatch(createPrivateBatchFavouritesMigration, /grant all/i);
    assert.doesNotMatch(createPrivateBatchFavouritesMigration, /update/i);

    for (const operation of ["view", "create", "delete"]) {
      assert.match(
        createPrivateBatchFavouritesMigration,
        new RegExp(`Account holders can ${operation} their private Batch Favourites`),
      );
    }
  });
});
