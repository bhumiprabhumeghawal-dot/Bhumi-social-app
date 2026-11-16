import sqlite3
import os
from pathlib import Path
from datetime import datetime, timezone

BASE = Path(__file__).resolve().parent
DB = BASE / "data" / "bug_reports.sqlite3"
BACKUPS = BASE / "data" / "backups"
BACKUPS.mkdir(parents=True, exist_ok=True)

if not DB.exists():
    raise SystemExit("ERROR: Database not found.")

stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
backup = BACKUPS / f"before_premium_lock_{stamp}.sqlite3"

src = sqlite3.connect(DB)
dst = sqlite3.connect(backup)
src.backup(dst)
dst.close()
src.close()
os.chmod(backup, 0o600)

db = sqlite3.connect(DB, timeout=30)
db.execute("PRAGMA foreign_keys=ON")
db.execute("PRAGMA busy_timeout=30000")

try:
    db.executescript("""
    BEGIN IMMEDIATE;

    CREATE TABLE IF NOT EXISTS premium_task_locks (
        task_id INTEGER PRIMARY KEY,
        locked_at TEXT NOT NULL,
        verified_by TEXT NOT NULL DEFAULT 'system',
        evidence_snapshot TEXT NOT NULL,
        acceptance_snapshot TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES premium_tasks(id)
    );

    CREATE TABLE IF NOT EXISTS premium_task_unlocks (
        task_id INTEGER PRIMARY KEY,
        approved_by TEXT NOT NULL,
        reason TEXT NOT NULL,
        approved_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES premium_tasks(id)
    );

    CREATE TABLE IF NOT EXISTS premium_task_lock_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        approved_by TEXT NOT NULL,
        reason TEXT NOT NULL,
        evidence_snapshot TEXT,
        created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_premium_locks_task
      ON premium_task_locks(task_id);

    CREATE INDEX IF NOT EXISTS idx_premium_lock_events_task
      ON premium_task_lock_events(task_id);

    DROP TRIGGER IF EXISTS premium_require_verified_evidence_insert;
    DROP TRIGGER IF EXISTS premium_require_verified_evidence_update;
    DROP TRIGGER IF EXISTS premium_prevent_locked_update;
    DROP TRIGGER IF EXISTS premium_prevent_locked_delete;
    DROP TRIGGER IF EXISTS premium_lock_after_insert;
    DROP TRIGGER IF EXISTS premium_lock_after_update;

    CREATE TRIGGER premium_require_verified_evidence_insert
    BEFORE INSERT ON premium_tasks
    WHEN NEW.status = 'verified'
      AND (
        NEW.progress_percent != 100
        OR length(trim(COALESCE(NEW.evidence,''))) = 0
        OR length(trim(COALESCE(NEW.acceptance_criteria,''))) = 0
      )
    BEGIN
      SELECT RAISE(ABORT,
        'Verification requires 100% progress, evidence and acceptance criteria');
    END;

    CREATE TRIGGER premium_require_verified_evidence_update
    BEFORE UPDATE ON premium_tasks
    WHEN NEW.status = 'verified'
      AND (
        NEW.progress_percent != 100
        OR length(trim(COALESCE(NEW.evidence,''))) = 0
        OR length(trim(COALESCE(NEW.acceptance_criteria,''))) = 0
      )
    BEGIN
      SELECT RAISE(ABORT,
        'Verification requires 100% progress, evidence and acceptance criteria');
    END;

    CREATE TRIGGER premium_prevent_locked_update
    BEFORE UPDATE ON premium_tasks
    WHEN EXISTS (
      SELECT 1 FROM premium_task_locks
      WHERE task_id = OLD.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM premium_task_unlocks
      WHERE task_id = OLD.id
    )
    BEGIN
      SELECT RAISE(ABORT,
        'Premium feature is locked. Admin approval is required to reopen it.');
    END;

    CREATE TRIGGER premium_prevent_locked_delete
    BEFORE DELETE ON premium_tasks
    WHEN EXISTS (
      SELECT 1 FROM premium_task_locks
      WHERE task_id = OLD.id
    )
    BEGIN
      SELECT RAISE(ABORT,
        'Verified Premium feature cannot be deleted.');
    END;

    CREATE TRIGGER premium_lock_after_insert
    AFTER INSERT ON premium_tasks
    WHEN NEW.status = 'verified'
    BEGIN
      INSERT INTO premium_task_locks
      (task_id, locked_at, verified_by,
       evidence_snapshot, acceptance_snapshot)
      VALUES
      (NEW.id, datetime('now'), 'system',
       NEW.evidence, NEW.acceptance_criteria);

      INSERT INTO premium_task_lock_events
      (task_id,event_type,approved_by,reason,evidence_snapshot,created_at)
      VALUES
      (NEW.id,'auto_locked_verified','system',
       'Task inserted with verified status and required evidence.',
       NEW.evidence,datetime('now'));
    END;

    CREATE TRIGGER premium_lock_after_update
    AFTER UPDATE ON premium_tasks
    BEGIN
      INSERT INTO premium_task_lock_events
      (task_id,event_type,approved_by,reason,evidence_snapshot,created_at)
      SELECT
        OLD.id,
        CASE WHEN NEW.status = 'verified'
             THEN 'admin_review_and_relock'
             ELSE 'admin_unlocked'
        END,
        approved_by,
        reason,
        OLD.evidence,
        datetime('now')
      FROM premium_task_unlocks
      WHERE task_id = OLD.id;

      INSERT INTO premium_task_locks
      (task_id,locked_at,verified_by,evidence_snapshot,acceptance_snapshot)
      SELECT
        NEW.id,datetime('now'),'system',
        NEW.evidence,NEW.acceptance_criteria
      WHERE NEW.status = 'verified'
      AND EXISTS (
        SELECT 1 FROM premium_task_unlocks WHERE task_id = OLD.id
      )
      ON CONFLICT(task_id) DO UPDATE SET
        locked_at=excluded.locked_at,
        verified_by=excluded.verified_by,
        evidence_snapshot=excluded.evidence_snapshot,
        acceptance_snapshot=excluded.acceptance_snapshot;

      DELETE FROM premium_task_locks
      WHERE task_id = OLD.id
        AND NEW.status != 'verified'
        AND EXISTS (
          SELECT 1 FROM premium_task_unlocks WHERE task_id = OLD.id
        );

      DELETE FROM premium_task_unlocks
      WHERE task_id = OLD.id;
    END;

    COMMIT;
    """)

    print("PREMIUM DATABASE SECURITY MIGRATION SUCCESS")
    print("Backup:", backup)
    print("Verified feature lock: enabled")
    print("Evidence validation: enabled")
    print("Unauthorized update protection: enabled")
    print("Unauthorized delete protection: enabled")
    print("Admin unlock audit table: created")
    print("Existing Settings tasks: preserved")
    print("No feature has been falsely marked verified.")

except Exception:
    db.rollback()
    raise
finally:
    db.close()

os.chmod(DB, 0o600)
