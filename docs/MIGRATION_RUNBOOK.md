# Migration Runbook — Legacy SQLite Volume

This runbook covers applying the new `translations` and `vocabulary` migrations
to the production SQLite volume (`backend_data`) that currently holds a legacy
database. The schema in that volume was created before the migrations existed,
so it must be treated as untrusted until inspected.

## Why this is needed

Before Sprint 0, `reader.translations` had a `0002_add_fields` migration whose
`0001_initial` dependency did not exist, and `reader.vocabulary` had no
migrations at all. `manage.py migrate` on an empty database therefore never
created:

- `translations_wordtranslation`
- `translations_sentencetranslation`
- `vocabulary_vocabularyentry`
- `vocabulary_reviewsession`

Production only worked because the old volume already contained those tables.
The new `0001_initial` migrations make a fresh database reproducible.

## Strategy: snapshot → stage → cut over

Never run `migrate` directly against the live volume first. The legacy database
may already contain the tables, may be missing columns, or may have a
`django_migrations` table that disagrees with the files.

### 1. Snapshot the live database (no downtime)

Use SQLite's online backup API, not `cp`, so a concurrent write cannot produce a
torn file:

```bash
docker exec contextual-reader-backend \
  python -c "import sqlite3; src=sqlite3.connect('/app/db_data/db.sqlite3'); dst=sqlite3.connect('/app/db_data/snapshot.sqlite3'); src.backup(dst); dst.close(); src.close()"
docker cp contextual-reader-backend:/app/db_data/snapshot.sqlite3 ./db-snapshot-$(date +%F).sqlite3
```

Also snapshot the media volume (`backend_media`) with the DevOps backup script.

### 2. Inspect the snapshot

```bash
sqlite3 db-snapshot.sqlite3 ".tables"
sqlite3 db-snapshot.sqlite3 "SELECT app, name FROM django_migrations WHERE app IN ('translations','vocabulary','books');"
sqlite3 db-snapshot.sqlite3 "PRAGMA table_info(vocabulary_vocabularyentry);"
```

Record which of the four tables exist and whether `next_review` is nullable.

### 3. Rehearse on a staging copy

```bash
cp db-snapshot.sqlite3 staging.sqlite3
SQLITE_PATH=$PWD/staging.sqlite3 SECRET_KEY=staging-only DEBUG=False \
  ALLOWED_HOSTS=staging.local python manage.py migrate --plan
```

Then apply:

```bash
SQLITE_PATH=$PWD/staging.sqlite3 SECRET_KEY=staging-only DEBUG=False \
  ALLOWED_HOSTS=staging.local python manage.py migrate
SQLITE_PATH=$PWD/staging.sqlite3 SECRET_KEY=staging-only DEBUG=False \
  ALLOWED_HOSTS=staging.local python manage.py migrate --check
```

Expected result: `migrate --check` exits 0.

If the legacy database already has the tables but no migration records, use
`--fake-initial` so Django records `0001_initial` without trying to recreate
them:

```bash
python manage.py migrate --fake-initial
```

`--fake-initial` only fakes a migration when **all** of its tables already
exist. If only some exist, stop and inspect: do not force it.

### 4. Verify the staged data

```bash
sqlite3 staging.sqlite3 "SELECT COUNT(*) FROM translations_wordtranslation;"
sqlite3 staging.sqlite3 "SELECT COUNT(*) FROM vocabulary_vocabularyentry;"
sqlite3 staging.sqlite3 "SELECT COUNT(*) FROM vocabulary_vocabularyentry WHERE next_review IS NULL;"
sqlite3 staging.sqlite3 "SELECT COUNT(*) FROM books_book WHERE status = 'completed';"
```

The last two should be `0` after `0002_alter_vocabularyentry_next_review` and
`0004_normalize_book_status` run. If they are not, the data migration did not
apply — do not cut over.

### 5. Cut over

1. Put the app in maintenance mode (or stop the backend container).
2. Take a final snapshot (step 1).
3. Copy the staged, migrated database over the live file.
4. Start the backend and run the smoke checks:

```bash
curl -fsS https://<host>/api/core/health/
curl -fsS https://<host>/api/vocabulary/
curl -fsS -X POST https://<host>/api/vocabulary/start_session/ \
  -H 'Content-Type: application/json' -d '{"book_id": 1}'
```

5. Keep the pre-cutover snapshot until the next successful backup cycle.

## Rollback

Stop the backend, restore the pre-cutover snapshot over `db.sqlite3`, and start
the previous image. Because the migrations only add tables/columns and normalise
two values, a rollback loses no rows.

## Notes

- `SQLITE_PATH` lets you point `manage.py` at a copy without touching the live
  volume. It defaults to `backend/db_data/db.sqlite3`.
- `SECRET_KEY` and `ALLOWED_HOSTS` are required when `DEBUG=False`; see
  `.env.example`.
- Do not run `migrate` concurrently from multiple containers. Run it once as a
  release step, then start the workers.
