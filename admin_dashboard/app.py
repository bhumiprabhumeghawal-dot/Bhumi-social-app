import hmac
import json
import os
import secrets
import urllib.error
import urllib.request
from functools import wraps

from flask import Flask, abort, flash, redirect, render_template_string, request, session, url_for

app = Flask(__name__)
app.secret_key = os.environ.get("DASHBOARD_SESSION_SECRET", "")
if not app.secret_key:
    raise RuntimeError("DASHBOARD_SESSION_SECRET is required")

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_SAMESITE="Strict",
    PERMANENT_SESSION_LIFETIME=3600,
    MAX_CONTENT_LENGTH=16 * 1024,
)

ADMIN_PASSWORD = os.environ.get("ADMIN_DASHBOARD_PASSWORD", "")
API_TOKEN = os.environ.get("DASHBOARD_API_TOKEN", "")
API_URL = os.environ.get("SOCIALAPP_API_URL", "https://bhumi-social-app-1.onrender.com").rstrip("/")
if not ADMIN_PASSWORD or not API_TOKEN:
    raise RuntimeError("Admin dashboard credentials are not configured")

PAGE = """
<!doctype html>
<html lang="hi"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#090d18"><link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/icon.svg" type="image/svg+xml">
<title>Bhumi Social AI · Live Database Dashboard</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#090d18;color:#edf2ff;font:15px system-ui,Arial}
header{padding:20px;background:#111a2b;border-bottom:1px solid #263550}
main{max-width:1120px;margin:auto;padding:20px}h1{font-size:22px;margin:0 0 5px}
.muted{color:#9aabc6}.bar{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px;margin:18px 0}
.card,.panel{background:#121c30;border:1px solid #263550;border-radius:15px;padding:16px}
.label{color:#9aabc6;font-size:13px}.num{font-size:28px;font-weight:750;margin-top:7px;overflow-wrap:anywhere}
h2{font-size:17px;margin:0 0 12px}.status{display:inline-block;padding:6px 10px;border-radius:20px;background:#173c2c;color:#7de5a8;font-size:12px}
.warn{background:#482b19;color:#ffd08b}.bad{background:#4a2028;color:#ff9ba3}
button{background:#293d60;color:white;border:1px solid #425b83;border-radius:9px;padding:10px 14px;cursor:pointer}
input{width:100%;padding:13px;border-radius:9px;background:#0b1322;border:1px solid #344866;color:white}
label{display:block;margin:12px 0 6px}.notice{padding:12px;border-radius:9px;background:#263550;margin:12px 0}
small{color:#9aabc6}.footer{margin-top:25px;color:#8092ae;font-size:12px}
a{color:#9dc6ff;text-decoration:none}
@media(max-width:600px){main{padding:13px}.card{padding:13px}.num{font-size:24px}}
</style></head><body>
<header><div class="bar"><div><h1>Bhumi Social AI · Live Database Dashboard</h1>
<div class="muted">Private Admin Panel · Production Neon PostgreSQL</div></div><button id="installApp" hidden onclick="installAdminApp()">Install App</button>
{% if logged_in %}<form method="post" action="{{ url_for('logout') }}">
<input type="hidden" name="csrf" value="{{ csrf }}"><button type="submit">Logout</button></form>{% endif %}
</div></header><main>
{% for message in get_flashed_messages() %}<div class="notice">{{ message }}</div>{% endfor %}
{{ body|safe }}
<div class="footer">Aggregate-only analytics · No passwords, tokens, emails or private message contents are displayed.</div>
</main><script>if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));}let installEvent=null;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEvent=e;document.getElementById("installApp").hidden=false;});async function installAdminApp(){if(!installEvent){alert("Browser menu में Add to Home screen चुनें।");return;}installEvent.prompt();await installEvent.userChoice;installEvent=null;}</script></body></html>
"""

def csrf_token():
    if "csrf" not in session:
        session["csrf"] = secrets.token_urlsafe(32)
    return session["csrf"]

def require_csrf():
    if not secrets.compare_digest(request.form.get("csrf", ""), session.get("csrf", "")):
        abort(400, "Invalid form token")

@app.before_request
def require_admin():
    if request.endpoint in ("login", "health"):
        return None
    if not session.get("admin_authenticated"):
        return redirect(url_for("login", next=request.path))

@app.get("/health")
def health():
    return {"ok": True, "service": "Bhumi Social AI Admin Dashboard"}

@app.route("/login", methods=["GET", "POST"])
def login():
    error = ""
    if request.method == "POST":
        require_csrf()
        supplied = request.form.get("password", "")
        if hmac.compare_digest(supplied, ADMIN_PASSWORD):
            session.clear()
            session.permanent = True
            session["admin_authenticated"] = True
            session["csrf"] = secrets.token_urlsafe(32)
            target = request.args.get("next", "/")
            if not target.startswith("/") or target.startswith("//"):
                target = "/"
            return redirect(target)
        error = "गलत Admin password।"
    body = render_template_string("""
    <section class="panel" style="max-width:430px;margin:40px auto">
      <h2>Private Admin Login</h2>{% if error %}<p class="bad">{{ error }}</p>{% endif %}
      <form method="post"><input type="hidden" name="csrf" value="{{ csrf }}">
      <label>Admin Password</label><input type="password" name="password" required autocomplete="current-password">
      <p><button type="submit">Secure Login</button></p></form>
    </section>""", error=error, csrf=csrf_token())
    return render_template_string(PAGE, body=body, logged_in=False, csrf=csrf_token())

@app.post("/logout")
def logout():
    require_csrf()
    session.clear()
    flash("आप सुरक्षित रूप से Logout हो गए।")
    return redirect(url_for("login"))

def fetch_analytics():
    req = urllib.request.Request(
        API_URL + "/api/admin/analytics",
        headers={"X-Dashboard-Token": API_TOKEN, "Accept": "application/json"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))

def fmt_bytes(value):
    value = max(0, int(value or 0))
    units = ("B", "KB", "MB", "GB", "TB")
    amount = float(value)
    for unit in units:
        if amount < 1024 or unit == units[-1]:
            return f"{amount:.1f} {unit}"
        amount /= 1024
    return f"{amount:.1f} TB"

@app.get("/")
def dashboard():
    data = None
    error = ""
    try:
        data = fetch_analytics()
        if not data.get("ok"):
            error = "Production analytics API ने सही response नहीं दिया।"
    except urllib.error.HTTPError as exc:
        error = "Production API unavailable (HTTP " + str(exc.code) + ")."
    except Exception:
        error = "Production API से connection नहीं हो पाया।"

    if data:
        t = data.get("totals", {})
        metrics = [
            ("Registered Users", t.get("users", 0)),
            ("Active Sessions", data.get("active_sessions", 0)),
            ("Online · 5 min", data.get("online_users_5m", 0)),
            ("Posts", t.get("posts", 0)),
            ("Reels", t.get("reels", 0)),
            ("Stories", t.get("stories", 0)),
            ("Follows", t.get("follows", 0)),
            ("Post Likes", t.get("post_likes", 0)),
            ("Post Comments", t.get("post_comments", 0)),
            ("Reel Likes", t.get("reel_likes", 0)),
            ("Reel Comments", t.get("reel_comments", 0)),
            ("Messages", t.get("messages", 0)),
            ("Notifications", t.get("notifications", 0)),
        ]
        cards = "".join(
            f'<section class="card"><div class="label">{name}</div><div class="num">{int(value or 0):,}</div></section>'
            for name, value in metrics
        )
        body = (
            '<div class="bar"><span class="status">LIVE · ' + data.get("database", "connected").upper() + '</span>'
            '<small>Last checked: ' + data.get("checked_at", "—") + '</small></div>'
            '<div class="grid">' + cards + '</div>'
            '<section class="panel"><h2>Database & API Health</h2>'
            '<p>Database: <b class="status">Neon PostgreSQL Connected</b></p>'
            '<p>Database Size: <b>' + fmt_bytes(data.get("database_size_bytes")) + '</b></p>'
            '<p>Analytics Query Time: <b>' + str(data.get("query_time_ms", "—")) + ' ms</b></p>'
            '<p>Data Source: <b>' + data.get("source", "Production") + '</b></p>'
            '<p><small>यह dashboard केवल aggregate counts दिखाता है। व्यक्तिगत account details और chat contents private रहते हैं।</small></p></section>'
        )
    else:
        body = '<section class="panel"><span class="status bad">LIVE DATA NOT AVAILABLE</span><p>' + error + '</p><p><small>Backend analytics API और Render environment configuration जाँचें।</small></p></section>'

    body += '<p><a href="/">↻ Refresh live data</a></p>'
    return render_template_string(PAGE, body=body, logged_in=True, csrf=csrf_token())

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "10000")), debug=False)


@app.get('/manifest.webmanifest')
def manifest():
    return app.response_class(open(os.path.join(os.path.dirname(__file__), 'manifest.webmanifest'), encoding='utf-8').read(), mimetype='application/manifest+json')

@app.get('/sw.js')
def service_worker():
    response = app.response_class(open(os.path.join(os.path.dirname(__file__), 'sw.js'), encoding='utf-8').read(), mimetype='application/javascript')
    response.headers['Service-Worker-Allowed'] = '/'
    response.headers['Cache-Control'] = 'no-cache'
    return response

@app.get('/icon.svg')
def app_icon():
    return app.response_class(open(os.path.join(os.path.dirname(__file__), 'icon.svg'), encoding='utf-8').read(), mimetype='image/svg+xml')
