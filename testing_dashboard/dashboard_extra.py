
from flask import Blueprint, session, redirect, url_for, render_template_string
from pathlib import Path
import sqlite3

bp = Blueprint("dashboard_extra", __name__)
ROOT = Path(__file__).resolve().parent.parent
BUG_DB = ROOT / "testing_dashboard" / "data" / "bug_reports.sqlite3"
SOCIAL_DB = ROOT / "server" / "data" / "socialapp.db"

MODULES = [
    ("Home Feed", "Home Feed और Feed Scrolling"),
    ("Posts", "Post Creation, Editing और Saving"),
    ("Likes", "Post और Reel Likes"),
    ("Comments", "Comments और Replies"),
    ("Follows", "Follow, Unfollow और Requests"),
    ("Reels", "Reels Playback और Interactions"),
    ("Stories", "Stories, Expiry और Viewing"),
    ("Profile", "Profile और Privacy"),
    ("Settings", "Account और Notification Settings"),
    ("Authentication & Sessions", "Login, Sessions और Logout"),
    ("Security & Privacy", "Access Control और Security"),
]

STYLE = """
<style>
*{box-sizing:border-box}body{margin:0;background:#0b1020;color:#edf2ff;
font:15px system-ui,Arial}main{max-width:1150px;margin:auto;padding:22px}
nav{display:flex;gap:9px;flex-wrap:wrap;margin:16px 0 22px}
a{color:#9cc7ff;text-decoration:none}.nav a,.btn{background:#202b43;
padding:10px 13px;border-radius:10px;display:inline-block}
h1{font-size:25px;margin:8px 0}h2{font-size:19px}
.muted{color:#9caecb}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:13px}
.card{background:#151f34;border:1px solid #293751;border-radius:15px;padding:16px;min-width:0}
.num{font-size:27px;font-weight:750;margin-top:8px;overflow-wrap:anywhere}
table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:11px 8px;
border-bottom:1px solid #293751;vertical-align:top}th{color:#a9bddc}
.wrap{overflow-x:auto}.pill{display:inline-block;border-radius:20px;padding:4px 9px;
background:#344055;font-size:12px}.green{color:#65dfa0}.blue{color:#78baff}
.yellow{color:#ffd36b}.red{color:#ff8585}.purple{color:#c5a2ff}.grey{color:#a6b1c3}
@media(max-width:600px){main{padding:13px}h1{font-size:22px}.card{padding:13px}
td,th{padding:9px 6px;font-size:13px}}
</style>
"""

def page(title, body):
    links = [
        ("/workspace", "Workspace"),
        ("/workspace/analytics", "Analytics"),
        ("/workspace/features", "Features"),
        ("/workspace/bugs", "Bug Reports"),
        ("/workspace/security", "Security"),
        ("/workspace/system", "System"),
    ]
    nav = "".join(f'<a class="nav" href="{u}">{n}</a>' for u,n in links)
    return render_template_string(
        STYLE + '<main><h1>Bhumi Social AI · Private Testing Dashboard</h1>'
        '<p class="muted">Admin-only workspace · Local dashboard data</p>'
        f'<nav>{nav}</nav><h2>{title}</h2>{body}'
        '<p class="muted">Production app में कोई बदलाव इस Workspace से नहीं किया जाता।</p>'
        '</main>'
    )

def admin_only():
    return bool(session.get("admin_authenticated"))

def bug_conn():
    con = sqlite3.connect(str(BUG_DB))
    con.row_factory = sqlite3.Row
    return con

def social_counts():
    result = {
        "users": None, "sessions": None, "content": None, "posts": None,
        "reels": None, "stories": None, "follows": None, "likes": None,
        "comments": None, "online": None, "login_history": None,
    }
    if not SOCIAL_DB.exists():
        return result, "Local database unavailable"
    try:
        con = sqlite3.connect(f"file:{SOCIAL_DB.resolve()}?mode=ro", uri=True)
        tables = {r[0] for r in con.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
        def count(table):
            if table not in tables:
                return None
            return con.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        result["users"] = count("users")
        result["sessions"] = count("auth_sessions")
        result["content"] = count("content")
        if "content" in tables:
            for kind in ("posts", "reels", "stories"):
                result[kind] = con.execute(
                    "SELECT COUNT(*) FROM content WHERE kind=?", (kind,)
                ).fetchone()[0]
        result["follows"] = count("follows")
        result["likes"] = count("post_likes")
        result["comments"] = count("post_comments")
        con.close()
        return result, "Local SQLite snapshot — Production live data नहीं"
    except Exception as e:
        return result, "Database unavailable: " + type(e).__name__

@bp.get("/workspace")
def workspace():
    if not admin_only():
        return redirect(url_for("admin_login"))
    body = """
    <div class="grid">
      <section class="card"><h3>Analytics</h3><p>Users, Sessions और Content का उपलब्ध डेटा</p><a href="/workspace/analytics">खोलें →</a></section>
      <section class="card"><h3>Feature Registry</h3><p>सभी 11 फीचर मॉड्यूल की स्थिति</p><a href="/workspace/features">खोलें →</a></section>
      <section class="card"><h3>Bug Management</h3><p>दर्ज Bugs और उनके Status</p><a href="/workspace/bugs">खोलें →</a></section>
      <section class="card"><h3>Security Overview</h3><p>उपलब्ध Security Events और सीमाएँ</p><a href="/workspace/security">खोलें →</a></section>
      <section class="card"><h3>System</h3><p>Dashboard Database और Local Data</p><a href="/workspace/system">खोलें →</a></section>
    </div>
    <p class="muted">यह Workspace Dashboard की व्यवस्था है, ऐप की टेस्टिंग रिपोर्ट नहीं।</p>
    """
    return page("Admin Workspace", body)

@bp.get("/workspace/analytics")
def analytics():
    if not admin_only():
        return redirect(url_for("admin_login"))
    d, note = social_counts()
    labels = [
        ("Registered Users", "users"), ("Stored Sessions", "sessions"),
        ("All Content", "content"), ("Posts", "posts"), ("Reels", "reels"),
        ("Stories", "stories"), ("Follows", "follows"), ("Likes", "likes"),
        ("Comments", "comments"),
    ]
    cards = "".join(
        f'<section class="card"><div class="muted">{label}</div>'
        f'<div class="num">{d[key] if d[key] is not None else "N/A"}</div></section>'
        for label,key in labels
    )
    body = f'<p class="pill blue">{note}</p><div class="grid">{cards}</div>'
    body += """
    <h3>Presence और Login Activity</h3><div class="grid">
    <section class="card"><b class="grey">GREY · NOT TRACKED</b><p>Online Users / Heartbeat</p></section>
    <section class="card"><b class="grey">GREY · NOT TRACKED</b><p>Login History</p></section>
    <section class="card"><b class="grey">GREY · NOT TRACKED</b><p>Inactive User Timeline</p></section>
    </div><p class="muted">Stored sessions की संख्या online users की संख्या नहीं है।</p>
    """
    return page("User & Admin Analytics", body)

@bp.get("/workspace/features")
def features():
    if not admin_only():
        return redirect(url_for("admin_login"))
    rows = []
    try:
        with bug_conn() as con:
            con.execute("""CREATE TABLE IF NOT EXISTS test_cases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_key TEXT UNIQUE, module TEXT, name TEXT,
                description TEXT, enabled INTEGER DEFAULT 1, created_at TEXT
            )""")
            import datetime
            for module, desc in MODULES:
                key = "module-" + module.lower().replace(" ", "-").replace("&","and")
                con.execute("""INSERT OR IGNORE INTO test_cases
                    (test_key,module,name,description,enabled,created_at)
                    VALUES (?,?,?,?,1,?)""",
                    (key,module,module,desc,datetime.datetime.now().isoformat()))
            records = con.execute(
                "SELECT module, COUNT(*) AS n FROM test_cases GROUP BY module ORDER BY module"
            ).fetchall()
            for module, desc in MODULES:
                rec = next((r for r in records if r["module"] == module), None)
                rows.append((module, rec["n"] if rec else 0))
    except Exception:
        rows = [(m, "Unavailable") for m,_ in MODULES]
    body = '<p class="muted">Registry तैयार है। नीचे NOT TESTED का अर्थ है कि अभी कोई टेस्ट निष्पादित नहीं हुआ।</p><div class="wrap"><table><tr><th>Module</th><th>Registry Entries</th><th>Status</th></tr>'
    body += "".join(f'<tr><td>{m}</td><td>{n}</td><td><span class="pill grey">NOT TESTED</span></td></tr>' for m,n in rows)
    body += "</table></div>"
    return page("Feature Registry", body)

@bp.get("/workspace/bugs")
def bugs():
    if not admin_only():
        return redirect(url_for("admin_login"))
    body = "<div class='wrap'><table><tr><th>Bug ID</th><th>Title</th><th>Module</th><th>Severity</th><th>Status</th><th>Occurrences</th></tr>"
    try:
        with bug_conn() as con:
            records = con.execute("""SELECT id,title,module,severity,status,occurrences
                FROM bug_reports ORDER BY last_seen DESC""").fetchall()
        for r in records:
            body += "<tr>" + "".join(
                f"<td>{str(r[k] or '—')[:180]}</td>"
                for k in ("id","title","module","severity","status","occurrences")
            ) + "</tr>"
        if not records:
            body += "<tr><td colspan='6'>अभी कोई Bug Report दर्ज नहीं है।</td></tr>"
    except Exception:
        body += "<tr><td colspan='6'>Bug database unavailable</td></tr>"
    body += "</table></div><p class='muted'>Bug status बदलने के लिए मौजूदा Bug Management पेज इस्तेमाल करें।</p>"
    return page("Bug Management Overview", body)

@bp.get("/workspace/security")
def security():
    if not admin_only():
        return redirect(url_for("admin_login"))
    body = """
    <div class="grid">
    <section class="card"><b class="blue">AVAILABLE</b><p>Dashboard Admin Login और Session Gate</p></section>
    <section class="card"><b class="grey">NOT TRACKED</b><p>Live Failed Login Counter</p></section>
    <section class="card"><b class="grey">NOT TRACKED</b><p>Production Suspicious Activity Stream</p></section>
    <section class="card"><b class="grey">NOT CONNECTED</b><p>Production Security Events API</p></section>
    </div>
    <p>Dashboard में मौजूद Bug Events अलग से दर्ज होते हैं; उन्हें Production Security Monitoring नहीं माना जाएगा।</p>
    <p class="muted">कोई पासवर्ड, Password Hash या Session Token यहाँ प्रदर्शित नहीं किया जाता।</p>
    """
    return page("Security & Privacy Overview", body)

@bp.get("/workspace/system")
def system():
    if not admin_only():
        return redirect(url_for("admin_login"))
    items = [
        ("Dashboard app.py", ROOT / "testing_dashboard" / "app.py"),
        ("Bug Database", BUG_DB),
        ("Local Social Database", SOCIAL_DB),
    ]
    body = "<div class='grid'>"
    for label,path in items:
        state = "AVAILABLE" if path.exists() else "NOT AVAILABLE"
        color = "green" if path.exists() else "grey"
        body += f'<section class="card"><b>{label}</b><p class="{color}">{state}</p></section>'
    body += "</div><p class='muted'>Dashboard local device पर चलता है। इसे सार्वजनिक Internet पर expose नहीं किया गया है।</p>"
    return page("System & Data Sources", body)

def register_dashboard_extra(app):
    if "dashboard_extra" not in app.blueprints:
        app.register_blueprint(bp)
