import sqlite3
import os
from pathlib import Path

BASE = Path(__file__).resolve().parent
DB = BASE / "data" / "bug_reports.sqlite3"

BASE.joinpath("data").mkdir(parents=True, exist_ok=True)

db = sqlite3.connect(DB)
db.execute("PRAGMA foreign_keys = ON")
db.execute("PRAGMA journal_mode = WAL")

db.executescript("""
CREATE TABLE IF NOT EXISTS test_runs (
    id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    environment TEXT NOT NULL DEFAULT 'testing',
    app_version TEXT,
    base_url TEXT,
    status TEXT NOT NULL DEFAULT 'running'
        CHECK(status IN ('running','passed','failed','partial','cancelled')),
    total_tests INTEGER NOT NULL DEFAULT 0,
    passed_tests INTEGER NOT NULL DEFAULT 0,
    failed_tests INTEGER NOT NULL DEFAULT 0,
    summary_json TEXT
);

CREATE TABLE IF NOT EXISTS test_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_key TEXT NOT NULL UNIQUE,
    module TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    enabled INTEGER NOT NULL DEFAULT 1
        CHECK(enabled IN (0,1)),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS test_results (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    test_case_id INTEGER,
    module TEXT NOT NULL,
    test_name TEXT NOT NULL,
    status TEXT NOT NULL
        CHECK(status IN ('passed','failed','skipped','error')),
    started_at TEXT NOT NULL,
    duration_ms INTEGER,
    http_status INTEGER,
    error_code TEXT,
    error_message TEXT,
    request_path TEXT,
    details_json TEXT,
    FOREIGN KEY(run_id) REFERENCES test_runs(id) ON DELETE CASCADE,
    FOREIGN KEY(test_case_id) REFERENCES test_cases(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bug_reports (
    id TEXT PRIMARY KEY,
    fingerprint TEXT NOT NULL UNIQUE,
    run_id TEXT,
    result_id TEXT,
    title TEXT NOT NULL,
    module TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium'
        CHECK(severity IN ('critical','high','medium','low')),
    priority TEXT NOT NULL DEFAULT 'normal'
        CHECK(priority IN ('urgent','high','normal','low')),
    description TEXT,
    steps_json TEXT,
    expected_result TEXT,
    actual_result TEXT,
    environment_json TEXT,
    status TEXT NOT NULL DEFAULT 'open'
        CHECK(status IN ('open','investigating','fixed','verified','wont_fix')),
    occurrences INTEGER NOT NULL DEFAULT 1,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    resolution_notes TEXT,
    FOREIGN KEY(run_id) REFERENCES test_runs(id) ON DELETE SET NULL,
    FOREIGN KEY(result_id) REFERENCES test_results(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bug_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bug_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    message TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(bug_id) REFERENCES bug_reports(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_runs_started
ON test_runs(started_at);

CREATE INDEX IF NOT EXISTS idx_results_run
ON test_results(run_id);

CREATE INDEX IF NOT EXISTS idx_results_status
ON test_results(status);

CREATE INDEX IF NOT EXISTS idx_bugs_status
ON bug_reports(status);

CREATE INDEX IF NOT EXISTS idx_bugs_severity
ON bug_reports(severity);

CREATE INDEX IF NOT EXISTS idx_bugs_module
ON bug_reports(module);

CREATE INDEX IF NOT EXISTS idx_bug_events_bug
ON bug_events(bug_id);
""")

db.commit()
db.close()
os.chmod(DB, 0o600)

print("BUG REPORT DATABASE READY")
print("Database:", DB)
print("Tables: test_runs, test_cases, test_results, bug_reports, bug_events")
print("Foreign keys: enabled")
print("Duplicate detection: enabled")
