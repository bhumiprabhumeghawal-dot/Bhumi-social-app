from pathlib import Path
from datetime import datetime
import shutil

p = Path("testing_dashboard/app.py")
src = p.read_text(encoding="utf-8")

marker = "from dashboard_extra import register_dashboard_extra"
if marker not in src:
    raise SystemExit("STOP: route insertion point not found.")

if "def development_audit_dashboard():" in src:
    raise SystemExit("STOP: Development Audit routes already exist.")

backup = p.with_name(
    "app.py.before_development_audit_" +
    datetime.now().strftime("%Y%m%d_%H%M%S")
)
shutil.copy2(p, backup)

routes = r'''
# === DEVELOPMENT CHANGE AUDIT ===

@app.get("/development-audit")
def development_audit_dashboard():
    status_filter = request.args.get("status", "all")
    allowed = ("all", "pending", "reviewed", "approved")
    if status_filter not in allowed:
        status_filter = "all"

    with connect() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS development_change_reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                audit_id INTEGER NOT NULL,
                old_status TEXT NOT NULL,
                new_status TEXT NOT NULL,
                note TEXT,
                reviewed_by TEXT NOT NULL,
                reviewed_at TEXT NOT NULL
            )
        """)

        totals = db.execute("""
            SELECT
              COUNT(*) AS total,
              SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN status='reviewed' THEN 1 ELSE 0 END) AS reviewed,
              SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved
            FROM development_change_audit
        """).fetchone()

        if status_filter == "all":
            rows = db.execute("""
                SELECT * FROM development_change_audit
                ORDER BY id DESC LIMIT 500
            """).fetchall()
        else:
            rows = db.execute("""
                SELECT * FROM development_change_audit
                WHERE status=?
                ORDER BY id DESC LIMIT 500
            """, (status_filter,)).fetchall()

        review_rows = db.execute("""
            SELECT * FROM development_change_reviews
            ORDER BY id DESC LIMIT 100
        """).fetchall()

    content = render_template_string("""
    <section class="panel">
      <h2>Development Change Audit</h2>
      <p>Termux file changes recorded in the local SQLite database.</p>
      <div class="grid">
        <div><small>Total events</small><h2>{{totals.total or 0}}</h2></div>
        <div><small>Pending</small><h2>{{totals.pending or 0}}</h2></div>
        <div><small>Reviewed</small><h2>{{totals.reviewed or 0}}</h2></div>
        <div><small>Approved</small><h2>{{totals.approved or 0}}</h2></div>
      </div>
      <p>
        Filter:
        <a href="{{url_for('development_audit_dashboard',status='all')}}">All</a> |
        <a href="{{url_for('development_audit_dashboard',status='pending')}}">Pending</a> |
        <a href="{{url_for('development_audit_dashboard',status='reviewed')}}">Reviewed</a> |
        <a href="{{url_for('development_audit_dashboard',status='approved')}}">Approved</a>
      </p>
      <p><a href="{{url_for('index')}}">Main Dashboard</a></p>
    </section>

    <section class="panel">
      <h2>Change Events — {{status_filter}}</h2>
      {% if rows %}
        {% for r in rows %}
        <div style="padding:14px 0;border-bottom:1px solid #46536b">
          <strong>#{{r.id}} · {{r.path}}</strong>
          <p>{{r.change_type}} · {{r.detected_at}} ·
            <span class="pill">{{r.status}}</span>
          </p>
          <details>
            <summary>View safe Diff</summary>
            <pre>{{r.diff_text or 'No text diff available.'}}</pre>
            <p><small>SHA-256 before: {{r.old_sha256 or 'N/A'}}</small></p>
            <p><small>SHA-256 after: {{r.new_sha256 or 'N/A'}}</small></p>
          </details>
          <form method="post"
                action="{{url_for('development_audit_review',audit_id=r.id)}}"
                style="margin-top:10px">
            <input type="hidden" name="csrf" value="{{csrf_token()}}">
            <label>Review status</label>
            <select name="status" required>
              <option value="reviewed" {% if r.status=='reviewed' %}selected{% endif %}>Reviewed</option>
              <option value="approved" {% if r.status=='approved' %}selected{% endif %}>Approved</option>
              <option value="pending">Pending</option>
            </select>
            <label>Review note (optional)</label>
            <input name="note" maxlength="1000" style="width:100%">
            <button type="submit">Save Review</button>
          </form>
        </div>
        {% endfor %}
      {% else %}
        <p>No events in this filter.</p>
      {% endif %}
      <small>Showing at most 500 events, newest first.</small>
    </section>

    <section class="panel">
      <h2>Review History</h2>
      {% if review_rows %}
        {% for h in review_rows %}
          <p>#{{h.audit_id}} · {{h.old_status}} → {{h.new_status}}
          · {{h.reviewed_at}} · {{h.reviewed_by}}</p>
          {% if h.note %}<p>{{h.note}}</p>{% endif %}
        {% endfor %}
      {% else %}
        <p>No review actions yet.</p>
      {% endif %}
    </section>
    """, rows=rows, totals=totals, status_filter=status_filter,
         review_rows=review_rows)

    return render_template_string(BASE_HTML, content=content)


@app.post("/development-audit/<int:audit_id>/review")
def development_audit_review(audit_id):
    if not secrets.compare_digest(
        request.form.get("csrf", ""),
        session.get("csrf", "")
    ):
        abort(400, "Invalid form token")

    new_status = request.form.get("status", "").strip()
    if new_status not in ("pending", "reviewed", "approved"):
        abort(400, "Invalid review status")

    note = request.form.get("note", "").strip()[:1000]
    stamp = datetime.now().astimezone().isoformat(timespec="seconds")

    with connect() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS development_change_reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                audit_id INTEGER NOT NULL,
                old_status TEXT NOT NULL,
                new_status TEXT NOT NULL,
                note TEXT,
                reviewed_by TEXT NOT NULL,
                reviewed_at TEXT NOT NULL
            )
        """)

        event = db.execute(
            "SELECT id,status FROM development_change_audit WHERE id=?",
            (audit_id,)
        ).fetchone()

        if event is None:
            abort(404)

        old_status = event["status"]
        db.execute("""
            UPDATE development_change_audit
            SET status=?
            WHERE id=?
        """, (new_status, audit_id))

        db.execute("""
            INSERT INTO development_change_reviews
            (audit_id,old_status,new_status,note,reviewed_by,reviewed_at)
            VALUES(?,?,?,?,?,?)
        """, (
            audit_id, old_status, new_status, note,
            "authenticated_dashboard_admin", stamp
        ))
        db.commit()

    flash("Development Audit review saved.")
    return redirect(url_for("development_audit_dashboard"))
'''

src = src.replace(marker, routes + "\n" + marker, 1)

# Add a small navigation link without replacing existing dashboard content.
needle = "<main>"
if needle in src and "Development Audit</a>" not in src:
    src = src.replace(
        needle,
        needle + "\n<p><a href='/development-audit'>Development Audit</a></p>",
        1
    )

p.write_text(src, encoding="utf-8")
print("Backup:", backup)
print("Development Audit routes added.")
