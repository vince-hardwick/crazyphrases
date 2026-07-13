import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

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
const createAccountProfilesMigrationUrl = findMigrationUrl(
  "create_account_profiles",
);
const tightenAccountProfileDirectoryGrantsMigrationUrl = findMigrationUrl(
  "tighten_account_profile_directory_grants",
);
const replaceAccountProfileDirectoryViewMigrationUrl = findMigrationUrl(
  "replace_account_profile_directory_view",
);
const privateEmailLookupAndGamerTagMigrationUrl = findMigrationUrl(
  "private_email_lookup_and_gamer_tag",
);
const createPendingGamesMigrationUrl = findMigrationUrl("create_pending_games");
const supportPendingGameInviteResponsesMigrationUrl = findMigrationUrl(
  "support_pending_game_invite_responses",
);
const startPendingGameFoundationMigrationUrl = findMigrationUrl(
  "start_pending_game_foundation",
);
const startedGameTurnSubmissionMigrationUrl = findMigrationUrl(
  "started_game_turn_submission",
);
const participantSectionExecutionMigrationUrl = findMigrationUrl(
  "participant_section_multiplayer_execution",
);
const creatorMultiplayerCancellationMigrationUrl = findMigrationUrl(
  "creator_multiplayer_cancellation",
);
const completedMultiplayerHistoryMigrationUrl = findMigrationUrl(
  "completed_multiplayer_history",
);
const completedMultiplayerHistoryPaginationMigrationUrl = findMigrationUrl(
  "completed_multiplayer_history_pagination",
);
const pendingGameInviteExpiryMigrationUrl = findMigrationUrl(
  "pending_game_invite_expiry",
);
const nudgeTimeoutFoundationMigrationUrl = findMigrationUrl(
  "nudge_timeout_foundation",
);
const fixNudgeNotificationAssignmentFkIndexMigrationUrl = findMigrationUrl(
  "fix_nudge_notification_assignment_fk_index",
);
const uploadedAvatarProfileMigrationUrl = findMigrationUrl(
  "uploaded_avatar_profile",
);
const gamerTagSnapshotRpcCleanupMigrationUrl = findMigrationUrl(
  "gamer_tag_snapshot_rpc_cleanup",
);
const legacyIdentityColumnCleanupMigrationUrl = findMigrationUrl(
  "legacy_identity_column_cleanup",
);
const remediateSupabaseAdvisorLintsMigrationUrl = findMigrationUrl(
  "remediate_supabase_advisor_lints",
);
const pendingGameInviteNotificationsMigrationUrl = findMigrationUrl(
  "pending_game_invite_notifications",
);
const participantScopedStartedGameLoaderMigrationUrl = findMigrationUrl(
  "participant_scoped_started_game_loader",
);
const pinMultiplayerEntryAssistShardsMigrationUrl = findMigrationUrl(
  "pin_multiplayer_entry_assist_shards",
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

  it("creates Account Profiles with signed-in lookup and owner-only mutation", () => {
    assert.equal(existsSync(createAccountProfilesMigrationUrl), true);

    const createAccountProfilesMigration = readFileSync(
      createAccountProfilesMigrationUrl,
      "utf8",
    );

    assert.match(
      createAccountProfilesMigration,
      /create table if not exists public\.account_profiles/,
    );
    assert.match(
      createAccountProfilesMigration,
      /account_id uuid not null references auth\.users \(id\) on delete cascade/,
    );
    assert.match(
      createAccountProfilesMigration,
      /profile_id uuid not null default gen_random_uuid\(\)/,
    );
    assert.match(createAccountProfilesMigration, /handle text not null/);
    assert.match(createAccountProfilesMigration, /gamer_name text not null/);
    assert.match(createAccountProfilesMigration, /avatar_key text not null/);
    assert.match(createAccountProfilesMigration, /primary key \(account_id\)/);
    assert.match(createAccountProfilesMigration, /unique \(profile_id\)/);
    assert.match(createAccountProfilesMigration, /unique \(handle\)/);
    assert.match(createAccountProfilesMigration, /char_length\(handle\) between 3 and 30/);
    assert.match(createAccountProfilesMigration, /handle ~ '\^\[a-z0-9\]\+\(-\[a-z0-9\]\+\)\*\$'/);
    assert.match(createAccountProfilesMigration, /char_length\(btrim\(gamer_name\)\) between 1 and 40/);
    assert.match(createAccountProfilesMigration, /avatar_key in \('spark', 'paper', 'moon', 'star', 'comet', 'kite'\)/);
    assert.match(createAccountProfilesMigration, /enable row level security/);

    for (const role of ["anon", "authenticated", "service_role"]) {
      assert.match(
        createAccountProfilesMigration,
        new RegExp(`revoke all on table public\\.account_profiles from ${role}`),
      );
    }

    assert.doesNotMatch(createAccountProfilesMigration, /grant .* to anon/i);
    assert.match(createAccountProfilesMigration, /grant select, insert, update/);
    assert.doesNotMatch(createAccountProfilesMigration, /grant .*delete/i);

    assert.match(
      createAccountProfilesMigration,
      /Signed-in accounts can view Account Profiles/,
    );
    for (const operation of ["create", "update"]) {
      assert.match(
        createAccountProfilesMigration,
        new RegExp(`Account holders can ${operation} their own Account Profile`),
      );
    }
    assert.match(createAccountProfilesMigration, /\(select auth\.uid\(\)\) = account_id/);
  });

  it("tightens Account Profile grants behind an invite-safe directory surface", () => {
    assert.equal(existsSync(tightenAccountProfileDirectoryGrantsMigrationUrl), true);

    const tightenAccountProfileDirectoryGrantsMigration = readFileSync(
      tightenAccountProfileDirectoryGrantsMigrationUrl,
      "utf8",
    );

    assert.match(
      tightenAccountProfileDirectoryGrantsMigration,
      /create or replace view public\.account_profile_directory/,
    );
    assert.match(
      tightenAccountProfileDirectoryGrantsMigration,
      /select\s+profile_id,\s+handle,\s+gamer_name,\s+avatar_key\s+from public\.account_profiles/is,
    );
    assert.doesNotMatch(
      tightenAccountProfileDirectoryGrantsMigration,
      /select\s+account_id[\s\S]*from public\.account_profiles/i,
    );
    assert.match(
      tightenAccountProfileDirectoryGrantsMigration,
      /revoke all on table public\.account_profile_directory from anon/,
    );
    assert.match(
      tightenAccountProfileDirectoryGrantsMigration,
      /grant select on table public\.account_profile_directory to authenticated/,
    );
    assert.match(
      tightenAccountProfileDirectoryGrantsMigration,
      /drop policy if exists "Signed-in accounts can view Account Profiles"/,
    );
    assert.match(
      tightenAccountProfileDirectoryGrantsMigration,
      /Account holders can view their own Account Profile/,
    );
    assert.match(
      tightenAccountProfileDirectoryGrantsMigration,
      /using \(\(select auth\.uid\(\)\) = account_id\)/,
    );
    assert.match(
      tightenAccountProfileDirectoryGrantsMigration,
      /revoke select, insert, update on table public\.account_profiles from authenticated/,
    );
    assert.match(
      tightenAccountProfileDirectoryGrantsMigration,
      /grant select \(account_id, profile_id, handle, gamer_name, avatar_key\)\s+on table public\.account_profiles\s+to authenticated/,
    );
    assert.match(
      tightenAccountProfileDirectoryGrantsMigration,
      /grant insert \(account_id, profile_id, handle, gamer_name, avatar_key\)\s+on table public\.account_profiles\s+to authenticated/,
    );
    assert.match(
      tightenAccountProfileDirectoryGrantsMigration,
      /grant update \(handle, gamer_name, avatar_key\)\s+on table public\.account_profiles\s+to authenticated/,
    );
    assert.doesNotMatch(
      tightenAccountProfileDirectoryGrantsMigration,
      /grant update .*profile_id/i,
    );
  });

  it("replaces the Account Profile directory view with a synced invite-safe table", () => {
    assert.equal(existsSync(replaceAccountProfileDirectoryViewMigrationUrl), true);

    const replaceAccountProfileDirectoryViewMigration = readFileSync(
      replaceAccountProfileDirectoryViewMigrationUrl,
      "utf8",
    );

    assert.match(
      replaceAccountProfileDirectoryViewMigration,
      /drop view if exists public\.account_profile_directory/,
    );
    assert.match(
      replaceAccountProfileDirectoryViewMigration,
      /create table if not exists public\.account_profile_directory/,
    );
    assert.match(
      replaceAccountProfileDirectoryViewMigration,
      /profile_id uuid primary key\s+references public\.account_profiles \(profile_id\)/,
    );
    for (const column of ["handle text not null unique", "gamer_name text not null", "avatar_key text not null"]) {
      assert.match(replaceAccountProfileDirectoryViewMigration, new RegExp(column));
    }
    assert.match(
      replaceAccountProfileDirectoryViewMigration,
      /insert into public\.account_profile_directory/,
    );
    assert.match(
      replaceAccountProfileDirectoryViewMigration,
      /alter table public\.account_profile_directory enable row level security/,
    );
    assert.match(
      replaceAccountProfileDirectoryViewMigration,
      /grant select on table public\.account_profile_directory to authenticated, service_role/,
    );
    assert.match(
      replaceAccountProfileDirectoryViewMigration,
      /Signed-in accounts can view Account Profile Directory/,
    );
    assert.match(replaceAccountProfileDirectoryViewMigration, /using \(true\)/);
    assert.match(
      replaceAccountProfileDirectoryViewMigration,
      /create or replace function private\.sync_account_profile_directory\(\)/,
    );
    assert.match(replaceAccountProfileDirectoryViewMigration, /security definer/);
    assert.match(replaceAccountProfileDirectoryViewMigration, /set search_path = ''/);
    assert.match(
      replaceAccountProfileDirectoryViewMigration,
      /revoke all on function private\.sync_account_profile_directory\(\) from public/,
    );
    assert.match(
      replaceAccountProfileDirectoryViewMigration,
      /create trigger sync_account_profile_directory\s+after insert or update or delete on public\.account_profiles/,
    );
    assert.doesNotMatch(replaceAccountProfileDirectoryViewMigration, /account_id/);
    assert.doesNotMatch(
      replaceAccountProfileDirectoryViewMigration,
      /create or replace view public\.account_profile_directory/,
    );
    assert.doesNotMatch(
      replaceAccountProfileDirectoryViewMigration,
      /create or replace function public\.sync_account_profile_directory/i,
    );
  });

  it("adds private email lookup and Gamer Tag lookup without exposing emails", () => {
    assert.equal(existsSync(privateEmailLookupAndGamerTagMigrationUrl), true);

    const migration = readFileSync(
      privateEmailLookupAndGamerTagMigrationUrl,
      "utf8",
    );

    for (const tableName of ["account_profiles", "account_profile_directory"]) {
      assert.match(
        migration,
        new RegExp(
          `alter table public\\.${tableName}[\\s\\S]*add column if not exists email_lookup_key text`,
        ),
      );
      assert.match(
        migration,
        new RegExp(
          `alter table public\\.${tableName}[\\s\\S]*add column if not exists gamer_tag text`,
        ),
      );
      assert.match(
        migration,
        new RegExp(
          `create unique index if not exists ${tableName}_email_lookup_key_unique_idx`,
        ),
      );
      assert.match(
        migration,
        new RegExp(
          `create unique index if not exists ${tableName}_gamer_tag_lookup_unique_idx`,
        ),
      );
    }

    assert.match(
      migration,
      /Private email lookup and Gamer Tag migration requires empty account profile tables/,
    );
    assert.match(migration, /exists \(select 1 from public\.account_profiles\)/);
    assert.match(
      migration,
      /exists \(select 1 from public\.account_profile_directory\)/,
    );
    assert.doesNotMatch(
      migration,
      /update public\.account_profiles as profile\s+set email_lookup_key = lower\(btrim\(auth_user\.email\)\)/,
    );
    assert.doesNotMatch(migration, /with profile_gamer_tags as/);
    assert.doesNotMatch(migration, /profile_gamer_tags\.duplicate_ordinal/);

    assert.match(migration, /from auth\.users as auth_user/);
    assert.match(migration, /lower\(btrim\(auth_user\.email\)\)/);
    assert.match(migration, /create or replace function private\.sync_account_profile_lookup_identity\(\)/);
    assert.match(migration, /create or replace function private\.sync_account_profile_directory\(\)/);
    assert.match(migration, /new\.email_lookup_key/);
    assert.match(migration, /new\.gamer_tag/);

    assert.match(
      migration,
      /create or replace function public\.lookup_account_profile\(\s*lookup_key text,\s*lookup_kind text\s*\)/,
    );
    assert.match(
      migration,
      /returns table \(\s*profile_id uuid,\s*gamer_tag text,\s*avatar_type text,\s*avatar_key text,\s*avatar_object_path text\s*\)/,
    );
    assert.match(migration, /security definer/);
    assert.match(migration, /set search_path = ''/);
    assert.match(migration, /auth\.uid\(\) is not null/);
    assert.match(migration, /directory\.email_lookup_key = lower\(btrim\(lookup_key\)\)/);
    assert.match(migration, /lower\(directory\.gamer_tag\) = lower\(btrim\(lookup_key\)\)/);
    assert.match(migration, /revoke all on function public\.lookup_account_profile\(text, text\)\s+from public/);
    assert.match(migration, /revoke all on function public\.lookup_account_profile\(text, text\)\s+from anon/);
    assert.match(migration, /grant execute on function public\.lookup_account_profile\(text, text\)\s+to authenticated/);

    assert.match(
      migration,
      /grant select \(profile_id, handle, gamer_name, gamer_tag, avatar_type, avatar_key, avatar_object_path\)\s+on table public\.account_profile_directory\s+to authenticated/,
    );
    assert.doesNotMatch(
      migration,
      /grant select \([^)]*email_lookup_key[^)]*\)\s+on table public\.account_profile_directory\s+to authenticated/i,
    );
    assert.doesNotMatch(
      migration,
      /grant select on table public\.account_profile_directory to authenticated/i,
    );
  });

  it("creates Pending Games with creator-owned creation and trigger-managed participants", () => {
    assert.equal(existsSync(createPendingGamesMigrationUrl), true);

    const createPendingGamesMigration = readFileSync(
      createPendingGamesMigrationUrl,
      "utf8",
    );

    assert.match(
      createPendingGamesMigration,
      /create table if not exists public\.pending_games/,
    );
    assert.match(
      createPendingGamesMigration,
      /creator_account_id uuid not null references auth\.users \(id\) on delete cascade/,
    );
    assert.match(
      createPendingGamesMigration,
      /creator_profile_id uuid not null\s+references public\.account_profile_directory \(profile_id\)/,
    );
    assert.match(
      createPendingGamesMigration,
      /invitee_profile_id uuid not null\s+references public\.account_profile_directory \(profile_id\)/,
    );
    assert.match(createPendingGamesMigration, /row_count integer not null/);
    assert.match(
      createPendingGamesMigration,
      /row_count in \(10, 15, 20, 25, 30\)/,
    );
    assert.match(
      createPendingGamesMigration,
      /status text not null default 'pending'/,
    );
    assert.match(
      createPendingGamesMigration,
      /creator_profile_id <> invitee_profile_id/,
    );

    assert.match(
      createPendingGamesMigration,
      /create table if not exists public\.pending_game_participants/,
    );
    assert.match(
      createPendingGamesMigration,
      /pending_game_id uuid not null\s+references public\.pending_games \(id\)\s+on delete cascade/,
    );
    assert.match(
      createPendingGamesMigration,
      /participant_role in \('creator', 'invitee'\)/,
    );
    assert.match(
      createPendingGamesMigration,
      /invite_status in \('accepted', 'pending'\)/,
    );
    assert.match(
      createPendingGamesMigration,
      /unique \(pending_game_id, profile_id\)/,
    );

    for (const tableName of ["pending_games", "pending_game_participants"]) {
      assert.match(
        createPendingGamesMigration,
        new RegExp(
          `alter table public\\.${tableName} enable row level security`,
        ),
      );
      assert.match(
        createPendingGamesMigration,
        new RegExp(`revoke all on table public\\.${tableName} from anon`),
      );
    }

    assert.match(
      createPendingGamesMigration,
      /grant select, insert on table public\.pending_games to authenticated/,
    );
    assert.match(
      createPendingGamesMigration,
      /grant select on table public\.pending_game_participants to authenticated/,
    );
    assert.doesNotMatch(
      createPendingGamesMigration,
      /grant insert on table public\.pending_game_participants to authenticated/i,
    );

    assert.match(
      createPendingGamesMigration,
      /Account holders can create their Pending Games/,
    );
    assert.match(
      createPendingGamesMigration,
      /\(select auth\.uid\(\)\) = creator_account_id/,
    );
    assert.match(
      createPendingGamesMigration,
      /Account holders can view participant rows for their created Pending Games/,
    );

    for (const indexName of [
      "pending_games_creator_account_id_idx",
      "pending_games_creator_profile_id_idx",
      "pending_games_invitee_profile_id_idx",
      "pending_game_participants_pending_game_id_idx",
      "pending_game_participants_profile_id_idx",
      "pending_game_participants_account_id_idx",
    ]) {
      assert.match(
        createPendingGamesMigration,
        new RegExp(`create index if not exists ${indexName}`),
      );
    }

    assert.match(
      createPendingGamesMigration,
      /create or replace function private\.create_pending_game_participants\(\)/,
    );
    assert.match(createPendingGamesMigration, /security definer/);
    assert.match(createPendingGamesMigration, /set search_path = ''/);
    assert.match(
      createPendingGamesMigration,
      /revoke all on function private\.create_pending_game_participants\(\) from public/,
    );
    assert.match(
      createPendingGamesMigration,
      /create trigger create_pending_game_participants\s+after insert on public\.pending_games/,
    );
    assert.doesNotMatch(
      createPendingGamesMigration,
      /create or replace function public\.create_pending_game_participants/i,
    );
  });

  it("supports Pending Game invite response visibility without broad browser update authority", () => {
    assert.equal(
      existsSync(supportPendingGameInviteResponsesMigrationUrl),
      true,
    );

    const supportPendingGameInviteResponsesMigration = readFileSync(
      supportPendingGameInviteResponsesMigrationUrl,
      "utf8",
    );

    assert.match(
      supportPendingGameInviteResponsesMigration,
      /invite_status in \('accepted', 'pending', 'declined'\)/,
    );
    assert.match(
      supportPendingGameInviteResponsesMigration,
      /participant_role = 'invitee'\s+and invite_status = 'accepted'\s+and account_id is not null/,
    );
    assert.match(
      supportPendingGameInviteResponsesMigration,
      /participant_role = 'invitee'\s+and invite_status = 'declined'\s+and account_id is not null/,
    );
    assert.match(
      supportPendingGameInviteResponsesMigration,
      /Invitees can view their Pending Game invites/,
    );
    assert.match(
      supportPendingGameInviteResponsesMigration,
      /Invitees can view participant rows for their Pending Game invites/,
    );
    assert.match(
      supportPendingGameInviteResponsesMigration,
      /grant update \(account_id, invite_status\)\s+on table public\.pending_game_participants\s+to authenticated/,
    );
    assert.match(
      supportPendingGameInviteResponsesMigration,
      /Invitees can respond to their Pending Game invites/,
    );
    assert.match(
      supportPendingGameInviteResponsesMigration,
      /create or replace function private\.cancel_pending_game_after_invite_decline\(\)/,
    );
    assert.match(
      supportPendingGameInviteResponsesMigration,
      /after update of invite_status on public\.pending_game_participants/,
    );
    assert.match(
      supportPendingGameInviteResponsesMigration,
      /execute function private\.cancel_pending_game_after_invite_decline\(\)/,
    );
    assert.doesNotMatch(
      supportPendingGameInviteResponsesMigration,
      /grant update .* on table public\.pending_games to authenticated/i,
    );
    assert.doesNotMatch(
      supportPendingGameInviteResponsesMigration,
      /create or replace function public\.cancel_pending_game_after_invite_decline/i,
    );
  });

  it("creates Started Game storage with private Pending Game conversion authority", () => {
    assert.equal(existsSync(startPendingGameFoundationMigrationUrl), true);

    const startPendingGameFoundationMigration = readFileSync(
      startPendingGameFoundationMigrationUrl,
      "utf8",
    );

    assert.match(
      startPendingGameFoundationMigration,
      /status in \('pending', 'cancelled', 'started'\)/,
    );
    assert.match(
      startPendingGameFoundationMigration,
      /create table if not exists public\.games/,
    );
    assert.match(
      startPendingGameFoundationMigration,
      /pending_game_id uuid not null unique\s+references public\.pending_games \(id\)/,
    );
    assert.match(startPendingGameFoundationMigration, /slot_allocation jsonb not null/);
    assert.match(startPendingGameFoundationMigration, /slot_order jsonb not null/);
    assert.match(
      startPendingGameFoundationMigration,
      /create table if not exists public\.game_participants/,
    );
    assert.match(
      startPendingGameFoundationMigration,
      /game_id uuid not null\s+references public\.games \(id\)\s+on delete cascade/,
    );
    assert.match(startPendingGameFoundationMigration, /participant_kind text not null default 'human'/);
    assert.match(startPendingGameFoundationMigration, /profile_id uuid not null/);
    assert.match(startPendingGameFoundationMigration, /handle text not null/);
    assert.match(startPendingGameFoundationMigration, /gamer_name text not null/);
    assert.match(startPendingGameFoundationMigration, /avatar_key text not null/);

    for (const tableName of ["games", "game_participants"]) {
      assert.match(
        startPendingGameFoundationMigration,
        new RegExp(`alter table public\\.${tableName} enable row level security`),
      );
      assert.match(
        startPendingGameFoundationMigration,
        new RegExp(`revoke all on table public\\.${tableName} from anon`),
      );
    }

    assert.match(
      startPendingGameFoundationMigration,
      /grant select on table public\.games to authenticated/,
    );
    assert.match(
      startPendingGameFoundationMigration,
      /grant insert \(pending_game_id\)\s+on table public\.games\s+to authenticated/,
    );
    assert.match(
      startPendingGameFoundationMigration,
      /grant select on table public\.game_participants to authenticated/,
    );
    assert.doesNotMatch(
      startPendingGameFoundationMigration,
      /grant update .* on table public\.pending_games to authenticated/i,
    );

    for (const policyName of [
      "Game Creators can start accepted Pending Games",
      "Participants can view their Started Games",
      "Participants can view Started Game snapshots",
    ]) {
      assert.match(startPendingGameFoundationMigration, new RegExp(policyName));
    }

    assert.match(
      startPendingGameFoundationMigration,
      /create or replace function private\.is_started_game_participant\(/,
    );
    assert.match(
      startPendingGameFoundationMigration,
      /grant usage on schema private to authenticated/,
    );
    assert.match(
      startPendingGameFoundationMigration,
      /grant execute on function private\.is_started_game_participant\(uuid, uuid\)\s+to authenticated/,
    );
    assert.match(
      startPendingGameFoundationMigration,
      /private\.is_started_game_participant\(\s*public\.game_participants\.game_id,\s+\(select auth\.uid\(\)\)\s*\)/,
    );
    assert.doesNotMatch(
      startPendingGameFoundationMigration,
      /from public\.game_participants as viewer/i,
    );
    assert.match(
      startPendingGameFoundationMigration,
      /if coalesce\(cardinality\(participant_profile_ids\), 0\) <> 2 then/,
    );

    for (const functionName of [
      "prepare_started_game_from_pending",
      "create_started_game_participants",
    ]) {
      assert.match(
        startPendingGameFoundationMigration,
        new RegExp(`create or replace function private\\.${functionName}\\(\\)`),
      );
      assert.match(startPendingGameFoundationMigration, /security definer/);
      assert.match(startPendingGameFoundationMigration, /set search_path = ''/);
      assert.match(
        startPendingGameFoundationMigration,
        new RegExp(
          `revoke all on function private\\.${functionName}\\(\\)\\s+from public`,
        ),
      );
      assert.doesNotMatch(
        startPendingGameFoundationMigration,
        new RegExp(`create or replace function public\\.${functionName}`, "i"),
      );
    }
    assert.match(
      startPendingGameFoundationMigration,
      /create trigger prepare_started_game_from_pending\s+before insert on public\.games/,
    );
    assert.match(
      startPendingGameFoundationMigration,
      /create trigger create_started_game_participants\s+after insert on public\.games/,
    );
  });

  it("creates Started Game turn storage with narrow submission authority", () => {
    assert.equal(existsSync(startedGameTurnSubmissionMigrationUrl), true);

    const startedGameTurnSubmissionMigration = readFileSync(
      startedGameTurnSubmissionMigrationUrl,
      "utf8",
    );

    assert.match(
      startedGameTurnSubmissionMigration,
      /create table if not exists public\.game_turns/,
    );
    assert.match(
      startedGameTurnSubmissionMigration,
      /create table if not exists public\.game_entries/,
    );
    assert.match(startedGameTurnSubmissionMigration, /status text not null default 'active'/);
    assert.match(
      startedGameTurnSubmissionMigration,
      /unique \(game_id, turn_index\)/,
    );
    assert.match(
      startedGameTurnSubmissionMigration,
      /unique \(turn_id, row_index\)/,
    );

    for (const tableName of ["game_turns", "game_entries"]) {
      assert.match(
        startedGameTurnSubmissionMigration,
        new RegExp(`alter table public\\.${tableName} enable row level security`),
      );
      assert.match(
        startedGameTurnSubmissionMigration,
        new RegExp(`revoke all on table public\\.${tableName} from anon`),
      );
    }

    assert.match(
      startedGameTurnSubmissionMigration,
      /grant select on table public\.game_turns to authenticated/,
    );
    assert.doesNotMatch(
      startedGameTurnSubmissionMigration,
      /grant insert .*on table public\.game_entries to authenticated/i,
    );
    assert.doesNotMatch(
      startedGameTurnSubmissionMigration,
      /grant update .*on table public\.game_turns to authenticated/i,
    );

    assert.match(
      startedGameTurnSubmissionMigration,
      /Participants can view their active Started Game Turns/,
    );
    assert.match(
      startedGameTurnSubmissionMigration,
      /create or replace function private\.is_active_started_game_turn_assignee\(/,
    );
    assert.match(
      startedGameTurnSubmissionMigration,
      /create or replace function private\.create_started_game_turns\(\)/,
    );
    assert.match(
      startedGameTurnSubmissionMigration,
      /jsonb_array_elements\(new\.slot_order\)/,
    );
    assert.match(
      startedGameTurnSubmissionMigration,
      /create trigger create_started_game_turns\s+after insert on public\.games/,
    );
    assert.match(
      startedGameTurnSubmissionMigration,
      /create or replace function public\.submit_started_game_turn\(/,
    );
    assert.match(startedGameTurnSubmissionMigration, /security definer/);
    assert.match(startedGameTurnSubmissionMigration, /set search_path = ''/);
    assert.match(
      startedGameTurnSubmissionMigration,
      /grant execute on function public\.submit_started_game_turn\(uuid, jsonb\)\s+to authenticated/,
    );
    assert.match(
      startedGameTurnSubmissionMigration,
      /insert into public\.game_entries/,
    );
    assert.match(
      startedGameTurnSubmissionMigration,
      /update public\.game_turns\s+set status = 'submitted'/,
    );
    assert.doesNotMatch(
      startedGameTurnSubmissionMigration,
      /create or replace function private\.submit_started_game_turn/i,
    );
  });

  it("creates participant-section multiplayer execution with notifications and reveal state", () => {
    assert.equal(existsSync(participantSectionExecutionMigrationUrl), true);

    const migration = readFileSync(
      participantSectionExecutionMigrationUrl,
      "utf8",
    );

    for (const tableName of [
      "game_section_assignments",
      "game_section_entries",
      "multiplayer_batch_reveals",
      "in_app_notifications",
    ]) {
      assert.match(
        migration,
        new RegExp(`create table if not exists public\\.${tableName}`),
      );
      assert.match(
        migration,
        new RegExp(`alter table public\\.${tableName} enable row level security`),
      );
      assert.match(
        migration,
        new RegExp(`revoke all on table public\\.${tableName} from anon`),
      );
      for (const role of ["public", "authenticated", "service_role"]) {
        assert.match(
          migration,
          new RegExp(`revoke all on table public\\.${tableName} from ${role}`),
        );
      }
    }

    assert.match(migration, /participant_section_index integer not null/);
    assert.match(migration, /unique \(game_id, participant_profile_id, participant_section_index\)/);
    assert.match(migration, /unique \(assignment_id, row_index\)/);
    assert.match(migration, /unique \(id, game_id\)/);
    assert.match(
      migration,
      /constraint game_section_assignments_participant_fk\s+foreign key \(game_id, participant_profile_id\)\s+references public\.game_participants \(game_id, profile_id\)/,
    );
    assert.match(
      migration,
      /constraint multiplayer_batch_reveals_participant_fk\s+foreign key \(game_id, participant_profile_id\)\s+references public\.game_participants \(game_id, profile_id\)/,
    );
    assert.match(
      migration,
      /constraint game_section_entries_assignment_game_fk\s+foreign key \(assignment_id, game_id\)\s+references public\.game_section_assignments \(id, game_id\)/,
    );
    assert.match(migration, /notification_type in \('entries_needed', 'batch_complete'\)/);
    assert.match(migration, /notification_status in \('unread', 'read'\)/);
    assert.match(
      migration,
      /create index if not exists game_section_entries_assignment_game_idx\s+on public\.game_section_entries \(assignment_id, game_id\)/,
    );
    assert.deepEqual(tableGrantSet(migration, "game_section_assignments"), [
      "grant select, insert, update on table public.game_section_assignments to service_role",
    ]);
    assert.deepEqual(tableGrantSet(migration, "game_section_entries"), [
      "grant select, insert on table public.game_section_entries to service_role",
    ]);
    assert.deepEqual(tableGrantSet(migration, "multiplayer_batch_reveals"), [
      "grant select, insert on table public.multiplayer_batch_reveals to service_role",
    ]);
    assert.deepEqual(tableGrantSet(migration, "in_app_notifications"), [
      "grant select on table public.in_app_notifications to authenticated",
      "grant select, insert, update on table public.in_app_notifications to service_role",
      "grant update (notification_status) on table public.in_app_notifications to authenticated",
    ]);

    for (const tableName of [
      "game_section_assignments",
      "game_section_entries",
      "multiplayer_batch_reveals",
      "in_app_notifications",
    ]) {
      assert.deepEqual(
        tableGrantRoles(migration, tableName).sort(),
        tableName === "in_app_notifications"
          ? ["authenticated", "service_role"]
          : ["service_role"],
      );
      assertNoTableGrantToRoles(migration, tableName, ["public", "anon"]);
    }
    assertNoTableGrantToRoles(
      migration,
      "game_section_assignments",
      ["authenticated"],
    );
    assertNoTableGrantToRoles(
      migration,
      "game_section_entries",
      ["authenticated"],
    );
    assertNoTableGrantToRoles(
      migration,
      "multiplayer_batch_reveals",
      ["authenticated"],
    );
    assertNoTableGrantWithPrivileges(
      migration,
      "in_app_notifications",
      "authenticated",
      ["insert", "delete"],
    );

    assert.match(
      migration,
      /create or replace function private\.create_started_game_section_assignments\(\)/,
    );
    for (const [helperName, signature] of [
      ["set_in_app_notifications_updated_at", ""],
      ["multiplayer_participant_message", "uuid, text"],
      ["create_started_game_section_assignments", ""],
      ["current_game_section_assignment", "uuid, uuid"],
      ["multiplayer_batch_is_complete", "uuid"],
      ["render_multiplayer_phrases", "uuid"],
    ]) {
      assert.match(
        migration,
        new RegExp(`create or replace function private\\.${helperName}\\(`),
      );
      assert.match(
        migration,
        new RegExp(
          `revoke all on function private\\.${helperName}\\(${escapeRegExp(signature)}\\)\\s+from public`,
        ),
      );
      assert.match(
        migration,
        new RegExp(
          `revoke all on function private\\.${helperName}\\(${escapeRegExp(signature)}\\)\\s+from anon`,
        ),
      );
      assert.match(
        migration,
        new RegExp(
          `revoke all on function private\\.${helperName}\\(${escapeRegExp(signature)}\\)\\s+from authenticated`,
        ),
      );
      assert.doesNotMatch(
        migration,
        new RegExp(`create or replace function public\\.${helperName}`, "i"),
      );
    }
    assert.match(
      migration,
      /create trigger create_started_game_section_assignments\s+after insert on public\.games/,
    );
    assert.match(
      migration,
      /create or replace function public\.list_multiplayer_dashboard\(\)/,
    );
    assert.match(
      migration,
      /'phrases',\s*case\s+when exists \(\s*select 1\s+from public\.multiplayer_batch_reveals[\s\S]*?then private\.render_multiplayer_phrases\(game_row\.id\)/,
    );
    assert.match(
      migration,
      /create or replace function public\.submit_multiplayer_section\(\s*target_assignment_id uuid,\s*submitted_entries jsonb\s*\)/,
    );
    assert.match(
      migration,
      /create or replace function public\.reveal_multiplayer_batch\(\s*target_game_id uuid\s*\)/,
    );
    assert.doesNotMatch(
      migration,
      /on conflict \(game_id, participant_profile_id\) do nothing/,
    );
    assert.match(
      migration,
      /on conflict on constraint multiplayer_batch_reveals_game_id_participant_profile_id_key\s+do nothing/,
    );
    assert.doesNotMatch(
      migration,
      /pg_catalog\.trim\(/,
    );
    assert.match(
      migration,
      /pg_catalog\.btrim\(\s*pg_catalog\.regexp_replace/,
    );
    assert.doesNotMatch(
      migration,
      /alias for \$[12]/,
    );

    assert.match(
      migration,
      /grant execute on function public\.list_multiplayer_dashboard\(\)\s+to authenticated/,
    );
    assert.match(
      migration,
      /grant execute on function public\.submit_multiplayer_section\(uuid, jsonb\)\s+to authenticated/,
    );
    assert.match(
      migration,
      /grant execute on function public\.reveal_multiplayer_batch\(uuid\)\s+to authenticated/,
    );
    assert.match(
      migration,
      /revoke select on table public\.games\s+from authenticated/,
    );
    assert.match(
      migration,
      /grant select \(id, pending_game_id, creator_account_id, creator_profile_id, invitee_profile_id, template_id, row_count, status, created_at, updated_at\)\s+on table public\.games\s+to authenticated/,
    );
    assert.doesNotMatch(
      migration,
      /grant select on table public\.games\s+to authenticated/i,
    );
    assert.doesNotMatch(
      migration,
      /grant select \([^)]*slot_allocation[^)]*\)\s+on table public\.games\s+to authenticated/i,
    );
    assert.doesNotMatch(
      migration,
      /grant select \([^)]*slot_order[^)]*\)\s+on table public\.games\s+to authenticated/i,
    );
    assert.doesNotMatch(
      migration,
      /revoke all on table public\.games\s+from authenticated/i,
    );
    assert.doesNotMatch(
      migration,
      /revoke insert .*on table public\.games\s+from authenticated/i,
    );
    assert.match(
      migration,
      /drop trigger if exists create_started_game_turns\s+on public\.games/,
    );
    assert.match(
      migration,
      /drop policy if exists "Participants can view their active Started Game Turns"\s+on public\.game_turns/,
    );
    assert.match(
      migration,
      /revoke all on table public\.game_turns\s+from authenticated/,
    );
    assert.match(
      migration,
      /revoke all on table public\.game_entries\s+from authenticated/,
    );
    assert.match(
      migration,
      /revoke all on function private\.is_active_started_game_turn_assignee\(uuid, uuid\)\s+from authenticated/,
    );
    for (const role of ["public", "anon", "authenticated", "service_role"]) {
      assert.match(
        migration,
        new RegExp(
          `revoke all on function public\\.submit_started_game_turn\\(uuid, jsonb\\)\\s+from ${role}`,
        ),
      );
    }
    assert.doesNotMatch(
      migration,
      /grant .* on table public\.game_turns\s+to authenticated/i,
    );
    assert.doesNotMatch(
      migration,
      /grant .* on table public\.game_entries\s+to authenticated/i,
    );
    assert.doesNotMatch(
      migration,
      /grant execute on function public\.submit_started_game_turn\(uuid, jsonb\)\s+to authenticated/i,
    );
    assert.match(
      migration,
      /create or replace function private\.set_in_app_notifications_updated_at\(\)/,
    );
    assert.match(
      migration,
      /new\.updated_at = pg_catalog\.timezone\('utc', pg_catalog\.now\(\)\)/,
    );
    assert.match(
      migration,
      /create trigger set_in_app_notifications_updated_at\s+before update on public\.in_app_notifications/,
    );
    assert.match(migration, /order by assignment\.id\s+for update/);
    assert.match(
      migration,
      /(?:select|perform) 1\s+from public\.games as game_row\s+where game_row\.id = target_assignment\.game_id\s+for update/,
    );
    assert.match(
      migration,
      /row_index_text !~ '\^\[0-9\]\+\$'/,
    );
    assert.match(
      migration,
      /case\s+when participant\.account_id = caller_account_id then 'read'\s+else 'unread'\s+end/,
    );
    assert.match(
      migration,
      /limit 5/,
    );
    assert(
      migration.indexOf("if caller_profile_id is null then") <
        migration.indexOf("if not private.multiplayer_batch_is_complete(target_game_id) then"),
      "reveal must check participant membership before completion",
    );
    assert.match(
      migration,
      /Precondition: hosted application must verify there are no meaningful legacy Started Game Turn submissions/,
    );
    assert.doesNotMatch(
      migration,
      /grant insert .*on table public\.game_section_entries to authenticated/i,
    );
    assert.doesNotMatch(
      migration,
      /create or replace function public\.create_started_game_section_assignments/i,
    );
  });

  it("adds creator-controlled multiplayer cancellation with pending-aware notifications", () => {
    assert.equal(existsSync(creatorMultiplayerCancellationMigrationUrl), true);

    const migration = readFileSync(
      creatorMultiplayerCancellationMigrationUrl,
      "utf8",
    );

    assert.match(
      migration,
      /alter table public\.in_app_notifications\s+add column if not exists target_pending_game_id uuid\s+references public\.pending_games \(id\)\s+on delete cascade/,
    );
    assert.match(
      migration,
      /alter table public\.in_app_notifications\s+alter column target_game_id drop not null/,
    );
    assert.match(
      migration,
      /drop constraint if exists in_app_notifications_type/,
    );
    assert.match(
      migration,
      /notification_type in \('entries_needed', 'batch_complete', 'game_cancelled'\)/,
    );
    assert.match(
      migration,
      /drop constraint if exists in_app_notifications_target_required/,
    );
    assert.match(
      migration,
      /target_game_id is not null\s+and\s+target_pending_game_id is null/,
    );
    assert.match(
      migration,
      /target_game_id is null\s+and\s+target_pending_game_id is not null/,
    );
    assert.match(
      migration,
      /drop constraint if exists in_app_notifications_target_game_id_account_id_notification_type_key/,
    );
    assert.match(
      migration,
      /create unique index if not exists in_app_notifications_target_game_unique\s+on public\.in_app_notifications \(target_game_id, account_id, notification_type\)\s+where target_game_id is not null/,
    );
    assert.match(
      migration,
      /create unique index if not exists in_app_notifications_target_pending_game_unique\s+on public\.in_app_notifications \(target_pending_game_id, account_id, notification_type\)\s+where target_pending_game_id is not null/,
    );

    assert.match(
      migration,
      /create or replace function public\.cancel_created_game\(\s*target_pending_game_id uuid\s*\)/,
    );
    assert.match(
      migration,
      /returns table \(\s*id uuid,\s*template_id text,\s*row_count integer,\s*status text,\s*started_game_id uuid\s*\)/,
    );
    assert.match(migration, /security definer/);
    assert.match(migration, /set search_path = ''/);
    assert.match(
      migration,
      /caller_account_id uuid := \(select auth\.uid\(\)\)/,
    );
    assert.match(
      migration,
      /where pending_game\.id = target_pending_game_id\s+for update/,
    );
    assert.match(
      migration,
      /pending_game\.creator_account_id <> caller_account_id/,
    );
    assert.match(
      migration,
      /pending_game\.status not in \('pending', 'started'\)/,
    );
    assert.match(
      migration,
      /exists \(\s*select 1\s+from public\.multiplayer_batch_reveals as reveal/,
    );
    assert.match(
      migration,
      /update public\.pending_games\s+set status = 'cancelled'/,
    );
    assert.match(
      migration,
      /update public\.in_app_notifications\s+set notification_status = 'read'[\s\S]*notification_type = 'entries_needed'/,
    );
    assert.match(
      migration,
      /'game_cancelled',\s+'unread'/,
    );
    assert.match(
      migration,
      /case\s+when started_game_id is null then null\s+else started_game_id\s+end/,
    );
    assert.match(
      migration,
      /case\s+when started_game_id is null then target_pending_game_id\s+else null\s+end/,
    );

    assert.match(
      migration,
      /create or replace function public\.list_multiplayer_dashboard\(\)/,
    );
    assert.match(
      migration,
      /join public\.pending_games as pending_game\s+on pending_game\.id = game_row\.pending_game_id\s+and pending_game\.status = 'started'/,
    );
    assert.match(
      migration,
      /Multiplayer game has been cancelled\./,
    );

    for (const role of ["public", "anon", "authenticated", "service_role"]) {
      assert.match(
        migration,
        new RegExp(
          `revoke all on function public\\.cancel_created_game\\(uuid\\)\\s+from ${role}`,
        ),
      );
    }
    assert.match(
      migration,
      /grant execute on function public\.cancel_created_game\(uuid\)\s+to authenticated/,
    );
  });

  it("adds seven-day Pending Game invite expiry without broad browser mutation authority", () => {
    assert.equal(existsSync(pendingGameInviteExpiryMigrationUrl), true);

    const migration = readFileSync(
      pendingGameInviteExpiryMigrationUrl,
      "utf8",
    );

    assert.match(
      migration,
      /alter table public\.pending_games\s+add column if not exists expires_at timestamp with time zone/,
    );
    assert.match(
      migration,
      /update public\.pending_games\s+set expires_at = created_at \+ interval '7 days'\s+where expires_at is null/,
    );
    assert.match(
      migration,
      /alter table public\.pending_games\s+alter column expires_at set default \(pg_catalog\.timezone\('utc', pg_catalog\.now\(\)\) \+ interval '7 days'\)/,
    );
    assert.match(
      migration,
      /alter table public\.pending_games\s+alter column expires_at set not null/,
    );
    assert.match(
      migration,
      /status in \('pending', 'cancelled', 'started', 'expired'\)/,
    );
    assert.match(
      migration,
      /create index if not exists pending_games_pending_expires_at_idx\s+on public\.pending_games \(expires_at\)\s+where status = 'pending'/,
    );

    assert.match(
      migration,
      /drop policy if exists "Invitees can respond to their Pending Game invites"/,
    );
    assert.match(
      migration,
      /and expires_at > pg_catalog\.timezone\('utc', pg_catalog\.now\(\)\)/,
    );
    assert.match(
      migration,
      /drop policy if exists "Game Creators can start accepted Pending Games"/,
    );
    assert.match(
      migration,
      /pending_game\.expires_at <= pg_catalog\.timezone\('utc', pg_catalog\.now\(\)\)/,
    );
    assert.match(
      migration,
      /target_pending_game\.expires_at <= pg_catalog\.timezone\('utc', pg_catalog\.now\(\)\)/,
    );
    assert.doesNotMatch(
      migration,
      /grant update .* on table public\.pending_games to authenticated/i,
    );
  });

  it("adds dashboard-triggered nudge timeout generation without browser insert authority", () => {
    assert.equal(existsSync(nudgeTimeoutFoundationMigrationUrl), true);

    const migration = readFileSync(
      nudgeTimeoutFoundationMigrationUrl,
      "utf8",
    );

    assert.match(
      migration,
      /alter table public\.pending_games\s+add column if not exists nudge_timeout_hours integer/,
    );
    assert.match(
      migration,
      /alter table public\.pending_games\s+alter column nudge_timeout_hours set default 48/,
    );
    assert.match(
      migration,
      /nudge_timeout_hours in \(24, 48, 72, 168\)/,
    );
    assert.match(
      migration,
      /alter table public\.games\s+add column if not exists nudge_timeout_hours integer/,
    );
    assert.match(
      migration,
      /new\.nudge_timeout_hours = pending_game\.nudge_timeout_hours/,
    );
    assert.match(
      migration,
      /grant select \(id, pending_game_id, creator_account_id, creator_profile_id, invitee_profile_id, template_id, row_count, nudge_timeout_hours, status, created_at, updated_at\)\s+on table public\.games\s+to authenticated/,
    );

    assert.match(
      migration,
      /alter table public\.game_section_assignments\s+add column if not exists available_at timestamp with time zone/,
    );
    assert.match(
      migration,
      /create index if not exists game_section_assignments_available_nudge_idx\s+on public\.game_section_assignments \(available_at\)\s+where status = 'active'\s+and available_at is not null/,
    );
    assert.match(
      migration,
      /case\s+when assigned_section\.participant_section_index = 0 then pg_catalog\.timezone\('utc', pg_catalog\.now\(\)\)\s+else null\s+end/,
    );
    assert.match(
      migration,
      /set available_at = coalesce\(next_assignment\.available_at, pg_catalog\.timezone\('utc', pg_catalog\.now\(\)\)\)/,
    );

    assert.match(
      migration,
      /alter table public\.in_app_notifications\s+add column if not exists target_assignment_id uuid/,
    );
    assert.match(
      migration,
      /foreign key \(target_assignment_id, target_game_id\)\s+references public\.game_section_assignments \(id, game_id\)/,
    );
    assert.match(
      migration,
      /notification_type in \('entries_needed', 'batch_complete', 'game_cancelled', 'nudge'\)/,
    );
    assert.match(
      migration,
      /notification_type <> 'nudge'/,
    );
    assert.match(
      migration,
      /create unique index if not exists in_app_notifications_nudge_assignment_unique\s+on public\.in_app_notifications \(target_game_id, target_assignment_id, account_id, notification_type\)\s+where target_game_id is not null\s+and target_assignment_id is not null\s+and notification_type = 'nudge'/,
    );

    assert.match(
      migration,
      /create or replace function private\.create_overdue_nudge_notifications\(\s*target_account_id uuid\s*\)/,
    );
    assert.match(migration, /security definer/);
    assert.match(migration, /set search_path = ''/);
    assert.match(
      migration,
      /assignment\.available_at \+ pg_catalog\.make_interval\(hours => pending_game\.nudge_timeout_hours\)\s+<= pg_catalog\.timezone\('utc', pg_catalog\.now\(\)\)/,
    );
    assert.match(
      migration,
      /private\.current_game_section_assignment\(\s*assignment\.game_id,\s*assignment\.participant_profile_id\s*\)/,
    );
    assert.match(
      migration,
      /'nudge',\s+'unread'/,
    );
    assert.match(
      migration,
      /private\.multiplayer_participant_message\(\s*assignment\.game_id,\s*'A batch is waiting for your entries with'\s*\)/,
    );
    assert.match(migration, /on conflict do nothing/);
    for (const role of ["public", "anon", "authenticated"]) {
      assert.match(
        migration,
        new RegExp(
          `revoke all on function private\\.create_overdue_nudge_notifications\\(uuid\\)\\s+from ${role}`,
        ),
      );
    }

    assert.match(
      migration,
      /perform private\.create_overdue_nudge_notifications\(dashboard_account_id\)/,
    );
    assert.match(
      migration,
      /notification_type in \('entries_needed', 'nudge'\)/,
    );
    assert.doesNotMatch(
      migration,
      /grant insert .*on table public\.in_app_notifications to authenticated/i,
    );
    assert.doesNotMatch(
      migration,
      /grant update .* on table public\.pending_games to authenticated/i,
    );
  });

  it("covers the nudge notification assignment foreign key in column order", () => {
    assert.equal(
      existsSync(fixNudgeNotificationAssignmentFkIndexMigrationUrl),
      true,
    );

    const migration = readFileSync(
      fixNudgeNotificationAssignmentFkIndexMigrationUrl,
      "utf8",
    );

    assert.match(
      migration,
      /create index if not exists in_app_notifications_target_assignment_game_idx\s+on public\.in_app_notifications \(target_assignment_id, target_game_id\)\s+where target_assignment_id is not null\s+and target_game_id is not null/,
    );
    assert.match(
      migration,
      /drop index if exists public\.in_app_notifications_target_assignment_id_idx/,
    );
  });

  it("emits Gamer Tag participant snapshots from dashboard and history RPCs", () => {
    assert.equal(existsSync(gamerTagSnapshotRpcCleanupMigrationUrl), true);

    const migration = readFileSync(
      gamerTagSnapshotRpcCleanupMigrationUrl,
      "utf8",
    );

    assert.doesNotMatch(migration, /as\s+\$\$/);
    assert.doesNotMatch(migration, /\n\$\$;/);

    assert.match(
      migration,
      /create or replace function private\.multiplayer_participant_message\(/,
    );
    assert.match(migration, /participant\.gamer_name/);
    assert.doesNotMatch(migration, /'@' \|\| participant\.handle/);

    assert.match(
      migration,
      /create or replace function public\.list_multiplayer_dashboard\(\)/,
    );
    assert.match(
      migration,
      /pg_catalog\.jsonb_build_object\('gamerTag', participant\.gamer_name\)/,
    );
    assert.doesNotMatch(
      migration,
      /pg_catalog\.jsonb_build_object\('handle', participant\.handle\)/,
    );

    assert.match(
      migration,
      /create or replace function public\.list_completed_multiplayer_history\(/,
    );
    assert.match(
      migration,
      /creator\.gamer_name \|\| ' cancelled a batch with '/,
    );
    assert.doesNotMatch(migration, /'@' \|\| creator\.handle/);
    assert.match(
      migration,
      /grant execute on function public\.list_multiplayer_dashboard\(\)\s+to authenticated/,
    );
    assert.match(
      migration,
      /grant execute on function public\.list_completed_multiplayer_history\(integer, bigint, uuid\)\s+to authenticated/,
    );
    assert.match(
      migration,
      /grant execute on function public\.cancel_created_game\(uuid\)\s+to authenticated/,
    );
  });

  it("removes legacy identity storage columns from active profile and participant surfaces", () => {
    assert.equal(existsSync(legacyIdentityColumnCleanupMigrationUrl), true);
    assert.ok(
      legacyIdentityColumnCleanupMigrationUrl.pathname >
        gamerTagSnapshotRpcCleanupMigrationUrl.pathname,
      "legacy identity column cleanup must run after Gamer Tag RPC cleanup",
    );

    const migration = readFileSync(
      legacyIdentityColumnCleanupMigrationUrl,
      "utf8",
    );

    assert.match(migration, /alter table public\.pending_game_participants[\s\S]*add column if not exists gamer_tag text/);
    assert.match(migration, /alter table public\.game_participants[\s\S]*add column if not exists gamer_tag text/);
    assert.match(migration, /update public\.pending_game_participants[\s\S]*set gamer_tag = left\(btrim\(gamer_name\), 40\)/);
    assert.match(migration, /update public\.game_participants[\s\S]*set gamer_tag = left\(btrim\(gamer_name\), 40\)/);
    assert.match(
      migration,
      /insert into public\.account_profile_directory \(\s*profile_id,\s*gamer_name,\s*handle,\s*gamer_tag,/,
    );
    assert.match(
      migration,
      /select\s+profile_id,\s+gamer_name,\s+handle,\s+gamer_tag,/,
    );
    assert.match(migration, /gamer_name = excluded\.gamer_name/);
    assert.match(migration, /handle = excluded\.handle/);

    assert.match(migration, /create or replace function private\.sync_account_profile_lookup_identity\(\)/);
    assert.match(migration, /create or replace function private\.sync_account_profile_directory\(\)/);
    assert.match(migration, /create or replace function private\.create_pending_game_participants\(\)/);
    assert.match(migration, /create or replace function private\.create_started_game_participants\(\)/);
    assert.match(migration, /create or replace function private\.multiplayer_participant_message\(/);
    assert.match(migration, /create or replace function public\.list_multiplayer_dashboard\(\)/);
    assert.match(migration, /create or replace function public\.list_completed_multiplayer_history\(/);
    assert.match(migration, /create or replace function public\.cancel_created_game\(/);

    assert.match(
      migration,
      /grant select \(account_id, profile_id, gamer_tag, avatar_type, avatar_key, avatar_object_path\)\s+on table public\.account_profiles\s+to authenticated/,
    );
    assert.match(
      migration,
      /grant insert \(account_id, profile_id, gamer_tag, avatar_type, avatar_key, avatar_object_path\)\s+on table public\.account_profiles\s+to authenticated/,
    );
    assert.match(
      migration,
      /grant update \(gamer_tag, avatar_type, avatar_key, avatar_object_path\)\s+on table public\.account_profiles\s+to authenticated/,
    );
    assert.match(
      migration,
      /grant select \(profile_id, gamer_tag, avatar_type, avatar_key, avatar_object_path\)\s+on table public\.account_profile_directory\s+to authenticated/,
    );

    for (const tableName of [
      "account_profiles",
      "account_profile_directory",
      "pending_game_participants",
      "game_participants",
    ]) {
      assert.match(
        migration,
        new RegExp(`alter table public\\.${tableName}[\\s\\S]*drop column if exists handle`),
      );
      assert.match(
        migration,
        new RegExp(`alter table public\\.${tableName}[\\s\\S]*drop column if exists gamer_name`),
      );
    }

    assert.doesNotMatch(migration, /participant\.gamer_name/);
    assert.doesNotMatch(migration, /participant\.handle/);
    assert.doesNotMatch(migration, /creator\.gamer_name/);
    assert.doesNotMatch(migration, /creator\.handle/);
    assert.doesNotMatch(migration, /new\.gamer_name/);
    assert.doesNotMatch(migration, /new\.handle/);
    assert.doesNotMatch(migration, /public\.cancel_created_game\.started_game_id/);
    assert.doesNotMatch(migration, /grant [^;]*handle[^;]*on table public\.(account_profiles|account_profile_directory)/i);
    assert.doesNotMatch(migration, /grant [^;]*gamer_name[^;]*on table public\.(account_profiles|account_profile_directory)/i);
    assert.doesNotMatch(migration, /grant [^;]*email_lookup_key[^;]*on table public\.account_profiles/i);
  });

  it("remediates Supabase advisor lints without broadening table access", () => {
    assert.equal(existsSync(remediateSupabaseAdvisorLintsMigrationUrl), true);
    assert.ok(
      remediateSupabaseAdvisorLintsMigrationUrl.pathname >
        legacyIdentityColumnCleanupMigrationUrl.pathname,
      "advisor remediation must run after the current public RPC definitions",
    );

    const migration = readFileSync(
      remediateSupabaseAdvisorLintsMigrationUrl,
      "utf8",
    );

    assert.match(
      migration,
      /alter default privileges in schema public\s+revoke execute on functions from public/,
    );
    assert.match(
      migration,
      /alter default privileges in schema public\s+revoke execute on functions from anon, authenticated/,
    );
    assert.match(migration, /grant usage on schema private to authenticated/);

    for (const signature of [
      "cancel_created_game\\(uuid\\)",
      "list_completed_multiplayer_history\\(integer, bigint, uuid\\)",
      "list_multiplayer_dashboard\\(\\)",
      "lookup_account_profile\\(text, text\\)",
      "reveal_multiplayer_batch\\(uuid\\)",
      "submit_multiplayer_section\\(uuid, jsonb\\)",
    ]) {
      assert.match(
        migration,
        new RegExp(`alter function public\\.${signature}\\s+set schema private`),
      );
      assert.match(
        migration,
        new RegExp(`revoke all on function private\\.${signature}\\s+from public, anon, service_role`),
      );
      assert.match(
        migration,
        new RegExp(`grant execute on function private\\.${signature}\\s+to authenticated`),
      );
      assert.match(
        migration,
        new RegExp(`revoke all on function public\\.${signature}\\s+from public, anon, authenticated, service_role`),
      );
      assert.match(
        migration,
        new RegExp(`grant execute on function public\\.${signature}\\s+to authenticated`),
      );
    }

    for (const functionName of [
      "lookup_account_profile",
      "list_multiplayer_dashboard",
      "list_completed_multiplayer_history",
      "submit_multiplayer_section",
      "reveal_multiplayer_batch",
      "cancel_created_game",
    ]) {
      assert.match(
        migration,
        new RegExp(`create or replace function public\\.${functionName}`),
      );
    }
    assert.match(migration, /security invoker/g);
    assert.doesNotMatch(
      migration,
      /create or replace function public\.[\s\S]*?security definer/i,
    );

    for (const tableName of [
      "game_entries",
      "game_section_assignments",
      "game_section_entries",
      "game_turns",
      "multiplayer_batch_reveals",
    ]) {
      assert.match(
        migration,
        new RegExp(`create policy "No direct browser access to ${tableName}"[\\s\\S]*?on public\\.${tableName}[\\s\\S]*?for all[\\s\\S]*?to anon, authenticated[\\s\\S]*?using \\(false\\)[\\s\\S]*?with check \\(false\\)`),
      );
    }

    assert.match(
      migration,
      /drop policy if exists "Account holders can view their created Pending Games"/,
    );
    assert.match(
      migration,
      /drop policy if exists "Invitees can view their Pending Game invites"/,
    );
    assert.match(
      migration,
      /create policy "Account holders can view relevant Pending Games"/,
    );
    assert.match(
      migration,
      /pending_game\.creator_account_id = \(select auth\.uid\(\)\)/,
    );

    assert.match(
      migration,
      /drop policy if exists\s+"Account holders can view participant rows for their created Pending Games"/,
    );
    assert.match(
      migration,
      /drop policy if exists\s+"Invitees can view participant rows for their Pending Game invites"/,
    );
    assert.match(
      migration,
      /create policy "Account holders can view relevant Pending Game participants"/,
    );

    for (const droppedIndex of [
      "game_section_entries_assignment_id_idx",
      "game_turns_participant_profile_id_idx",
      "games_creator_profile_id_idx",
    ]) {
      assert.match(
        migration,
        new RegExp(`drop index if exists public\\.${droppedIndex}`),
      );
    }

    for (const retainedIndex of [
      "game_turns_game_id_idx",
      "in_app_notifications_target_assignment_game_idx",
      "in_app_notifications_target_pending_game_id_idx",
    ]) {
      assert.doesNotMatch(
        migration,
        new RegExp(`drop index if exists public\\.${retainedIndex}`),
      );
    }
  });

  it("creates Pending Game invite notifications through database-owned authority", () => {
    assert.equal(existsSync(pendingGameInviteNotificationsMigrationUrl), true);
    assert.ok(
      pendingGameInviteNotificationsMigrationUrl.pathname >
        remediateSupabaseAdvisorLintsMigrationUrl.pathname,
      "invite notification migration must run after current advisor remediation",
    );

    const migration = readFileSync(
      pendingGameInviteNotificationsMigrationUrl,
      "utf8",
    );

    assert.match(migration, /drop constraint if exists in_app_notifications_type/);
    assert.match(
      migration,
      /notification_type in \('entries_needed', 'batch_complete', 'game_cancelled', 'nudge', 'game_invite'\)/,
    );
    assert.match(
      migration,
      /create or replace function private\.create_pending_game_invite_notification\(\)/,
    );
    assert.match(migration, /returns trigger/);
    assert.match(migration, /security definer/);
    assert.match(migration, /set search_path = ''/);
    assert.match(migration, /insert into public\.in_app_notifications/);
    assert.match(migration, /'game_invite',\s+'unread'/);
    assert.match(
      migration,
      /creator\.gamer_tag \|\| ' invited you to a multiplayer game\.'/,
    );
    assert.match(migration, /target_pending_game_id/);
    assert.match(migration, /invitee\.profile_id = new\.invitee_profile_id/);
    assert.match(migration, /invitee\.account_id <> new\.creator_account_id/);
    assert.match(migration, /on conflict do nothing/);
    for (const role of ["public", "anon", "authenticated"]) {
      assert.match(
        migration,
        new RegExp(
          `revoke all on function private\\.create_pending_game_invite_notification\\(\\)\\s+from ${role}`,
        ),
      );
    }
    assert.match(
      migration,
      /create trigger create_pending_game_invite_notification\s+after insert on public\.pending_games/,
    );
    assert.doesNotMatch(
      migration,
      /grant insert .*on table public\.in_app_notifications to authenticated/i,
    );
    assert.doesNotMatch(
      migration,
      /grant execute on function private\.create_pending_game_invite_notification\(\)\s+to authenticated/i,
    );
  });

  it("adds Uploaded Avatar storage, descriptor, and snapshot authority", () => {
    assert.equal(existsSync(uploadedAvatarProfileMigrationUrl), true);

    const migration = readFileSync(uploadedAvatarProfileMigrationUrl, "utf8");

    assert.match(
      migration,
      /insert into storage\.buckets \(\s*id,\s*name,\s*public,\s*file_size_limit,\s*allowed_mime_types\s*\)/,
    );
    assert.match(migration, /'avatars',\s*'avatars',\s*true,\s*1048576/);
    assert.match(
      migration,
      /array\['image\/jpeg', 'image\/png', 'image\/webp'\]::text\[\]/,
    );

    assert.match(
      migration,
      /create table if not exists public\.uploaded_avatar_objects/,
    );
    assert.match(
      migration,
      /object_path text primary key/,
    );
    assert.match(
      migration,
      /account_id uuid not null references auth\.users \(id\) on delete cascade/,
    );
    assert.match(
      migration,
      /profile_id uuid not null references public\.account_profiles \(profile_id\) on delete cascade/,
    );
    assert.match(
      migration,
      /lifecycle_status in \('pending', 'live', 'historical', 'abandoned'\)/,
    );
    assert.match(
      migration,
      /object_path ~ '\^uploaded\/\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[1-5\]\[0-9a-f\]\{3\}-\[89ab\]\[0-9a-f\]\{3\}-\[0-9a-f\]\{12\}\\\.\(jpg\|jpeg\|png\|webp\)\$'/,
    );
    assert.doesNotMatch(migration, /email/i);

    for (const tableName of [
      "account_profiles",
      "account_profile_directory",
      "pending_game_participants",
      "game_participants",
    ]) {
      assert.match(
        migration,
        new RegExp(
          `alter table public\\.${tableName}\\s+add column if not exists avatar_type text not null default 'built-in'`,
        ),
      );
      assert.match(
        migration,
        new RegExp(
          `alter table public\\.${tableName}[\\s\\S]*add column if not exists avatar_object_path text`,
        ),
      );
    }

    assert.match(migration, /avatar_key in \('dice', 'hat-wizard', 'gamepad', 'ghost', 'puzzle-piece', 'biohazard', 'dragon', 'hurricane', 'jedi', 'pizza-slice', 'spaghetti-monster-flying', 'user-astronaut', 'yin-yang'\)/);
    assert.match(
      migration,
      /create or replace function private\.sync_uploaded_avatar_lifecycle\(\)/,
    );
    assert.match(migration, /lifecycle_status = 'live'/);
    assert.match(migration, /lifecycle_status = 'historical'/);

    assert.match(
      migration,
      /create policy "Account holders can create Uploaded Avatar metadata"/,
    );
    assert.match(
      migration,
      /create policy "Account holders can upload registered Uploaded Avatar objects"/,
    );
    assert.match(
      migration,
      /exists \(\s*select 1\s+from public\.uploaded_avatar_objects as avatar_object/,
    );
    assert.match(migration, /avatar_object\.object_path = storage\.objects\.name/);
    assert.match(migration, /avatar_object\.account_id = \(select auth\.uid\(\)\)/);
    assert.match(migration, /avatar_object\.lifecycle_status = 'pending'/);

    assert.match(
      migration,
      /grant select \(account_id, profile_id, handle, gamer_name, avatar_type, avatar_key, avatar_object_path\)\s+on table public\.account_profiles\s+to authenticated/,
    );
    assert.match(
      migration,
      /grant update \(handle, gamer_name, avatar_type, avatar_key, avatar_object_path\)\s+on table public\.account_profiles\s+to authenticated/,
    );
    assert.doesNotMatch(
      migration,
      /grant select .*uploaded_avatar_objects.*to anon/i,
    );
  });

  it("adds an Account-scoped completed multiplayer history read RPC", () => {
    assert.equal(existsSync(completedMultiplayerHistoryMigrationUrl), true);

    const migration = readFileSync(
      completedMultiplayerHistoryMigrationUrl,
      "utf8",
    );

    assert.match(
      migration,
      /create or replace function public\.list_completed_multiplayer_history\(\)/,
    );
    assert.match(migration, /returns jsonb/);
    assert.match(migration, /stable/);
    assert.match(migration, /security definer/);
    assert.match(migration, /set search_path = ''/);
    assert.match(
      migration,
      /participant\.account_id = history_account_id/,
    );
    assert.match(
      migration,
      /join public\.pending_games as pending_game\s+on pending_game\.id = game_row\.pending_game_id\s+and pending_game\.status = 'started'/,
    );
    assert.match(
      migration,
      /'phrases',\s*case\s+when exists \(\s*select 1\s+from public\.multiplayer_batch_reveals[\s\S]*?then private\.render_multiplayer_phrases\(game_row\.id\)/,
    );
    assert.match(migration, /limit 20/);
    assert.match(
      migration,
      /'batches',\s*coalesce\(/,
    );
    assert.match(
      migration,
      /revoke all on function public\.list_completed_multiplayer_history\(\)\s+from public/,
    );
    assert.match(
      migration,
      /revoke all on function public\.list_completed_multiplayer_history\(\)\s+from anon/,
    );
    assert.match(
      migration,
      /grant execute on function public\.list_completed_multiplayer_history\(\)\s+to authenticated/,
    );
  });

  it("upgrades completed multiplayer history to an Account-scoped paginated read RPC", () => {
    assert.equal(
      existsSync(completedMultiplayerHistoryPaginationMigrationUrl),
      true,
    );

    const migration = readFileSync(
      completedMultiplayerHistoryPaginationMigrationUrl,
      "utf8",
    );

    assert.match(
      migration,
      /create or replace function public\.list_completed_multiplayer_history\(\s*page_size integer default 20,\s*after_completed_order bigint default null,\s*after_game_id uuid default null\s*\)/,
    );
    assert.match(migration, /returns jsonb/);
    assert.match(migration, /stable/);
    assert.match(migration, /security definer/);
    assert.match(migration, /set search_path = ''/);
    assert.match(
      migration,
      /least\(greatest\(coalesce\(page_size, 20\), 1\), 50\)/,
    );
    assert.match(
      migration,
      /pg_catalog\.date_part\('epoch', max\(assignment\.submitted_at\)\) \* 1000000/,
    );
    assert.doesNotMatch(
      migration,
      /pg_catalog\.extract\(\s*epoch\s+from/,
    );
    assert.match(
      migration,
      /order by\s+completed_order desc,\s+game_id desc/,
    );
    assert.match(
      migration,
      /where\s+after_completed_order is null\s+or after_game_id is null\s+or \(completed_order, game_id\) < \(after_completed_order, after_game_id\)/,
    );
    assert.match(migration, /'hasMore', page_has_more/);
    assert.match(
      migration,
      /'nextCursor',\s+case\s+when page_has_more then pg_catalog\.jsonb_build_object\(\s*'completedOrder', page_cursor_completed_order,\s*'gameId', page_cursor_game_id/,
    );
    assert.match(
      migration,
      /revoke all on function public\.list_completed_multiplayer_history\(integer, bigint, uuid\)\s+from public/,
    );
    assert.match(
      migration,
      /revoke all on function public\.list_completed_multiplayer_history\(integer, bigint, uuid\)\s+from anon/,
    );
    assert.match(
      migration,
      /grant execute on function public\.list_completed_multiplayer_history\(integer, bigint, uuid\)\s+to authenticated/,
    );
  });

  it("adds a participant-scoped Started Game loader without direct table authority", () => {
    assert.equal(existsSync(participantScopedStartedGameLoaderMigrationUrl), true);
    assert.ok(
      participantScopedStartedGameLoaderMigrationUrl.pathname >
        pendingGameInviteNotificationsMigrationUrl.pathname,
      "the Game Play Surface loader must follow the current multiplayer RPCs",
    );

    const migration = readFileSync(
      participantScopedStartedGameLoaderMigrationUrl,
      "utf8",
    );

    assert.match(
      migration,
      /create or replace function private\.load_game_play_surface\(\s*target_game_id uuid\s*\)/,
    );
    assert.match(migration, /returns jsonb/);
    assert.match(migration, /security definer/);
    assert.match(migration, /set search_path = ''/);
    assert.match(migration, /caller_account_id uuid := \(select auth\.uid\(\)\)/);
    assert.match(
      migration,
      /from public\.game_participants as participant[\s\S]*?where participant\.game_id = target_game_id[\s\S]*?and participant\.profile_id = caller_profile_id/,
    );
    assert.match(
      migration,
      /private\.multiplayer_batch_is_complete\(target_game_id\)/,
    );
    assert.match(
      migration,
      /private\.render_multiplayer_phrases\(target_game_id\)/,
    );
    assert.match(migration, /'state', 'unavailable'/);
    assert.match(
      migration,
      /if target_pending_game\.status <> 'started' then[\s\S]*?'state', 'unavailable'/,
    );
    assert.match(migration, /'state', 'cancelled'/);
    assert.match(migration, /'state', 'active'/);
    assert.match(migration, /'state', 'waiting'/);
    assert.match(migration, /'state', 'completed'/);
    assert.match(migration, /'state', 'revealed'/);
    assert.match(migration, /'currentSection'/);
    assert.match(migration, /'entryKind'/);
    assert.match(migration, /'sectionIndex'/);
    assert.match(migration, /'sectionCount'/);
    assert.match(migration, /'rowIndex'/);
    assert.match(migration, /'gamerTag'/);
    assert.match(
      migration,
      /create or replace function public\.load_game_play_surface\(\s*target_game_id uuid\s*\)/,
    );
    assert.match(migration, /security invoker/);
    assert.match(
      migration,
      /select private\.load_game_play_surface\(target_game_id\)/,
    );

    for (const role of ["public", "anon", "service_role"]) {
      assert.match(
        migration,
        new RegExp(
          `revoke all on function private\\.load_game_play_surface\\(uuid\\)\\s+from ${role}`,
        ),
      );
    }
    assert.match(
      migration,
      /grant execute on function private\.load_game_play_surface\(uuid\)\s+to authenticated/,
    );
    assert.match(
      migration,
      /revoke all on function public\.load_game_play_surface\(uuid\)\s+from public, anon, authenticated, service_role/,
    );
    assert.match(
      migration,
      /grant execute on function public\.load_game_play_surface\(uuid\)\s+to authenticated/,
    );

    for (const tableName of [
      "games",
      "game_participants",
      "game_section_assignments",
      "game_section_entries",
      "multiplayer_batch_reveals",
    ]) {
      assert.doesNotMatch(
        migration,
        new RegExp(`grant\\s+[^;]*on\\s+table\\s+public\\.${tableName}`, "i"),
      );
    }
    assert.doesNotMatch(migration, /'profileId'/);
    assert.doesNotMatch(migration, /'accountId'/);
    assert.doesNotMatch(migration, /'pendingGameId'/);
  });

  it("pins approved Multiplayer Entry Assist shard references without browser authority", () => {
    assert.equal(existsSync(pinMultiplayerEntryAssistShardsMigrationUrl), true);
    assert.ok(
      pinMultiplayerEntryAssistShardsMigrationUrl.pathname >
        participantScopedStartedGameLoaderMigrationUrl.pathname,
      "Entry Assist shard pinning must follow the participant-scoped loader",
    );

    const migration = readFileSync(
      pinMultiplayerEntryAssistShardsMigrationUrl,
      "utf8",
    );

    assert.match(
      migration,
      /create table if not exists private\.word_bank_shard_registry/,
    );
    assert.match(
      migration,
      /alter table private\.word_bank_shard_registry enable row level security/,
    );
    assert.match(
      migration,
      /revoke all on table private\.word_bank_shard_registry from public, anon, authenticated, service_role/,
    );
    assert.match(
      migration,
      /add column if not exists entry_candidate_snapshot jsonb/,
    );
    assert.match(
      migration,
      /create trigger pin_started_game_entry_candidate_snapshot/,
    );
    assert.match(migration, /'entryAssist'/);
    assert.match(migration, /'state', 'available'/);
    assert.match(migration, /'state', 'unavailable'/);
    assert.doesNotMatch(
      migration,
      /grant\s+select\s*\([^)]*entry_candidate_snapshot/i,
    );

    assert.match(
      migration,
      /create or replace function private\.build_default_entry_candidate_snapshot\(\)/,
    );
    assert.match(migration, /stable\s+security invoker\s+set search_path = ''/);
    assert.match(
      migration,
      /create or replace function private\.pin_started_game_entry_candidate_snapshot\(\)/,
    );
    assert.match(migration, /security definer\s+set search_path = ''/);
    assert.match(migration, /\(select auth\.uid\(\)\) is null/);

    for (const functionName of [
      "build_default_entry_candidate_snapshot",
      "pin_started_game_entry_candidate_snapshot",
    ]) {
      assert.match(
        migration,
        new RegExp(
          `revoke all on function private\\.${functionName}\\(\\)\\s+from public, anon, authenticated, service_role`,
        ),
      );
    }

    assert.match(
      migration,
      /create or replace function private\.load_game_play_surface\(\s*target_game_id uuid\s*\)/,
    );
    assert.match(migration, /caller_account_id uuid := \(select auth\.uid\(\)\)/);
    assert.match(migration, /caller_account_id is null/);
    assert.match(
      migration,
      /from public\.game_participants as participant[\s\S]*?where participant\.game_id = target_game_id[\s\S]*?and participant\.profile_id = caller_profile_id/,
    );
    assert.match(
      migration,
      /create or replace function public\.load_game_play_surface\(\s*target_game_id uuid\s*\)[\s\S]*?security invoker[\s\S]*?set search_path = ''/,
    );
    assert.match(
      migration,
      /revoke all on function public\.load_game_play_surface\(uuid\)\s+from public, anon, authenticated, service_role/,
    );
    assert.match(
      migration,
      /grant execute on function public\.load_game_play_surface\(uuid\)\s+to authenticated/,
    );

    for (const tableName of [
      "games",
      "game_participants",
      "game_section_assignments",
      "game_section_entries",
      "multiplayer_batch_reveals",
    ]) {
      assert.doesNotMatch(
        migration,
        new RegExp(`grant\\s+[^;]*on\\s+table\\s+public\\.${tableName}`, "i"),
      );
    }
    assert.doesNotMatch(
      migration,
      /grant\s+[^;]*on\s+table\s+private\.word_bank_shard_registry/i,
    );
  });
});

function findMigrationUrl(name) {
  const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
  const fileName =
    readdirSync(migrationsDir).find((candidate) =>
      candidate.endsWith(`_${name}.sql`),
    ) ?? `00000000000000_${name}.sql`;

  return new URL(fileName, migrationsDir);
}

function tableGrantSet(migration, tableName) {
  return tableGrantMatches(migration, tableName)
    .map((grant) => grant.statement)
    .sort();
}

function tableGrantRoles(migration, tableName) {
  return [
    ...new Set(
      tableGrantMatches(migration, tableName).flatMap((grant) => grant.roles),
    ),
  ];
}

function assertNoTableGrantToRoles(migration, tableName, disallowedRoles) {
  for (const grant of tableGrantMatches(migration, tableName)) {
    for (const role of disallowedRoles) {
      assert.equal(
        grant.roles.includes(role),
        false,
        `${tableName} must not grant ${grant.privileges} to ${role}`,
      );
    }
  }
}

function assertNoTableGrantWithPrivileges(
  migration,
  tableName,
  role,
  disallowedPrivileges,
) {
  for (const grant of tableGrantMatches(migration, tableName)) {
    if (!grant.roles.includes(role)) {
      continue;
    }

    for (const privilege of disallowedPrivileges) {
      assert.equal(
        grant.privilegeNames.includes(privilege),
        false,
        `${tableName} must not grant ${privilege} to ${role}`,
      );
    }
  }
}

function tableGrantMatches(migration, tableName) {
  const grantPattern = new RegExp(
    `grant\\s+([a-z_,\\s()]+?)\\s+on\\s+table\\s+public\\.${escapeRegExp(tableName)}\\s+to\\s+([^;]+);`,
    "gi",
  );
  const lastRevokeIndex = lastTableRevokeIndex(migration, tableName);

  return [...migration.matchAll(grantPattern)].map((match) => {
    assert(
      match.index > lastRevokeIndex,
      `${tableName} grant appears before the table revokes`,
    );

    const privileges = canonicalizeSqlFragment(match[1]);
    return {
      statement: canonicalizeSqlFragment(match[0].replace(/;$/, "")),
      privileges,
      privilegeNames: privileges
        .split(",")
        .map((privilege) => privilege.trim().split(/\s+/)[0]),
      roles: match[2]
        .split(",")
        .map((role) => canonicalizeSqlFragment(role)),
    };
  });
}

function lastTableRevokeIndex(migration, tableName) {
  const revokePattern = new RegExp(
    `revoke\\s+all\\s+on\\s+table\\s+public\\.${escapeRegExp(tableName)}\\s+from\\s+(?:public|anon|authenticated|service_role)\\s*;`,
    "gi",
  );
  const revokeIndexes = [...migration.matchAll(revokePattern)].map(
    (match) => match.index,
  );

  assert.equal(
    revokeIndexes.length,
    4,
    `${tableName} must revoke all table grants from public, anon, authenticated, and service_role`,
  );

  return Math.max(...revokeIndexes);
}

function canonicalizeSqlFragment(fragment) {
  return fragment.trim().replace(/\s+/g, " ").toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
