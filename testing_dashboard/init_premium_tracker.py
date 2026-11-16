import sqlite3
import os
from pathlib import Path
from datetime import datetime, timezone

BASE = Path(__file__).resolve().parent
DB = BASE / "data" / "bug_reports.sqlite3"
BACKUPS = BASE / "data" / "backups"
BACKUPS.mkdir(parents=True, exist_ok=True)

if not DB.exists():
    raise SystemExit("Project database not found.")

now = datetime.now(timezone.utc).isoformat()
backup = BACKUPS / f"before_premium_tracker_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.sqlite3"

src = sqlite3.connect(DB)
dst = sqlite3.connect(backup)
src.backup(dst)
dst.close()
src.close()
os.chmod(backup, 0o600)

categories = [
    ("ai_photo_studio", "AI Photo Studio", 18),
    ("ai_video_studio", "AI Video Studio", 20),
    ("ai_caption_generator", "AI Caption Generator", 18),
    ("ai_hashtag_generator", "AI Hashtag Generator", 10),
    ("ai_content_generator", "AI Content Generator", 15),
    ("ai_reel_designer", "AI Reel Designer", 15),
    ("ai_creator_assistant", "AI Creator Assistant", 12),
    ("advanced_creator_analytics", "Advanced Creator Analytics", 16),
    ("post_reel_scheduler", "Post/Reel Scheduler", 11),
    ("premium_profile_customization", "Premium Profile Customization", 10),
    ("advanced_business_tools", "Advanced Business Tools", 12),
    ("premium_subscription_system", "Premium Subscription System", 17),
    ("ai_credits_usage_management", "AI Credits/Usage Management", 12),
    ("ai_studio_security_privacy", "AI Studio Security/Privacy", 14),
]

con = sqlite3.connect(DB, timeout=30)
con.row_factory = sqlite3.Row
con.execute("PRAGMA foreign_keys=ON")
con.execute("PRAGMA busy_timeout=30000")

try:
    con.executescript("""
    CREATE TABLE IF NOT EXISTS premium_modules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        expected_feature_count INTEGER NOT NULL CHECK(expected_feature_count >= 0),
        status TEXT NOT NULL DEFAULT 'audit_required'
          CHECK(status IN ('audit_required','planned','in_progress','blocked','implemented','tested','verified','deferred')),
        progress_percent INTEGER NOT NULL DEFAULT 0
          CHECK(progress_percent BETWEEN 0 AND 100),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS premium_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_id INTEGER NOT NULL,
        task_key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        acceptance_criteria TEXT,
        status TEXT NOT NULL DEFAULT 'audit_required'
          CHECK(status IN ('audit_required','planned','in_progress','blocked','implemented','tested','verified','deferred')),
        progress_percent INTEGER NOT NULL DEFAULT 0
          CHECK(progress_percent BETWEEN 0 AND 100),
        priority TEXT NOT NULL DEFAULT 'medium'
          CHECK(priority IN ('critical','high','medium','low')),
        evidence TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(module_id) REFERENCES premium_modules(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS premium_task_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT,
        old_progress INTEGER,
        new_progress INTEGER,
        note TEXT NOT NULL,
        evidence TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES premium_tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS premium_module_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        note TEXT NOT NULL,
        evidence TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(module_id) REFERENCES premium_modules(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_premium_tasks_module
      ON premium_tasks(module_id);
    CREATE INDEX IF NOT EXISTS idx_premium_tasks_status
      ON premium_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_premium_task_events_task
      ON premium_task_events(task_id);
    CREATE INDEX IF NOT EXISTS idx_premium_module_events_module
      ON premium_module_events(module_id);

    CREATE VIEW IF NOT EXISTS premium_progress_summary AS
    SELECT
      m.id AS module_id,
      m.module_key,
      m.name AS module_name,
      m.expected_feature_count,
      COUNT(t.id) AS registered_tasks,
      SUM(CASE WHEN t.status='verified' THEN 1 ELSE 0 END) AS verified_tasks,
      SUM(CASE WHEN t.status='tested' THEN 1 ELSE 0 END) AS tested_tasks,
      SUM(CASE WHEN t.status='implemented' THEN 1 ELSE 0 END) AS implemented_tasks,
      SUM(CASE WHEN t.status='in_progress' THEN 1 ELSE 0 END) AS in_progress_tasks,
      SUM(CASE WHEN t.status='blocked' THEN 1 ELSE 0 END) AS blocked_tasks,
      SUM(CASE WHEN t.status='audit_required' THEN 1 ELSE 0 END) AS audit_required_tasks,
      COALESCE(ROUND(AVG(t.progress_percent),1),0) AS average_progress
    FROM premium_modules m
    LEFT JOIN premium_tasks t ON t.module_id=m.id
    GROUP BY m.id,m.module_key,m.name,m.expected_feature_count;
    """)

    for key, name, count in categories:
        cur = con.execute("""
          INSERT OR IGNORE INTO premium_modules
          (module_key,name,expected_feature_count,status,progress_percent,notes,created_at,updated_at)
          VALUES (?,?,?,'audit_required',0,?,?,?)
        """, (key, name, count,
              "Premium roadmap category registered. Individual feature records will be added from the approved detailed feature inventory.",
              now, now))

        row = con.execute(
            "SELECT id FROM premium_modules WHERE module_key=?", (key,)
        ).fetchone()

        if cur.rowcount:
            con.execute("""
              INSERT INTO premium_module_events
              (module_id,event_type,note,created_at)
              VALUES (?,'created',?,?)
            """, (row["id"],
                  f"Premium category registered with {count} expected features; detailed feature-level audit pending.",
                  now))

    con.commit()

    total = con.execute(
        "SELECT SUM(expected_feature_count) FROM premium_modules"
    ).fetchone()[0]
    registered = con.execute(
        "SELECT COUNT(*) FROM premium_modules"
    ).fetchone()[0]

    print("\nPREMIUM ROADMAP TRACKER READY")
    print("Backup:", backup)
    print("Premium categories:", registered)
    print("Expected individual features:", total)
    print("Settings tracker remains separate.")
    print("\nCATEGORY REGISTER:")
    for r in con.execute("""
        SELECT name,expected_feature_count,status
        FROM premium_modules ORDER BY id
    """):
        print(f"{r['name']}: {r['expected_feature_count']} features | {r['status']}")

    print("\nNOTE: Category counts are registered; individual feature records are not yet populated or marked complete.")
finally:
    con.close()

os.chmod(DB, 0o600)
