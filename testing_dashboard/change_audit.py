import os, sys, time, re, sqlite3, hashlib, difflib, argparse
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "testing_dashboard/data/bug_reports.sqlite3"
EXTENSIONS = {".py",".js",".jsx",".ts",".tsx",".json",".html",".css",".sql",".yml",".yaml",".toml",".md",".sh",".txt"}
SKIP_DIRS = {".git","node_modules",".expo","android","ios","build","dist","__pycache__"}
SECRET_NAMES = {".env",".env.local",".env.production","id_rsa","id_ed25519"}
MAX_BYTES = 1024 * 1024

def now():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")

def dbconn():
    c = sqlite3.connect(DB, timeout=20)
    c.execute("PRAGMA busy_timeout=20000")
    return c

def redact(s):
    patterns = [
        (r'(?i)(password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|authorization)(\s*["\']?\s*[:=]\s*["\']?)([^"\'\s,;]+)', r'\1\2[REDACTED]'),
        (r'(?i)(Bearer\s+)[A-Za-z0-9._~+/=-]+', r'\1[REDACTED]'),
        (r'(?i)(-----BEGIN [A-Z ]*PRIVATE KEY-----).*?(-----END [A-Z ]*PRIVATE KEY-----)', r'\1[REDACTED]\2'),
    ]
    for pattern, replacement in patterns:
        s = re.sub(pattern, replacement, s, flags=re.S if "PRIVATE KEY" in pattern else 0)
    return s

def eligible(p):
    try:
        rel = p.relative_to(ROOT)
    except ValueError:
        return False
    if any(part in SKIP_DIRS for part in rel.parts):
        return False
    if "testing_dashboard/data" in str(rel):
        return False
    name = p.name.lower()
    if name in SECRET_NAMES or name.startswith(".env"):
        return False
    if any(x in name for x in (".backup", ".before", ".bak", ".sqlite", ".apk")):
        return False
    if p.suffix.lower() not in EXTENSIONS:
        return False
    try:
        return p.is_file() and p.stat().st_size <= MAX_BYTES
    except OSError:
        return False

def read_file(p):
    raw = p.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        return digest, None
    return digest, redact(content)

def init():
    with dbconn() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS development_change_state (
          path TEXT PRIMARY KEY, sha256 TEXT NOT NULL,
          safe_content TEXT, last_seen TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS development_change_audit (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          path TEXT NOT NULL, change_type TEXT NOT NULL,
          old_sha256 TEXT, new_sha256 TEXT,
          diff_text TEXT, status TEXT NOT NULL DEFAULT 'pending',
          detected_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_dev_audit_time
          ON development_change_audit(detected_at);
        CREATE INDEX IF NOT EXISTS idx_dev_audit_path
          ON development_change_audit(path);
        """)
        c.commit()

def scan():
    found = {}
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            p = Path(base) / name
            if eligible(p):
                try:
                    digest, content = read_file(p)
                    if content is not None:
                        found[p.relative_to(ROOT).as_posix()] = (digest, content)
                except (OSError, PermissionError):
                    pass
    return found

def baseline():
    init()
    found = scan()
    with dbconn() as c:
        count = c.execute("SELECT COUNT(*) FROM development_change_state").fetchone()[0]
        if count:
            print("Baseline already exists; existing state preserved.")
            return
        stamp = now()
        c.executemany(
            "INSERT OR IGNORE INTO development_change_state(path,sha256,safe_content,last_seen) VALUES(?,?,?,?)",
            [(p,h,content,stamp) for p,(h,content) in found.items()]
        )
        c.commit()
    print("Audit tables ready.")
    print("Baseline files recorded:", len(found))
    print("No historical changes were fabricated.")

def monitor():
    init()
    print("Termux Change Monitor running. Stop with CTRL+C.")
    while True:
        found = scan()
        stamp = now()
        with dbconn() as c:
            old = {r[0]: (r[1],r[2]) for r in c.execute(
                "SELECT path,sha256,safe_content FROM development_change_state"
            )}
            for path, (new_hash, new_content) in found.items():
                previous = old.get(path)
                if previous is None:
                    change, old_hash, old_content = "created", None, ""
                elif previous[0] != new_hash:
                    change, old_hash, old_content = "modified", previous[0], previous[1] or ""
                else:
                    c.execute("UPDATE development_change_state SET last_seen=? WHERE path=?", (stamp,path))
                    continue

                diff = "".join(difflib.unified_diff(
                    old_content.splitlines(True), new_content.splitlines(True),
                    fromfile="previous/"+path, tofile="current/"+path
                ))
                c.execute("""
                    INSERT INTO development_change_audit
                    (path,change_type,old_sha256,new_sha256,diff_text,status,detected_at)
                    VALUES(?,?,?,?,?,'pending',?)
                """, (path,change,old_hash,new_hash,diff[:50000],stamp))
                c.execute("""
                    INSERT INTO development_change_state(path,sha256,safe_content,last_seen)
                    VALUES(?,?,?,?)
                    ON CONFLICT(path) DO UPDATE SET
                    sha256=excluded.sha256,safe_content=excluded.safe_content,
                    last_seen=excluded.last_seen
                """, (path,new_hash,new_content,stamp))
                print(change.upper(), path, flush=True)

            for path, (old_hash, old_content) in old.items():
                if path not in found:
                    c.execute("""
                        INSERT INTO development_change_audit
                        (path,change_type,old_sha256,new_sha256,diff_text,status,detected_at)
                        VALUES(?,'deleted',?,NULL,?,'pending',?)
                    """, (path,old_hash,"File deleted\n",stamp))
                    c.execute("DELETE FROM development_change_state WHERE path=?", (path,))
                    print("DELETED",path,flush=True)
            c.commit()
        time.sleep(3)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline", action="store_true")
    args = parser.parse_args()
    if args.baseline:
        baseline()
    else:
        monitor()
