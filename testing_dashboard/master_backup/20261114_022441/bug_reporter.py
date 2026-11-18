import sqlite3
import hashlib
import json
import re
import uuid
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlunsplit

DB_PATH = Path(__file__).resolve().parent / "data" / "bug_reports.sqlite3"

def now():
    return datetime.now(timezone.utc).isoformat()

def clean(value):
    """Remove credentials and sensitive values before saving reports."""
    if isinstance(value, dict):
        safe = {}
        for key, val in value.items():
            if re.search(r"token|password|secret|authorization|cookie|api.?key", str(key), re.I):
                safe[key] = "[REDACTED]"
            else:
                safe[key] = clean(val)
        return safe
    if isinstance(value, list):
        return [clean(v) for v in value]
    if isinstance(value, str):
        value = re.sub(r"(?i)(bearer\s+)[A-Za-z0-9._~+/=-]+", r"\1[REDACTED]", value)
        value = re.sub(
            r"(?i)((?:password|token|secret|api[_-]?key)\s*[=:]\s*)[^&\s,;]+",
            r"\1[REDACTED]", value
        )
        return value[:5000]
    return value

def safe_path(path):
    if not path:
        return None
    try:
        parts = urlsplit(str(path))
        return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
    except Exception:
        return str(path).split("?", 1)[0][:500]

def connect():
    db = sqlite3.connect(DB_PATH, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    return db

def start_run(environment="testing", app_version=None, base_url=None):
    run_id = uuid.uuid4().hex
    with connect() as db:
        db.execute("""
            INSERT INTO test_runs
            (id, started_at, environment, app_version, base_url, status)
            VALUES (?, ?, ?, ?, ?, 'running')
        """, (run_id, now(), environment, app_version, safe_path(base_url)))
    return run_id

def fingerprint(module, test_name, error_code, error_message):
    identity = "|".join([
        str(module).strip().lower(),
        str(test_name).strip().lower(),
        str(error_code or "").strip().lower(),
        re.sub(r"\s+", " ", str(error_message or "").strip().lower())[:1000]
    ])
    return hashlib.sha256(identity.encode()).hexdigest()

def record_result(
    run_id, module, test_name, status,
    duration_ms=None, http_status=None,
    error_code=None, error_message=None,
    request_path=None, details=None,
    severity="medium", priority="normal",
    description=None, steps=None,
    expected_result=None, actual_result=None
):
    if status not in ("passed", "failed", "skipped", "error"):
        raise ValueError("Invalid test status")

    if severity not in ("critical", "high", "medium", "low"):
        severity = "medium"
    if priority not in ("urgent", "high", "normal", "low"):
        priority = "normal"

    result_id = uuid.uuid4().hex
    timestamp = now()
    details_json = json.dumps(clean(details or {}), ensure_ascii=False)
    error_message = clean(str(error_message or ""))[:5000]
    request_path = safe_path(request_path)

    with connect() as db:
        if not db.execute(
            "SELECT 1 FROM test_runs WHERE id=?", (run_id,)
        ).fetchone():
            raise ValueError("Test run not found")

        db.execute("""
            INSERT INTO test_results (
                id, run_id, module, test_name, status,
                started_at, duration_ms, http_status,
                error_code, error_message, request_path, details_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            result_id, run_id, module, test_name, status,
            timestamp, duration_ms, http_status,
            error_code, error_message or None,
            request_path, details_json
        ))

        db.execute("""
            UPDATE test_runs SET
                total_tests = total_tests + 1,
                passed_tests = passed_tests + ?,
                failed_tests = failed_tests + ?
            WHERE id=?
        """, (
            int(status == "passed"),
            int(status in ("failed", "error")),
            run_id
        ))

        bug_id = None

        if status in ("failed", "error"):
            fp = fingerprint(module, test_name, error_code, error_message)
            existing = db.execute(
                "SELECT id, status FROM bug_reports WHERE fingerprint=?",
                (fp,)
            ).fetchone()

            if existing:
                bug_id = existing["id"]
                new_status = (
                    "open" if existing["status"] in ("fixed", "verified")
                    else existing["status"]
                )
                db.execute("""
                    UPDATE bug_reports SET
                        occurrences=occurrences+1,
                        last_seen=?,
                        status=?
                    WHERE id=?
                """, (timestamp, new_status, bug_id))

                event_type = "reopened" if new_status == "open" and existing["status"] != "open" else "duplicate"
                event_message = "Bug detected again during automated testing."
            else:
                bug_id = uuid.uuid4().hex
                title = f"{module}: {test_name}"[:250]

                db.execute("""
                    INSERT INTO bug_reports (
                        id, fingerprint, run_id, result_id, title,
                        module, severity, priority, description,
                        steps_json, expected_result, actual_result,
                        environment_json, status, occurrences,
                        first_seen, last_seen
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 1, ?, ?)
                """, (
                    bug_id, fp, run_id, result_id, title,
                    module, severity, priority,
                    clean(description or error_message or "Automated test failed."),
                    json.dumps(clean(steps or []), ensure_ascii=False),
                    clean(expected_result),
                    clean(actual_result or error_message),
                    json.dumps(clean(details or {}), ensure_ascii=False),
                    timestamp, timestamp
                ))
                event_type = "created"
                event_message = "New bug detected by automated testing."

            db.execute("""
                INSERT INTO bug_events (bug_id, event_type, message, created_at)
                VALUES (?, ?, ?, ?)
            """, (bug_id, event_type, event_message, timestamp))

    return {"result_id": result_id, "bug_id": bug_id, "status": status}

def finish_run(run_id, status=None, summary=None):
    with connect() as db:
        row = db.execute(
            "SELECT total_tests, passed_tests, failed_tests FROM test_runs WHERE id=?",
            (run_id,)
        ).fetchone()

        if not row:
            raise ValueError("Test run not found")

        if status is None:
            status = "failed" if row["failed_tests"] else "passed"

        if status not in ("passed", "failed", "partial", "cancelled"):
            raise ValueError("Invalid run status")

        db.execute("""
            UPDATE test_runs SET
                finished_at=?, status=?, summary_json=?
            WHERE id=?
        """, (
            now(), status,
            json.dumps(clean(summary or {}), ensure_ascii=False),
            run_id
        ))

        return dict(row)

def get_bug_summary():
    with connect() as db:
        return dict(db.execute("""
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) AS open,
                SUM(CASE WHEN severity='critical' AND status='open' THEN 1 ELSE 0 END) AS critical,
                SUM(CASE WHEN severity='high' AND status='open' THEN 1 ELSE 0 END) AS high,
                SUM(occurrences) AS total_occurrences
            FROM bug_reports
        """).fetchone())

if __name__ == "__main__":
    print("Automatic Bug Reporter loaded successfully.")
    print("Database:", DB_PATH)
    print("Summary:", json.dumps(get_bug_summary(), indent=2))
