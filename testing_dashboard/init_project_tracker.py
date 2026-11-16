import sqlite3
import os
from pathlib import Path
from datetime import datetime, timezone

BASE = Path(__file__).resolve().parent
DB = BASE / "data" / "bug_reports.sqlite3"
BACKUP_DIR = BASE / "data" / "backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

if not DB.exists():
    raise SystemExit(f"Database not found: {DB}")

now = datetime.now(timezone.utc).isoformat()

# Safe SQLite backup before migration
backup = BACKUP_DIR / f"bug_reports_before_tracker_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.sqlite3"
src = sqlite3.connect(DB)
dst = sqlite3.connect(backup)
src.backup(dst)
dst.close()
src.close()
os.chmod(backup, 0o600)
print("Backup created:", backup)

modules = [
("security_login", "Security & Login", [
    ("two_factor_auth", "Two-factor authentication", "Add a second verification factor for account login."),
    ("active_sessions", "Active sessions and devices", "View and manage active account sessions."),
    ("logout_all_devices", "Logout from all devices", "Securely revoke other active sessions."),
    ("login_alerts", "New login alerts", "Notify account owner about new or suspicious logins."),
    ("account_recovery", "Account recovery", "Secure password and account recovery flow."),
]),
("privacy_safety", "Privacy & Safety", [
    ("post_visibility", "Post visibility controls", "Control who can view posts."),
    ("follow_permissions", "Follow permissions", "Control follow requests and private account access."),
    ("message_permissions", "Message permissions", "Control who can send messages."),
    ("comment_permissions", "Comment permissions", "Control who can comment."),
    ("mention_tag_permissions", "Mention and tag permissions", "Control mentions and tags."),
    ("activity_visibility", "Activity and online visibility", "Control activity status visibility."),
    ("profile_discovery", "Profile discoverability", "Control profile discovery options."),
]),
("notifications", "Notifications", [
    ("push_email_preferences", "Push and email preferences", "Configure notification delivery channels."),
    ("notification_categories", "Notification categories", "Configure likes, comments, follows, requests, stories and system alerts."),
    ("notification_sound", "Notification sound", "Configure notification tone."),
    ("quiet_hours", "Quiet hours", "Schedule notification quiet hours."),
]),
("messages_stories", "Messages & Stories", [
    ("message_requests", "Message requests", "Configure message request handling."),
    ("read_receipts", "Read receipts", "Control read receipt visibility."),
    ("typing_status", "Typing status", "Control typing indicators."),
    ("story_replies", "Story replies", "Configure story reply permissions."),
    ("story_sharing", "Story sharing", "Configure story sharing permissions."),
    ("story_hide_list", "Hide story from list", "Manage users who cannot view stories."),
]),
("account_management", "Account Management", [
    ("email_phone_username", "Email, phone and username", "Manage account contact details and username."),
    ("deactivate_account", "Deactivate account", "Provide secure temporary account deactivation."),
    ("delete_account", "Delete account", "Provide secure account deletion and retention workflow."),
    ("download_data", "Download account data", "Allow users to request an export of their data."),
    ("account_verification", "Account verification", "Manage account verification workflow."),
]),
("appearance_language", "Appearance & Accessibility", [
    ("theme_settings", "Theme settings", "Support light, dark and system themes."),
    ("font_size", "Font size", "Provide readable font size controls."),
    ("contrast_accessibility", "Contrast and accessibility", "Improve contrast and accessibility support."),
    ("reduce_motion", "Reduce motion", "Respect reduced-motion preferences."),
    ("screen_reader", "Screen reader support", "Add accessible labels and navigation."),
    ("language_settings", "Language settings", "Support selectable application languages."),
]),
("media_data", "Media & Data", [
    ("data_saver", "Data saver", "Reduce network usage where possible."),
    ("autoplay_controls", "Autoplay controls", "Configure video and reel autoplay."),
    ("upload_quality", "Upload quality", "Configure media upload quality."),
    ("download_quality", "Download quality", "Configure media download quality."),
    ("save_originals", "Save originals", "Configure saving original media."),
    ("data_usage", "Data usage", "Show relevant data usage information."),
]),
("content_preferences", "Content Preferences", [
    ("saved_content", "Saved posts and reels", "Manage saved content."),
    ("sensitive_content", "Sensitive content controls", "Configure sensitive content preferences."),
    ("content_suggestions", "Content suggestions", "Manage suggested content preferences."),
    ("feed_preferences", "Feed preferences", "Provide feed personalization controls."),
    ("interested_controls", "Interested and not interested", "Allow users to tune recommendations."),
]),
("permissions_apps", "Permissions & Connected Apps", [
    ("device_permissions", "Camera, microphone and gallery permissions", "Explain and manage required device permissions."),
    ("contacts_location", "Contacts and location permissions", "Use optional permissions only with clear consent."),
    ("connected_apps", "Connected applications", "Review and revoke connected applications."),
    ("trusted_devices", "Trusted devices", "Review trusted devices where supported."),
]),
("help_support", "Help & Support", [
    ("help_center", "Help center and FAQs", "Provide help articles and frequently asked questions."),
    ("contact_support", "Contact support", "Provide a support contact workflow."),
    ("report_problem", "Report a problem", "Allow users to submit bug reports."),
    ("privacy_policy", "Privacy policy", "Publish accessible privacy policy."),
    ("terms", "Terms and conditions", "Publish terms and conditions."),
]),
("about_updates", "About Bhumi Social AI", [
    ("app_version", "App version", "Display installed application version."),
    ("check_updates", "Check for updates", "Check and present available app updates."),
    ("release_history", "Release history", "Display release notes and version history."),
    ("share_app", "Share application", "Share official application information."),
    ("licenses", "Open-source licenses", "Display third-party license notices."),
]),
("integration_quality", "Integration & Quality Assurance", [
    ("backend_integration", "Backend integration", "Verify API integration and persistence."),
    ("database_integrity", "Database integrity", "Verify schema, migrations and data consistency."),
    ("security_review", "Security review", "Review authorization, validation and abuse protection."),
    ("regression_testing", "Regression testing", "Verify existing application behavior after changes."),
    ("release_validation", "Release validation", "Validate readiness before production release."),
]),
]

con = sqlite3.connect(DB, timeout=30)
con.row_factory = sqlite3.Row
con.execute("PRAGMA foreign_keys=ON")
con.execute("PRAGMA busy_timeout=30000")

try:
    con.executescript("""
    CREATE TABLE IF NOT EXISTS project_modules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        module_key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'audit_required'
          CHECK(status IN ('audit_required','planned','in_progress','blocked','implemented','tested','verified','deferred')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_tasks (
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
        FOREIGN KEY(module_id) REFERENCES project_modules(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_task_events (
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
        FOREIGN KEY(task_id) REFERENCES project_tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_project_tasks_module
      ON project_tasks(module_id);
    CREATE INDEX IF NOT EXISTS idx_project_tasks_status
      ON project_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_project_events_task
      ON project_task_events(task_id);
    CREATE INDEX IF NOT EXISTS idx_project_events_created
      ON project_task_events(created_at);

    CREATE VIEW IF NOT EXISTS project_progress_summary AS
    SELECT
      m.id AS module_id,
      m.module_key,
      m.name AS module_name,
      COUNT(t.id) AS total_tasks,
      SUM(CASE WHEN t.status='verified' THEN 1 ELSE 0 END) AS verified_tasks,
      SUM(CASE WHEN t.status='tested' THEN 1 ELSE 0 END) AS tested_tasks,
      SUM(CASE WHEN t.status='implemented' THEN 1 ELSE 0 END) AS implemented_tasks,
      SUM(CASE WHEN t.status='in_progress' THEN 1 ELSE 0 END) AS in_progress_tasks,
      SUM(CASE WHEN t.status='blocked' THEN 1 ELSE 0 END) AS blocked_tasks,
      SUM(CASE WHEN t.status='audit_required' THEN 1 ELSE 0 END) AS audit_required_tasks,
      COALESCE(ROUND(AVG(t.progress_percent), 1), 0) AS average_progress
    FROM project_modules m
    LEFT JOIN project_tasks t ON t.module_id=m.id
    GROUP BY m.id, m.module_key, m.name;
    """)

    for module_key, module_name, tasks in modules:
        con.execute("""
          INSERT OR IGNORE INTO project_modules
          (module_key,name,description,status,created_at,updated_at)
          VALUES (?,?,?,'audit_required',?,?)
        """, (module_key, module_name, f"Settings roadmap category: {module_name}", now, now))

        module_id = con.execute(
            "SELECT id FROM project_modules WHERE module_key=?",
            (module_key,)
        ).fetchone()["id"]

        for task_key, task_name, description in tasks:
            full_key = module_key + "." + task_key
            cur = con.execute("""
              INSERT OR IGNORE INTO project_tasks
              (module_id,task_key,name,description,status,progress_percent,priority,created_at,updated_at)
              VALUES (?,?,?,?,'audit_required',0,'medium',?,?)
            """, (module_id, full_key, task_name, description, now, now))

            if cur.rowcount:
                task_id = cur.lastrowid
                con.execute("""
                  INSERT INTO project_task_events
                  (task_id,event_type,new_status,new_progress,note,created_at)
                  VALUES (?,'created','audit_required',0,?,?)
                """, (task_id, "Roadmap task registered; existing implementation requires audit.", now))

    con.commit()

    print("\nPROJECT TRACKER DATABASE READY")
    print("Database:", DB)
    print("Backup:", backup)
    print("Modules:", con.execute("SELECT COUNT(*) FROM project_modules").fetchone()[0])
    print("Tasks:", con.execute("SELECT COUNT(*) FROM project_tasks").fetchone()[0])
    print("Task history records:", con.execute("SELECT COUNT(*) FROM project_task_events").fetchone()[0])
    print("\nMODULE PROGRESS:")
    for row in con.execute("SELECT module_name,total_tasks,audit_required_tasks,average_progress FROM project_progress_summary ORDER BY module_id"):
        print(f"- {row['module_name']}: {row['total_tasks']} tasks | audit required: {row['audit_required_tasks']} | progress: {row['average_progress']}%")
    print("\nExisting bug/testing tables were preserved.")
finally:
    con.close()

os.chmod(DB, 0o600)
