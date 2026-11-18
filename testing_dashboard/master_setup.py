from pathlib import Path
import sqlite3
import json
import shutil
import py_compile
import sys

BASE = Path(__file__).resolve().parent
APP = BASE / "app.py"
CONFIG = BASE / "data" / "dashboard_admin.json"
MATRIX = BASE / "data" / "feature_matrix.json"
SOCIAL_DB = BASE.parent / "server" / "data" / "socialapp.db"

if not APP.exists():
    sys.exit("STOP: Dashboard app.py नहीं मिली।")
if not CONFIG.exists():
    sys.exit("STOP: Admin credentials नहीं मिलीं। पहले से बनाया Admin password सुरक्षित रखें।")

s = APP.read_text(encoding="utf-8")

# Preflight: सभी आवश्यक insertion points जाँचें, फिर ही बदलाव करें।
required = [
    '@app.get("/")\ndef index():',
    '    content = render_template_string("""',
    '""", s=summary, bugs=bugs, runs=runs)',
    '</style>',
]
for anchor in required:
    if anchor not in s:
        sys.exit("STOP: अपेक्षित code anchor नहीं मिला: " + repr(anchor))

if "def get_social_analytics():" not in s:
    analytics_function = '''

def get_social_analytics():
    """Read-only local snapshot; never returns account names or secrets."""
    from datetime import datetime, timezone

    result = {
        "available": False, "users": None, "valid_sessions": None,
        "session_accounts": None, "posts": None, "reels": None,
        "stories": None, "follows": None, "likes": None,
        "comments": None, "online": None, "login_history": None,
        "failed_logins": None,
    }
    path = BASE_DIR.parent / "server" / "data" / "socialapp.db"
    if not path.is_file():
        return result

    db = None
    try:
        db = sqlite3.connect(
            path.resolve().as_uri() + "?mode=ro",
            uri=True, timeout=3
        )
        db.row_factory = sqlite3.Row
        tables = {
            row["name"] for row in
            db.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }

        def count_table(name):
            if name not in tables:
                return None
            return db.execute(
                'SELECT COUNT(*) FROM "' + name + '"'
            ).fetchone()[0]

        result["users"] = count_table("users")
        result["follows"] = count_table("follows")
        result["likes"] = count_table("post_likes")
        result["comments"] = count_table("post_comments")

        if "content" in tables:
            kinds = {
                row["kind"]: row["total"] for row in db.execute(
                    "SELECT kind, COUNT(*) AS total FROM content GROUP BY kind"
                )
            }
            result["posts"] = kinds.get("posts", 0)
            result["reels"] = kinds.get("reels", 0)
            result["stories"] = kinds.get("stories", 0)

        if "auth_sessions" in tables:
            now = datetime.now(timezone.utc)
            valid_count = 0
            valid_users = set()
            for row in db.execute(
                "SELECT username, expires_at FROM auth_sessions"
            ):
                try:
                    expiry = datetime.fromisoformat(row["expires_at"])
                    if expiry.tzinfo is None:
                        expiry = expiry.replace(tzinfo=timezone.utc)
                    if expiry > now:
                        valid_count += 1
                        valid_users.add(row["username"])
                except (TypeError, ValueError):
                    continue
            result["valid_sessions"] = valid_count
            result["session_accounts"] = len(valid_users)

        result["available"] = True
    except (sqlite3.Error, OSError, ValueError):
        pass
    finally:
        if db is not None:
            db.close()

    # These metrics require heartbeat and dedicated security audit events.
    return result

'''
    s = s.replace(
        '@app.get("/")\ndef index():',
        analytics_function + '@app.get("/")\ndef index():',
        1
    )

if '    analytics = get_social_analytics()' not in s:
    s = s.replace(
        'def index():\n    with connect() as db:',
        'def index():\n    analytics = get_social_analytics()\n    with connect() as db:',
        1
    )

# Add a real, explicit feature verification matrix.
modules = [
    {"name": "Authentication & Sessions", "status": "NOT TESTED"},
    {"name": "Home Feed", "status": "NOT TESTED"},
    {"name": "Posts & Media Upload", "status": "NOT TESTED"},
    {"name": "Likes & Comments", "status": "NOT TESTED"},
    {"name": "Follows & Follow Requests", "status": "NOT TESTED"},
    {"name": "Reels & Video Playback", "status": "NOT TESTED"},
    {"name": "Stories & Expiry", "status": "NOT TESTED"},
    {"name": "Profile & Privacy", "status": "NOT TESTED"},
    {"name": "Settings & Notifications", "status": "NOT TESTED"},
    {"name": "Security & Abuse Prevention", "status": "NOT TESTED"},
]
if not MATRIX.exists():
    MATRIX.write_text(json.dumps(modules, ensure_ascii=False, indent=2), encoding="utf-8")

if 'FEATURE_MATRIX_PATH' not in s:
    s = s.replace(
        'DB_PATH = BASE_DIR / "data" / "bug_reports.sqlite3"',
        'DB_PATH = BASE_DIR / "data" / "bug_reports.sqlite3"\nFEATURE_MATRIX_PATH = BASE_DIR / "data" / "feature_matrix.json"',
        1
    )

if 'status-green' not in s:
    styles = """
.status{display:inline-block;border-radius:20px;padding:4px 9px;font-size:12px;font-weight:700}
.status-green{background:#153d2b;color:#75e6a5}
.status-blue{background:#173653;color:#85c9ff}
.status-yellow{background:#493b18;color:#ffdc79}
.status-red{background:#4a2027;color:#ff929b}
.status-purple{background:#382653;color:#d4a5ff}
.status-grey{background:#303642;color:#bdc5d2}
.source-note{font-size:12px;color:#aab3c5;margin-top:8px}
"""
    s = s.replace('</style>', styles + '\n</style>', 1)

analytics_html = '''
    <section class="panel">
      <h2>User & Admin Analytics</h2>
      {% if a.available %}
      <div class="notice"><span class="status status-blue">INFO</span>
        Local SQLite snapshot — Production का live data नहीं।
      </div>
      <div class="cards">
        <div class="card"><div class="muted">Registered Users</div><div class="num">{{a.users if a.users is not none else 'N/A'}}</div><span class="status status-blue">DATA</span></div>
        <div class="card"><div class="muted">Valid Sessions</div><div class="num">{{a.valid_sessions if a.valid_sessions is not none else 'N/A'}}</div><span class="status status-blue">SESSION DATA</span></div>
        <div class="card"><div class="muted">Accounts with Sessions</div><div class="num">{{a.session_accounts if a.session_accounts is not none else 'N/A'}}</div><span class="status status-blue">SESSION DATA</span></div>
        <div class="card"><div class="muted">Posts</div><div class="num">{{a.posts if a.posts is not none else 'N/A'}}</div><span class="status status-blue">DATA</span></div>
        <div class="card"><div class="muted">Reels</div><div class="num">{{a.reels if a.reels is not none else 'N/A'}}</div><span class="status status-blue">DATA</span></div>
        <div class="card"><div class="muted">Stories</div><div class="num">{{a.stories if a.stories is not none else 'N/A'}}</div><span class="status status-blue">DATA</span></div>
        <div class="card"><div class="muted">Follows</div><div class="num">{{a.follows if a.follows is not none else 'N/A'}}</div><span class="status status-blue">DATA</span></div>
        <div class="card"><div class="muted">Likes</div><div class="num">{{a.likes if a.likes is not none else 'N/A'}}</div><span class="status status-blue">DATA</span></div>
        <div class="card"><div class="muted">Comments</div><div class="num">{{a.comments if a.comments is not none else 'N/A'}}</div><span class="status status-blue">DATA</span></div>
        <div class="card"><div class="muted">Online Users</div><div class="num">N/A</div><span class="status status-grey">NOT TRACKED</span></div>
        <div class="card"><div class="muted">Login History</div><div class="num">N/A</div><span class="status status-grey">NOT TRACKED</span></div>
        <div class="card"><div class="muted">Failed Login Events</div><div class="num">N/A</div><span class="status status-grey">NOT TRACKED</span></div>
      </div>
      <p class="source-note">Valid session का अर्थ user online होना नहीं है। Heartbeat और अलग security audit log अभी आवश्यक हैं।</p>
      {% else %}
      <span class="status status-grey">DATA UNAVAILABLE</span>
      <p>Local SocialApp database उपलब्ध नहीं है। अनुमानित आँकड़े नहीं दिखाए गए।</p>
      {% endif %}
    </section>
    <section class="panel">
      <h2>Feature Testing Matrix</h2>
      <p class="source-note">Grey = अभी verified test result उपलब्ध नहीं। Test PASS होने पर ही status बदलेगा।</p>
      <table><thead><tr><th>Module</th><th>Status</th></tr></thead><tbody>
      {% for item in modules %}
        <tr><td>{{item.name}}</td><td><span class="status status-grey">{{item.status}}</span></td></tr>
      {% endfor %}
      </tbody></table>
    </section>
'''

if 'User & Admin Analytics' not in s:
    s = s.replace(
        '    content = render_template_string("""',
        '    content = render_template_string("""' + analytics_html,
        1
    )

if 'a=analytics, modules=modules' not in s:
    s = s.replace(
        'def index():\n    analytics = get_social_analytics()\n    with connect() as db:',
        'def index():\n    analytics = get_social_analytics()\n    modules = json.loads(FEATURE_MATRIX_PATH.read_text(encoding="utf-8"))\n    with connect() as db:',
        1
    )
    s = s.replace(
        '""", s=summary, bugs=bugs, runs=runs)',
        '""", s=summary, bugs=bugs, runs=runs, a=analytics, modules=modules)',
        1
    )

# Add logout control to the authenticated dashboard header.
if 'admin_logout' in s and 'Logout</button>' not in s:
    s = s.replace(
        '</header>',
        '''{% if session.get("admin_authenticated") %}
<form method="post" action="{{url_for('admin_logout')}}" style="padding:0 20px 12px">
<input type="hidden" name="csrf" value="{{session.get('csrf','')}}">
<button type="submit">Logout</button>
</form>
{% endif %}
</header>''',
        1
    )

# Save only after all preflight checks and transformations.
backup = APP.with_name("app.py.pre-master-backup")
if not backup.exists():
    shutil.copy2(APP, backup)

APP.write_text(s, encoding="utf-8")
py_compile.compile(str(APP), doraise=True)

print("MASTER INSTALL: PASS")
print("Backup:", backup.name)
print("Analytics: installed (local DB read-only)")
print("Feature matrix: installed")
print("Six status colors: installed")
print("Admin logout control: checked")
print("Online / login history / failed-login metrics: honestly marked NOT TRACKED")
