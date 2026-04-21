---
name: Supabase db push is atomic across pending migrations
description: Fixing a single broken migration may require fixing OTHER unrelated pending migrations first, because supabase db push applies all pending migrations in one transaction
type: feedback
---

`supabase db push --linked` applies ALL pending local migrations in
chronological order. If ANY migration fails, the entire push aborts and
later migrations (even valid ones) are not applied.

**Why:** On 2026-04-08 I needed to apply `20260408000003_person_media_vault_filter.sql`
to dev Supabase (`jealdowtihqmhfuufbnt`) to ship the People-filter fix for
Fort Knox vaults. `supabase db push` refused because
`20260407181733_db_monitoring_health.sql` (written by another session and
never applied) referenced `notification_logs.read` (column doesn't exist)
and `affiliate_tracking` (table is actually `affiliates`). I had to fix
those dangling references in a migration file that wasn't mine before
my intended migration could reach the database.

**How to apply:** Before pushing ANY new migration, run
`supabase migration list --linked` and look for gaps between Local and
Remote timestamps — every local-only migration will run on the next push,
so audit them all for schema errors first. If a pre-existing broken
migration was never applied to any environment, repairing it in-place is
acceptable (it's effectively still a draft). Never modify a migration
that has already been applied remotely — add a new migration instead.
