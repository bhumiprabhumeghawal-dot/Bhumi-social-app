from pathlib import Path
from datetime import datetime
import shutil

p = Path("testing_dashboard/app.py")
source = p.read_text()

marker = "# === PREMIUM TRACKER ROUTES ==="
if marker in source:
    raise SystemExit("Premium routes already exist. No changes made.")

anchor = "@app.errorhandler(404)"
if anchor not in source:
    raise SystemExit("Safe insertion point not found.")

backup = p.with_name("app.py.before_premium_routes_" + datetime.now().strftime("%Y%m%d_%H%M%S"))
shutil.copy2(p, backup)

routes = r'''
# === PREMIUM TRACKER ROUTES ===

@app.get("/premium")
def premium_dashboard():
    with connect() as db:
        modules = db.execute("SELECT * FROM premium_progress_summary ORDER BY module_name").fetchall()
        totals = db.execute("""
            SELECT COUNT(*) AS total,
            SUM(CASE WHEN status='verified' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN status!='verified' THEN 1 ELSE 0 END) AS remaining,
            SUM(CASE WHEN status='blocked' THEN 1 ELSE 0 END) AS blocked
            FROM premium_tasks
        """).fetchone()

    content = render_template_string("""
    <section class="panel">
      <h2>Bhumi Social AI — Premium Progress</h2>
      <p>Settings tracker से अलग Premium tracker.</p>
      <div class="grid">
        <div><small>Expected</small><h2>{{expected}}</h2></div>
        <div><small>Registered</small><h2>{{totals.total or 0}}</h2></div>
        <div><small>Verified & Locked</small><h2>{{totals.completed or 0}}</h2></div>
        <div><small>Remaining</small><h2>{{totals.remaining or 0}}</h2></div>
        <div><small>Blocked</small><h2>{{totals.blocked or 0}}</h2></div>
      </div>
      <p><a href="{{url_for('premium_remaining')}}">Remaining Work</a> |
      <a href="{{url_for('premium_completed')}}">Completed & Locked</a> |
      <a href="{{url_for('index')}}">Main Dashboard</a></p>
    </section>
    <section class="panel"><h3>Premium Categories</h3>
    {% for m in modules %}
      <div style="padding:10px 0;border-bottom:1px solid #46536b">
        <strong>{{m.module_name}}</strong>
        <p>Expected: {{m.expected_feature_count}} |
        Registered: {{m.registered_tasks}} |
        Verified: {{m.verified_tasks}} |
        Progress: {{m.average_progress}}%</p>
      </div>
    {% endfor %}
    </section>
    """, modules=modules, totals=totals,
       expected=sum(m["expected_feature_count"] for m in modules))
    return render_template_string(BASE_HTML, content=content)


@app.get("/premium/remaining")
def premium_remaining():
    with connect() as db:
        tasks = db.execute("""
            SELECT t.*, m.name AS module_name
            FROM premium_tasks t
            JOIN premium_modules m ON m.id=t.module_id
            WHERE t.status != 'verified'
            ORDER BY m.name, t.priority, t.id
        """).fetchall()

    content = render_template_string("""
    <section class="panel"><h2>Premium — Remaining Work</h2>
    <p><a href="{{url_for('premium_dashboard')}}">Overview</a> |
    <a href="{{url_for('premium_completed')}}">Completed & Locked</a></p>
    {% if tasks %}
      {% for t in tasks %}
        <div style="padding:12px 0;border-bottom:1px solid #46536b">
          <strong>{{t.name}}</strong>
          <p>{{t.module_name}} | {{t.status}} | {{t.progress_percent}}% | {{t.priority}}</p>
          <p>{{t.description or ''}}</p>
          <small>Task ID: {{t.id}} | {{t.task_key}}</small>
        </div>
      {% endfor %}
    {% else %}<p>No individual remaining tasks registered yet.</p>{% endif %}
    </section>
    """, tasks=tasks)
    return render_template_string(BASE_HTML, content=content)


@app.get("/premium/completed")
def premium_completed():
    with connect() as db:
        tasks = db.execute("""
            SELECT t.*, m.name AS module_name, l.locked_at,
                   l.verified_by, l.evidence_snapshot
            FROM premium_tasks t
            JOIN premium_modules m ON m.id=t.module_id
            JOIN premium_task_locks l ON l.task_id=t.id
            WHERE t.status='verified'
            ORDER BY m.name, t.id
        """).fetchall()

    content = render_template_string("""
    <section class="panel"><h2>Premium — Completed & Locked</h2>
    <p><a href="{{url_for('premium_dashboard')}}">Overview</a> |
    <a href="{{url_for('premium_remaining')}}">Remaining Work</a></p>
    {% if tasks %}
      {% for t in tasks %}
        <div style="padding:14px 0;border-bottom:1px solid #46536b">
          <strong>{{t.name}}</strong>
          <p>{{t.module_name}} | Verified & Locked | 100%</p>
          <p>Locked at: {{t.locked_at}}</p>
          <p>Evidence: {{t.evidence_snapshot}}</p>
          <form method="post" action="{{url_for('premium_unlock', task_id=t.id)}}">
            <input type="hidden" name="csrf" value="{{csrf_token()}}">
            <label>Reopen reason (required)</label>
            <textarea name="reason" required minlength="10" maxlength="2000" rows="2" style="width:100%"></textarea>
            <button type="submit">Admin Reopen</button>
          </form>
        </div>
      {% endfor %}
    {% else %}<p>अभी कोई individual feature Verified & Locked नहीं है।</p>{% endif %}
    </section>
    """, tasks=tasks)
    return render_template_string(BASE_HTML, content=content)


@app.post("/premium/tasks/<int:task_id>/unlock")
def premium_unlock(task_id):
    if not secrets.compare_digest(request.form.get("csrf", ""), session.get("csrf", "")):
        abort(400, "Invalid form token")

    reason = request.form.get("reason", "").strip()
    if len(reason) < 10:
        abort(400, "Reopen reason must contain at least 10 characters.")
    reason = reason[:2000]

    with connect() as db:
        task = db.execute("""
            SELECT t.* FROM premium_tasks t
            JOIN premium_task_locks l ON l.task_id=t.id
            WHERE t.id=? AND t.status='verified'
        """, (task_id,)).fetchone()
        if not task:
            abort(409, "Task is not currently verified and locked.")

        db.execute("""
            INSERT INTO premium_task_unlocks
            (task_id,approved_by,reason,approved_at)
            VALUES (?,?,?,datetime('now'))
        """, (task_id, "authenticated_dashboard_admin", reason))

        db.execute("""
            UPDATE premium_tasks
            SET status='audit_required', progress_percent=0,
                completed_at=NULL, updated_at=datetime('now')
            WHERE id=?
        """, (task_id,))

        db.execute("""
            INSERT INTO premium_task_events
            (task_id,event_type,old_status,new_status,old_progress,
             new_progress,note,evidence,created_at)
            VALUES (?,?,?,?,?,?,?,?,datetime('now'))
        """, (task_id, "admin_reopened", "verified", "audit_required",
              task["progress_percent"], 0, reason, task["evidence"]))
        db.commit()

    flash("Premium feature reopened. Audit history retained.")
    return redirect(url_for("premium_remaining"))


'''

p.write_text(source.replace(anchor, routes + "\n" + anchor, 1))
print("Premium dashboard routes added.")
print("Backup:", backup)
print("Routes: /premium, /premium/remaining, /premium/completed")
print("Admin reopen: POST /premium/tasks/<id>/unlock")
