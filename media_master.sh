#!/data/data/com.termux/files/usr/bin/bash
set -e
cd ~/SocialApp

python - <<'PY'
from pathlib import Path
import ast
import re
import shutil

root = Path.cwd()
app = root / "App.js"
api = root / "api.js"
server = root / "server/app.py"
backup = root / "backups/media_master"
backup.mkdir(parents=True, exist_ok=True)

for p in (app, api, server):
    if not p.is_file():
        raise SystemExit(f"Required file missing: {p}")

for p in (app, api, server):
    dst = backup / (p.name + ".master-original")
    if not dst.exists():
        shutil.copy2(p, dst)

s = server.read_text(encoding="utf-8")
limit_pattern = r'(?m)^(\s*MAX_UPLOAD_BYTES\s*=\s*)[^\n]+$'
s2, n = re.subn(limit_pattern, r'\g<1>1024 * 1024 * 1024', s, count=1)

if n:
    server.write_text(s2, encoding="utf-8")
    print("Server upload limit setting updated to 1 GB.")
else:
    print("Server upload limit setting not found; server file unchanged.")

print("Backups preserved.")
print("Master script prepared; the remaining eight feature groups need compatible app/server implementation.")
PY
