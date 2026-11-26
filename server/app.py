import os
import json
import urllib.request
import urllib.error
import sqlite3
import uuid
import threading
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from dotenv import load_dotenv

from flask import Flask, jsonify, redirect, request, send_from_directory
from werkzeug.utils import secure_filename

from server.media_storage import delete_remote_media, is_remote_media_filename, presigned_media_url, upload_media_file

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / '.env')
load_dotenv(BASE_DIR.parent / '.env')
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"
DB_PATH = DATA_DIR / "socialapp.db"

UPLOAD_LIMITS = {
    "posts": 50 * 1024 * 1024,
    "stories": 25 * 1024 * 1024,
    "reels": 50 * 1024 * 1024,
}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    "posts": {"jpg", "jpeg", "png", "webp", "gif", "mp4", "mov", "webm"},
    "stories": {"jpg", "jpeg", "png", "webp", "mp4", "mov", "webm"},
    "reels": {"mp4", "mov", "webm"},
}

app = Flask(__name__)
# Chat video attachments are allowed up to 100 MB; leave multipart overhead too.
# Permit large DM uploads; per-media limits are enforced by each upload endpoint.
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024 * 1024 + 10 * 1024 * 1024


def get_db():
    from server.db_compat import connect_database
    return connect_database(DB_PATH)


def init_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    for kind in ALLOWED_EXTENSIONS:
        (UPLOAD_DIR / kind).mkdir(parents=True, exist_ok=True)

    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS content (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kind TEXT NOT NULL,
                username TEXT NOT NULL DEFAULT 'you',
                caption TEXT NOT NULL DEFAULT '',
                media_url TEXT NOT NULL,
                media_type TEXT NOT NULL,
                group_id TEXT,
                created_at TEXT NOT NULL,
                expires_at TEXT
            )
        """)
        columns = {row["name"] for row in db.execute("PRAGMA table_info(content)").fetchall()}
        if "group_id" not in columns:
            db.execute("ALTER TABLE content ADD COLUMN group_id TEXT")
        if "audio_url" not in columns:
            db.execute("ALTER TABLE content ADD COLUMN audio_url TEXT")

        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_content_group_id
            ON content(group_id)
        """)

        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_content_kind_id
            ON content(kind, id DESC)
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_content_kind_username
            ON content(kind, username)
        """)

        db.execute("""
            CREATE TABLE IF NOT EXISTS post_likes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(content_id, username)
            )
        """)

        db.execute("""
            CREATE TABLE IF NOT EXISTS post_reposts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(content_id, username)
            )
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_post_reposts_content
            ON post_reposts(content_id)
        """)

        db.execute("""
            CREATE TABLE IF NOT EXISTS post_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                text TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)

        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_post_comments_content
            ON post_comments(content_id, id DESC)
        """)



        db.execute("""
            CREATE TABLE IF NOT EXISTS reel_likes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(content_id, username)
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS reel_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                text TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        for table in ("post_comments", "reel_comments"):
            for column_sql in ("ADD COLUMN approved INTEGER NOT NULL DEFAULT 1", "ADD COLUMN parent_comment_id INTEGER"):
                try:
                    db.execute(f"ALTER TABLE {table} {column_sql}")
                except Exception:
                    pass

        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_reel_comments_content
            ON reel_comments(content_id, id DESC)
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS saved_content (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                content_id INTEGER NOT NULL,
                kind TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(username, content_id, kind)
            )
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_saved_content_user
            ON saved_content(username, created_at DESC)
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS content_views (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content_id INTEGER NOT NULL,
                content_kind TEXT NOT NULL,
                viewer_username TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(content_id, content_kind, viewer_username)
            )
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_content_views_owner_lookup
            ON content_views(content_kind, content_id, created_at DESC)
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS story_likes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(content_id, username)
            )
        """)

def can_view_content(db, owner, viewer=None):
    """Allow owners, approved followers of private accounts, and non-blocked viewers."""
    owner = str(owner or "").strip()
    viewer = str(viewer or "").strip()

    if not owner:
        return False
    if viewer and owner.casefold() == viewer.casefold():
        return True

    if viewer:
        blocked = db.execute("""
            SELECT 1 FROM people_blocks
            WHERE (LOWER(blocker)=LOWER(?) AND LOWER(blocked)=LOWER(?))
               OR (LOWER(blocker)=LOWER(?) AND LOWER(blocked)=LOWER(?))
            LIMIT 1
        """, (owner, viewer, viewer, owner)).fetchone()
        if blocked:
            return False

    settings = db.execute(
        "SELECT is_private FROM user_settings WHERE LOWER(username)=LOWER(?)",
        (owner,)
    ).fetchone()

    if not settings or not bool(settings["is_private"]):
        return True
    if not viewer:
        return False

    return bool(db.execute("""
        SELECT 1 FROM follows
        WHERE LOWER(follower)=LOWER(?) AND LOWER(following)=LOWER(?)
        LIMIT 1
    """, (viewer, owner)).fetchone())


def content_json(row, viewer=None, db=None):
    if db is None:
        with get_db() as connection:
            return content_json(row, viewer, connection)

    profile = db.execute(
        "SELECT avatar_url FROM profiles WHERE LOWER(username)=LOWER(?) ORDER BY username LIMIT 1",
        (row["username"],)
    ).fetchone()
    avatar_url = profile["avatar_url"] if profile else None
    extra = {}
    if row["kind"] in ("posts", "reels"):
        comment_table = "reel_comments" if row["kind"] == "reels" else "post_comments"
        if row["kind"] == "posts":
            likes = db.execute(
                "SELECT COUNT(*) AS total FROM post_likes WHERE content_id=?",
                (row["id"],)
            ).fetchone()
            extra["likesCount"] = int(likes["total"] or 0)
            reposts = db.execute("SELECT COUNT(*) AS total FROM post_reposts WHERE content_id=?", (row["id"],)).fetchone()
            extra["repostsCount"] = int(reposts["total"] or 0)
            extra["isReposted"] = bool(db.execute("SELECT 1 FROM post_reposts WHERE content_id=? AND LOWER(username)=LOWER(?)", (row["id"], viewer or "")).fetchone()) if viewer else False
            extra["isLiked"] = bool(db.execute(
                "SELECT 1 FROM post_likes WHERE content_id=? AND LOWER(username)=LOWER(?)",
                (row["id"], viewer or "")
            ).fetchone()) if viewer else False
        comments = db.execute(
            f"SELECT COUNT(*) AS total FROM {comment_table} WHERE content_id=? AND approved=1",
            (row["id"],)
        ).fetchone()
        saves = db.execute(
            "SELECT COUNT(*) AS total FROM saved_content WHERE content_id=? AND kind=?",
            (row["id"], row["kind"])
        ).fetchone()
        extra["commentsCount"] = int(comments["total"] or 0)
        extra["savesCount"] = int(saves["total"] or 0)

    if row["kind"] == "reels":
        likes = db.execute(
            "SELECT COUNT(*) AS total FROM reel_likes WHERE content_id=?",
            (row["id"],)
        ).fetchone()
        extra["likesCount"] = int(likes["total"] or 0)
        extra["isLiked"] = False
        extra["isSaved"] = False
        extra["isFollowing"] = False
        extra["followRequestStatus"] = None
        extra["isPrivate"] = False

        if viewer:
            extra["isLiked"] = bool(db.execute(
                "SELECT 1 FROM reel_likes WHERE content_id=? AND username=?",
                (row["id"], viewer)
            ).fetchone())
            extra["isSaved"] = bool(db.execute(
                "SELECT 1 FROM saved_content WHERE username=? AND content_id=? AND kind='reels'",
                (viewer, row["id"])
            ).fetchone())
            extra["isFollowing"] = bool(db.execute(
                "SELECT 1 FROM follows WHERE follower=? AND following=?",
                (viewer, row["username"])
            ).fetchone())
            request_row = db.execute(
                "SELECT status FROM follow_requests WHERE requester=? AND target=?",
                (viewer, row["username"])
            ).fetchone()
            extra["followRequestStatus"] = request_row["status"] if request_row else None
            settings = db.execute(
                "SELECT is_private FROM user_settings WHERE username=?",
                (row["username"],)
            ).fetchone()
            extra["isPrivate"] = bool(settings["is_private"]) if settings else False

    return {
        "id": row["id"],
        "avatarUrl": avatar_url,
        "type": row["kind"],
        "user": row["username"],
        "caption": row["caption"],
        "mediaUrl": row["media_url"],
        "mediaType": row["media_type"],
        "audioUrl": row["audio_url"] if "audio_url" in row.keys() else None,
        "groupId": row["group_id"],
        "createdAt": row["created_at"],
        "expiresAt": row["expires_at"],
        **extra,
    }


@app.after_request
def add_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
    return response


@app.route("/api/<path:unused>", methods=["OPTIONS"])
def options_handler(unused):
    return "", 204



@app.get("/api/app-version")
def app_version():
    apk_url = "https://github.com/bhumiprabhumeghawal-dot/Bhumi-social-app/releases/latest/download/SocialApp.apk"
    latest_version = os.environ.get("SOCIALAPP_LATEST_VERSION", "1.0.8").strip() or "1.0.8"
    return jsonify({
        "version": latest_version,
        "download_url": request.host_url.rstrip("/") + "/download",
        "apk_url": apk_url,
        "force_update": os.environ.get("SOCIALAPP_FORCE_UPDATE", "false").lower() == "true",
        "message": f"Bhumi Social AI version {latest_version} is available. Download and install the latest update."
    })


@app.get("/download")
def download_page():
    apk_url = "https://github.com/bhumiprabhumeghawal-dot/Bhumi-social-app/releases/latest/download/SocialApp.apk"
    html = (
        '<!doctype html><html lang="en"><head>'
        '<meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        '<title>Download SocialApp</title>'
        '<style>body{font-family:Arial,sans-serif;max-width:520px;margin:60px auto;padding:24px;text-align:center;color:#222}'
        'a{display:inline-block;background:#1685D9;color:white;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:bold}'
        'p{line-height:1.6;color:#555}</style></head><body>'
        '<h1>SocialApp</h1>'
        '<p>Download the latest version of SocialApp for Android.</p>'
        '<a href="' + apk_url + '">Download SocialApp APK</a>'
        '<p>Only install APK files from a source you trust.</p>'
        '</body></html>'
    )
    return html


@app.get("/api/health")
def health():
    from server.db_compat import postgres_enabled

    db = None
    try:
        db = get_db()
        db.execute("SELECT 1").fetchone()
        return jsonify({
            "ok": True,
            "service": "SocialApp Server",
            "database": "postgresql" if postgres_enabled() else "sqlite",
            "time": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        app.logger.exception("Health database check failed")
        return jsonify({
            "ok": False,
            "service": "SocialApp Server",
            "database": "error",
            "time": datetime.now(timezone.utc).isoformat(),
        }), 503
    finally:
        if db is not None:
            db.close()


@app.get("/api/<kind>")
def list_content(kind):
    if kind not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "Unknown content type"}), 404

    now = datetime.now(timezone.utc).isoformat()

    with get_db() as db:
        if kind == "stories":
            db.execute(
                "DELETE FROM content WHERE kind='stories' AND expires_at <= ?",
                (now,),
            )

        rows = db.execute(
            "SELECT * FROM content WHERE kind=? ORDER BY id DESC LIMIT 100",
            (kind,),
        ).fetchall()
        viewer = getattr(g, "auth_username", None)
        favorite_accounts = set()
        muted_accounts = set()
        if viewer:
            for entry in db.execute(
                "SELECT target_username, list_type FROM feed_user_lists WHERE LOWER(owner_username)=LOWER(?)",
                (viewer,),
            ).fetchall():
                target_key = str(entry["target_username"]).casefold()
                if entry["list_type"] == "favorite":
                    favorite_accounts.add(target_key)
                elif entry["list_type"] == "muted":
                    muted_accounts.add(target_key)

        visible_rows = []
        for row in rows:
            owner = row["username"]
            if viewer and owner.casefold() in muted_accounts and owner.casefold() != viewer.casefold():
                continue
            if not can_view_content(db, owner, viewer):
                continue
            if kind == "stories" and viewer and owner.casefold() != viewer.casefold():
                audience = _chat_preferences(db, owner).get("story.audience", "followers")
                follows_owner = bool(db.execute("""
                    SELECT 1 FROM follows
                    WHERE LOWER(follower)=LOWER(?) AND LOWER(following)=LOWER(?)
                    LIMIT 1
                """, (viewer, owner)).fetchone())
                owner_follows_viewer = bool(db.execute("""
                    SELECT 1 FROM follows
                    WHERE LOWER(follower)=LOWER(?) AND LOWER(following)=LOWER(?)
                    LIMIT 1
                """, (owner, viewer)).fetchone())
                if audience == "followers" and not follows_owner:
                    continue
                if audience == "close_friends" and not (follows_owner and owner_follows_viewer):
                    continue
            elif kind == "stories" and not viewer:
                continue
            visible_rows.append(row)

        rows = visible_rows
        if viewer and kind in ("posts", "reels") and favorite_accounts:
            rows.sort(key=lambda row: (
                0 if str(row["username"]).casefold() in favorite_accounts else 1,
                -int(row["id"]),
            ))

        items = [content_json(row, viewer, db) for row in rows]

    return jsonify({"items": items})


@app.post("/api/content/<kind>/<int:content_id>/view")
def record_content_view(kind, content_id):
    viewer = getattr(g, "auth_username", None)
    if not viewer:
        return jsonify({"error": "Please log in first."}), 401
    if kind not in ("posts", "reels", "stories"):
        return jsonify({"error": "Unsupported content type."}), 400
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        item = db.execute(
            "SELECT id, username FROM content WHERE id=? AND kind=?",
            (content_id, kind),
        ).fetchone()
        if item is None or not can_view_content(db, item["username"], viewer):
            return jsonify({"error": "Content not found."}), 404
        if item["username"].casefold() != viewer.casefold():
            db.execute("""
                INSERT INTO content_views (content_id, content_kind, viewer_username, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(content_id, content_kind, viewer_username)
                DO UPDATE SET created_at=excluded.created_at
            """, (content_id, kind, viewer, now))
        total = db.execute(
            "SELECT COUNT(*) AS total FROM content_views WHERE content_id=? AND content_kind=?",
            (content_id, kind),
        ).fetchone()["total"]
    return jsonify({"ok": True, "views": total})


@app.get("/api/content/<kind>/<int:content_id>/viewers")
def list_content_viewers(kind, content_id):
    owner = getattr(g, "auth_username", None)
    if not owner:
        return jsonify({"error": "Please log in first."}), 401
    if kind not in ("posts", "reels", "stories"):
        return jsonify({"error": "Unsupported content type."}), 400
    with get_db() as db:
        item = db.execute(
            "SELECT id, username FROM content WHERE id=? AND kind=?",
            (content_id, kind),
        ).fetchone()
        if item is None or item["username"].casefold() != owner.casefold():
            return jsonify({"error": "Only the content owner can view its viewer list."}), 403
        rows = db.execute("""
            SELECT v.viewer_username AS username, v.created_at,
                   p.avatar_url, p.display_name
            FROM content_views v
            LEFT JOIN profiles p ON LOWER(p.username)=LOWER(v.viewer_username)
            WHERE v.content_id=? AND v.content_kind=?
            ORDER BY v.created_at DESC
        """, (content_id, kind)).fetchall()
    return jsonify({"ok": True, "views": len(rows), "viewers": [{
        "username": row["username"],
        "displayName": row["display_name"] if "display_name" in row.keys() else None,
        "avatarUrl": row["avatar_url"],
        "viewedAt": row["created_at"],
    } for row in rows]})


@app.get("/api/content/activity")
def list_my_content_activity():
    owner = getattr(g, "auth_username", None)
    if not owner:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        rows = db.execute("""
            SELECT v.viewer_username AS actor, v.created_at,
                   c.id AS content_id, c.kind AS content_kind,
                   p.avatar_url, p.display_name
            FROM content_views v
            JOIN content c ON c.id=v.content_id AND c.kind=v.content_kind
            LEFT JOIN profiles p ON LOWER(p.username)=LOWER(v.viewer_username)
            WHERE LOWER(c.username)=LOWER(?)
            ORDER BY v.created_at DESC
            LIMIT 100
        """, (owner,)).fetchall()
    return jsonify({"ok": True, "items": [{
        "id": "view-{}-{}-{}".format(row["content_kind"], row["content_id"], row["actor"]),
        "kind": "content_view", "actor": row["actor"],
        "referenceId": row["content_id"], "contentKind": row["content_kind"],
        "displayName": row["display_name"], "avatarUrl": row["avatar_url"],
        "createdAt": row["created_at"], "isRead": True,
    } for row in rows]})


@app.post("/api/stories/<int:content_id>/like")
def toggle_story_like(content_id):
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        story = db.execute(
            "SELECT id, username FROM content WHERE id=? AND kind='stories'",
            (content_id,),
        ).fetchone()
        if story is None or not can_view_content(db, story["username"], username):
            return jsonify({"error": "Story not found."}), 404
        existing = db.execute(
            "SELECT id FROM story_likes WHERE content_id=? AND LOWER(username)=LOWER(?)",
            (content_id, username),
        ).fetchone()
        if existing:
            db.execute("DELETE FROM story_likes WHERE content_id=? AND LOWER(username)=LOWER(?)", (content_id, username))
            liked = False
        else:
            db.execute(
                "INSERT INTO story_likes (content_id, username, created_at) VALUES (?, ?, ?)",
                (content_id, username, now),
            )
            liked = True
            _people_notification(db, story["username"], username, "story_like", content_id, now)
        count = db.execute(
            "SELECT COUNT(*) AS total FROM story_likes WHERE content_id=?",
            (content_id,),
        ).fetchone()["total"]
    return jsonify({"ok": True, "liked": liked, "likes": count})


@app.get("/api/stories/<int:content_id>/likes")
def list_story_likes(content_id):
    viewer = getattr(g, "auth_username", None)
    if not viewer:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        story = db.execute(
            "SELECT id, username FROM content WHERE id=? AND kind='stories'",
            (content_id,),
        ).fetchone()
        if story is None or not can_view_content(db, story["username"], viewer):
            return jsonify({"error": "Story not found."}), 404
        liked = bool(db.execute(
            "SELECT 1 FROM story_likes WHERE content_id=? AND LOWER(username)=LOWER(?)",
            (content_id, viewer),
        ).fetchone())
        count = db.execute(
            "SELECT COUNT(*) AS total FROM story_likes WHERE content_id=?",
            (content_id,),
        ).fetchone()["total"]
    return jsonify({"ok": True, "liked": liked, "likes": count})


@app.post("/api/<kind>")
def create_content(kind):
    if kind not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "Unknown content type"}), 404

    media = request.files.get("file")
    if media is None or not media.filename:
        return jsonify({"error": "Media file is required"}), 400

    original_name = secure_filename(media.filename)
    if "." not in original_name:
        return jsonify({"error": "File extension is missing"}), 400

    extension = original_name.rsplit(".", 1)[1].lower()
    if extension not in ALLOWED_EXTENSIONS[kind]:
        return jsonify({"error": "This file type is not allowed"}), 415

    caption = request.form.get("caption", "").strip()
    username = g.auth_username

    folder = UPLOAD_DIR / kind
    stored_name = f"{uuid.uuid4().hex}.{extension}"
    destination = folder / stored_name

    try:
        media.save(destination)

        uploaded_size = destination.stat().st_size
        size_limit = UPLOAD_LIMITS.get(kind, MAX_UPLOAD_BYTES)
        if uploaded_size > size_limit:
            destination.unlink(missing_ok=True)
            return jsonify({
                "error": f"File exceeds the {size_limit // (1024 * 1024)} MB limit for {kind}"
            }), 413

        if destination.stat().st_size == 0:
            destination.unlink(missing_ok=True)
            return jsonify({"error": "The uploaded file is empty"}), 400

        now = datetime.now(timezone.utc)
        created_at = now.isoformat()
        expires_at = (
            (now + timedelta(hours=24)).isoformat()
            if kind == "stories" else None
        )
        media_type = (
            "video" if extension in {"mp4", "mov", "webm"} else "image"
        )
        remote_media_url = upload_media_file(str(destination), kind, stored_name)
        if remote_media_url:
            destination.unlink(missing_ok=True)
        media_url = remote_media_url or f"/uploads/{kind}/{stored_name}"

        with get_db() as db:
            cursor = db.execute(
                """
                INSERT INTO content
                    (kind, username, caption, media_url, media_type,
                     audio_url, group_id, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    kind, username, caption, media_url, media_type,
                    (request.form.get("audio_url") or None),
                    (request.form.get("group_id") or request.headers.get("X-Post-Group-Id") or None),
                    created_at, expires_at,
                ),
            )
            row = db.execute(
                "SELECT * FROM content WHERE id=?",
                (cursor.lastrowid,),
            ).fetchone()

            # Notify mentioned users; only real accounts can be mentioned.
            mentioned = {
                value.casefold()
                for value in re.findall(r"(?<![A-Za-z0-9_.])@([A-Za-z0-9_.]{2,50})", caption)
            }
            for handle in mentioned:
                target = db.execute(
                    "SELECT username FROM users WHERE LOWER(username)=LOWER(?)",
                    (handle,),
                ).fetchone()
                if not target or target["username"].casefold() == username.casefold():
                    continue
                target_name = target["username"]
                blocked = db.execute(
                    """SELECT 1 FROM people_blocks
                       WHERE (blocker=? AND blocked=?) OR (blocker=? AND blocked=?)
                       LIMIT 1""",
                    (username, target_name, target_name, username),
                ).fetchone()
                if blocked or not can_view_content(db, username, target_name):
                    continue
                db.execute(
                    """INSERT INTO people_notifications
                       (id, recipient, actor, kind, reference_id, created_at, is_read)
                       VALUES (?, ?, ?, ?, ?, ?, 0)""",
                    (uuid.uuid4().hex, target_name, username, f"mention_{kind}",
                     str(row["id"]), created_at),
                )

        return jsonify({"ok": True, "item": content_json(row)}), 201

    except Exception:
        destination.unlink(missing_ok=True)
        app.logger.exception("Could not save uploaded media")
        return jsonify({"error": "Could not save media"}), 500



@app.delete("/api/<kind>/<int:content_id>")
def delete_content(kind, content_id):
    if kind not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "Unknown content type"}), 404

    actor = getattr(g, "auth_username", None)
    if not actor:
        return jsonify({"error": "Please log in first."}), 401

    with get_db() as db:
        row = db.execute(
            "SELECT id, username, media_url FROM content WHERE id=? AND kind=?",
            (content_id, kind),
        ).fetchone()
        if row is None:
            return jsonify({"error": "Content not found."}), 404
        if str(row["username"] or "").casefold() != str(actor).casefold():
            return jsonify({"error": "You can only delete your own content."}), 403

        # Remove dependent engagement records before deleting the content row.
        db.execute("DELETE FROM post_likes WHERE content_id=?", (content_id,))
        db.execute("DELETE FROM post_comments WHERE content_id=?", (content_id,))
        db.execute(
            "DELETE FROM saved_content WHERE content_id=? AND kind=?",
            (content_id, kind),
        )
        db.execute("DELETE FROM content WHERE id=? AND kind=?", (content_id, kind))

    media_url = str(row["media_url"] or "")
    prefix = f"/uploads/{kind}/"
    if media_url.startswith(prefix):
        filename = media_url[len(prefix):]
        if filename and "/" not in filename and "\\" not in filename:
            if is_remote_media_filename(filename):
                delete_remote_media(kind, filename)
            else:
                (UPLOAD_DIR / kind / filename).unlink(missing_ok=True)

    return jsonify({"ok": True, "id": content_id, "kind": kind})


@app.get("/uploads/<kind>/<filename>")
def uploaded_file(kind, filename):
    if kind not in ALLOWED_EXTENSIONS and kind not in {"profiles", "chat"}:
        return jsonify({"error": "Unknown media type"}), 404

    if kind in ALLOWED_EXTENSIONS:
        media_url = f"/uploads/{kind}/{filename}"
        viewer = getattr(g, "auth_username", None)
        with get_db() as db:
            row = db.execute(
                "SELECT username, expires_at FROM content WHERE kind=? AND media_url=?",
                (kind, media_url),
            ).fetchone()
            if row is None:
                return jsonify({"error": "Media not found"}), 404
            if kind == "stories" and row["expires_at"] and row["expires_at"] <= datetime.now(timezone.utc).isoformat():
                return jsonify({"error": "Media not found"}), 404
            if not can_view_content(db, row["username"], viewer):
                return jsonify({"error": "Media not found"}), 404

    elif kind == "profiles":
        media_url = f"/uploads/profiles/{filename}"
        viewer = getattr(g, "auth_username", None)
        with get_db() as db:
            row = db.execute(
                "SELECT username FROM profiles WHERE avatar_url=? LIMIT 1",
                (media_url,),
            ).fetchone()
            if row is None or not can_view_content(db, row["username"], viewer):
                return jsonify({"error": "Media not found"}), 404

    elif kind == "chat":
        viewer = _chat_current_user()
        if not viewer:
            return jsonify({"error": "Media not found"}), 404

        media_url = f"/uploads/chat/{filename}"
        with get_db() as db:
            row = db.execute("""
                SELECT 1
                FROM direct_messages
                WHERE (image_url=? OR attachment_url=?)
                  AND (
                    LOWER(sender_username)=LOWER(?)
                    OR LOWER(recipient_username)=LOWER(?)
                  )
                LIMIT 1
            """, (media_url, media_url, viewer, viewer)).fetchone()
            if row is None:
                return jsonify({"error": "Media not found"}), 404

    remote_url = presigned_media_url(kind, filename)
    if remote_url:
        return redirect(remote_url, code=302)
    return send_from_directory(UPLOAD_DIR / kind, filename)


@app.errorhandler(413)
def file_too_large(error):
    return jsonify({"error": "File exceeds the upload limit for this media type"}), 413


# PUBLIC_LEGAL_PAGES_V1
@app.get("/privacy")
def privacy_policy_page():
    html = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Privacy Policy · Bhumi Social AI</title><style>
    *{box-sizing:border-box}body{margin:0;background:#080b12;color:#edf2ff;font:16px/1.7 system-ui,Arial,sans-serif}main{max-width:850px;margin:36px auto;padding:24px}article{background:#111827;border:1px solid #273247;border-radius:20px;padding:clamp(20px,5vw,42px)}h1,h2{line-height:1.25}h1{font-size:32px}h2{margin-top:30px;font-size:20px;color:#9fc8ff}p,li{color:#c6d0e0}a{color:#9fc8ff}small{color:#9aa8bd}.nav{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:20px}.pill{display:inline-block;padding:7px 12px;border:1px solid #33435e;border-radius:20px;text-decoration:none}</style></head><body><main><nav class="nav"><a class="pill" href="/">Bhumi Social AI</a><a class="pill" href="/terms">Terms</a><a class="pill" href="/delete-account">Delete account</a></nav><article>
    <h1>Privacy Policy</h1><p><strong>Bhumi Social AI</strong> · Effective date: 21 November 2026</p>
    <p>This policy explains what information the service processes, why it is used, how it is shared with service providers, and how you can request deletion. Contact: <a href="mailto:bhumiprabhumeghawal@gmail.com">bhumiprabhumeghawal@gmail.com</a>.</p>
    <h2>Information we process</h2><ul>
    <li><strong>Account information:</strong> username, password hash (not your readable password), account creation time, and any email address or phone number you choose to add.</li>
    <li><strong>Profile and social activity:</strong> display name, bio, profile image, posts, stories, reels, likes, comments, follows, blocks, saved items and notification preferences.</li>
    <li><strong>Messages and calls:</strong> direct messages and attachments you send, plus call signalling information such as participants, call type, status and timestamps. Message contents are not used for advertising.</li>
    <li><strong>Technical and activity information:</strong> session identifiers stored as hashes, login/session expiry, presence/last-seen signals, and basic server/security logs needed to operate and protect the service.</li>
    <li><strong>Permissions and media:</strong> camera, microphone and selected media are accessed when you use features that need them. The app does not need access to your camera or microphone when you are not using those features.</li>
    </ul>
    <h2>Location</h2><p>Live location is off by default. If you choose to share it, Bhumi Social AI requests device location permission and sends your coordinates to the specific mutual follower you select. Sharing expires after the duration you choose (15 minutes, 1 hour, 4 hours, or 24 hours), and either participant can stop it. Recent share records are retained in the app for up to 30 days. Approximate Location rounds coordinates before sending. If you separately enable Background Location and grant the operating system's Always/background permission, the app may continue location updates while backgrounded and displays an ongoing system notification where required. You can stop sharing at any time; disabling permission in system settings also prevents further device location access.</p>
    <h2>Account security history</h2><p>Successful sign-ins are recorded with the sign-in time and device/browser label for up to 90 days to help you review account access. Active session records are used to show and revoke signed-in devices. Failed password attempts are not displayed in this history. If you enable fingerprint or face unlock, authentication is performed by your device operating system; Bhumi Social AI receives only the authentication result and does not receive or store your fingerprint or face data.</p>
    <h2>How information is used</h2><p>We use information to create and secure accounts, show profiles and social content, deliver messages and calls, provide notifications, prevent abuse, troubleshoot errors, and maintain service performance. We do not sell personal information.</p>
    <h2>Service providers and sharing</h2><p>Information is processed by infrastructure providers needed to run the service, which may include Render (application hosting), Neon (database hosting), LiveKit (real-time voice/video infrastructure), and configured S3-compatible media storage providers. These providers process information to provide their services. We do not publish private messages or account credentials to other users.</p>
    <h2>Retention and security</h2><p>Information is retained while needed to provide the service, meet security and legal obligations, resolve disputes, and process deletion requests. Passwords are stored as hashes, and session tokens are stored as hashes. We use access controls and encrypted connections where supported, but no internet service can guarantee absolute security.</p>
    <h2>Your choices and deletion</h2><p>You can update available account and privacy settings in the app. To request deletion of your account and associated personal information, visit <a href="/delete-account">Delete Account</a> or email <a href="mailto:bhumiprabhumeghawal@gmail.com?subject=Bhumi%20Social%20AI%20Account%20Deletion">bhumiprabhumeghawal@gmail.com</a> from your registered email, including your username. We may ask for reasonable verification. Some records may be retained where legally required or necessary for security, fraud prevention, or dispute resolution.</p>
    <h2>Children</h2><p>Bhumi Social AI is a general social networking service and is not designed for children under 13. If you believe a child has created an account, contact us so we can review the report.</p>
    <h2>Policy changes</h2><p>We may update this policy as features change. The effective date above will be revised when material changes are made.</p>
    <h2>Contact</h2><p>Privacy and support: <a href="mailto:bhumiprabhumeghawal@gmail.com">bhumiprabhumeghawal@gmail.com</a></p>
    </article></main></body></html>"""
    response = app.response_class(html, mimetype="text/html")
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return response


@app.get("/terms")
def terms_page():
    html = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Terms of Service · Bhumi Social AI</title><style>
    *{box-sizing:border-box}body{margin:0;background:#080b12;color:#edf2ff;font:16px/1.7 system-ui,Arial,sans-serif}main{max-width:850px;margin:36px auto;padding:24px}article{background:#111827;border:1px solid #273247;border-radius:20px;padding:clamp(20px,5vw,42px)}h1,h2{line-height:1.25}h1{font-size:32px}h2{margin-top:30px;font-size:20px;color:#9fc8ff}p,li{color:#c6d0e0}a{color:#9fc8ff}.nav{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:20px}.pill{display:inline-block;padding:7px 12px;border:1px solid #33435e;border-radius:20px;text-decoration:none}</style></head><body><main><nav class="nav"><a class="pill" href="/">Bhumi Social AI</a><a class="pill" href="/privacy">Privacy</a><a class="pill" href="/delete-account">Delete account</a></nav><article>
    <h1>Terms of Service</h1><p><strong>Bhumi Social AI</strong> · Effective date: 21 November 2026</p>
    <p>By creating an account or using Bhumi Social AI, you agree to these terms. If you do not agree, do not use the service.</p>
    <h2>Your account</h2><p>Provide accurate account information, keep your sign-in credentials private, and notify us if you suspect unauthorized access. You are responsible for activity performed through your account.</p>
    <h2>Your content and conduct</h2><p>You remain responsible for content you upload, publish or send. Do not post unlawful, abusive, threatening, harassing, deceptive, infringing, or otherwise harmful material. Do not impersonate others, access accounts without permission, interfere with the service, or misuse other users' information.</p>
    <h2>Safety and moderation</h2><p>We may restrict, remove or disable content or accounts where reasonably necessary to protect users, comply with law, investigate abuse, or maintain the service. You can report problems to <a href="mailto:bhumiprabhumeghawal@gmail.com">bhumiprabhumeghawal@gmail.com</a>.</p>
    <h2>Privacy</h2><p>Our <a href="/privacy">Privacy Policy</a> explains how information is processed and how to request account deletion.</p>
    <h2>Availability and third-party services</h2><p>Features may change, be unavailable, or depend on third-party infrastructure. We do not guarantee uninterrupted service, call quality, or permanent availability of user content. Third-party services may have their own terms and privacy practices.</p>
    <h2>Termination</h2><p>You may stop using the service and request account deletion at any time using the <a href="/delete-account">account deletion page</a>. We may suspend access for serious violations, security risks or legal requirements.</p>
    <h2>Disclaimers and liability</h2><p>The service is provided on an as-available basis to the extent permitted by applicable law. Nothing in these terms excludes rights or remedies that cannot legally be excluded. To the extent permitted by law, we are not responsible for indirect loss arising from interruptions, user-generated content, or third-party services.</p>
    <h2>Changes and contact</h2><p>We may revise these terms as the service evolves. Continued use after an update means you accept the revised terms to the extent permitted by law. Contact: <a href="mailto:bhumiprabhumeghawal@gmail.com">bhumiprabhumeghawal@gmail.com</a>.</p>
    </article></main></body></html>"""
    response = app.response_class(html, mimetype="text/html")
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return response


@app.get("/delete-account")
def delete_account_page():
    from urllib.parse import quote
    username = str(request.args.get("username", "")).strip().lstrip("@")[:50]
    subject = quote("Bhumi Social AI account deletion request")
    body = quote("Please delete my Bhumi Social AI account and associated personal information.\\nUsername: " + (username or "[enter your username]") + "\\nI understand that identity verification may be required.")
    mailto = "mailto:bhumiprabhumeghawal@gmail.com?subject=" + subject + "&body=" + body
    html = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Delete Account · Bhumi Social AI</title><style>
    *{box-sizing:border-box}body{margin:0;background:#080b12;color:#edf2ff;font:16px/1.7 system-ui,Arial,sans-serif}main{max-width:680px;margin:40px auto;padding:24px}.card{background:#111827;border:1px solid #273247;border-radius:20px;padding:clamp(22px,5vw,42px)}h1{line-height:1.2}p,li{color:#c6d0e0}a{color:#9fc8ff}.btn{display:inline-block;background:#1685d9;color:#fff;padding:13px 20px;border-radius:12px;text-decoration:none;font-weight:800;margin:12px 0}.nav{display:flex;gap:18px;flex-wrap:wrap;margin-bottom:20px}</style></head><body><main><nav class="nav"><a href="/">Bhumi Social AI</a><a href="/privacy">Privacy Policy</a><a href="/terms">Terms</a></nav><section class="card">
    <h1>Request account deletion</h1><p>Use the button below to email the Bhumi Social AI support team. Include the username of the account you want deleted. If you are signed in to the app, open Settings → Account Settings → Delete Account Request to reach this page.</p>
    <ol><li>Send the deletion request from the email address associated with your account, if one is registered.</li><li>Include your exact username (not your password).</li><li>We may contact you to verify account ownership before processing the request.</li><li>After verification, account information and associated content will be deleted or de-identified where applicable, except information we must retain for legal, security or dispute-resolution reasons.</li></ol>
    <p><strong>We will never ask you to send your password or one-time login code.</strong></p>
    <a class="btn" href="__MAILTO__">Email deletion request</a>
    <p>If the button does not open an email app, send your request directly to <a href="mailto:bhumiprabhumeghawal@gmail.com">bhumiprabhumeghawal@gmail.com</a>.</p>
    </section></main></body></html>"""
    html = html.replace("__MAILTO__", mailto)
    response = app.response_class(html, mimetype="text/html")
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return response


@app.get("/")
def index():
    response = send_from_directory(BASE_DIR / "webapp", "index.html")
    response.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    return response


@app.get("/manifest.webmanifest")
def web_manifest():
    return send_from_directory(
        BASE_DIR / "webapp", "manifest.webmanifest",
        mimetype="application/manifest+json"
    )


@app.get("/sw.js")
def web_service_worker():
    response = send_from_directory(
        BASE_DIR / "webapp", "sw.js",
        mimetype="application/javascript"
    )
    response.headers["Service-Worker-Allowed"] = "/"
    response.headers["Cache-Control"] = "no-cache"
    return response


@app.get("/webapp/<path:filename>")
def webapp_assets(filename):
    response = send_from_directory(BASE_DIR / "webapp", filename)
    response.headers["Cache-Control"] = "no-store, max-age=0, must-revalidate"
    return response


# SOCIALAPP_PROFILE_API_V1
def profile_api_routes_marker():
    pass


def init_profile_tables():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                username TEXT PRIMARY KEY,
                display_name TEXT NOT NULL DEFAULT '',
                bio TEXT NOT NULL DEFAULT '',
                avatar_url TEXT,
                name_changed_at TEXT,
                created_at TEXT NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS follows (
                follower TEXT NOT NULL,
                following TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (follower, following),
                CHECK (follower <> following)
            )
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_follows_following
            ON follows(following)
        """)



        db.execute("""
            CREATE TABLE IF NOT EXISTS user_settings (
                username TEXT PRIMARY KEY,
                is_private INTEGER NOT NULL DEFAULT 0,
                show_activity INTEGER NOT NULL DEFAULT 1,
                allow_messages INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL
            )
        """)
        settings_columns = {row["name"] for row in db.execute("PRAGMA table_info(user_settings)").fetchall()}
        if "account_type" not in settings_columns:
            db.execute("ALTER TABLE user_settings ADD COLUMN account_type TEXT NOT NULL DEFAULT 'personal'")

        db.execute("""
            CREATE TABLE IF NOT EXISTS business_profiles (
                username TEXT PRIMARY KEY,
                business_name TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '',
                phone TEXT NOT NULL DEFAULT '',
                whatsapp TEXT NOT NULL DEFAULT '',
                email TEXT NOT NULL DEFAULT '',
                website TEXT NOT NULL DEFAULT '',
                address TEXT NOT NULL DEFAULT '',
                area TEXT NOT NULL DEFAULT '',
                city TEXT NOT NULL DEFAULT '',
                state TEXT NOT NULL DEFAULT '',
                pincode TEXT NOT NULL DEFAULT '',
                service_areas TEXT NOT NULL DEFAULT '',
                service_radius_km INTEGER NOT NULL DEFAULT 0,
                opening_hours TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL
            )
        """)
        db.execute("CREATE INDEX IF NOT EXISTS idx_business_area ON business_profiles(city, area, category)")

        db.execute("""
            CREATE TABLE IF NOT EXISTS business_catalog (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                item_type TEXT NOT NULL DEFAULT 'product',
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                price TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            )
        """)
        db.execute("CREATE INDEX IF NOT EXISTS idx_business_catalog_owner ON business_catalog(username, id DESC)")
        db.execute("""
            CREATE TABLE IF NOT EXISTS business_quick_replies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                shortcut TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(username, shortcut)
            )
        """)




def profile_json(db, username):
    row = db.execute(
        "SELECT * FROM profiles WHERE LOWER(username)=LOWER(?) ORDER BY username LIMIT 1", (username,)
    ).fetchone()
    if row is None:
        now = datetime.now(timezone.utc).isoformat()
        db.execute(
            """INSERT OR IGNORE INTO profiles
               (username, display_name, bio, avatar_url, name_changed_at, created_at)
               VALUES (?, ?, '', NULL, NULL, ?)""",
            (username, username, now),
        )
        row = db.execute(
            "SELECT * FROM profiles WHERE LOWER(username)=LOWER(?) ORDER BY username LIMIT 1", (username,)
        ).fetchone()

    posts = db.execute(
        "SELECT COUNT(*) FROM content WHERE kind='posts' AND LOWER(username)=LOWER(?)",
        (username,),
    ).fetchone()[0]
    followers = db.execute(
        "SELECT COUNT(*) FROM follows WHERE LOWER(following)=LOWER(?)", (username,)
    ).fetchone()[0]
    following = db.execute(
        "SELECT COUNT(*) FROM follows WHERE LOWER(follower)=LOWER(?)", (username,)
    ).fetchone()[0]
    account = db.execute(
        "SELECT account_type FROM user_settings WHERE LOWER(username)=LOWER(?)",
        (username,),
    ).fetchone()
    business_row = db.execute(
        "SELECT * FROM business_profiles WHERE LOWER(username)=LOWER(?)",
        (username,),
    ).fetchone()
    business_profile = None
    business_catalog = db.execute(
        "SELECT id, item_type, title, description, price, category FROM business_catalog WHERE LOWER(username)=LOWER(?) ORDER BY id DESC LIMIT 50",
        (username,),
    ).fetchall()
    if business_row:
        business_profile = {
            "businessName": business_row["business_name"],
            "category": business_row["category"],
            "description": business_row["description"],
            "phone": business_row["phone"],
            "whatsapp": business_row["whatsapp"],
            "email": business_row["email"],
            "website": business_row["website"],
            "address": business_row["address"],
            "area": business_row["area"],
            "city": business_row["city"],
            "state": business_row["state"],
            "pincode": business_row["pincode"],
            "serviceAreas": business_row["service_areas"],
            "serviceRadiusKm": business_row["service_radius_km"],
            "openingHours": business_row["opening_hours"],
        }
    return {
        "username": row["username"],
        "businessProfile": business_profile,
        "businessCatalog": [dict(item) for item in business_catalog],
        "accountType": (account["account_type"] if account else "personal") or "personal",
        "displayName": row["display_name"],
        "bio": row["bio"],
        "avatarUrl": row["avatar_url"],
        "postsCount": posts,
        "followersCount": followers,
        "followingCount": following,
    }


@app.get("/api/search/users")
def search_users():
    query = request.args.get("q", "").strip().lstrip("@")
    if len(query) < 2:
        return jsonify({"results": []})

    query = query[:60].lower()
    pattern = "%" + query + "%"
    viewer = getattr(g, "auth_username", None)

    with get_db() as db:
        rows = db.execute("""
            SELECT u.username,
                   COALESCE(NULLIF(p.display_name, ''), u.username) AS display_name,
                   p.avatar_url
            FROM users u
            LEFT JOIN profiles p ON LOWER(p.username) = LOWER(u.username)
            WHERE LOWER(u.username) LIKE ?
               OR LOWER(COALESCE(p.display_name, '')) LIKE ?
            ORDER BY CASE WHEN LOWER(u.username) = ? THEN 0 ELSE 1 END,
                     LOWER(u.username)
            LIMIT 30
        """, (pattern, pattern, query)).fetchall()

        results = []
        for row in rows:
            target = row["username"]
            if viewer and target.lower() != viewer.lower():
                blocked = db.execute("""
                    SELECT 1 FROM people_blocks
                    WHERE (blocker=? AND blocked=?)
                       OR (blocker=? AND blocked=?)
                    LIMIT 1
                """, (viewer, target, target, viewer)).fetchone()
                if blocked:
                    continue

            is_following = False
            follows_you = False
            request_status = None
            is_private = False
            is_restricted = False
            mutual_count = 0

            if viewer:
                is_following = bool(db.execute(
                    "SELECT 1 FROM follows WHERE follower=? AND following=?",
                    (viewer, target)
                ).fetchone())
                follows_you = bool(db.execute(
                    "SELECT 1 FROM follows WHERE follower=? AND following=?",
                    (target, viewer)
                ).fetchone())

                request_row = db.execute("""
                    SELECT status FROM follow_requests
                    WHERE requester=? AND target=?
                """, (viewer, target)).fetchone()
                request_status = request_row["status"] if request_row else None

                settings = db.execute(
                    "SELECT is_private FROM user_settings WHERE username=?",
                    (target,)
                ).fetchone()
                is_private = bool(settings["is_private"]) if settings else False

                is_restricted = bool(db.execute("""
                    SELECT 1 FROM people_restrictions
                    WHERE owner=? AND restricted=?
                """, (viewer, target)).fetchone())

                mutual = db.execute("""
                    SELECT COUNT(*) FROM follows a
                    JOIN follows b ON b.following=a.following
                    WHERE a.follower=? AND b.follower=?
                """, (viewer, target)).fetchone()
                mutual_count = mutual[0] if mutual else 0

            results.append({
                "username": target,
                "displayName": row["display_name"],
                "avatarUrl": row["avatar_url"],
                "isFollowing": is_following,
                "followsYou": follows_you,
                "followRequestStatus": request_status,
                "isPrivate": is_private,
                "isRestricted": is_restricted,
                "mutualFollowersCount": mutual_count,
            })

    return jsonify({"results": results})


@app.get("/api/people/suggestions")
def people_suggestions():
    viewer = getattr(g, "auth_username", None)
    if not viewer:
        return jsonify({"error": "Please log in first."}), 401

    with get_db() as db:
        rows = db.execute("""
            SELECT u.username,
                   COALESCE(NULLIF(p.display_name, ''), u.username) AS display_name,
                   p.avatar_url,
                   COUNT(DISTINCT mutual.following) AS mutual_count,
                   MAX(u.created_at) AS recent_rank
            FROM users u
            LEFT JOIN profiles p ON LOWER(p.username)=LOWER(u.username)
            LEFT JOIN follows mutual
                ON mutual.follower=? AND mutual.following IN (
                    SELECT f.following FROM follows f
                    WHERE f.follower=u.username
                )
            WHERE LOWER(u.username) <> LOWER(?)
              AND NOT EXISTS (
                  SELECT 1 FROM follows f
                  WHERE f.follower=? AND f.following=u.username
              )
              AND NOT EXISTS (
                  SELECT 1 FROM follow_requests r
                  WHERE r.requester=? AND r.target=u.username
                    AND r.status='pending'
              )
              AND NOT EXISTS (
                  SELECT 1 FROM people_blocks b
                  WHERE (b.blocker=? AND b.blocked=u.username)
                     OR (b.blocker=u.username AND b.blocked=?)
              )
            GROUP BY u.username, p.display_name, p.avatar_url
            ORDER BY mutual_count DESC, recent_rank DESC
            LIMIT 30
        """, (viewer, viewer, viewer, viewer, viewer, viewer)).fetchall()

        results = []
        for row in rows:
            target = row["username"]
            follows_you = bool(db.execute(
                "SELECT 1 FROM follows WHERE follower=? AND following=?",
                (target, viewer)
            ).fetchone())
            settings = db.execute(
                "SELECT is_private FROM user_settings WHERE username=?",
                (target,)
            ).fetchone()

            if _chat_preferences(db, target).get("privacy.hideFromSuggestions", False) is True:
                continue

            results.append({
                "username": target,
                "displayName": row["display_name"],
                "avatarUrl": row["avatar_url"],
                "mutualFollowersCount": row["mutual_count"],
                "followsYou": follows_you,
                "isPrivate": bool(settings["is_private"]) if settings else False,
            })

    return jsonify({"results": results})


@app.get("/api/profile/<username>")
def get_profile(username):
    username = username.strip().lstrip("@")
    if not username or len(username) > 50:
        return jsonify({"error": "Invalid username"}), 400

    viewer = getattr(g, "auth_username", None)
    with get_db() as db:
        user = db.execute(
            "SELECT username FROM users WHERE LOWER(username)=LOWER(?)",
            (username,),
        ).fetchone()

        if user is None:
            return jsonify({"error": "Profile not found"}), 404

        username = user["username"]

        # A private account's profile identity remains discoverable. Privacy
        # controls posts, reels, and connection lists; blocking hides the
        # profile itself in both directions.
        if viewer and viewer.casefold() != username.casefold():
            blocked = db.execute("""
                SELECT 1 FROM people_blocks
                WHERE (LOWER(blocker)=LOWER(?) AND LOWER(blocked)=LOWER(?))
                   OR (LOWER(blocker)=LOWER(?) AND LOWER(blocked)=LOWER(?))
                LIMIT 1
            """, (username, viewer, viewer, username)).fetchone()
            if blocked:
                return jsonify({"error": "Profile not found"}), 404

        result = profile_json(db, username)
        result["isFollowing"] = bool(
            viewer and db.execute(
                "SELECT 1 FROM follows WHERE LOWER(follower)=LOWER(?) AND LOWER(following)=LOWER(?)",
                (viewer, username),
            ).fetchone()
        )
        result["followsYou"] = bool(
            viewer and db.execute(
                "SELECT 1 FROM follows WHERE LOWER(follower)=LOWER(?) AND LOWER(following)=LOWER(?)",
                (username, viewer),
            ).fetchone()
        )
        settings = db.execute(
            "SELECT is_private FROM user_settings WHERE username=?",
            (username,),
        ).fetchone()
        result["isPrivate"] = bool(settings["is_private"]) if settings else False

        request_row = None
        if viewer:
            request_row = db.execute(
                "SELECT status FROM follow_requests WHERE LOWER(requester)=LOWER(?) AND LOWER(target)=LOWER(?)",
                (viewer, username),
            ).fetchone()
        result["followRequestStatus"] = request_row["status"] if request_row else None

        return jsonify({"profile": result})



@app.get("/api/business/profile")
def get_business_profile():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        account = db.execute(
            "SELECT account_type FROM user_settings WHERE LOWER(username)=LOWER(?)",
            (username,),
        ).fetchone()
        if not account or account["account_type"] != "business":
            return jsonify({"error": "Switch to a Business Account first."}), 403
        row = db.execute(
            "SELECT * FROM business_profiles WHERE LOWER(username)=LOWER(?)",
            (username,),
        ).fetchone()
        fields = {
            "businessName": "business_name", "category": "category",
            "description": "description", "phone": "phone", "whatsapp": "whatsapp",
            "email": "email", "website": "website", "address": "address",
            "area": "area", "city": "city", "state": "state", "pincode": "pincode",
            "serviceAreas": "service_areas", "serviceRadiusKm": "service_radius_km",
            "openingHours": "opening_hours",
        }
        result = {key: (row[column] if row else (0 if key == "serviceRadiusKm" else "")) for key, column in fields.items()}
        return jsonify({"businessProfile": result})


@app.patch("/api/business/profile")
def update_business_profile():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    data = request.get_json(silent=True) or {}
    columns = {
        "businessName": "business_name", "category": "category",
        "description": "description", "phone": "phone", "whatsapp": "whatsapp",
        "email": "email", "website": "website", "address": "address",
        "area": "area", "city": "city", "state": "state", "pincode": "pincode",
        "serviceAreas": "service_areas", "serviceRadiusKm": "service_radius_km",
        "openingHours": "opening_hours",
    }
    if not isinstance(data, dict) or not data or any(key not in columns for key in data):
        return jsonify({"error": "Business profile data is invalid."}), 400
    values = {}
    for key, value in data.items():
        if key == "serviceRadiusKm":
            try:
                radius = int(value)
            except (TypeError, ValueError):
                return jsonify({"error": "Service radius must be a whole number."}), 400
            if radius < 0 or radius > 500:
                return jsonify({"error": "Service radius must be between 0 and 500 km."}), 400
            values[key] = radius
        else:
            if not isinstance(value, str) or len(value) > (3000 if key == "description" else 500):
                return jsonify({"error": "Please check the business profile fields."}), 400
            values[key] = value.strip()
    if "businessName" in values and not values["businessName"]:
        return jsonify({"error": "Business name is required."}), 400
    if "city" in values and not values["city"]:
        return jsonify({"error": "City is required for area-wise discovery."}), 400
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        account = db.execute(
            "SELECT account_type FROM user_settings WHERE LOWER(username)=LOWER(?)",
            (username,),
        ).fetchone()
        if not account or account["account_type"] != "business":
            return jsonify({"error": "Switch to a Business Account first."}), 403
        row = db.execute(
            "SELECT username FROM business_profiles WHERE LOWER(username)=LOWER(?)",
            (username,),
        ).fetchone()
        if row is None:
            defaults = {
                "business_name": "", "category": "", "description": "", "phone": "",
                "whatsapp": "", "email": "", "website": "", "address": "", "area": "",
                "city": "", "state": "", "pincode": "", "service_areas": "",
                "service_radius_km": 0, "opening_hours": "",
            }
            defaults.update({columns[key]: value for key, value in values.items()})
            db.execute("""
                INSERT INTO business_profiles (
                    username, business_name, category, description, phone, whatsapp,
                    email, website, address, area, city, state, pincode, service_areas,
                    service_radius_km, opening_hours, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                username, defaults["business_name"], defaults["category"], defaults["description"],
                defaults["phone"], defaults["whatsapp"], defaults["email"], defaults["website"],
                defaults["address"], defaults["area"], defaults["city"], defaults["state"],
                defaults["pincode"], defaults["service_areas"], defaults["service_radius_km"],
                defaults["opening_hours"], now,
            ))
        else:
            assignments = [f"{columns[key]}=?" for key in values]
            params = list(values.values()) + [now, username]
            db.execute(
                f"UPDATE business_profiles SET {', '.join(assignments)}, updated_at=? WHERE LOWER(username)=LOWER(?)",
                params,
            )
        saved = db.execute(
            "SELECT * FROM business_profiles WHERE LOWER(username)=LOWER(?)",
            (username,),
        ).fetchone()
        business_fields = {
            "businessName": "business_name", "category": "category",
            "description": "description", "phone": "phone", "whatsapp": "whatsapp",
            "email": "email", "website": "website", "address": "address",
            "area": "area", "city": "city", "state": "state", "pincode": "pincode",
            "serviceAreas": "service_areas", "serviceRadiusKm": "service_radius_km",
            "openingHours": "opening_hours",
        }
        return jsonify({
            "ok": True,
            "businessProfile": {
                key: saved[column] for key, column in business_fields.items()
            },
        })




@app.get("/api/business/catalog")
def get_business_catalog():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        account = db.execute("SELECT account_type FROM user_settings WHERE LOWER(username)=LOWER(?)", (username,)).fetchone()
        if not account or account["account_type"] != "business":
            return jsonify({"error": "Business Account is required."}), 403
        rows = db.execute("SELECT * FROM business_catalog WHERE LOWER(username)=LOWER(?) ORDER BY id DESC", (username,)).fetchall()
        return jsonify({"items": [dict(row) for row in rows]})


@app.post("/api/business/catalog")
def create_business_catalog_item():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    data = request.get_json(silent=True) or {}
    item_type = data.get("itemType", "product")
    title = str(data.get("title") or "").strip()
    description = str(data.get("description") or "").strip()
    price = str(data.get("price") or "").strip()
    category = str(data.get("category") or "").strip()
    if item_type not in ("product", "service") or not title or len(title) > 120 or len(description) > 1200 or len(price) > 80 or len(category) > 100:
        return jsonify({"error": "Please enter a valid product or service."}), 400
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        account = db.execute("SELECT account_type FROM user_settings WHERE LOWER(username)=LOWER(?)", (username,)).fetchone()
        if not account or account["account_type"] != "business":
            return jsonify({"error": "Business Account is required."}), 403
        cursor = db.execute(
            "INSERT INTO business_catalog(username, item_type, title, description, price, category, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (username, item_type, title, description, price, category, now),
        )
        item = db.execute("SELECT * FROM business_catalog WHERE id=?", (cursor.lastrowid,)).fetchone()
        return jsonify({"ok": True, "item": dict(item)}), 201


@app.delete("/api/business/catalog/<int:item_id>")
def remove_business_catalog_item(item_id):
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        deleted = db.execute("DELETE FROM business_catalog WHERE id=? AND LOWER(username)=LOWER(?)", (item_id, username))
        if deleted.rowcount == 0:
            return jsonify({"error": "Catalog item not found."}), 404
    return jsonify({"ok": True})


@app.get("/api/business/quick-replies")
def get_business_quick_replies():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        account = db.execute("SELECT account_type FROM user_settings WHERE LOWER(username)=LOWER(?)", (username,)).fetchone()
        if not account or account["account_type"] != "business":
            return jsonify({"error": "Business Account is required."}), 403
        rows = db.execute("SELECT * FROM business_quick_replies WHERE LOWER(username)=LOWER(?) ORDER BY id DESC", (username,)).fetchall()
        return jsonify({"items": [dict(row) for row in rows]})


@app.post("/api/business/quick-replies")
def create_business_quick_reply():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    data = request.get_json(silent=True) or {}
    shortcut = str(data.get("shortcut") or "").strip().lstrip("/").lower()
    message = str(data.get("message") or "").strip()
    if not shortcut or len(shortcut) > 32 or not shortcut.replace("_", "").isalnum() or not message or len(message) > 1500:
        return jsonify({"error": "Enter a valid shortcut and reply message."}), 400
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        account = db.execute("SELECT account_type FROM user_settings WHERE LOWER(username)=LOWER(?)", (username,)).fetchone()
        if not account or account["account_type"] != "business":
            return jsonify({"error": "Business Account is required."}), 403
        try:
            cursor = db.execute(
                "INSERT INTO business_quick_replies(username, shortcut, message, created_at) VALUES (?, ?, ?, ?)",
                (username, shortcut, message, now),
            )
        except Exception:
            return jsonify({"error": "This quick-reply shortcut already exists."}), 409
        item = db.execute("SELECT * FROM business_quick_replies WHERE id=?", (cursor.lastrowid,)).fetchone()
        return jsonify({"ok": True, "item": dict(item)}), 201


@app.delete("/api/business/quick-replies/<int:reply_id>")
def remove_business_quick_reply(reply_id):
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        deleted = db.execute("DELETE FROM business_quick_replies WHERE id=? AND LOWER(username)=LOWER(?)", (reply_id, username))
        if deleted.rowcount == 0:
            return jsonify({"error": "Quick reply not found."}), 404
    return jsonify({"ok": True})


@app.get("/api/business/insights")
def business_insights():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        account = db.execute(
            "SELECT account_type FROM user_settings WHERE LOWER(username)=LOWER(?)",
            (username,),
        ).fetchone()
        if not account or account["account_type"] != "business":
            return jsonify({"error": "Business Account is required."}), 403
        posts = db.execute(
            "SELECT COUNT(*) FROM content WHERE LOWER(username)=LOWER(?) AND kind IN ('posts','reels')",
            (username,),
        ).fetchone()[0]
        followers = db.execute(
            "SELECT COUNT(*) FROM follows WHERE LOWER(following)=LOWER(?)",
            (username,),
        ).fetchone()[0]
        likes = db.execute("""
            SELECT COUNT(*) FROM post_likes l
            JOIN content c ON c.id=l.content_id
            WHERE LOWER(c.username)=LOWER(?)
        """, (username,)).fetchone()[0]
        comments = db.execute("""
            SELECT COUNT(*) FROM post_comments c
            JOIN content p ON p.id=c.content_id
            WHERE LOWER(p.username)=LOWER(?)
        """, (username,)).fetchone()[0]
        reel_likes = db.execute("""
            SELECT COUNT(*) FROM reel_likes l
            JOIN content c ON c.id=l.content_id
            WHERE LOWER(c.username)=LOWER(?)
        """, (username,)).fetchone()[0]
        reel_comments = db.execute("""
            SELECT COUNT(*) FROM reel_comments c
            JOIN content p ON p.id=c.content_id
            WHERE LOWER(p.username)=LOWER(?)
        """, (username,)).fetchone()[0]
    return jsonify({
        "insights": {
            "contentCount": posts,
            "followers": followers,
            "likes": likes + reel_likes,
            "comments": comments + reel_comments,
        }
    })


@app.get("/api/businesses")
def discover_businesses():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        account = db.execute(
            "SELECT account_type FROM user_settings WHERE LOWER(username)=LOWER(?)",
            (username,),
        ).fetchone()
        if not account or account["account_type"] != "business":
            return jsonify({"error": "Business Account is required to use area-wise business discovery."}), 403
    city = request.args.get("city", "").strip()[:100]
    area = request.args.get("area", "").strip()[:100]
    category = request.args.get("category", "").strip()[:100]
    query = request.args.get("q", "").strip()[:100]
    try:
        limit = min(max(int(request.args.get("limit", 30)), 1), 100)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid result limit."}), 400
    if not any((city, area, category, query)):
        return jsonify({"businesses": []})
    clauses = []
    params = []
    for value, column in ((city, "city"), (area, "area"), (category, "category")):
        if value:
            clauses.append(f"LOWER({column}) LIKE ?")
            params.append("%" + value.lower() + "%")
    if query:
        clauses.append("(LOWER(business_name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(category) LIKE ?)")
        params.extend(["%" + query.lower() + "%"] * 3)
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM business_profiles WHERE " + " AND ".join(clauses) +
            " ORDER BY business_name COLLATE NOCASE LIMIT ?",
            (*params, limit),
        ).fetchall()
        results = [{
            "username": row["username"], "businessName": row["business_name"],
            "category": row["category"], "description": row["description"],
            "area": row["area"], "city": row["city"], "state": row["state"],
            "address": row["address"], "phone": row["phone"], "whatsapp": row["whatsapp"],
            "website": row["website"], "serviceAreas": row["service_areas"],
            "serviceRadiusKm": row["service_radius_km"],
        } for row in rows]
    return jsonify({"businesses": results})


@app.get("/api/profile/<username>/posts")
def get_profile_posts(username):
    username = str(username or "").strip().lstrip("@")
    if not username or len(username) > 50:
        return jsonify({"error": "Invalid username"}), 400

    try:
        limit = min(max(int(request.args.get("limit", 100)), 1), 100)
        offset = max(int(request.args.get("offset", 0)), 0)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid pagination values"}), 400

    viewer = getattr(g, "auth_username", None)
    with get_db() as db:
        user = db.execute(
            "SELECT username FROM users WHERE LOWER(username)=LOWER(?)",
            (username,),
        ).fetchone()
        if user is None:
            return jsonify({"error": "Profile not found"}), 404

        canonical_username = user["username"]
        if not can_view_content(db, canonical_username, viewer):
            return jsonify({"error": "Profile not found"}), 404

        rows = db.execute("""
            SELECT * FROM content
            WHERE kind='posts' AND LOWER(username)=LOWER(?)
            ORDER BY id DESC
            LIMIT ? OFFSET ?
        """, (canonical_username, limit + 1, offset)).fetchall()

        has_more = len(rows) > limit
        rows = rows[:limit]
        items = [content_json(row, viewer, db) for row in rows]

    return jsonify({
        "items": items,
        "hasMore": has_more,
        "nextOffset": offset + len(items),
    })


@app.patch("/api/profile/<username>")
def update_profile(username):
    username = username.strip().lstrip("@")
    data = request.get_json(silent=True) or {}
    # This basic API uses the supplied username as identity. Add authenticated
    # sessions before exposing it to untrusted users.
    display_name = str(data.get("displayName", "")).strip()
    bio = str(data.get("bio", "")).strip()
    if len(display_name) > 60 or len(bio) > 300:
        return jsonify({"error": "Name max 60 and bio max 300 characters"}), 400
    now = datetime.now(timezone.utc)
    with get_db() as db:
        profile_json(db, username)
        row = db.execute(
            "SELECT * FROM profiles WHERE username=?", (username,)
        ).fetchone()
        if "displayName" in data and display_name != row["display_name"]:
            previous = row["name_changed_at"]
            if previous:
                try:
                    last = datetime.fromisoformat(previous)
                    if now - last < timedelta(days=90):
                        next_date = (last + timedelta(days=90)).date().isoformat()
                        return jsonify({
                            "error": f"You can change your display name again from {next_date}."
                        }), 429
                except ValueError:
                    pass
            db.execute(
                "UPDATE profiles SET display_name=?, name_changed_at=? WHERE username=?",
                (display_name or username, now.isoformat(), username),
            )
        if "bio" in data:
            db.execute("UPDATE profiles SET bio=? WHERE username=?", (bio, username))
        # Username is intentionally never accepted as an editable field.
        result = profile_json(db, username)
    return jsonify({"ok": True, "profile": result})


@app.post("/api/profile/<username>/avatar")
def upload_profile_avatar(username):
    username = username.strip().lstrip("@")
    media = request.files.get("file")
    if media is None or not media.filename:
        return jsonify({"error": "Profile photo file is required"}), 400
    filename = secure_filename(media.filename)
    if "." not in filename:
        return jsonify({"error": "File extension is missing"}), 400
    ext = filename.rsplit(".", 1)[1].lower()
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        return jsonify({"error": "Only image files are allowed"}), 415
    folder = UPLOAD_DIR / "profiles"
    folder.mkdir(parents=True, exist_ok=True)
    stored = f"{uuid.uuid4().hex}.{ext}"
    destination = folder / stored
    try:
        media.save(destination)
        if destination.stat().st_size == 0:
            destination.unlink(missing_ok=True)
            return jsonify({"error": "Empty image"}), 400
        avatar_url = f"/uploads/profiles/{stored}"
        with get_db() as db:
            profile_json(db, username)
            old = db.execute(
                "SELECT avatar_url FROM profiles WHERE username=?", (username,)
            ).fetchone()["avatar_url"]
            db.execute("UPDATE profiles SET avatar_url=? WHERE username=?",
                       (avatar_url, username))
        if old and old.startswith("/uploads/profiles/"):
            (folder / old.rsplit("/", 1)[1]).unlink(missing_ok=True)
        with get_db() as db:
            return jsonify({"ok": True, "profile": profile_json(db, username)}), 201
    except Exception:
        destination.unlink(missing_ok=True)
        app.logger.exception("Profile photo upload failed")
        return jsonify({"error": "Could not save profile photo"}), 500


@app.delete("/api/profile/<username>/avatar")
def delete_profile_avatar(username):
    username = username.strip().lstrip("@")
    with get_db() as db:
        profile_json(db, username)
        row = db.execute(
            "SELECT avatar_url FROM profiles WHERE username=?", (username,)
        ).fetchone()
        old = row["avatar_url"]
        db.execute("UPDATE profiles SET avatar_url=NULL WHERE username=?", (username,))
        result = profile_json(db, username)
    if old and old.startswith("/uploads/profiles/"):
        (UPLOAD_DIR / "profiles" / old.rsplit("/", 1)[1]).unlink(missing_ok=True)
    return jsonify({"ok": True, "profile": result})



@app.post("/api/profile/<username>/follow")
def follow_profile(username):
    actor = getattr(g, "auth_username", None)
    target = username.strip().lstrip("@")
    if not actor:
        return jsonify({"error": "Please log in first."}), 401
    if not target or target.lower() == actor.lower():
        return jsonify({"error": "You cannot follow yourself."}), 400

    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        user = db.execute(
            "SELECT username FROM users WHERE LOWER(username)=LOWER(?)",
            (target,),
        ).fetchone()
        if not user:
            return jsonify({"error": "User not found."}), 404
        target = user["username"]

        blocked = db.execute("""
            SELECT 1 FROM people_blocks
            WHERE (blocker=? AND blocked=?)
               OR (blocker=? AND blocked=?)
        """, (actor, target, target, actor)).fetchone()
        if blocked:
            return jsonify({"error": "This connection is unavailable."}), 403

        db.execute("""
            INSERT OR IGNORE INTO user_settings (username, updated_at)
            VALUES (?, ?)
        """, (target, now))
        settings = db.execute(
            "SELECT is_private FROM user_settings WHERE username=?",
            (target,),
        ).fetchone()

        if settings and settings["is_private"]:
            existing = db.execute("""
                SELECT id, status FROM follow_requests
                WHERE requester=? AND target=?
            """, (actor, target)).fetchone()
            if existing and existing["status"] == "pending":
                return jsonify({"ok": True, "status": "requested"})
            request_id = uuid.uuid4().hex
            cursor = db.execute("""
                INSERT INTO follow_requests
                (id, requester, target, status, created_at, updated_at)
                VALUES (?, ?, ?, 'pending', ?, ?)
            ON CONFLICT(requester, target) DO UPDATE SET
                id=excluded.id, status='pending',
                created_at=excluded.created_at,
                updated_at=excluded.updated_at
            WHERE follow_requests.status <> 'pending'
            """, (request_id, actor, target, now, now))

            if cursor.rowcount == 1:
                _people_notification(
                    db, target, actor, "follow_request", request_id, now
                )
            return jsonify({"ok": True, "status": "requested"}), 201

        cursor = db.execute("""
            INSERT OR IGNORE INTO follows (follower, following, created_at)
            VALUES (?, ?, ?)
        """, (actor, target, now))
        if cursor.rowcount == 1:
            _people_notification(db, target, actor, "follow", None, now)
        return jsonify({"ok": True, "status": "following",
                        "profile": profile_json(db, target)}), 201


@app.delete("/api/profile/<username>/follow")
def unfollow_profile(username):
    actor = getattr(g, "auth_username", None)
    target = str(username or "").strip().lstrip("@").strip()

    if not actor:
        return jsonify({"error": "Please log in first."}), 401
    if not target or target.lower() == actor.lower():
        return jsonify({"error": "Invalid account."}), 400

    with get_db() as db:
        user = db.execute(
            "SELECT username FROM users WHERE LOWER(username)=LOWER(?)",
            (target,),
        ).fetchone()
        if not user:
            return jsonify({"error": "User not found."}), 404

        target = user["username"]
        now = datetime.now(timezone.utc).isoformat()

        db.execute("""
            DELETE FROM follows
            WHERE LOWER(follower)=LOWER(?) AND LOWER(following)=LOWER(?)
        """, (actor, target))

        db.execute("""
            UPDATE follow_requests
            SET status='cancelled', updated_at=?
            WHERE LOWER(requester)=LOWER(?)
              AND LOWER(target)=LOWER(?)
              AND status='pending'
        """, (now, actor, target))

        return jsonify({
            "ok": True,
            "status": "not_following",
            "profile": profile_json(db, target),
        })


@app.get("/api/settings/restricted-accounts")
def get_restricted_accounts():
    actor = getattr(g, "auth_username", None)
    if not actor:
        return jsonify({"error": "Please log in first."}), 401

    with get_db() as db:
        rows = db.execute("""
            SELECT r.restricted AS username,
                   COALESCE(NULLIF(p.display_name, ''), u.username) AS display_name,
                   p.avatar_url
            FROM people_restrictions r
            JOIN users u ON LOWER(u.username)=LOWER(r.restricted)
            LEFT JOIN profiles p ON LOWER(p.username)=LOWER(u.username)
            WHERE LOWER(r.owner)=LOWER(?)
            ORDER BY r.created_at DESC
        """, (actor,)).fetchall()

    return jsonify({"restrictedAccounts": [
        {"username": row["username"], "displayName": row["display_name"],
         "avatarUrl": row["avatar_url"]}
        for row in rows
    ]})


@app.post("/api/profile/<username>/restrict")
def restrict_account(username):
    actor = getattr(g, "auth_username", None)
    target = username.strip().lstrip("@")
    if not actor:
        return jsonify({"error": "Please log in first."}), 401
    if not target or target.lower() == actor.lower():
        return jsonify({"error": "Invalid account."}), 400

    with get_db() as db:
        user = db.execute(
            "SELECT username FROM users WHERE LOWER(username)=LOWER(?)",
            (target,)
        ).fetchone()
        if not user:
            return jsonify({"error": "User not found."}), 404
        target = user["username"]
        db.execute("""
            INSERT OR IGNORE INTO people_restrictions
            (owner, restricted, created_at) VALUES (?, ?, ?)
        """, (actor, target, datetime.now(timezone.utc).isoformat()))

    return jsonify({"ok": True, "restricted": True, "username": target})


@app.delete("/api/profile/<username>/restrict")
def unrestrict_account(username):
    actor = getattr(g, "auth_username", None)
    target = username.strip().lstrip("@")
    if not actor:
        return jsonify({"error": "Please log in first."}), 401
    if not target or target.lower() == actor.lower():
        return jsonify({"error": "Invalid account."}), 400

    with get_db() as db:
        cursor = db.execute("""
            DELETE FROM people_restrictions
            WHERE LOWER(owner)=LOWER(?) AND LOWER(restricted)=LOWER(?)
        """, (actor, target))
        if cursor.rowcount == 0:
            return jsonify({"error": "Account is not restricted."}), 404

    return jsonify({"ok": True, "restricted": False, "username": target})


@app.post("/api/settings/blocked-accounts/<username>")
def block_account(username):
    actor = getattr(g, "auth_username", None)
    target = str(username or "").strip().lstrip("@")

    if not actor:
        return jsonify({"error": "Please log in first."}), 401
    if not target or target.casefold() == actor.casefold():
        return jsonify({"error": "Invalid account."}), 400

    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        user = db.execute(
            "SELECT username FROM users WHERE LOWER(username)=LOWER(?)",
            (target,)
        ).fetchone()
        if not user:
            return jsonify({"error": "User not found."}), 404

        target = user["username"]
        db.execute("""
            INSERT OR IGNORE INTO people_blocks (blocker, blocked, created_at)
            VALUES (?, ?, ?)
        """, (actor, target, now))

        # Blocking ends the existing follow connection in both directions.
        db.execute("""
            DELETE FROM follows
            WHERE (LOWER(follower)=LOWER(?) AND LOWER(following)=LOWER(?))
               OR (LOWER(follower)=LOWER(?) AND LOWER(following)=LOWER(?))
        """, (actor, target, target, actor))

        db.execute("""
            UPDATE follow_requests
            SET status='cancelled', updated_at=?
            WHERE status='pending'
              AND ((LOWER(requester)=LOWER(?) AND LOWER(target)=LOWER(?))
                OR (LOWER(requester)=LOWER(?) AND LOWER(target)=LOWER(?)))
        """, (now, actor, target, target, actor))


    # Remove only stale follow-request notifications between these accounts.
    db.execute("""
        DELETE FROM people_notifications
        WHERE kind='follow_request'
          AND (
            (LOWER(recipient)=LOWER(?) AND LOWER(actor)=LOWER(?))
            OR
            (LOWER(recipient)=LOWER(?) AND LOWER(actor)=LOWER(?))
          )
    """, (actor, target, target, actor))

    return jsonify({"ok": True, "blocked": True, "username": target})


@app.get("/api/settings/blocked-accounts")
def get_blocked_accounts():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401

    with get_db() as db:
        rows = db.execute("""
            SELECT b.blocked AS username,
                   COALESCE(NULLIF(p.display_name, ''), u.username) AS display_name,
                   p.avatar_url
            FROM people_blocks b
            JOIN users u ON LOWER(u.username)=LOWER(b.blocked)
            LEFT JOIN profiles p ON LOWER(p.username)=LOWER(u.username)
            WHERE LOWER(b.blocker)=LOWER(?)
            ORDER BY b.created_at DESC
        """, (username,)).fetchall()

    return jsonify({"blockedAccounts": [
        {"username": row["username"], "displayName": row["display_name"],
         "avatarUrl": row["avatar_url"]}
        for row in rows
    ]})


@app.delete("/api/settings/blocked-accounts/<username>")
def unblock_account(username):
    actor = getattr(g, "auth_username", None)
    if not actor:
        return jsonify({"error": "Please log in first."}), 401

    target = username.strip().lstrip("@")
    if not target or target.lower() == actor.lower():
        return jsonify({"error": "Invalid account."}), 400

    with get_db() as db:
        cursor = db.execute(
            "DELETE FROM people_blocks WHERE LOWER(blocker)=LOWER(?) AND LOWER(blocked)=LOWER(?)",
            (actor, target),
        )
        if cursor.rowcount == 0:
            return jsonify({"error": "Account is not in your blocked list."}), 404

    return jsonify({"ok": True, "username": target})


@app.get("/api/follow-requests")
def get_follow_requests():
    actor = getattr(g, "auth_username", None)
    if not actor:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        rows = db.execute("""
            SELECT r.id, r.requester, r.created_at,
                   COALESCE(NULLIF(p.display_name, ''), u.username) AS display_name,
                   p.avatar_url
            FROM follow_requests r
            JOIN users u ON LOWER(u.username)=LOWER(r.requester)
            LEFT JOIN profiles p ON LOWER(p.username)=LOWER(r.requester)
            WHERE r.target=? AND r.status='pending'
            ORDER BY r.created_at DESC
        """, (actor,)).fetchall()
        return jsonify({"requests": [
            {"id": row["id"], "username": row["requester"],
             "displayName": row["display_name"], "avatarUrl": row["avatar_url"],
             "createdAt": row["created_at"]}
            for row in rows
        ]})


def _resolve_follow_request(db, request_id, actor, decision):
    if decision not in ("accept", "reject"):
        return None

    row = db.execute("""
        SELECT id, requester, target FROM follow_requests
        WHERE id=? AND target=? AND status='pending'
    """, (request_id, actor)).fetchone()

    if not row:
        return None

    now = datetime.now(timezone.utc).isoformat()

    if decision == "accept":
        blocked = db.execute("""
            SELECT 1 FROM people_blocks
            WHERE (blocker=? AND blocked=?)
               OR (blocker=? AND blocked=?)
        """, (actor, row["requester"], row["requester"], actor)).fetchone()

        if blocked:
            cursor = db.execute("""
                UPDATE follow_requests
                SET status='rejected', updated_at=?
                WHERE id=? AND target=? AND status='pending'
            """, (now, request_id, actor))

            if cursor.rowcount != 1:
                return None

            return {"ok": False, "error": "This connection is unavailable."}

    cursor = db.execute("""
        UPDATE follow_requests
        SET status=?, updated_at=?
        WHERE id=? AND target=? AND status='pending'
    """, (
        "accepted" if decision == "accept" else "rejected",
        now,
        request_id,
        actor,
    ))

    if cursor.rowcount != 1:
        return None

    if decision == "accept":
        db.execute("""
            INSERT OR IGNORE INTO follows (follower, following, created_at)
            VALUES (?, ?, ?)
        """, (row["requester"], actor, now))

        _people_notification(
            db, row["requester"], actor,
            "follow_accepted", request_id, now
        )
    else:
        _people_notification(
            db, row["requester"], actor,
            "follow_rejected", request_id, now
        )

    return {
        "ok": True,
        "status": "accepted" if decision == "accept" else "rejected"
    }


@app.post("/api/follow-requests/<request_id>/accept")
def accept_follow_request(request_id):
    actor = getattr(g, "auth_username", None)
    if not actor:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        result = _resolve_follow_request(db, request_id, actor, "accept")
        if result is None:
            return jsonify({"error": "Request not found."}), 404
        return jsonify(result), (200 if result.get("ok") else 403)


@app.post("/api/follow-requests/<request_id>/reject")
def reject_follow_request(request_id):
    actor = getattr(g, "auth_username", None)
    if not actor:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        result = _resolve_follow_request(db, request_id, actor, "reject")
        if result is None:
            return jsonify({"error": "Request not found."}), 404
        return jsonify(result)


@app.get("/api/notifications")
def list_people_notifications():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        rows = db.execute("""
            SELECT n.id, n.actor, n.kind, n.reference_id, n.created_at, n.is_read,
                   c.username AS content_owner, c.media_url AS post_media_url,
                   c.media_type AS post_media_type
            FROM people_notifications n
            LEFT JOIN content c
              ON CAST(c.id AS TEXT)=n.reference_id
             AND c.kind IN ('posts', 'reels')
            WHERE n.recipient=?
            ORDER BY n.created_at DESC
            LIMIT 100
        """, (username,)).fetchall()
        unread = db.execute("""
            SELECT COUNT(*) AS total
            FROM people_notifications
            WHERE recipient=? AND is_read=0
        """, (username,)).fetchone()
        unread_likes = db.execute("""
            SELECT COUNT(*) AS total
            FROM people_notifications
            WHERE recipient=? AND is_read=0
              AND kind IN ('like', 'reel_like', 'story_like', 'gift_flower')
        """, (username,)).fetchone()
        notification_items = [{
            "id": row["id"],
            "actor": row["actor"],
            "kind": row["kind"],
            "referenceId": row["reference_id"],
            "postMediaUrl": (
                row["post_media_url"]
                if row["content_owner"] and can_view_content(db, row["content_owner"], username)
                and row["post_media_type"] == "image" else None
            ),
            "createdAt": row["created_at"],
            "isRead": bool(row["is_read"]),
        } for row in rows]
    return jsonify({
        "notifications": notification_items,
        "unreadCount": unread["total"],
        "unreadLikeCount": unread_likes["total"],
    })


@app.patch("/api/notifications/<notification_id>/read")
def mark_people_notification_read(notification_id):
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        result = db.execute("""
            UPDATE people_notifications SET is_read=1
            WHERE id=? AND recipient=?
        """, (notification_id, username))
        if result.rowcount == 0:
            return jsonify({"error": "Notification not found."}), 404
    return jsonify({"ok": True})


@app.patch("/api/notifications/read-all")
def mark_all_people_notifications_read():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        db.execute("""
            UPDATE people_notifications SET is_read=1
            WHERE recipient=? AND is_read=0
        """, (username,))
    return jsonify({"ok": True})


@app.get("/api/profile/<username>/followers")
def list_followers(username):
    username = username.strip().lstrip("@")
    viewer = getattr(g, "auth_username", None)

    with get_db() as db:
        user = db.execute(
            "SELECT username FROM users WHERE LOWER(username)=LOWER(?)",
            (username,),
        ).fetchone()
        if user is None:
            return jsonify({"error": "Profile not found"}), 404

        username = user["username"]
        if not can_view_content(db, username, viewer):
            return jsonify({"error": "Profile not found"}), 404

        rows = db.execute(
            "SELECT follower FROM follows WHERE LOWER(following)=LOWER(?) ORDER BY created_at DESC",
            (username,),
        ).fetchall()

    return jsonify({"users": [r["follower"] for r in rows]})
@app.get("/api/profile/<username>/following")
def list_following(username):
    username = username.strip().lstrip("@")
    viewer = getattr(g, "auth_username", None)

    with get_db() as db:
        user = db.execute(
            "SELECT username FROM users WHERE LOWER(username)=LOWER(?)",
            (username,),
        ).fetchone()
        if user is None:
            return jsonify({"error": "Profile not found"}), 404

        username = user["username"]
        if not can_view_content(db, username, viewer):
            return jsonify({"error": "Profile not found"}), 404

        rows = db.execute(
            "SELECT following FROM follows WHERE LOWER(follower)=LOWER(?) ORDER BY created_at DESC",
            (username,),
        ).fetchall()

    return jsonify({"users": [r["following"] for r in rows]})
# SOCIALAPP_PRIVACY_SETTINGS_V2
@app.get("/api/profile/<username>/settings")
def get_user_settings(username):
    username = username.strip().lstrip("@")
    if not username:
        return jsonify({"error": "Username is required"}), 400

    viewer = getattr(g, "auth_username", None)
    if not viewer:
        return jsonify({"error": "Please log in first."}), 401

    if viewer.lower() != username.lower():
        return jsonify({"error": "You can only view your own settings."}), 403

    with get_db() as db:
        user = db.execute(
            "SELECT username FROM users WHERE LOWER(username)=LOWER(?)",
            (username,),
        ).fetchone()

        if user is None:
            return jsonify({"error": "User not found"}), 404

        row = db.execute(
            """SELECT is_private, show_activity, allow_messages, account_type
               FROM user_settings WHERE username=?""",
            (user["username"],),
        ).fetchone()

        if row is None:
            settings = {
                "isPrivate": False,
                "accountType": "personal",
                "showActivity": True,
                "allowMessages": True,
            }
        else:
            settings = {
                "isPrivate": bool(row["is_private"]),
                "accountType": row["account_type"] or "personal",
                "showActivity": bool(row["show_activity"]),
                "allowMessages": bool(row["allow_messages"]),
            }

        return jsonify({"settings": settings})


@app.patch("/api/profile/<username>/settings")
def update_user_settings(username):
    username = username.strip().lstrip("@")
    if not username:
        return jsonify({"error": "Username is required"}), 400

    viewer = getattr(g, "auth_username", None)
    if not viewer:
        return jsonify({"error": "Please log in first."}), 401

    if viewer.lower() != username.lower():
        return jsonify({"error": "You can only update your own settings."}), 403

    data = request.get_json(silent=True) or {}
    fields = {
        "isPrivate": "is_private",
        "showActivity": "show_activity",
        "allowMessages": "allow_messages",
    }
    if not data or any(key not in fields and key != "accountType" for key in data):
        return jsonify({"error": "Provide valid settings"}), 400
    for key, value in data.items():
        if key == "accountType":
            if value not in ("personal", "creator", "business"):
                return jsonify({"error": "Account type must be personal, creator or business."}), 400
        elif not isinstance(value, bool):
            return jsonify({"error": "Setting values must be true or false"}), 400

    now = datetime.now(timezone.utc).isoformat()

    with get_db() as db:
        user = db.execute(
            "SELECT username FROM users WHERE LOWER(username)=LOWER(?)",
            (username,),
        ).fetchone()

        if user is None:
            return jsonify({"error": "User not found"}), 404

        canonical_username = user["username"]

        db.execute(
            """INSERT OR IGNORE INTO user_settings
               (username, updated_at) VALUES (?, ?)""",
            (canonical_username, now),
        )

        for key, value in data.items():
            if key == "accountType":
                db.execute(
                    "UPDATE user_settings SET account_type=?, updated_at=? WHERE username=?",
                    (value, now, canonical_username),
                )
                if value == "business":
                    db.execute(
                        "UPDATE user_settings SET is_private=0, updated_at=? WHERE username=?",
                        (now, canonical_username),
                    )
            else:
                db.execute(
                    f"UPDATE user_settings SET {fields[key]}=?, updated_at=? WHERE username=?",
                    (int(value), now, canonical_username),
                )

        row = db.execute(
            """SELECT is_private, show_activity, allow_messages, account_type
               FROM user_settings WHERE username=?""",
            (canonical_username,),
        ).fetchone()

        return jsonify({
            "ok": True,
            "settings": {
                "isPrivate": bool(row["is_private"]),
                "accountType": row["account_type"] or "personal",
                "showActivity": bool(row["show_activity"]),
                "allowMessages": bool(row["allow_messages"]),
            },
        })


# SOCIALAPP_POST_INTERACTIONS_V1
@app.post("/api/posts/<int:content_id>/like")
def toggle_post_like(content_id):
    username = g.auth_username
    now = datetime.now(timezone.utc).isoformat()

    with get_db() as db:
        post = db.execute(
            "SELECT id, username FROM content WHERE id=? AND kind='posts'",
            (content_id,),
        ).fetchone()
        if post is None:
            return jsonify({"error": "Post not found"}), 404
        if not can_view_content(db, post["username"], username):
            return jsonify({"error": "Post not found"}), 404

        existing = db.execute(
            "SELECT id FROM post_likes WHERE content_id=? AND username=?",
            (content_id, username),
        ).fetchone()

        if existing:
            db.execute(
                "DELETE FROM post_likes WHERE content_id=? AND username=?",
                (content_id, username),
            )
            liked = False
        else:
            db.execute(
                "INSERT INTO post_likes (content_id, username, created_at) VALUES (?, ?, ?)",
                (content_id, username, now),
            )
            liked = True
            _people_notification(db, post["username"], username, "like", content_id, now)

        count = db.execute(
            "SELECT COUNT(*) AS total FROM post_likes WHERE content_id=?",
            (content_id,),
        ).fetchone()["total"]

    return jsonify({"ok": True, "liked": liked, "likes": count})


@app.post("/api/posts/<int:content_id>/repost")
def toggle_post_repost(content_id):
    username = g.auth_username
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        post = db.execute(
            "SELECT id, username FROM content WHERE id=? AND kind IN ('posts', 'reels')",
            (content_id,),
        ).fetchone()
        if post is None or not can_view_content(db, post["username"], username):
            return jsonify({"error": "Post not found"}), 404
        if post["username"].casefold() == username.casefold():
            return jsonify({"error": "You cannot repost your own post."}), 400
        existing = db.execute(
            "SELECT id FROM post_reposts WHERE content_id=? AND LOWER(username)=LOWER(?)",
            (content_id, username),
        ).fetchone()
        if existing:
            db.execute("DELETE FROM post_reposts WHERE content_id=? AND LOWER(username)=LOWER(?)", (content_id, username))
            reposted = False
        else:
            db.execute(
                "INSERT INTO post_reposts (content_id, username, created_at) VALUES (?, ?, ?)",
                (content_id, username, now),
            )
            reposted = True
            _people_notification(db, post["username"], username, "repost", content_id, now)
        count = db.execute("SELECT COUNT(*) AS total FROM post_reposts WHERE content_id=?", (content_id,)).fetchone()["total"]
    return jsonify({"ok": True, "reposted": reposted, "reposts": int(count or 0)})


@app.post("/api/posts/<int:content_id>/gifts")
def send_post_gift(content_id):
    sender = _chat_current_user()
    if not sender:
        return jsonify({"error": "Please log in first."}), 401
    data = request.get_json(silent=True) or {}
    gift_type = str(data.get("giftType") or "flower").strip().lower()
    if gift_type != "flower":
        return jsonify({"error": "Unsupported gift type."}), 400
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        post = db.execute(
            "SELECT id, username FROM content WHERE id=? AND kind IN ('posts', 'reels', 'stories')",
            (content_id,),
        ).fetchone()
        if post is None or not can_view_content(db, post["username"], sender):
            return jsonify({"error": "Content not found."}), 404
        recipient = str(post["username"] or "").strip()
        if recipient.lower() == sender.lower():
            return jsonify({"error": "You cannot send a gift to yourself."}), 400
        gift_id = uuid.uuid4().hex
        db.execute("""
            INSERT INTO post_gifts (id, content_id, sender_username, recipient_username, gift_type, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (gift_id, content_id, sender, recipient, gift_type, now))
        _people_notification(db, recipient, sender, "gift_flower", content_id, now)
        total = db.execute(
            "SELECT COUNT(*) AS total FROM post_gifts WHERE content_id=? AND gift_type=?",
            (content_id, gift_type),
        ).fetchone()["total"]
    return jsonify({"ok": True, "gift": {"id": gift_id, "contentId": content_id, "giftType": gift_type, "createdAt": now}, "giftCount": total}), 201


@app.get("/api/gifts/history")
def get_gift_history():
    username = _chat_current_user()
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        rows = db.execute("""
            SELECT id, content_id, sender_username, recipient_username, gift_type, created_at
            FROM post_gifts
            WHERE LOWER(sender_username)=LOWER(?) OR LOWER(recipient_username)=LOWER(?)
            ORDER BY created_at DESC LIMIT 100
        """, (username, username)).fetchall()
    return jsonify({"gifts": [{
        "id": row["id"], "contentId": row["content_id"],
        "sender": row["sender_username"], "recipient": row["recipient_username"],
        "giftType": row["gift_type"], "createdAt": row["created_at"],
        "direction": "sent" if str(row["sender_username"]).lower() == username.lower() else "received"
    } for row in rows]})

@app.get("/api/posts/<int:content_id>")
def get_post_by_id(content_id):
    viewer = getattr(g, "auth_username", None)
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM content WHERE id=? AND kind='posts'",
            (content_id,),
        ).fetchone()

        if row is None or not can_view_content(db, row["username"], viewer):
            return jsonify({"error": "Post not found"}), 404

        item = content_json(row, viewer, db)

    return jsonify({"ok": True, "item": item})


@app.get("/api/posts/<int:content_id>/comments")
def list_post_comments(content_id):
    viewer = getattr(g, "auth_username", None) or ""
    with get_db() as db:
        post = db.execute(
            "SELECT id, username FROM content WHERE id=? AND kind='posts'",
            (content_id,),
        ).fetchone()
        if post is None:
            return jsonify({"error": "Post not found"}), 404
        if not can_view_content(db, post["username"], viewer):
            return jsonify({"error": "Post not found"}), 404

        rows = db.execute("""
            SELECT id, username, text, created_at, parent_comment_id,
                   COALESCE(approved, 1) AS approved
            FROM post_comments
            WHERE content_id=?
              AND (
                  COALESCE(approved, 1)=1
                  OR LOWER(username)=LOWER(?)
                  OR LOWER(?)=LOWER(?)
              )
            ORDER BY id ASC
        """, (content_id, viewer, viewer, post["username"])).fetchall()

        return jsonify({
            "ok": True,
            "comments": [{
                "id": row["id"],
                "username": row["username"],
                "text": row["text"],
                "createdAt": row["created_at"],
                "parentCommentId": row["parent_comment_id"],
                "isPending": not bool(row["approved"]),
                "canApprove": bool(viewer) and viewer.lower() == post["username"].lower(),
            } for row in rows],
        })


@app.post("/api/posts/<int:content_id>/comments")
def create_post_comment(content_id):
    username = g.auth_username
    data = request.get_json(silent=True) or {}
    text = str(data.get("text", "")).strip()
    parent_comment_id = data.get("parent_comment_id")

    if not text:
        return jsonify({"error": "Comment cannot be empty"}), 400
    if len(text) > 2000:
        return jsonify({"error": "Comment is too long"}), 400

    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        post = db.execute(
            "SELECT id, username FROM content WHERE id=? AND kind='posts'",
            (content_id,),
        ).fetchone()
        if post is None:
            return jsonify({"error": "Post not found"}), 404
        if not can_view_content(db, post["username"], username):
            return jsonify({"error": "Post not found"}), 404
        if not _chat_preference(db, post["username"], "privacy.comments", True):
            return jsonify({"error": "This user is not accepting comments."}), 403

        restricted = db.execute("""
            SELECT 1 FROM people_restrictions
            WHERE LOWER(owner)=LOWER(?) AND LOWER(restricted)=LOWER(?)
        """, (post["username"], username)).fetchone()
        approved = 0 if restricted else 1

        if parent_comment_id not in (None, ""):
            parent = db.execute("SELECT id FROM post_comments WHERE id=? AND content_id=?", (parent_comment_id, content_id)).fetchone()
            if parent is None:
                return jsonify({"error": "Reply target comment not found."}), 404

        cursor = db.execute("""
            INSERT INTO post_comments
                (content_id, username, text, created_at, approved, parent_comment_id)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (content_id, username, text, now, approved, parent_comment_id or None))

        row = db.execute("""
            SELECT id, username, text, created_at, approved, parent_comment_id
            FROM post_comments WHERE id=?
        """, (cursor.lastrowid,)).fetchone()

        if approved:
            _people_notification(db, post["username"], username, "comment", content_id, now)

        return jsonify({
            "ok": True,
            "comment": {
                "id": row["id"],
                "username": row["username"],
                "text": row["text"],
                "createdAt": row["created_at"],
                "parentCommentId": row["parent_comment_id"],
                "isPending": not bool(row["approved"]),
                "canApprove": False,
            },
        }), 201

@app.post("/api/posts/<int:content_id>/comments/<int:comment_id>/approve")
def approve_post_comment(content_id, comment_id):
    owner = g.auth_username
    with get_db() as db:
        post = db.execute(
            "SELECT username FROM content WHERE id=? AND kind='posts'",
            (content_id,),
        ).fetchone()
        if post is None:
            return jsonify({"error": "Post not found"}), 404
        if post["username"].lower() != owner.lower():
            return jsonify({"error": "Only the post owner can approve comments."}), 403

        cursor = db.execute(
            "UPDATE post_comments SET approved=1 WHERE id=? AND content_id=?",
            (comment_id, content_id),
        )
        if cursor.rowcount == 0:
            return jsonify({"error": "Comment not found."}), 404

    return jsonify({"ok": True, "approved": True, "commentId": comment_id})


# SOCIALAPP_REELS_AND_SAVED_V1
@app.post("/api/reels/<int:content_id>/like")
def toggle_reel_like(content_id):
    username = g.auth_username
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        reel = db.execute(
            "SELECT id, username FROM content WHERE id=? AND kind='reels'",
            (content_id,)
        ).fetchone()
        if reel is None:
            return jsonify({"error": "Reel not found"}), 404
        if not can_view_content(db, reel["username"], username):
            return jsonify({"error": "Reel not found"}), 404

        existing = db.execute(
            "SELECT id FROM reel_likes WHERE content_id=? AND username=?",
            (content_id, username)
        ).fetchone()
        if existing:
            db.execute(
                "DELETE FROM reel_likes WHERE content_id=? AND username=?",
                (content_id, username)
            )
            liked = False
        else:
            db.execute(
                "INSERT INTO reel_likes (content_id, username, created_at) VALUES (?, ?, ?)",
                (content_id, username, now)
            )
            liked = True
            if liked:
                _people_notification(db, reel["username"], username, "reel_like", content_id, now)

        count = db.execute(
            "SELECT COUNT(*) AS total FROM reel_likes WHERE content_id=?",
            (content_id,)
        ).fetchone()["total"]
        return jsonify({"ok": True, "liked": liked, "likes": count})


@app.get("/api/reels/<int:content_id>/comments")
def list_reel_comments(content_id):
    viewer = getattr(g, "auth_username", None) or ""
    with get_db() as db:
        reel = db.execute(
            "SELECT id, username FROM content WHERE id=? AND kind='reels'",
            (content_id,),
        ).fetchone()
        if reel is None:
            return jsonify({"error": "Reel not found"}), 404
        if not can_view_content(db, reel["username"], viewer):
            return jsonify({"error": "Reel not found"}), 404

        rows = db.execute("""
            SELECT id, username, text, created_at, parent_comment_id,
                   COALESCE(approved, 1) AS approved
            FROM reel_comments
            WHERE content_id=?
              AND (
                  COALESCE(approved, 1)=1
                  OR LOWER(username)=LOWER(?)
                  OR LOWER(?)=LOWER(?)
              )
            ORDER BY id ASC
        """, (content_id, viewer, viewer, reel["username"])).fetchall()

        return jsonify({
            "ok": True,
            "comments": [{
                "id": row["id"],
                "username": row["username"],
                "text": row["text"],
                "createdAt": row["created_at"],
                "parentCommentId": row["parent_comment_id"],
                "isPending": not bool(row["approved"]),
                "canApprove": bool(viewer) and viewer.lower() == reel["username"].lower(),
            } for row in rows],
        })


@app.post("/api/reels/<int:content_id>/comments")
def create_reel_comment(content_id):
    username = g.auth_username
    data = request.get_json(silent=True) or {}
    text = str(data.get("text", "")).strip()
    parent_comment_id = data.get("parent_comment_id")

    if not text:
        return jsonify({"error": "Comment cannot be empty"}), 400
    if len(text) > 2000:
        return jsonify({"error": "Comment is too long"}), 400

    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        reel = db.execute(
            "SELECT id, username FROM content WHERE id=? AND kind='reels'",
            (content_id,),
        ).fetchone()
        if reel is None:
            return jsonify({"error": "Reel not found"}), 404
        if not can_view_content(db, reel["username"], username):
            return jsonify({"error": "Reel not found"}), 404
        if not _chat_preference(db, reel["username"], "privacy.comments", True):
            return jsonify({"error": "This user is not accepting comments."}), 403

        restricted = db.execute("""
            SELECT 1 FROM people_restrictions
            WHERE LOWER(owner)=LOWER(?) AND LOWER(restricted)=LOWER(?)
        """, (reel["username"], username)).fetchone()
        approved = 0 if restricted else 1

        if parent_comment_id not in (None, ""):
            parent = db.execute("SELECT id FROM reel_comments WHERE id=? AND content_id=?", (parent_comment_id, content_id)).fetchone()
            if parent is None:
                return jsonify({"error": "Reply target comment not found."}), 404

        cursor = db.execute("""
            INSERT INTO reel_comments
                (content_id, username, text, created_at, approved, parent_comment_id)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (content_id, username, text, now, approved, parent_comment_id or None))

        row = db.execute("""
            SELECT id, username, text, created_at, approved, parent_comment_id
            FROM reel_comments WHERE id=?
        """, (cursor.lastrowid,)).fetchone()

        if approved:
            _people_notification(db, reel["username"], username, "reel_comment", content_id, now)

        comments_count = db.execute(
            "SELECT COUNT(*) AS total FROM reel_comments WHERE content_id=? AND approved=1",
            (content_id,),
        ).fetchone()["total"]

        return jsonify({
            "ok": True,
            "comment": {
                "id": row["id"],
                "username": row["username"],
                "text": row["text"],
                "createdAt": row["created_at"],
                "parentCommentId": row["parent_comment_id"],
                "isPending": not bool(row["approved"]),
                "canApprove": False,
            },
            "commentsCount": int(comments_count or 0),
        }), 201

@app.post("/api/reels/<int:content_id>/comments/<int:comment_id>/approve")
def approve_reel_comment(content_id, comment_id):
    owner = g.auth_username
    with get_db() as db:
        reel = db.execute(
            "SELECT username FROM content WHERE id=? AND kind='reels'",
            (content_id,),
        ).fetchone()
        if reel is None:
            return jsonify({"error": "Reel not found"}), 404
        if reel["username"].lower() != owner.lower():
            return jsonify({"error": "Only the reel owner can approve comments."}), 403

        cursor = db.execute(
            "UPDATE reel_comments SET approved=1 WHERE id=? AND content_id=?",
            (comment_id, content_id),
        )
        if cursor.rowcount == 0:
            return jsonify({"error": "Comment not found."}), 404

        comments_count = db.execute(
            "SELECT COUNT(*) AS total FROM reel_comments WHERE content_id=? AND approved=1",
            (content_id,),
        ).fetchone()["total"]

    return jsonify({
        "ok": True,
        "approved": True,
        "commentId": comment_id,
        "commentsCount": int(comments_count or 0),
    })


@app.get("/api/saved")
def list_saved_content():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401

    with get_db() as db:
        rows = db.execute(
            """SELECT c.*
               FROM saved_content s
               JOIN content c ON c.id=s.content_id AND c.kind=s.kind
               WHERE s.username=? AND s.kind IN ('posts', 'reels')
               ORDER BY s.created_at DESC""",
            (username,)
        ).fetchall()
        rows = [row for row in rows if can_view_content(db, row["username"], username)]

        items = [content_json(row, username, db) for row in rows]
        return jsonify({"ok": True, "items": items})


@app.post("/api/content/<kind>/<int:content_id>/save")
def save_content_item(kind, content_id):
    username = g.auth_username
    if kind not in ("posts", "reels"):
        return jsonify({"error": "Only posts and reels can be saved"}), 400

    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        item = db.execute(
            "SELECT id, username FROM content WHERE id=? AND kind=?",
            (content_id, kind)
        ).fetchone()
        if item is None or not can_view_content(db, item["username"], username):
            return jsonify({"error": "Content not found"}), 404

        existing = db.execute(
            """SELECT id FROM saved_content
               WHERE username=? AND content_id=? AND kind=?""",
            (username, content_id, kind)
        ).fetchone()
        if existing:
            db.execute(
                "DELETE FROM saved_content WHERE username=? AND content_id=? AND kind=?",
                (username, content_id, kind)
            )
            saved = False
        else:
            db.execute(
                """INSERT INTO saved_content (username, content_id, kind, created_at)
                   VALUES (?, ?, ?, ?)""",
                (username, content_id, kind, now)
            )
            saved = True

        return jsonify({"ok": True, "saved": saved})


@app.delete("/api/content/<kind>/<int:content_id>/save")
def remove_saved_content_item(kind, content_id):
    username = g.auth_username
    if kind not in ("posts", "reels"):
        return jsonify({"error": "Only posts and reels can be removed from Saved"}), 400

    with get_db() as db:
        db.execute(
            "DELETE FROM saved_content WHERE username=? AND content_id=? AND kind=?",
            (username, content_id, kind)
        )
    return jsonify({"ok": True, "saved": False})


# SOCIALAPP_AUTH_FOUNDATION_V1
import secrets
import hashlib
import hmac
from functools import wraps
from flask import g
from werkzeug.security import generate_password_hash, check_password_hash

def init_auth_tables():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                phone_number TEXT
            )
        """)

        columns = {
            row["name"] for row in db.execute("PRAGMA table_info(users)")
        }
        if "phone_number" not in columns:
            db.execute("ALTER TABLE users ADD COLUMN phone_number TEXT")
        if "email" not in columns:
            db.execute("ALTER TABLE users ADD COLUMN email TEXT")

        db.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
            ON users(email COLLATE NOCASE)
            WHERE email IS NOT NULL AND email != ''
        """)

        db.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower
            ON users(LOWER(username))
        """)

        db.execute("""
            CREATE TABLE IF NOT EXISTS auth_sessions (
                token_hash TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
        """)

        session_columns = {row["name"] for row in db.execute("PRAGMA table_info(auth_sessions)").fetchall()}
        if "device_label" not in session_columns:
            db.execute("ALTER TABLE auth_sessions ADD COLUMN device_label TEXT NOT NULL DEFAULT 'Unknown device'")
        if "last_seen_at" not in session_columns:
            db.execute("ALTER TABLE auth_sessions ADD COLUMN last_seen_at TEXT")

        db.execute("""
            CREATE TABLE IF NOT EXISTS auth_login_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token_hash TEXT NOT NULL,
                username TEXT NOT NULL,
                created_at TEXT NOT NULL,
                device_label TEXT NOT NULL DEFAULT 'Unknown device'
            )
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_auth_login_history_user_time
            ON auth_login_history(username, created_at DESC)
        """)

        db.execute("""
            CREATE TABLE IF NOT EXISTS location_shares (
                share_id TEXT PRIMARY KEY,
                owner_username TEXT NOT NULL,
                recipient_username TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                accuracy REAL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                active INTEGER NOT NULL DEFAULT 1
            )
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_location_shares_recipient_active
            ON location_shares(recipient_username, active, expires_at)
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_location_shares_owner_active
            ON location_shares(owner_username, active, expires_at)
        """)

        db.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_otps (
                email TEXT PRIMARY KEY COLLATE NOCASE,
                otp_hash TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                last_sent_at TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                reset_token_hash TEXT,
                reset_expires_at TEXT
            )
        """)

        db.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_email_lower
            ON password_reset_otps(LOWER(email))
        """)


def _auth_user():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    token = header[7:].strip()
    if len(token) < 32:
        return None
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        row = db.execute("""
            SELECT s.username FROM auth_sessions s
            JOIN users u ON u.username=s.username
            WHERE s.token_hash=? AND s.expires_at>?
        """, (digest, now)).fetchone()
        if row:
            stale_before = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
            db.execute(
                "UPDATE auth_sessions SET last_seen_at=? WHERE token_hash=? AND (last_seen_at IS NULL OR last_seen_at<?)",
                (now, digest, stale_before),
            )
    return row["username"] if row else None

@app.before_request
def enforce_authenticated_mutations():
    if not request.path.startswith("/api/"):
        return None

    if request.method in ("GET", "HEAD", "OPTIONS"):
        username = _auth_user()
        if username:
            g.auth_username = username
        return None

    if request.path in (
        "/api/auth/register",
        "/api/auth/login",
        "/api/auth/forgot-password/request",
        "/api/auth/forgot-password/verify",
        "/api/auth/forgot-password/reset",
    ):
        return None

    username = _auth_user()
    if not username:
        return jsonify({"error": "Please log in first."}), 401

    g.auth_username = username

    supplied = request.form.get("username")
    if supplied and supplied.strip().lstrip("@").lower() != username.lower():
        return jsonify({"error": "You must post from the logged-in account."}), 403

    if request.path.startswith("/api/profile/"):
        parts = request.path.strip("/").split("/")
        target = parts[2].strip().lstrip("@") if len(parts) >= 3 else ""
        action = parts[3] if len(parts) >= 4 else ""

        social_actions = {
            ("POST", "follow"),
            ("DELETE", "follow"),
            ("POST", "restrict"),
            ("DELETE", "restrict"),
        }
        is_social_action = (request.method, action) in social_actions

        if target and target.lower() != username.lower() and not is_social_action:
            app.logger.warning(
                "PROFILE_PERMISSION_BLOCK method=%s path=%s actor=%s target=%s",
                request.method, request.path, username, target
            )
            return jsonify({
                "error": "Changes to another account are not allowed. "
                         f"[{request.method} {request.path}]"
            }), 403

        data = request.get_json(silent=True) or {}
        supplied_json = data.get("username") or data.get("viewer")
        if supplied_json and str(supplied_json).strip().lstrip("@").lower() != username.lower():
            return jsonify({"error": "You must perform this action from the logged-in account."}), 403

    return None

@app.post("/api/auth/register")
def auth_register():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    phone_number = str(data.get("phone_number", "")).strip()
    phone_digits = "".join(ch for ch in phone_number if ch.isdigit())

    if email and ("@" not in email or "." not in email.rsplit("@", 1)[-1] or len(email) > 254):
        return jsonify({"error": "Enter a valid email address or leave it blank."}), 400
    if phone_number and (len(phone_digits) < 10 or len(phone_digits) > 15):
        return jsonify({"error": "Enter a valid mobile number or leave it blank."}), 400
    email = email or None
    phone_number = phone_number or None
    if len(password) < 4 or len(password) > 24:
        return jsonify({"error": "Password must be between 4 and 24 characters."}), 400

    username = str(data.get("username", "")).strip().lstrip("@")
    full_name = str(data.get("full_name", "")).strip()

    if not (3 <= len(username) <= 50) or any(
        not (ch.isascii() and (ch.isalnum() or ch in "_."))
        for ch in username
    ):
        return jsonify({"error": "Username must be 3 to 50 letters, numbers, dots, or underscores."}), 400
    if not full_name or len(full_name) > 60:
        return jsonify({"error": "Full name is required and must be at most 60 characters."}), 400

    now = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(32)
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    expires = "9999-12-31T23:59:59+00:00"

    try:
        with get_db() as db:
            if db.execute(
                "SELECT 1 FROM users WHERE username=? COLLATE NOCASE", (username,)
            ).fetchone():
                return jsonify({"error": "This username is already in use."}), 409

            db.execute(
                "INSERT INTO users(username,password_hash,created_at,phone_number,email) VALUES(?,?,?,?,?)",
                (username, generate_password_hash(password), now.isoformat(), phone_number, email)
            )
            device_label = str(request.headers.get("X-Device-Name") or request.headers.get("User-Agent") or "Unknown device").strip()[:180]
            db.execute(
                "INSERT INTO auth_sessions(token_hash,username,created_at,expires_at,device_label,last_seen_at) VALUES(?,?,?,?,?,?)",
                (digest, username, now.isoformat(), expires, device_label, now.isoformat())
            )
            db.execute("DELETE FROM auth_login_history WHERE created_at<?", ((now - timedelta(days=90)).isoformat(),))
            db.execute(
                "INSERT INTO auth_login_history(token_hash,username,created_at,device_label) VALUES(?,?,?,?)",
                (digest, username, now.isoformat(), device_label)
            )
            profile_json(db, username)
            db.execute(
                "UPDATE profiles SET display_name=? WHERE username=?",
                (full_name, username)
            )
            db.execute(
                "INSERT OR IGNORE INTO user_settings(username,updated_at) VALUES(?,?)",
                (username, now.isoformat())
            )
    except sqlite3.IntegrityError:
        return jsonify({"error": "This email is already associated with an account."}), 409

    return jsonify({"ok": True, "username": username, "token": token}), 201

@app.get("/api/account/settings")
def load_account_settings():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        row = db.execute(
            "SELECT email, phone_number FROM users WHERE username=? COLLATE NOCASE",
            (username,),
        ).fetchone()
    if not row:
        return jsonify({"error": "Account not found."}), 404
    return jsonify({"email": row["email"] or "", "phone_number": row["phone_number"] or ""})


@app.patch("/api/account/settings")
def save_account_settings():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    phone_number = str(data.get("phone_number", "")).strip()
    phone_digits = "".join(ch for ch in phone_number if ch.isdigit())
    if email and ("@" not in email or "." not in email.rsplit("@", 1)[-1] or len(email) > 254):
        return jsonify({"error": "Enter a valid email address or leave it blank."}), 400
    if phone_number and not 10 <= len(phone_digits) <= 15:
        return jsonify({"error": "Enter a valid mobile number or leave it blank."}), 400
    try:
        with get_db() as db:
            db.execute(
                "UPDATE users SET email=?, phone_number=? WHERE username=? COLLATE NOCASE",
                (email or None, phone_number or None, username),
            )
    except sqlite3.IntegrityError:
        return jsonify({"error": "This email address is already used by another account."}), 409
    return jsonify({"ok": True, "email": email, "phone_number": phone_number})


@app.get("/api/settings/notifications")
def load_notification_preference():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS notification_preferences (
                username TEXT PRIMARY KEY,
                enabled INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL
            )
        """)
        now = datetime.now(timezone.utc).isoformat()
        db.execute(
            "INSERT OR IGNORE INTO notification_preferences(username, enabled, updated_at) VALUES(?, 1, ?)",
            (username, now),
        )
        row = db.execute(
            "SELECT enabled FROM notification_preferences WHERE username=?",
            (username,),
        ).fetchone()
    return jsonify({"enabled": bool(row["enabled"])})


@app.patch("/api/settings/notifications")
def save_notification_preference():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    data = request.get_json(silent=True) or {}
    enabled = data.get("enabled")
    if not isinstance(enabled, bool):
        return jsonify({"error": "enabled must be true or false."}), 400
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS notification_preferences (
                username TEXT PRIMARY KEY,
                enabled INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL
            )
        """)
        db.execute("""
            INSERT INTO notification_preferences(username, enabled, updated_at)
            VALUES(?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                enabled=excluded.enabled, updated_at=excluded.updated_at
        """, (username, int(enabled), now))
    return jsonify({"ok": True, "enabled": enabled})



@app.get("/api/settings/notifications/details")
def load_notification_details():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401

    defaults = {
        "likes": 1, "comments": 1, "follows": 1, "requests": 1,
        "messages": 1, "reels": 1, "system_alerts": 1,
    }
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS notification_detail_preferences (
                username TEXT PRIMARY KEY,
                likes INTEGER NOT NULL DEFAULT 1,
                comments INTEGER NOT NULL DEFAULT 1,
                follows INTEGER NOT NULL DEFAULT 1,
                requests INTEGER NOT NULL DEFAULT 1,
                messages INTEGER NOT NULL DEFAULT 1,
                reels INTEGER NOT NULL DEFAULT 1,
                system_alerts INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL
            )
        """)
        db.execute("""
            INSERT OR IGNORE INTO notification_detail_preferences
            (username, likes, comments, follows, messages, system_alerts, updated_at)
            VALUES (?, 1, 1, 1, 1, 1, ?)
        """, (username, datetime.now(timezone.utc).isoformat()))
        row = db.execute("""
            SELECT likes, comments, follows, requests, messages, reels, system_alerts
            FROM notification_detail_preferences WHERE username=?
        """, (username,)).fetchone()

    return jsonify({key: bool(row[key]) for key in defaults})


@app.patch("/api/settings/notifications/details")
def save_notification_details():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401

    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not data:
        return jsonify({"error": "Provide notification preferences to update."}), 400

    allowed = {"likes", "comments", "follows", "requests", "messages", "reels", "system_alerts"}
    if any(key not in allowed or not isinstance(value, bool)
           for key, value in data.items()):
        return jsonify({"error": "Use valid notification keys with true or false values."}), 400

    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS notification_detail_preferences (
                username TEXT PRIMARY KEY,
                likes INTEGER NOT NULL DEFAULT 1,
                comments INTEGER NOT NULL DEFAULT 1,
                follows INTEGER NOT NULL DEFAULT 1,
                requests INTEGER NOT NULL DEFAULT 1,
                messages INTEGER NOT NULL DEFAULT 1,
                reels INTEGER NOT NULL DEFAULT 1,
                system_alerts INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL
            )
        """)
        db.execute("""
            INSERT OR IGNORE INTO notification_detail_preferences
            (username, likes, comments, follows, messages, system_alerts, updated_at)
            VALUES (?, 1, 1, 1, 1, 1, ?)
        """, (username, now))
        for key, value in data.items():
            db.execute(
                f"UPDATE notification_detail_preferences SET {key}=?, updated_at=? WHERE username=?",
                (int(value), now, username),
            )
        row = db.execute("""
            SELECT likes, comments, follows, requests, messages, reels, system_alerts
            FROM notification_detail_preferences WHERE username=?
        """, (username,)).fetchone()

    return jsonify({"ok": True, **{key: bool(row[key]) for key in allowed}})


@app.post("/api/auth/login")
def auth_login():
    data = request.get_json(silent=True) or {}
    identifier = str(data.get("username", data.get("email", ""))).strip().lstrip("@")
    password = str(data.get("password", ""))

    with get_db() as db:
        row = db.execute(
            "SELECT username,password_hash FROM users WHERE username=? COLLATE NOCASE OR email=? COLLATE NOCASE",
            (identifier, identifier)
        ).fetchone()
        if not row or not check_password_hash(row["password_hash"], password):
            return jsonify({"error": "Email/username or password is incorrect."}), 401

        now = datetime.now(timezone.utc)
        token = secrets.token_urlsafe(32)
        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        expires = "9999-12-31T23:59:59+00:00"
        device_label = str(request.headers.get("X-Device-Name") or request.headers.get("User-Agent") or "Unknown device").strip()[:180]
        db.execute(
            "INSERT INTO auth_sessions(token_hash,username,created_at,expires_at,device_label,last_seen_at) VALUES(?,?,?,?,?,?)",
            (digest, row["username"], now.isoformat(), expires, device_label, now.isoformat())
        )
        db.execute("DELETE FROM auth_login_history WHERE created_at<?", ((now - timedelta(days=90)).isoformat(),))
        db.execute(
            "INSERT INTO auth_login_history(token_hash,username,created_at,device_label) VALUES(?,?,?,?)",
            (digest, row["username"], now.isoformat(), device_label)
        )

    return jsonify({"ok": True, "username": row["username"], "token": token})

@app.get("/api/auth/me")
def auth_me():
    username = _auth_user()
    if not username:
        return jsonify({"error": "Login is required."}), 401
    return jsonify({"ok": True, "username": username})

@app.post("/api/auth/logout")
def auth_logout():
    header = request.headers.get("Authorization", "")
    token = header[7:].strip() if header.startswith("Bearer ") else ""
    if token:
        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with get_db() as db:
            db.execute("DELETE FROM auth_sessions WHERE token_hash=?", (digest,))
    return jsonify({"ok": True})



@app.get("/api/auth/login-history")
def auth_login_history():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Login is required."}), 401
    try:
        limit = max(1, min(int(request.args.get("limit", 30)), 100))
    except (TypeError, ValueError):
        limit = 30
    with get_db() as db:
        history_cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        db.execute("DELETE FROM auth_login_history WHERE created_at<?", (history_cutoff,))
        rows = db.execute("""
            SELECT h.id, h.created_at, h.device_label,
                   CASE WHEN s.token_hash IS NULL THEN 0 ELSE 1 END AS session_active,
                   CASE WHEN h.token_hash=? THEN 1 ELSE 0 END AS is_current
            FROM auth_login_history h
            LEFT JOIN auth_sessions s ON s.token_hash=h.token_hash AND s.expires_at>?
            WHERE h.username=?
            ORDER BY h.created_at DESC LIMIT ?
        """, (
            hashlib.sha256(request.headers.get("Authorization", "")[7:].strip().encode("utf-8")).hexdigest(),
            datetime.now(timezone.utc).isoformat(), username, limit
        )).fetchall()
    return jsonify({"ok": True, "items": [dict(row) for row in rows]})


@app.get("/api/auth/sessions")
def auth_list_sessions():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Login is required."}), 401
    header = request.headers.get("Authorization", "")
    token = header[7:].strip() if header.startswith("Bearer ") else ""
    current_digest = hashlib.sha256(token.encode("utf-8")).hexdigest() if token else ""
    with get_db() as db:
        rows = db.execute("""
            SELECT token_hash, created_at, COALESCE(device_label, 'Unknown device') AS device_label,
                   last_seen_at
            FROM auth_sessions
            WHERE username=? AND expires_at>?
            ORDER BY COALESCE(last_seen_at, created_at) DESC
        """, (username, datetime.now(timezone.utc).isoformat())).fetchall()
    return jsonify({"ok": True, "items": [
        {"id": hashlib.sha256(row["token_hash"].encode("utf-8")).hexdigest()[:16],
         "created_at": row["created_at"], "device_label": row["device_label"],
         "last_seen_at": row["last_seen_at"], "is_current": row["token_hash"] == current_digest}
        for row in rows
    ]})


@app.delete("/api/auth/sessions/<session_id>")
def auth_revoke_session(session_id):
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Login is required."}), 401
    header = request.headers.get("Authorization", "")
    token = header[7:].strip() if header.startswith("Bearer ") else ""
    current_digest = hashlib.sha256(token.encode("utf-8")).hexdigest() if token else ""
    with get_db() as db:
        rows = db.execute("SELECT token_hash FROM auth_sessions WHERE username=?", (username,)).fetchall()
        target = next((row["token_hash"] for row in rows if hashlib.sha256(row["token_hash"].encode("utf-8")).hexdigest()[:16] == session_id), None)
        if not target:
            return jsonify({"error": "Session not found."}), 404
        if target == current_digest:
            return jsonify({"error": "Use Sign Out to end the current session."}), 400
        db.execute("DELETE FROM auth_sessions WHERE token_hash=? AND username=?", (target, username))
    return jsonify({"ok": True})


@app.get("/api/location/shares")
def list_location_shares():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Login is required."}), 401
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        db.execute("UPDATE location_shares SET active=0 WHERE expires_at<=?", (now,))
        outgoing = db.execute("""
            SELECT share_id, recipient_username, latitude, longitude, accuracy,
                   created_at, updated_at, expires_at
            FROM location_shares WHERE owner_username=? AND active=1
            ORDER BY updated_at DESC
        """, (username,)).fetchall()
        incoming = db.execute("""
            SELECT share_id, owner_username, latitude, longitude, accuracy,
                   created_at, updated_at, expires_at
            FROM location_shares WHERE recipient_username=? AND active=1
            ORDER BY updated_at DESC
        """, (username,)).fetchall()
        history_since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        db.execute("DELETE FROM location_shares WHERE created_at<?", (history_since,))
        history = db.execute("""
            SELECT share_id, owner_username, recipient_username, latitude, longitude,
                   accuracy, created_at, updated_at, expires_at, active
            FROM location_shares
            WHERE (owner_username=? COLLATE NOCASE OR recipient_username=? COLLATE NOCASE)
              AND created_at>=?
            ORDER BY created_at DESC LIMIT 50
        """, (username, username, history_since)).fetchall()
    return jsonify({"ok": True, "outgoing": [dict(row) for row in outgoing], "incoming": [dict(row) for row in incoming], "history": [dict(row) for row in history]})


@app.post("/api/location/shares")
def create_or_update_location_share():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Login is required."}), 401
    data = request.get_json(silent=True) or {}
    recipient = str(data.get("recipient_username") or "").strip().lstrip("@")
    try:
        latitude = float(data.get("latitude"))
        longitude = float(data.get("longitude"))
        accuracy = float(data.get("accuracy")) if data.get("accuracy") is not None else None
        duration = int(data.get("duration_minutes", 60))
    except (TypeError, ValueError):
        return jsonify({"error": "Valid location coordinates and duration are required."}), 400
    if not recipient or recipient.lower() == username.lower():
        return jsonify({"error": "Choose another account to share your location with."}), 400
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return jsonify({"error": "Location coordinates are invalid."}), 400
    if accuracy is not None and not (0 <= accuracy <= 100000):
        return jsonify({"error": "Location accuracy is invalid."}), 400
    if duration not in (15, 60, 240, 1440):
        return jsonify({"error": "Choose a supported sharing duration."}), 400
    now = datetime.now(timezone.utc)
    expires = (now + timedelta(minutes=duration)).isoformat()
    with get_db() as db:
        db.execute("DELETE FROM location_shares WHERE created_at<?", ((now - timedelta(days=30)).isoformat(),))
        friend = db.execute("""
            SELECT 1 FROM follows a JOIN follows b
              ON a.follower=b.following AND a.following=b.follower
            WHERE a.follower=? COLLATE NOCASE AND a.following=? COLLATE NOCASE
        """, (username, recipient)).fetchone()
        if not friend:
            return jsonify({"error": "Live location can only be shared with mutual followers."}), 403
        target = db.execute("SELECT username FROM users WHERE username=? COLLATE NOCASE", (recipient,)).fetchone()
        if not target:
            return jsonify({"error": "Account not found."}), 404
        recipient = target["username"]
        share_id = str(data.get("share_id") or "").strip()
        if share_id:
            existing = db.execute("SELECT share_id FROM location_shares WHERE share_id=? AND owner_username=? AND recipient_username=? AND active=1 AND expires_at>?", (share_id, username, recipient, now.isoformat())).fetchone()
            if not existing:
                return jsonify({"error": "Active location share not found."}), 404
        else:
            share_id = secrets.token_urlsafe(18)
            db.execute("""
                INSERT INTO location_shares(share_id, owner_username, recipient_username, latitude, longitude, accuracy, created_at, updated_at, expires_at, active)
                VALUES(?,?,?,?,?,?,?,?,?,1)
            """, (share_id, username, recipient, latitude, longitude, accuracy, now.isoformat(), now.isoformat(), expires))
        db.execute("""
            UPDATE location_shares
            SET latitude=?, longitude=?, accuracy=?, updated_at=?, expires_at=?, active=1
            WHERE share_id=? AND owner_username=?
        """, (latitude, longitude, accuracy, now.isoformat(), expires, share_id, username))
    return jsonify({"ok": True, "share_id": share_id, "recipient_username": recipient, "expires_at": expires})


@app.delete("/api/location/shares/<share_id>")
def stop_location_share(share_id):
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Login is required."}), 401
    with get_db() as db:
        cursor = db.execute("""
            UPDATE location_shares SET active=0
            WHERE share_id=? AND (owner_username=? COLLATE NOCASE OR recipient_username=? COLLATE NOCASE)
        """, (share_id, username, username))
        if cursor.rowcount == 0:
            return jsonify({"error": "Location share not found."}), 404
    return jsonify({"ok": True})


@app.post("/api/auth/logout-other-sessions")
def auth_logout_other_sessions():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in again."}), 401

    header = request.headers.get("Authorization", "")
    token = header[7:].strip() if header.startswith("Bearer ") else ""
    if not token:
        return jsonify({"error": "Current session token is missing."}), 401

    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with get_db() as db:
        db.execute(
            "DELETE FROM auth_sessions WHERE username=? AND token_hash!=?",
            (username, digest),
        )
    return jsonify({"ok": True, "message": "Other sessions signed out."})


@app.post("/api/auth/change-password")
def auth_change_password():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in again."}), 401

    data = request.get_json(silent=True) or {}
    old_password = str(data.get("old_password", ""))
    new_password = str(data.get("new_password", ""))
    confirm_password = str(data.get("confirm_password", ""))

    if not old_password or not new_password or not confirm_password:
        return jsonify({"error": "All password fields are required."}), 400
    if new_password != confirm_password:
        return jsonify({"error": "New password and confirmation do not match."}), 400
    if len(new_password) < 4 or len(new_password) > 24:
        return jsonify({"error": "New password must be 4 to 24 characters."}), 400
    if new_password == old_password:
        return jsonify({"error": "Choose a password different from the old password."}), 400

    with get_db() as db:
        row = db.execute(
            "SELECT password_hash FROM users WHERE username=?",
            (username,)
        ).fetchone()

        if not row or not check_password_hash(row["password_hash"], old_password):
            return jsonify({"error": "Old password is incorrect."}), 401

        db.execute(
            "UPDATE users SET password_hash=? WHERE username=?",
            (generate_password_hash(new_password), username)
        )

        header = request.headers.get("Authorization", "")
        token = header[7:].strip() if header.startswith("Bearer ") else ""
        current_digest = hashlib.sha256(token.encode("utf-8")).hexdigest() if token else ""
        db.execute(
            "DELETE FROM auth_sessions WHERE username=? AND token_hash!=?",
            (username, current_digest)
        )

    return jsonify({"ok": True, "message": "Password changed successfully."})




def _send_password_reset_email(email, otp):
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    sender = os.environ.get("RESEND_FROM_EMAIL", "").strip()
    if not api_key or not sender:
        raise RuntimeError("Email provider is not configured.")

    payload = {
        "from": sender,
        "to": [email],
        "subject": "Your SocialApp password reset code",
        "text": (
            f"Your SocialApp password reset code is {otp}.\n\n"
            "This code expires in 10 minutes. If you did not request this, "
            "you can ignore this email."
        ),
    }
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        if response.status < 200 or response.status >= 300:
            raise RuntimeError("Email provider rejected the request.")


@app.post("/api/auth/forgot-password/request")
def auth_forgot_password_request():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    if len(email) > 254 or "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        return jsonify({"error": "Enter a valid email address."}), 400

    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    sender = os.environ.get("RESEND_FROM_EMAIL", "").strip()
    if not api_key or not sender:
        return jsonify({"error": "Password recovery email is not configured on the server yet."}), 503

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    with get_db() as db:
        user = db.execute(
            "SELECT username FROM users WHERE email=? COLLATE NOCASE", (email,)
        ).fetchone()
        if not user:
            return jsonify({
                "ok": True,
                "message": "If an account uses that email, a reset code will be sent."
            }), 200

        previous = db.execute(
            "SELECT last_sent_at FROM password_reset_otps WHERE email=? COLLATE NOCASE",
            (email,),
        ).fetchone()
        if previous:
            try:
                last_sent = datetime.fromisoformat(previous["last_sent_at"])
                if (now - last_sent).total_seconds() < 60:
                    return jsonify({
                        "ok": True,
                        "message": "If an account uses that email, a reset code will be sent."
                    }), 200
            except (TypeError, ValueError):
                pass

    otp = f"{secrets.randbelow(1000000):06d}"
    otp_hash = hmac.new(
        api_key.encode("utf-8"),
        f"{email}:{otp}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    expires = (now + timedelta(minutes=10)).isoformat()

    try:
        _send_password_reset_email(email, otp)
    except (urllib.error.URLError, TimeoutError, RuntimeError, ValueError):
        app.logger.warning("Password reset email delivery failed.")
        return jsonify({"error": "Could not send the reset email. Check the server email configuration."}), 503

    with get_db() as db:
        db.execute("""
            INSERT INTO password_reset_otps
                (email, otp_hash, expires_at, last_sent_at, attempts, reset_token_hash, reset_expires_at)
            VALUES (?, ?, ?, ?, 0, NULL, NULL)
            ON CONFLICT(email) DO UPDATE SET
                otp_hash=excluded.otp_hash,
                expires_at=excluded.expires_at,
                last_sent_at=excluded.last_sent_at,
                attempts=0,
                reset_token_hash=NULL,
                reset_expires_at=NULL
        """, (email, otp_hash, expires, now_iso))

    return jsonify({
        "ok": True,
        "message": "If an account uses that email, a reset code will be sent."
    }), 200


@app.post("/api/auth/forgot-password/verify")
def auth_forgot_password_verify():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    otp = str(data.get("otp", "")).strip()
    api_key = os.environ.get("RESEND_API_KEY", "").strip()

    if not api_key:
        return jsonify({"error": "Password recovery email is not configured on the server yet."}), 503
    if not email or not re.fullmatch(r"[0-9]{6}", otp):
        return jsonify({"error": "Enter the email address and 6-digit code."}), 400

    now = datetime.now(timezone.utc)
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM password_reset_otps WHERE email=? COLLATE NOCASE", (email,)
        ).fetchone()
        if not row:
            return jsonify({"error": "The code is invalid or expired."}), 400
        if row["attempts"] >= 5:
            return jsonify({"error": "Too many attempts. Request a new code."}), 429
        try:
            expired = datetime.fromisoformat(row["expires_at"]) <= now
        except (TypeError, ValueError):
            expired = True
        if expired:
            return jsonify({"error": "The code is invalid or expired. Request a new code."}), 400

        submitted_hash = hmac.new(
            api_key.encode("utf-8"),
            f"{email}:{otp}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(submitted_hash, row["otp_hash"]):
            db.execute(
                "UPDATE password_reset_otps SET attempts=attempts+1 WHERE email=? COLLATE NOCASE",
                (email,),
            )
            return jsonify({"error": "The code is invalid or expired."}), 400

        reset_token = secrets.token_urlsafe(32)
        reset_digest = hashlib.sha256(reset_token.encode("utf-8")).hexdigest()
        reset_expires = (now + timedelta(minutes=10)).isoformat()
        db.execute("""
            UPDATE password_reset_otps
            SET reset_token_hash=?, reset_expires_at=?
            WHERE email=? COLLATE NOCASE
        """, (reset_digest, reset_expires, email))

    return jsonify({"ok": True, "reset_token": reset_token}), 200


@app.post("/api/auth/forgot-password/reset")
def auth_forgot_password_reset():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    reset_token = str(data.get("reset_token", ""))
    new_password = str(data.get("new_password", ""))
    confirm_password = str(data.get("confirm_password", ""))

    if not email or not reset_token:
        return jsonify({"error": "Verify the email code first."}), 400
    if new_password != confirm_password:
        return jsonify({"error": "Passwords do not match."}), 400
    if len(new_password) < 4 or len(new_password) > 24:
        return jsonify({"error": "Password must be 4 to 24 characters long."}), 400

    reset_digest = hashlib.sha256(reset_token.encode("utf-8")).hexdigest()
    now = datetime.now(timezone.utc)
    with get_db() as db:
        row = db.execute(
            "SELECT reset_token_hash, reset_expires_at FROM password_reset_otps WHERE email=? COLLATE NOCASE",
            (email,),
        ).fetchone()
        if not row or not row["reset_token_hash"] or not hmac.compare_digest(
            reset_digest, row["reset_token_hash"]
        ):
            return jsonify({"error": "The reset session is invalid. Verify the code again."}), 400
        try:
            if not row["reset_expires_at"] or datetime.fromisoformat(row["reset_expires_at"]) <= now:
                return jsonify({"error": "The reset session expired. Verify the code again."}), 400
        except (TypeError, ValueError):
            return jsonify({"error": "The reset session expired. Verify the code again."}), 400

        user = db.execute(
            "SELECT username FROM users WHERE email=? COLLATE NOCASE", (email,)
        ).fetchone()
        if not user:
            return jsonify({"error": "The account could not be found."}), 400

        db.execute(
            "UPDATE users SET password_hash=? WHERE username=?",
            (generate_password_hash(new_password), user["username"]),
        )
        db.execute(
            "DELETE FROM auth_sessions WHERE username=?", (user["username"],)
        )
        db.execute(
            "DELETE FROM password_reset_otps WHERE email=? COLLATE NOCASE", (email,)
        )

    return jsonify({"ok": True, "message": "Password reset successfully. Please log in again."}), 200




# SOCIALAPP_CHAT_PHOTO_UPLOAD_V1
@app.post("/api/messages/upload-photo")
def upload_chat_photo():
    current = _chat_current_user()
    if not current:
        return jsonify({"error": "Please log in to upload a chat photo."}), 401
    media = request.files.get("file")
    if media is None or not media.filename:
        return jsonify({"error": "Photo file is required."}), 400
    filename = secure_filename(media.filename)
    if "." not in filename:
        return jsonify({"error": "Photo file extension is missing."}), 400
    extension = filename.rsplit(".", 1)[1].lower()
    if extension not in {"jpg", "jpeg", "png", "webp", "gif"}:
        return jsonify({"error": "Only JPG, PNG, WEBP and GIF photos are allowed."}), 415
    folder = UPLOAD_DIR / "chat"
    folder.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}.{extension}"
    destination = folder / stored_name
    try:
        media.save(destination)
        size = destination.stat().st_size
        if size <= 0 or size > 100 * 1024 * 1024:
            destination.unlink(missing_ok=True)
            return jsonify({"error": "Chat photos must not exceed 100 MB."}), 413
        with get_db() as db:
            db.execute("""
                INSERT INTO chat_media (
                    image_url, uploader_username, created_at,
                    attachment_type, attachment_name, attachment_mime, attachment_size
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                f"/uploads/chat/{stored_name}", current,
                datetime.now(timezone.utc).isoformat(),
                "image", filename, media.mimetype or "image/jpeg", str(size),
            ))
        return jsonify({"ok": True, "imageUrl": f"/uploads/chat/{stored_name}"}), 201
    except Exception:
        destination.unlink(missing_ok=True)
        app.logger.exception("Could not save chat photo")
        return jsonify({"error": "Could not save chat photo."}), 500


# SOCIALAPP_CHAT_ATTACHMENT_UPLOAD_V1
@app.post("/api/messages/upload-attachment")
def upload_chat_attachment():
    current = _chat_current_user()
    if not current:
        return jsonify({"error": "Please log in to upload an attachment."}), 401

    media = request.files.get("file")
    if media is None or not media.filename:
        return jsonify({"error": "Choose a file first."}), 400

    filename = secure_filename(media.filename)
    if not filename or "." not in filename:
        return jsonify({"error": "File extension is missing."}), 400

    extension = filename.rsplit(".", 1)[1].lower()
    allowed = {
        "jpg": "image", "jpeg": "image", "png": "image", "webp": "image", "gif": "image",
        "mp4": "video", "mov": "video", "webm": "video", "m4v": "video",
        "mp3": "audio", "m4a": "audio", "aac": "audio", "wav": "audio",
        "ogg": "audio", "opus": "audio", "amr": "audio",
        "pdf": "file", "txt": "file", "doc": "file", "docx": "file",
        "xls": "file", "xlsx": "file", "ppt": "file", "pptx": "file",
        "csv": "file", "rtf": "file",
    }
    attachment_type = allowed.get(extension)
    if not attachment_type:
        return jsonify({"error": "This file type is not allowed in chat."}), 415

    size_limits = {
        "image": 100 * 1024 * 1024,
        "video": 1024 * 1024 * 1024,
        "audio": 500 * 1024 * 1024,
        "file": 500 * 1024 * 1024,
    }
    folder = UPLOAD_DIR / "chat"
    folder.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}.{extension}"
    destination = folder / stored_name
    media_url = f"/uploads/chat/{stored_name}"

    try:
        media.save(destination)
        size = destination.stat().st_size
        if size <= 0:
            destination.unlink(missing_ok=True)
            return jsonify({"error": "The selected file is empty."}), 400
        if size > size_limits[attachment_type]:
            destination.unlink(missing_ok=True)
            limit_mb = size_limits[attachment_type] // (1024 * 1024)
            return jsonify({"error": f"{attachment_type.title()} files must not exceed {limit_mb} MB."}), 413

        mime_type = (media.mimetype or "application/octet-stream").lower()
        remote_media_url = upload_media_file(str(destination), "chat", stored_name)
        if remote_media_url:
            destination.unlink(missing_ok=True)
        media_url = remote_media_url or f"/uploads/chat/{stored_name}"
        with get_db() as db:
            db.execute("""
                INSERT INTO chat_media (
                    image_url, uploader_username, created_at,
                    attachment_type, attachment_name, attachment_mime, attachment_size
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                media_url, current, datetime.now(timezone.utc).isoformat(),
                attachment_type, filename, mime_type, str(size),
            ))

        return jsonify({
            "ok": True,
            "attachmentUrl": media_url,
            "attachmentType": attachment_type,
            "attachmentName": filename,
            "mimeType": mime_type,
            "sizeBytes": size,
        }), 201
    except Exception:
        destination.unlink(missing_ok=True)
        app.logger.exception("Could not save chat attachment")
        return jsonify({"error": "Could not save chat attachment."}), 500


# SOCIALAPP_CHAT_API_V1
def init_chat_tables():
    with get_db() as db:
        # Presence is read by profile/admin endpoints before a user's first
        # heartbeat, so these tables must exist at application startup.
        db.execute("""
            CREATE TABLE IF NOT EXISTS user_presence (
                username TEXT PRIMARY KEY,
                last_seen_at TEXT NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS user_presence_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                event TEXT NOT NULL,
                changed_at TEXT NOT NULL
            )
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_presence_history_user_time
            ON user_presence_history(LOWER(username), changed_at DESC)
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS direct_messages (
                id TEXT PRIMARY KEY,
                sender_username TEXT NOT NULL,
                recipient_username TEXT NOT NULL,
                body TEXT NOT NULL,
                created_at TEXT NOT NULL,
                image_url TEXT
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS chat_media (
                image_url TEXT PRIMARY KEY,
                uploader_username TEXT NOT NULL,
                created_at TEXT NOT NULL,
                attachment_type TEXT,
                attachment_name TEXT,
                attachment_mime TEXT,
                attachment_size TEXT
            )
        """)
        chat_media_columns = {
            row["name"]
            for row in db.execute("PRAGMA table_info(chat_media)").fetchall()
        }
        for column in (
            "attachment_type",
            "attachment_name",
            "attachment_mime",
            "attachment_size",
        ):
            if column not in chat_media_columns:
                db.execute(f"ALTER TABLE chat_media ADD COLUMN {column} TEXT")
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_chat_media_uploader
            ON chat_media(uploader_username)
        """)
        columns = {
            row["name"]
            for row in db.execute("PRAGMA table_info(direct_messages)").fetchall()
        }
        for column in (
            "image_url", "delivered_at", "read_at", "reply_to_id",
            "attachment_url", "attachment_type", "attachment_name",
            "attachment_mime", "attachment_size", "expires_at",
        ):
            if column not in columns:
                db.execute(f"ALTER TABLE direct_messages ADD COLUMN {column} TEXT")

        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_direct_messages_pair
            ON direct_messages(sender_username, recipient_username, created_at)
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS direct_message_typing (
                sender_username TEXT NOT NULL,
                recipient_username TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                PRIMARY KEY (sender_username, recipient_username)
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS message_inbox_folders (
                username TEXT NOT NULL,
                peer_username TEXT NOT NULL,
                folder TEXT NOT NULL CHECK(folder IN ('primary', 'general', 'requests')),
                updated_at TEXT NOT NULL,
                PRIMARY KEY(username, peer_username)
            )
        """)

def _chat_preferences(db, username):
    """Read persisted privacy preferences for an authenticated account."""
    db.execute("""
        CREATE TABLE IF NOT EXISTS user_settings_preferences (
            username TEXT PRIMARY KEY,
            preferences_json TEXT NOT NULL DEFAULT '{}',
            updated_at TEXT NOT NULL
        )
    """)
    row = db.execute(
        "SELECT preferences_json FROM user_settings_preferences WHERE LOWER(username)=LOWER(?)",
        (username,),
    ).fetchone()
    try:
        values = json.loads(row["preferences_json"]) if row else {}
    except (TypeError, ValueError):
        values = {}
    return values if isinstance(values, dict) else {}


def _chat_preference(db, username, key, default=True):
    value = _chat_preferences(db, username).get(key, default)
    return value if isinstance(value, bool) else default


def _chat_current_user():
    username = _auth_user()
    if not username:
        return None
    g.auth_username = username
    return username


@app.post("/api/presence/heartbeat")
def update_presence_heartbeat():
    username = _chat_current_user()
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS user_presence (
                username TEXT PRIMARY KEY,
                last_seen_at TEXT NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS user_presence_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                event TEXT NOT NULL,
                changed_at TEXT NOT NULL
            )
        """)
        db.execute("CREATE INDEX IF NOT EXISTS idx_presence_history_user_time ON user_presence_history(LOWER(username), changed_at DESC)")
        existing = db.execute(
            "SELECT username, last_seen_at FROM user_presence WHERE LOWER(username)=LOWER(?)",
            (username,),
        ).fetchone()
        should_record_online = not existing
        if existing:
            try:
                previous = datetime.fromisoformat(str(existing["last_seen_at"]).replace("Z", "+00:00"))
                if previous.tzinfo is None:
                    previous = previous.replace(tzinfo=timezone.utc)
                should_record_online = (datetime.now(timezone.utc) - previous).total_seconds() > 90
            except (TypeError, ValueError):
                should_record_online = True
            db.execute(
                "UPDATE user_presence SET last_seen_at=? WHERE LOWER(username)=LOWER(?)",
                (now, username),
            )
        else:
            db.execute(
                "INSERT INTO user_presence (username,last_seen_at) VALUES (?,?)",
                (username, now),
            )
        if should_record_online:
            db.execute(
                "INSERT INTO user_presence_history(username,event,changed_at) VALUES(?,?,?)",
                (username, "online", now),
            )
    return jsonify({"ok": True, "lastSeenAt": now})


@app.get("/api/presence/<username>")
def get_chat_presence(username):
    viewer = _chat_current_user()
    if not viewer:
        return jsonify({"error": "Please log in first."}), 401
    target = str(username or "").strip().lstrip("@")
    if not target or target.lower() == viewer.lower():
        return jsonify({"error": "Invalid user."}), 400
    now = datetime.now(timezone.utc)
    with get_db() as db:
        user = db.execute(
            "SELECT username FROM users WHERE LOWER(username)=LOWER(?)",
            (target,),
        ).fetchone()
        if not user:
            return jsonify({"error": "User not found."}), 404
        target = user["username"]
        privacy = db.execute(
            "SELECT show_activity FROM user_settings WHERE LOWER(username)=LOWER(?)",
            (target,),
        ).fetchone()
        if privacy and not bool(privacy["show_activity"]):
            return jsonify({"isOnline": False, "lastSeenAt": None, "hidden": True})
        row = db.execute(
            "SELECT last_seen_at FROM user_presence WHERE LOWER(username)=LOWER(?)",
            (target,),
        ).fetchone()
    last_seen = row["last_seen_at"] if row else None
    try:
        parsed = datetime.fromisoformat(last_seen) if last_seen else None
        if parsed and parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        online = bool(parsed and (now - parsed).total_seconds() <= 90)
    except (TypeError, ValueError):
        online = False
    return jsonify({"isOnline": online, "lastSeenAt": last_seen, "hidden": False})


# SOCIALAPP_LIVEKIT_CALLS_V1
def init_call_tables():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS call_sessions (
                id TEXT PRIMARY KEY,
                caller_username TEXT NOT NULL,
                callee_username TEXT NOT NULL,
                call_type TEXT NOT NULL,
                room_name TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL DEFAULT 'ringing',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_call_sessions_callee_status
            ON call_sessions(callee_username, status, created_at DESC)
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_call_sessions_caller_status
            ON call_sessions(caller_username, status, created_at DESC)
        """)
        # Match case-insensitive participant lookups and expiry filtering.
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_call_sessions_callee_lower_status_expiry
            ON call_sessions(LOWER(callee_username), status, expires_at, created_at DESC)
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_call_sessions_caller_lower_status_expiry
            ON call_sessions(LOWER(caller_username), status, expires_at, created_at DESC)
        """)
        # Case-insensitive indexes match the lookup predicates used by call signalling.
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_call_sessions_callee_status_ci
            ON call_sessions(LOWER(callee_username), status, expires_at)
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_call_sessions_caller_status_ci
            ON call_sessions(LOWER(caller_username), status, expires_at)
        """)

        db.execute("""
            CREATE TABLE IF NOT EXISTS call_push_tokens (
                expo_push_token TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_call_push_tokens_username
            ON call_push_tokens(LOWER(username))
        """)


def _send_incoming_call_push(username, caller, call_type, call_id):
    """Send a high-priority Expo push so a terminated app can still show an incoming-call alert."""
    with get_db() as db:
        rows = db.execute(
            "SELECT expo_push_token FROM call_push_tokens WHERE LOWER(username)=LOWER(?)",
            (username,),
        ).fetchall()

    if not rows:
        return

    call_data = {"type": "incoming_call", "callId": call_id, "callType": call_type, "caller": caller}
    payloads = []
    for row in rows:
        token = row["expo_push_token"]
        # Visible fallback alert remains available if Android defers headless work.
        payloads.append({
            "to": token,
            "title": "Incoming video call" if call_type == "video" else "Incoming voice call",
            "body": f"@{caller} is calling you",
            "sound": "default",
            "priority": "high",
            "ttl": 45,
            "channelId": "incoming-calls",
            "categoryId": "incoming_call",
            "data": call_data,
        })
        # A separate data-only push lets Expo TaskManager run when Android has
        # terminated the React UI process. Do not add title/body to this payload.
        payloads.append({
            "to": token,
            "priority": "high",
            "ttl": 45,
            "data": {**call_data, "type": "incoming_call_headless"},
        })

    for payload in payloads:
        try:
            request_obj = urllib.request.Request(
                "https://exp.host/--/api/v2/push/send",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Accept": "application/json", "Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request_obj, timeout=5) as response:
                result = json.loads(response.read().decode("utf-8") or "{}")
            tickets = result.get("data") if isinstance(result, dict) else None
            ticket_list = tickets if isinstance(tickets, list) else [tickets]
            for ticket in ticket_list:
                if ticket and ticket.get("status") == "error" and ticket.get("details", {}).get("error") == "DeviceNotRegistered":
                    with get_db() as db:
                        db.execute("DELETE FROM call_push_tokens WHERE expo_push_token=?", (payload["to"],))
        except Exception:
            app.logger.exception("Could not send incoming-call push to %s", username)


def _send_direct_message_push(username, sender, message_text="", attachment_type=None):
    """Deliver a private-message push to registered devices when message alerts are enabled."""
    try:
        with get_db() as db:
            enabled = db.execute(
                "SELECT enabled FROM notification_preferences WHERE LOWER(username)=LOWER(?)",
                (username,),
            ).fetchone()
            if enabled and not bool(enabled["enabled"]):
                return
            detail = db.execute(
                "SELECT messages FROM notification_detail_preferences WHERE LOWER(username)=LOWER(?)",
                (username,),
            ).fetchone()
            if detail and not bool(detail["messages"]):
                return
            prefs = _chat_preferences(db, username)
            preview = prefs.get("notifications.preview", True) is not False
            sound_enabled = prefs.get("notifications.sound", True) is not False
            rows = db.execute(
                "SELECT expo_push_token FROM call_push_tokens WHERE LOWER(username)=LOWER(?)",
                (username,),
            ).fetchall()
        if not rows:
            return
        snippet = str(message_text or "").strip()
        if not preview or not snippet:
            snippet = "Sent you a photo" if attachment_type == "image" else "Sent you an attachment" if attachment_type else "You have a new message"
        snippet = snippet[:140]
        for row in rows:
            token = row["expo_push_token"]
            payload = {
                "to": token,
                "title": f"New message from @{sender}",
                "body": snippet,
                "sound": "default" if sound_enabled else None,
                "priority": "high",
                "channelId": "messages" if sound_enabled else "messages-silent",
                "categoryIdentifier": "bhumi_message_reply",
                "data": {"type": "direct_message", "username": sender, "soundEnabled": sound_enabled},
            }
            request_obj = urllib.request.Request(
                "https://exp.host/--/api/v2/push/send",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Accept": "application/json", "Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request_obj, timeout=5) as response:
                result = json.loads(response.read().decode("utf-8") or "{}")
            tickets = result.get("data") if isinstance(result, dict) else None
            ticket_list = tickets if isinstance(tickets, list) else [tickets]
            if any(ticket and ticket.get("status") == "error" and ticket.get("details", {}).get("error") == "DeviceNotRegistered" for ticket in ticket_list):
                with get_db() as db:
                    db.execute("DELETE FROM call_push_tokens WHERE expo_push_token=? AND LOWER(username)=LOWER(?)", (token, username))
    except Exception:
        app.logger.exception("Could not send direct-message push to %s", username)


def _call_user():
    return _chat_current_user()

@app.post("/api/calls/push-token")
def register_call_push_token():
    username = _call_user()
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    payload = request.get_json(silent=True) or {}
    token = str(payload.get("token") or "").strip()
    if not token.startswith(("ExponentPushToken[", "ExpoPushToken[")) or len(token) > 512:
        return jsonify({"error": "Invalid push token."}), 400
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        db.execute("""
            INSERT INTO call_push_tokens (expo_push_token, username, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(expo_push_token) DO UPDATE SET
                username=excluded.username, updated_at=excluded.updated_at
        """, (token, username, now))
    return jsonify({"ok": True})


@app.delete("/api/calls/push-token")
def unregister_call_push_token():
    username = _call_user()
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    payload = request.get_json(silent=True) or {}
    token = str(payload.get("token") or "").strip()
    if not token:
        return jsonify({"error": "Push token is required."}), 400
    with get_db() as db:
        db.execute(
            "DELETE FROM call_push_tokens WHERE expo_push_token=? AND LOWER(username)=LOWER(?)",
            (token, username),
        )
    return jsonify({"ok": True})


def _call_json(row):
    return {
        "id": row["id"],
        "caller": row["caller_username"],
        "callee": row["callee_username"],
        "type": row["call_type"],
        "status": row["status"],
        "createdAt": row["created_at"],
        "expiresAt": row["expires_at"],
    }


@app.post("/api/calls")
def create_call():
    caller = _call_user()
    if not caller:
        return jsonify({"error": "Please log in first."}), 401
    payload = request.get_json(silent=True) or {}
    callee = str(payload.get("username") or "").strip().lstrip("@")
    call_type = str(payload.get("type") or "").strip().lower()
    if not callee or len(callee) > 60 or call_type not in ("audio", "video"):
        return jsonify({"error": "Valid username and call type are required."}), 400
    if callee.casefold() == caller.casefold():
        return jsonify({"error": "You cannot call yourself."}), 400

    now = datetime.now(timezone.utc)
    now_text = now.isoformat()
    expires_text = (now + timedelta(seconds=45)).isoformat()
    call_id = uuid.uuid4().hex
    room_name = "bhumi-call-" + uuid.uuid4().hex

    with get_db() as db:
        target = db.execute(
            "SELECT username FROM users WHERE LOWER(username)=LOWER(?) LIMIT 1",
            (callee,),
        ).fetchone()
        if not target:
            return jsonify({"error": "User not found."}), 404
        callee = target["username"]
        if call_type == "audio" and not _chat_preference(db, callee, "messages.allowVoiceCalls", True):
            return jsonify({"error": "This user is not accepting voice calls."}), 403
        if call_type == "video" and not _chat_preference(db, callee, "messages.allowVideoCalls", True):
            return jsonify({"error": "This user is not accepting video calls."}), 403

        blocked = db.execute("""
            SELECT 1 FROM people_blocks
            WHERE (LOWER(blocker)=LOWER(?) AND LOWER(blocked)=LOWER(?))
               OR (LOWER(blocker)=LOWER(?) AND LOWER(blocked)=LOWER(?))
            LIMIT 1
        """, (caller, callee, callee, caller)).fetchone()
        if blocked:
            return jsonify({"error": "Calls are unavailable for this account."}), 403

        # Either participant may already be busy. Check both caller and callee
        # against both sides of every unexpired call before creating a new one.
        active = db.execute("""
            SELECT id FROM call_sessions
            WHERE status IN ('ringing', 'accepted')
              AND expires_at > ?
              AND (
                LOWER(caller_username) IN (LOWER(?), LOWER(?))
                OR LOWER(callee_username) IN (LOWER(?), LOWER(?))
              )
            LIMIT 1
        """, (now_text, caller, callee, caller, callee)).fetchone()
        if active:
            return jsonify({"error": "You already have an active call."}), 409

        db.execute("""
            INSERT INTO call_sessions
                (id, caller_username, callee_username, call_type, room_name,
                 status, created_at, updated_at, expires_at)
            VALUES (?, ?, ?, ?, ?, 'ringing', ?, ?, ?)
        """, (call_id, caller, callee, call_type, room_name, now_text, now_text, expires_text))
        row = db.execute("SELECT * FROM call_sessions WHERE id=?", (call_id,)).fetchone()

    # Return the ringing call immediately. Expo push delivery can take several
    # seconds (and is best-effort), so never block call setup on the push network.
    threading.Thread(
        target=_send_incoming_call_push,
        args=(callee, caller, call_type, call_id),
        name="incoming-call-push",
        daemon=True,
    ).start()
    return jsonify({"ok": True, "call": _call_json(row)}), 201


@app.get("/api/calls/pending")
def get_pending_calls():
    username = _call_user()
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        rows = db.execute("""
            SELECT * FROM call_sessions
            WHERE LOWER(callee_username)=LOWER(?) AND status='ringing' AND expires_at>?
            ORDER BY created_at DESC LIMIT 5
        """, (username, now)).fetchall()
    return jsonify({"calls": [_call_json(row) for row in rows]})


@app.post("/api/calls/<call_id>/<action>")
def update_call(call_id, action):
    username = _call_user()
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    if action not in ("accept", "reject", "end"):
        return jsonify({"error": "Invalid call action."}), 404
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        row = db.execute("SELECT * FROM call_sessions WHERE id=?", (call_id,)).fetchone()
        if row is None:
            return jsonify({"error": "Call not found."}), 404
        caller = row["caller_username"].casefold() == username.casefold()
        callee = row["callee_username"].casefold() == username.casefold()
        if not (caller or callee):
            return jsonify({"error": "You are not a participant in this call."}), 403
        if action in ("accept", "reject") and not callee:
            return jsonify({"error": "Only the recipient can answer this call."}), 403
        if action == "accept":
            expires = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
            changed = db.execute("""
                UPDATE call_sessions
                SET status='accepted', updated_at=?, expires_at=?
                WHERE id=? AND status='ringing' AND expires_at>?
            """, (now, expires, call_id, now))
            error_message = "This call is no longer ringing or has expired."
        elif action == "reject":
            changed = db.execute("""
                UPDATE call_sessions SET status='rejected', updated_at=?
                WHERE id=? AND status='ringing' AND expires_at>?
            """, (now, call_id, now))
            error_message = "This call is no longer ringing."
        else:
            changed = db.execute("""
                UPDATE call_sessions SET status='ended', updated_at=?
                WHERE id=? AND status IN ('ringing', 'accepted') AND expires_at>?
            """, (now, call_id, now))
            error_message = "This call has already ended or expired."
        # Conditional updates make accept/reject/end mutually exclusive even
        # when two devices send actions at nearly the same time.
        if changed.rowcount != 1:
            return jsonify({"error": error_message}), 409
        updated = db.execute("SELECT * FROM call_sessions WHERE id=?", (call_id,)).fetchone()
    return jsonify({"ok": True, "call": _call_json(updated)})



@app.get("/api/calls/<call_id>")
def get_call_status(call_id):
    username = _call_user()
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        row = db.execute("SELECT * FROM call_sessions WHERE id=?", (call_id,)).fetchone()
    if row is None:
        return jsonify({"error": "Call not found."}), 404
    if username.casefold() not in (
        row["caller_username"].casefold(), row["callee_username"].casefold()
    ):
        return jsonify({"error": "You are not a participant in this call."}), 403
    now = datetime.now(timezone.utc).isoformat()
    if row["status"] == "ringing" and row["expires_at"] <= now:
        with get_db() as db:
            db.execute(
                "UPDATE call_sessions SET status='missed', updated_at=? WHERE id=? AND status='ringing'",
                (now, call_id),
            )
            row = db.execute("SELECT * FROM call_sessions WHERE id=?", (call_id,)).fetchone()
    elif row["status"] == "accepted" and row["expires_at"] <= now:
        # Accepted sessions have a bounded lifetime too. Expire them explicitly
        # so clients do not keep polling a permanently accepted, stale call.
        with get_db() as db:
            db.execute(
                "UPDATE call_sessions SET status='ended', updated_at=? WHERE id=? AND status='accepted'",
                (now, call_id),
            )
            row = db.execute("SELECT * FROM call_sessions WHERE id=?", (call_id,)).fetchone()
    return jsonify({"ok": True, "call": _call_json(row)})


@app.post("/api/calls/<call_id>/token")
def get_call_token(call_id):
    username = _call_user()
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    livekit_url = (os.environ.get("LIVEKIT_URL") or "").strip()
    api_key = (os.environ.get("LIVEKIT_API_KEY") or "").strip()
    api_secret = (os.environ.get("LIVEKIT_API_SECRET") or "").strip()
    if not (livekit_url and api_key and api_secret):
        return jsonify({"error": "Voice/video calling is not configured on the server yet."}), 503

    with get_db() as db:
        row = db.execute("SELECT * FROM call_sessions WHERE id=?", (call_id,)).fetchone()
    if row is None:
        return jsonify({"error": "Call not found."}), 404
    if row["status"] != "accepted":
        return jsonify({"error": "The other person has not accepted the call yet."}), 409
    if row["expires_at"] <= datetime.now(timezone.utc).isoformat():
        return jsonify({"error": "This call has expired."}), 409
    if username.casefold() not in (
        row["caller_username"].casefold(), row["callee_username"].casefold()
    ):
        return jsonify({"error": "You are not a participant in this call."}), 403

    try:
        from livekit import api as livekit_api
        identity = "u_" + __import__("hashlib").sha256(username.casefold().encode()).hexdigest()[:24]
        token = (
            livekit_api.AccessToken(api_key, api_secret)
            .with_identity(identity)
            .with_name(username)
            .with_grants(livekit_api.VideoGrants(
                room_join=True,
                room=row["room_name"],
                can_publish=True,
                can_subscribe=True,
            ))
            .with_ttl(timedelta(minutes=30))
            .to_jwt()
        )
    except ImportError:
        app.logger.exception("LiveKit server SDK is not installed")
        return jsonify({"error": "Calling service is being installed. Please try again later."}), 503
    except Exception:
        app.logger.exception("Could not generate LiveKit call token")
        return jsonify({"error": "Could not prepare the call connection."}), 500

    normalized_url = livekit_url.replace("https://", "wss://").replace("http://", "ws://")
    return jsonify({"ok": True, "url": normalized_url, "token": token, "type": row["call_type"]})


# SOCIALAPP_NOTES_API_V1
def init_notes_tables():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS user_notes (
                username TEXT PRIMARY KEY,
                body TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
        """)
        db.execute("CREATE INDEX IF NOT EXISTS idx_user_notes_expiry ON user_notes(expires_at)")
        for column, definition in (
            ("audio_url", "TEXT"),
            ("audio_title", "TEXT"),
            ("audio_artist", "TEXT"),
        ):
            try:
                db.execute(f"ALTER TABLE user_notes ADD COLUMN {column} {definition}")
            except Exception:
                pass


@app.get("/api/notes")
def get_user_notes():
    current = _chat_current_user()
    if not current:
        return jsonify({"error": "Please log in to view notes."}), 401
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        db.execute("DELETE FROM user_notes WHERE expires_at <= ?", (now,))
        rows = db.execute("""
            SELECT n.username, n.body, n.created_at, n.expires_at,
                   n.audio_url, n.audio_title, n.audio_artist,
                   p.display_name, p.avatar_url
            FROM user_notes n
            LEFT JOIN profiles p ON LOWER(p.username)=LOWER(n.username)
            WHERE (LOWER(n.username)=LOWER(?) OR LOWER(n.username) IN
                (SELECT LOWER(following) FROM follows WHERE LOWER(follower)=LOWER(?)))
              AND n.expires_at > ?
            ORDER BY n.created_at DESC
        """, (current, current, now)).fetchall()
    own = None
    friends = []
    for row in rows:
        item = {
            "username": row["username"], "text": row["body"],
            "createdAt": row["created_at"], "expiresAt": row["expires_at"],
            "audioUrl": row["audio_url"], "audioTitle": row["audio_title"],
            "audioArtist": row["audio_artist"],
            "displayName": row["display_name"] or row["username"],
            "avatarUrl": row["avatar_url"]
        }
        if row["username"].lower() == current.lower():
            own = item
        else:
            friends.append(item)
    return jsonify({"ownNote": own, "friendsNotes": friends})


@app.post("/api/notes")
def save_user_note():
    current = _chat_current_user()
    if not current:
        return jsonify({"error": "Please log in to post a note."}), 401
    data = request.get_json(silent=True) or {}
    body = str(data.get("text") or "").strip()
    audio_url = str(data.get("audioUrl") or "").strip() or None
    audio_title = str(data.get("audioTitle") or "").strip() or None
    audio_artist = str(data.get("audioArtist") or "").strip() or None
    if audio_url and not audio_url.startswith("https://"):
        return jsonify({"error": "Song preview URL must use HTTPS."}), 400
    if audio_url and len(audio_url) > 2048:
        return jsonify({"error": "Song preview URL is too long."}), 400
    if not body and not audio_url:
        return jsonify({"error": "Note cannot be empty."}), 400
    if len(body) > 60:
        return jsonify({"error": "Note must be 60 characters or fewer."}), 400
    now_dt = datetime.now(timezone.utc)
    now = now_dt.isoformat()
    expires = (now_dt + timedelta(hours=24)).isoformat()
    with get_db() as db:
        db.execute("""
            INSERT INTO user_notes
                (username, body, created_at, expires_at, audio_url, audio_title, audio_artist)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                body=excluded.body, created_at=excluded.created_at,
                expires_at=excluded.expires_at, audio_url=excluded.audio_url,
                audio_title=excluded.audio_title, audio_artist=excluded.audio_artist
        """, (current, body, now, expires, audio_url, audio_title, audio_artist))
    return jsonify({"ok": True, "note": {
        "username": current, "text": body,
        "createdAt": now, "expiresAt": expires,
        "audioUrl": audio_url, "audioTitle": audio_title, "audioArtist": audio_artist
    }})


@app.delete("/api/notes")
def delete_user_note():
    current = _chat_current_user()
    if not current:
        return jsonify({"error": "Please log in to delete your note."}), 401
    with get_db() as db:
        db.execute("DELETE FROM user_notes WHERE LOWER(username)=LOWER(?)", (current,))
    return jsonify({"ok": True})


@app.get("/api/messages/conversations")
def get_message_conversations():
    current = _chat_current_user()
    if not current:
        return jsonify({"error": "Please log in to view messages."}), 401

    with get_db() as db:
        now = datetime.now(timezone.utc).isoformat()
        db.execute(
            "DELETE FROM direct_messages WHERE expires_at IS NOT NULL AND expires_at <= ?",
            (now,),
        )
        db.execute(
            """
            UPDATE direct_messages
            SET delivered_at = COALESCE(delivered_at, ?)
            WHERE LOWER(recipient_username)=LOWER(?)
              AND (expires_at IS NULL OR expires_at > ?)
            """,
            (now, current, now),
        )
        rows = db.execute("""
            SELECT
                dm.id, dm.sender_username, dm.recipient_username,
                dm.body, dm.image_url, dm.attachment_type, dm.created_at, dm.delivered_at, dm.read_at,
                (
                    SELECT COUNT(*) FROM direct_messages unread
                    WHERE LOWER(unread.sender_username)=LOWER(
                        CASE
                            WHEN LOWER(dm.sender_username)=LOWER(?) THEN dm.recipient_username
                            ELSE dm.sender_username
                        END
                    )
                    AND LOWER(unread.recipient_username)=LOWER(?)
                    AND unread.read_at IS NULL
                ) AS unread_count,
                p.display_name AS other_display_name,
                p.avatar_url AS other_avatar_url
            FROM direct_messages dm
            LEFT JOIN profiles p
              ON LOWER(p.username) = LOWER(
                CASE
                  WHEN LOWER(dm.sender_username)=LOWER(?) THEN dm.recipient_username
                  ELSE dm.sender_username
                END
              )
            WHERE (LOWER(dm.sender_username)=LOWER(?)
               OR LOWER(dm.recipient_username)=LOWER(?))
              AND (dm.expires_at IS NULL OR dm.expires_at > ?)
            ORDER BY dm.created_at DESC, dm.id DESC
        """, (current, current, current, current, current, now)).fetchall()
        connected_rows = db.execute("""
            SELECT CASE WHEN LOWER(follower)=LOWER(?) THEN following ELSE follower END AS peer
            FROM follows
            WHERE LOWER(follower)=LOWER(?) OR LOWER(following)=LOWER(?)
        """, (current, current, current)).fetchall()
        connected_users = {str(item["peer"]).lower() for item in connected_rows}
        folder_rows = db.execute("""
            SELECT peer_username, folder
            FROM message_inbox_folders
            WHERE LOWER(username)=LOWER(?)
        """, (current,)).fetchall()
        saved_folders = {str(item["peer_username"]).lower(): str(item["folder"]) for item in folder_rows}

    conversations = []
    seen = set()

    for row in rows:
        other = (
            row["recipient_username"]
            if row["sender_username"].lower() == current.lower()
            else row["sender_username"]
        )
        key = other.lower()
        if key in seen:
            continue
        seen.add(key)
        default_folder = "primary" if key in connected_users else "requests"
        inbox_folder = saved_folders.get(key, default_folder)
        conversations.append({
            "username": other,
            "displayName": row["other_display_name"] or other,
            "avatarUrl": row["other_avatar_url"],
            "folder": inbox_folder,
            "isRequest": inbox_folder == "requests",
            "lastMessage": row["body"] or (
                "📷 Photo" if row["image_url"] or row["attachment_type"] == "image"
                else "🎬 Video" if row["attachment_type"] == "video"
                else "🎵 Audio" if row["attachment_type"] == "audio"
                else "📎 File" if row["attachment_type"] == "file"
                else ""
            ),
            "lastMessageAt": row["created_at"],
            "lastMessageSender": row["sender_username"],
            "deliveredAt": row["delivered_at"],
            "readAt": row["read_at"],
            "unreadCount": int(row["unread_count"] or 0),
        })

    return jsonify({"conversations": conversations})


@app.patch("/api/messages/conversations/<username>/folder")
def update_message_conversation_folder(username):
    current = _chat_current_user()
    if not current:
        return jsonify({"error": "Please log in to organize messages."}), 401
    peer = str(username or "").strip().lstrip("@")
    if not peer or peer.lower() == current.lower():
        return jsonify({"error": "Choose a valid conversation."}), 400
    data = request.get_json(silent=True) or {}
    folder = str(data.get("folder") or "").strip().lower()
    if folder not in {"primary", "general", "requests"}:
        return jsonify({"error": "Choose Primary, General or Requests."}), 400
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        exists = db.execute("""
            SELECT 1 FROM direct_messages
            WHERE (LOWER(sender_username)=LOWER(?) AND LOWER(recipient_username)=LOWER(?))
               OR (LOWER(sender_username)=LOWER(?) AND LOWER(recipient_username)=LOWER(?))
            LIMIT 1
        """, (current, peer, peer, current)).fetchone()
        if not exists:
            return jsonify({"error": "Conversation not found."}), 404
        db.execute("""
            INSERT INTO message_inbox_folders (username, peer_username, folder, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(username, peer_username) DO UPDATE SET
                folder=excluded.folder, updated_at=excluded.updated_at
        """, (current, peer, folder, now))
    return jsonify({"ok": True, "username": peer, "folder": folder})


@app.get("/api/messages/<username>")
def get_direct_messages(username):
    current = _chat_current_user()
    if not current:
        return jsonify({"error": "Please log in to view messages."}), 401

    target = username.strip().lstrip("@")
    if not target or target.lower() == current.lower():
        return jsonify({"error": "Choose another valid username."}), 400

    with get_db() as db:
        user = db.execute(
            "SELECT username FROM users WHERE username=? COLLATE NOCASE",
            (target,),
        ).fetchone()

        if not user:
            return jsonify({"error": "User not found."}), 404

        target = user["username"]
        now = datetime.now(timezone.utc).isoformat()
        db.execute(
            "DELETE FROM direct_messages WHERE expires_at IS NOT NULL AND expires_at <= ?",
            (now,),
        )

        receipts_enabled = _chat_preference(db, current, "messages.readReceipts", True)
        if receipts_enabled:
            db.execute("""
                UPDATE direct_messages
                SET delivered_at = CASE
                        WHEN LOWER(recipient_username)=LOWER(?)
                        THEN COALESCE(delivered_at, ?)
                        ELSE delivered_at
                    END,
                    read_at = CASE
                        WHEN LOWER(recipient_username)=LOWER(?)
                        THEN ?
                        ELSE read_at
                    END
                WHERE (LOWER(sender_username)=LOWER(?) AND LOWER(recipient_username)=LOWER(?))
                   OR (LOWER(sender_username)=LOWER(?) AND LOWER(recipient_username)=LOWER(?))
            """, (current, now, current, now, current, target, target, current))
        else:
            db.execute("""
                UPDATE direct_messages
                SET delivered_at = CASE
                    WHEN LOWER(recipient_username)=LOWER(?)
                    THEN COALESCE(delivered_at, ?)
                    ELSE delivered_at
                END
                WHERE (LOWER(sender_username)=LOWER(?) AND LOWER(recipient_username)=LOWER(?))
                   OR (LOWER(sender_username)=LOWER(?) AND LOWER(recipient_username)=LOWER(?))
            """, (current, now, current, target, target, current))

        rows = db.execute("""
            SELECT
                dm.id, dm.sender_username, dm.recipient_username,
                dm.body, dm.image_url, dm.attachment_url, dm.attachment_type,
                dm.attachment_name, dm.attachment_mime, dm.attachment_size,
                dm.created_at, dm.delivered_at, dm.read_at, dm.reply_to_id,
                dm.expires_at,
                parent.body AS reply_text,
                parent.sender_username AS reply_sender,
                sender_profile.avatar_url AS sender_avatar_url,
                recipient_profile.avatar_url AS recipient_avatar_url
            FROM direct_messages dm
            LEFT JOIN direct_messages parent ON parent.id = dm.reply_to_id
            LEFT JOIN profiles sender_profile ON LOWER(sender_profile.username)=LOWER(dm.sender_username)
            LEFT JOIN profiles recipient_profile ON LOWER(recipient_profile.username)=LOWER(dm.recipient_username)
            WHERE ((LOWER(dm.sender_username)=LOWER(?) AND LOWER(dm.recipient_username)=LOWER(?))
               OR (LOWER(dm.sender_username)=LOWER(?) AND LOWER(dm.recipient_username)=LOWER(?)))
              AND (dm.expires_at IS NULL OR dm.expires_at > ?)
            ORDER BY dm.created_at ASC, dm.id ASC
            LIMIT 500
        """, (current, target, target, current, now)).fetchall()

    return jsonify({
        "username": target,
        "messages": [{
            "id": row["id"],
            "sender": row["sender_username"],
            "recipient": row["recipient_username"],
            "senderAvatarUrl": row["sender_avatar_url"],
            "recipientAvatarUrl": row["recipient_avatar_url"],
            "text": row["body"],
            "imageUrl": row["image_url"],
            "attachmentUrl": row["attachment_url"] or row["image_url"],
            "attachmentType": row["attachment_type"] or ("image" if row["image_url"] else None),
            "attachmentName": row["attachment_name"],
            "mimeType": row["attachment_mime"],
            "sizeBytes": row["attachment_size"],
            "createdAt": row["created_at"],
            "deliveredAt": row["delivered_at"],
            "readAt": row["read_at"],
            "expiresAt": row["expires_at"],
            "replyToId": row["reply_to_id"],
            "replyText": row["reply_text"],
            "replySender": row["reply_sender"],
        } for row in rows]
    })


@app.post("/api/messages/<username>")
def send_direct_message(username):
    current = _chat_current_user()
    if not current:
        return jsonify({"error": "Please log in to send messages."}), 401

    target = username.strip().lstrip("@")
    data = request.get_json(silent=True) or {}
    body = str(data.get("text", data.get("message", ""))).strip()

    legacy_image_url = str(data.get("imageUrl") or "").strip() or None
    attachment_url = str(data.get("attachmentUrl") or "").strip() or legacy_image_url
    attachment_type = str(data.get("attachmentType") or ("image" if legacy_image_url else "")).strip().lower() or None
    attachment_name = str(data.get("attachmentName") or "").strip() or None
    attachment_mime = str(data.get("mimeType") or "").strip() or None
    attachment_size = data.get("sizeBytes")

    if not target or target.lower() == current.lower():
        return jsonify({"error": "Choose another valid username."}), 400
    if not body and not attachment_url:
        return jsonify({"error": "Write a message or attach a file."}), 400
    if len(body) > 5000:
        return jsonify({"error": "Message must be 5000 characters or less."}), 400

    if attachment_type not in {None, "image", "video", "audio", "file"}:
        return jsonify({"error": "Invalid attachment type."}), 400

    if attachment_url:
        prefix = "/uploads/chat/"
        filename = attachment_url[len(prefix):] if attachment_url.startswith(prefix) else ""
        if (
            not filename
            or "/" in filename
            or "\\" in filename
            or secure_filename(filename) != filename
        ):
            return jsonify({"error": "Invalid chat attachment."}), 400

    now = datetime.now(timezone.utc).isoformat()
    message_id = str(uuid.uuid4())

    with get_db() as db:
        if attachment_url:
              media = db.execute("""
                  SELECT uploader_username, attachment_type, attachment_name,
                         attachment_mime, attachment_size
                  FROM chat_media
                  WHERE image_url=?
              """, (attachment_url,)).fetchone()
              if not media or media["uploader_username"].casefold() != current.casefold():
                  return jsonify({"error": "You cannot send this attachment."}), 403
              attachment_type = media["attachment_type"] or ("image" if legacy_image_url else None)
              attachment_name = media["attachment_name"]
              attachment_mime = media["attachment_mime"]
              attachment_size = media["attachment_size"]
              if attachment_type not in {"image", "video", "audio", "file"}:
                  return jsonify({"error": "Attachment metadata is invalid."}), 400

        user = db.execute(
            "SELECT username FROM users WHERE username=? COLLATE NOCASE",
            (target,),
        ).fetchone()
        if not user:
            return jsonify({"error": "User not found."}), 404
        target = user["username"]
        blocked_pair = db.execute("""
            SELECT 1 FROM people_blocks
            WHERE
                (LOWER(blocker)=LOWER(?) AND LOWER(blocked)=LOWER(?))
                OR
                (LOWER(blocker)=LOWER(?) AND LOWER(blocked)=LOWER(?))
            LIMIT 1
        """, (current, target, target, current)).fetchone()
        if blocked_pair:
            return jsonify({"error": "Messages are unavailable between these users."}), 403

        target_preferences = _chat_preferences(db, target)
        contact_audience = target_preferences.get("privacy.contactAudience", "everyone")
        follows_target = bool(db.execute("""
            SELECT 1 FROM follows
            WHERE LOWER(follower)=LOWER(?) AND LOWER(following)=LOWER(?)
            LIMIT 1
        """, (current, target)).fetchone())
        target_follows_current = bool(db.execute("""
            SELECT 1 FROM follows
            WHERE LOWER(follower)=LOWER(?) AND LOWER(following)=LOWER(?)
            LIMIT 1
        """, (target, current)).fetchone())
        if contact_audience == "friends" and not (follows_target and target_follows_current):
            return jsonify({"error": "This user only accepts messages from friends."}), 403
        if contact_audience == "followers" and not follows_target:
            return jsonify({"error": "This user only accepts messages from followers."}), 403

        settings = db.execute(
            "SELECT allow_messages FROM user_settings WHERE username=?",
            (target,),
        ).fetchone()
        if settings and not bool(settings["allow_messages"]):
            return jsonify({"error": "This user does not accept messages."}), 403
        if not _chat_preference(db, target, "messages.allowMessages", True):
            return jsonify({"error": "This user has turned off direct messages."}), 403

        existing_thread = db.execute("""
            SELECT 1 FROM direct_messages
            WHERE (LOWER(sender_username)=LOWER(?) AND LOWER(recipient_username)=LOWER(?))
               OR (LOWER(sender_username)=LOWER(?) AND LOWER(recipient_username)=LOWER(?))
            LIMIT 1
        """, (current, target, target, current)).fetchone()
        relationship = db.execute("""
            SELECT 1 FROM follows
            WHERE (LOWER(follower)=LOWER(?) AND LOWER(following)=LOWER(?))
               OR (LOWER(follower)=LOWER(?) AND LOWER(following)=LOWER(?))
            LIMIT 1
        """, (current, target, target, current)).fetchone()
        if not existing_thread and not relationship:
            if not _chat_preference(db, target, "messages.messageRequests", True):
                return jsonify({"error": "This user is not accepting message requests."}), 403
            if not _chat_preference(db, target, "messages.allowUnknown", True):
                return jsonify({"error": "This user only accepts messages from people they follow."}), 403

        reply_to_id = str(data.get("replyToId") or "").strip() or None
        if reply_to_id:
            parent = db.execute("""
                SELECT id FROM direct_messages
                WHERE id=? AND (
                    (LOWER(sender_username)=LOWER(?) AND LOWER(recipient_username)=LOWER(?))
                    OR (LOWER(sender_username)=LOWER(?) AND LOWER(recipient_username)=LOWER(?))
                )
            """, (reply_to_id, current, target, target, current)).fetchone()
            if not parent:
                return jsonify({"error": "Reply message not found in this chat."}), 404

        disappearing = _chat_preferences(db, current).get("messages.disappearing", "off")
        expiry_hours = {"24h": 24, "7d": 24 * 7, "24_hours": 24, "7_days": 24 * 7}.get(disappearing)
        expires_at = (
            (datetime.now(timezone.utc) + timedelta(hours=expiry_hours)).isoformat()
            if expiry_hours else None
        )
        db.execute("""
            INSERT INTO direct_messages (
                id, sender_username, recipient_username, body, image_url, created_at,
                reply_to_id, attachment_url, attachment_type, attachment_name,
                attachment_mime, attachment_size, expires_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            message_id, current, target, body, legacy_image_url, now,
            reply_to_id, attachment_url, attachment_type, attachment_name,
            attachment_mime, str(attachment_size) if attachment_size is not None else None,
            expires_at,
        ))
        _people_notification(db, target, current, "message", message_id, now)

    _send_direct_message_push(target, current, body, attachment_type)

    return jsonify({
        "ok": True,
        "message": {
            "id": message_id,
            "sender": current,
            "recipient": target,
            "text": body,
            "imageUrl": legacy_image_url,
            "attachmentUrl": attachment_url,
            "attachmentType": attachment_type or ("image" if legacy_image_url else None),
            "attachmentName": attachment_name,
            "mimeType": attachment_mime,
            "sizeBytes": attachment_size,
            "createdAt": now,
            "replyToId": reply_to_id,
            "deliveredAt": None,
            "readAt": None,
        },
    }), 201


@app.delete("/api/messages/<username>/<message_id>")
def unsend_direct_message(username, message_id):
    current = _chat_current_user()
    if not current:
        return jsonify({"error": "Please log in to unsend messages."}), 401

    target = username.strip().lstrip("@")
    if not target or target.lower() == current.lower():
        return jsonify({"error": "Invalid chat."}), 400

    with get_db() as db:
        existing = db.execute(
            """
            SELECT id FROM direct_messages
            WHERE id=?
              AND LOWER(sender_username)=LOWER(?)
              AND LOWER(recipient_username)=LOWER(?)
            """,
            (message_id, current, target),
        ).fetchone()

        if not existing:
            return jsonify({"error": "Message not found or you cannot unsend it."}), 404

        db.execute(
            "UPDATE direct_messages SET reply_to_id=NULL WHERE reply_to_id=?",
            (message_id,),
        )
        db.execute(
            """
            DELETE FROM direct_messages
            WHERE id=?
              AND LOWER(sender_username)=LOWER(?)
              AND LOWER(recipient_username)=LOWER(?)
            """,
            (message_id, current, target),
        )

    return jsonify({"ok": True, "messageId": message_id})


@app.post("/api/messages/<username>/typing")
def update_chat_typing(username):
    current = _chat_current_user()
    if not current:
        return jsonify({"error": "Please log in to use chat."}), 401

    target = username.strip().lstrip("@")
    if not target or target.lower() == current.lower():
        return jsonify({"error": "Invalid chat user."}), 400

    data = request.get_json(silent=True) or {}
    typing = bool(data.get("typing"))
    now = datetime.now(timezone.utc)
    expires = (now + timedelta(seconds=8) if typing else now).isoformat()

    with get_db() as db:
        user = db.execute(
            "SELECT username FROM users WHERE username=? COLLATE NOCASE",
            (target,),
        ).fetchone()
        if not user:
            return jsonify({"error": "User not found."}), 404

        target = user["username"]
        if not _chat_preference(db, current, "messages.typingIndicator",
                                 _chat_preference(db, current, "messages.typing", True)):
            db.execute("""
                DELETE FROM direct_message_typing
                WHERE LOWER(sender_username)=LOWER(?) AND LOWER(recipient_username)=LOWER(?)
            """, (current, target))
            return jsonify({"ok": True, "typing": False})

        blocked_pair = db.execute("""
            SELECT 1 FROM people_blocks
            WHERE
                (LOWER(blocker)=LOWER(?) AND LOWER(blocked)=LOWER(?))
                OR
                (LOWER(blocker)=LOWER(?) AND LOWER(blocked)=LOWER(?))
            LIMIT 1
        """, (current, target, target, current)).fetchone()

        if blocked_pair:
            return jsonify({"error": "Typing status unavailable between these users."}), 403

        db.execute("""
            INSERT INTO direct_message_typing
                (sender_username, recipient_username, expires_at)
            VALUES (?, ?, ?)
            ON CONFLICT(sender_username, recipient_username)
            DO UPDATE SET expires_at=excluded.expires_at
        """, (current, target, expires))

    return jsonify({"ok": True})


@app.get("/api/messages/<username>/typing")
def get_chat_typing(username):
    current = _chat_current_user()
    if not current:
        return jsonify({"error": "Please log in to use chat."}), 401

    target = username.strip().lstrip("@")
    now = datetime.now(timezone.utc).isoformat()

    with get_db() as db:
        if not _chat_preference(db, current, "messages.typingIndicator",
                                 _chat_preference(db, current, "messages.typing", True)):
            return jsonify({"typing": False})
        blocked_pair = db.execute("""
            SELECT 1 FROM people_blocks
            WHERE
                (LOWER(blocker)=LOWER(?) AND LOWER(blocked)=LOWER(?))
                OR
                (LOWER(blocker)=LOWER(?) AND LOWER(blocked)=LOWER(?))
            LIMIT 1
        """, (current, target, target, current)).fetchone()

        if blocked_pair:
            return jsonify({"typing": False})

        row = db.execute("""
            SELECT expires_at FROM direct_message_typing
            WHERE LOWER(sender_username)=LOWER(?)
              AND LOWER(recipient_username)=LOWER(?)
        """, (target, current)).fetchone()

    return jsonify({"typing": bool(row and row["expires_at"] > now)})




def _send_social_activity_push(recipient, actor, kind, reference_id=None, notification_id=None):
    """Best-effort push delivery for social activity after its notification row is written."""
    messages = {
        "like": ("New like", f"@{actor} liked your post"),
        "comment": ("New comment", f"@{actor} commented on your post"),
        "reel_like": ("New reel like", f"@{actor} liked your reel"),
        "reel_comment": ("New reel comment", f"@{actor} commented on your reel"),
        "follow": ("New follower", f"@{actor} started following you"),
        "follow_request": ("Follow request", f"@{actor} requested to follow you"),
        "follow_accepted": ("Follow request accepted", f"@{actor} accepted your follow request"),
        "follow_rejected": ("Follow request update", f"@{actor} declined your follow request"),
    }
    title_body = messages.get(kind)
    if not title_body:
        return
    try:
        with get_db() as db:
            preferences = _chat_preferences(db, recipient)
            sound_enabled = preferences.get("notifications.sound", True) is not False
            rows = db.execute(
                "SELECT expo_push_token FROM call_push_tokens WHERE LOWER(username)=LOWER(?)",
                (recipient,),
            ).fetchall()
        for row in rows:
            payload = {
                "to": row["expo_push_token"],
                "title": title_body[0],
                "body": title_body[1],
                "sound": "default" if sound_enabled else None,
                "priority": "high",
                "channelId": "social-activity" if sound_enabled else "social-activity-silent",
                "data": {
                    "type": kind,
                    "actor": actor,
                    "referenceId": reference_id,
                    "notificationId": notification_id,
                    "soundEnabled": sound_enabled,
                },
            }
            req = urllib.request.Request(
                "https://exp.host/--/api/v2/push/send",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Accept": "application/json", "Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                result = json.loads(response.read().decode("utf-8") or "{}")
            tickets = result.get("data") if isinstance(result, dict) else None
            ticket_list = tickets if isinstance(tickets, list) else [tickets]
            if any(
                ticket and ticket.get("status") == "error"
                and ticket.get("details", {}).get("error") == "DeviceNotRegistered"
                for ticket in ticket_list
            ):
                with get_db() as db:
                    db.execute(
                        "DELETE FROM call_push_tokens WHERE expo_push_token=?",
                        (row["expo_push_token"],),
                    )
    except Exception:
        app.logger.exception("Could not send social activity push to %s", recipient)


def _people_notification(db, recipient, actor, kind, reference_id, now):
    if not recipient or not actor or recipient.lower() == actor.lower():
        return
    category = {
        "like": "likes",
        "gift_flower": "likes",
        "comment": "comments",
        "message": "messages",
        "follow": "follows",
        "follow_request": "requests",
        "reel_like": "reels", "reel_comment": "reels",
        "story_like": "likes",
        "follow_accepted": "follows",
        "follow_rejected": "follows",
        "system_alert": "system_alerts",
    }.get(kind, "system_alerts")
    pref = db.execute(
        "SELECT enabled FROM notification_preferences WHERE username=?",
        (recipient,),
    ).fetchone()
    detail = db.execute(
        f"SELECT {category} AS enabled FROM notification_detail_preferences WHERE username=?",
        (recipient,),
    ).fetchone()
    if pref and not pref["enabled"]:
        return
    if detail and not detail["enabled"]:
        return
    notification_id = uuid.uuid4().hex
    db.execute("""
        INSERT INTO people_notifications
        (id, recipient, actor, kind, reference_id, created_at, is_read)
        VALUES (?, ?, ?, ?, ?, ?, 0)
    """, (notification_id, recipient, actor, kind, reference_id, now))
    if kind in {"like", "gift_flower", "comment", "reel_like", "reel_comment", "story_like", "follow", "follow_request", "follow_accepted", "follow_rejected"}:
        # Do not hold the request's database transaction open while contacting Expo.
        threading.Thread(
            target=_send_social_activity_push,
            args=(recipient, actor, kind, reference_id, notification_id),
            daemon=True,
        ).start()



def init_people_connect_tables():
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS notification_preferences (
                username TEXT PRIMARY KEY,
                enabled INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS notification_detail_preferences (
                username TEXT PRIMARY KEY,
                likes INTEGER NOT NULL DEFAULT 1,
                comments INTEGER NOT NULL DEFAULT 1,
                follows INTEGER NOT NULL DEFAULT 1,
                requests INTEGER NOT NULL DEFAULT 1,
                messages INTEGER NOT NULL DEFAULT 1,
                reels INTEGER NOT NULL DEFAULT 1,
                system_alerts INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL
            )
        """)
    with get_db() as db:
        try:
            db.execute("ALTER TABLE notification_detail_preferences ADD COLUMN requests INTEGER NOT NULL DEFAULT 1")
        except Exception:
            # The column already exists on upgraded databases.
            pass
        try:
            db.execute("ALTER TABLE notification_detail_preferences ADD COLUMN reels INTEGER NOT NULL DEFAULT 1")
        except Exception:
            # The column already exists on upgraded databases.
            pass
        db.execute("""
            CREATE TABLE IF NOT EXISTS follow_requests (
                id TEXT PRIMARY KEY,
                requester TEXT NOT NULL,
                target TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(requester, target)
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS people_blocks (
                blocker TEXT NOT NULL,
                blocked TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY(blocker, blocked),
                CHECK(blocker <> blocked)
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS people_restrictions (
                owner TEXT NOT NULL,
                restricted TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY(owner, restricted),
                CHECK(owner <> restricted)
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS feed_user_lists (
                owner_username TEXT NOT NULL,
                target_username TEXT NOT NULL,
                list_type TEXT NOT NULL CHECK(list_type IN ('favorite','muted')),
                created_at TEXT NOT NULL,
                PRIMARY KEY(owner_username, target_username, list_type),
                CHECK(LOWER(owner_username) <> LOWER(target_username))
            )
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_feed_user_lists_owner_type
            ON feed_user_lists(owner_username, list_type, created_at DESC)
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS people_notifications (
                id TEXT PRIMARY KEY,
                recipient TEXT NOT NULL,
                actor TEXT NOT NULL,
                kind TEXT NOT NULL,
                reference_id TEXT,
                created_at TEXT NOT NULL,
                is_read INTEGER NOT NULL DEFAULT 0
            )
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_people_notifications_recipient
            ON people_notifications(recipient, created_at)
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS post_gifts (
                id TEXT PRIMARY KEY,
                content_id INTEGER NOT NULL,
                sender_username TEXT NOT NULL,
                recipient_username TEXT NOT NULL,
                gift_type TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_post_gifts_recipient
            ON post_gifts(recipient_username, created_at DESC)
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_post_gifts_sender
            ON post_gifts(sender_username, created_at DESC)
        """)


# Initialize database only after all functions and routes are defined.
init_db()
init_profile_tables()
init_auth_tables()
init_chat_tables()
init_call_tables()
init_notes_tables()
init_people_connect_tables()



# SOCIALAPP_FEED_USER_LISTS_V1
@app.get("/api/feed/lists")
def get_feed_user_lists():
    owner = getattr(g, "auth_username", None)
    if not owner:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        rows = db.execute("""
            SELECT l.target_username, l.list_type, l.created_at,
                   COALESCE(NULLIF(p.display_name, ''), u.username) AS display_name,
                   p.avatar_url
            FROM feed_user_lists l
            JOIN users u ON LOWER(u.username)=LOWER(l.target_username)
            LEFT JOIN profiles p ON LOWER(p.username)=LOWER(l.target_username)
            WHERE LOWER(l.owner_username)=LOWER(?)
            ORDER BY l.created_at DESC
        """, (owner,)).fetchall()
    items = {"favorites": [], "muted": []}
    for row in rows:
        key = "favorites" if row["list_type"] == "favorite" else "muted"
        items[key].append({
            "username": row["target_username"],
            "displayName": row["display_name"],
            "avatarUrl": row["avatar_url"],
            "createdAt": row["created_at"],
        })
    response = jsonify(items)
    response.headers["Cache-Control"] = "no-store"
    return response


@app.post("/api/feed/lists")
def add_feed_user_list():
    owner = getattr(g, "auth_username", None)
    if not owner:
        return jsonify({"error": "Please log in first."}), 401
    data = request.get_json(silent=True) or {}
    list_type = str(data.get("list_type") or "").strip().lower()
    target = str(data.get("username") or "").strip().lstrip("@")
    if list_type not in ("favorite", "muted"):
        return jsonify({"error": "Choose Favorites or Muted."}), 400
    if not target or len(target) > 50 or target.casefold() == owner.casefold():
        return jsonify({"error": "Enter another valid username."}), 400
    with get_db() as db:
        user = db.execute(
            "SELECT username FROM users WHERE LOWER(username)=LOWER(?)",
            (target,),
        ).fetchone()
        if not user:
            return jsonify({"error": "Account not found."}), 404
        target = user["username"]
        now = datetime.now(timezone.utc).isoformat()
        db.execute("""
            DELETE FROM feed_user_lists
            WHERE LOWER(owner_username)=LOWER(?) AND LOWER(target_username)=LOWER(?)
              AND list_type=?
        """, (owner, target, "muted" if list_type == "favorite" else "favorite"))
        db.execute("""
            INSERT INTO feed_user_lists(owner_username, target_username, list_type, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(owner_username, target_username, list_type) DO NOTHING
        """, (owner, target, list_type, now))
    return jsonify({"ok": True, "username": target, "list_type": list_type})


@app.delete("/api/feed/lists/<list_type>/<username>")
def remove_feed_user_list(list_type, username):
    owner = getattr(g, "auth_username", None)
    if not owner:
        return jsonify({"error": "Please log in first."}), 401
    if list_type not in ("favorite", "muted"):
        return jsonify({"error": "Invalid list."}), 400
    target = username.strip().lstrip("@")
    if not target or len(target) > 50:
        return jsonify({"error": "Invalid username."}), 400
    with get_db() as db:
        result = db.execute("""
            DELETE FROM feed_user_lists
            WHERE LOWER(owner_username)=LOWER(?) AND LOWER(target_username)=LOWER(?)
              AND list_type=?
        """, (owner, target, list_type))
        if result.rowcount == 0:
            return jsonify({"error": "Account was not in this list."}), 404
    return jsonify({"ok": True, "username": target, "list_type": list_type})


# SOCIALAPP_SETTINGS_PREFERENCES_V1
@app.get("/api/settings/preferences")
def get_settings_preferences():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS user_settings_preferences (
                username TEXT PRIMARY KEY,
                preferences_json TEXT NOT NULL DEFAULT '{}',
                updated_at TEXT NOT NULL
            )
        """)
        row = db.execute(
            "SELECT preferences_json FROM user_settings_preferences WHERE LOWER(username)=LOWER(?)",
            (username,),
        ).fetchone()
    try:
        preferences = json.loads(row["preferences_json"]) if row else {}
    except (TypeError, ValueError):
        preferences = {}
    return jsonify({"preferences": preferences})


@app.patch("/api/settings/preferences")
def patch_settings_preferences():
    username = getattr(g, "auth_username", None)
    if not username:
        return jsonify({"error": "Please log in first."}), 401
    changes = request.get_json(silent=True)
    if not isinstance(changes, dict) or not changes:
        return jsonify({"error": "Provide settings to update."}), 400
    if len(changes) > 100:
        return jsonify({"error": "Too many settings in one update."}), 400
    allowed_prefixes = (
        "location.", "privacy.", "security.", "notifications.",
        "messages.", "story.", "feed.", "appearance.", "advanced.",
        "profile.", "account.", "creator.", "protection.", "data.", "premium."
    )
    for key, value in changes.items():
        if not isinstance(key, str) or not key.startswith(allowed_prefixes):
            return jsonify({"error": "Invalid settings key."}), 400
        if not isinstance(value, (bool, str, int, float, type(None))):
            return jsonify({"error": "Invalid setting value."}), 400
        if isinstance(value, str) and len(value) > 200:
            return jsonify({"error": "Setting value is too long."}), 400
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS user_settings_preferences (
                username TEXT PRIMARY KEY,
                preferences_json TEXT NOT NULL DEFAULT '{}',
                updated_at TEXT NOT NULL
            )
        """)
        row = db.execute(
            "SELECT preferences_json FROM user_settings_preferences WHERE LOWER(username)=LOWER(?)",
            (username,),
        ).fetchone()
        try:
            current = json.loads(row["preferences_json"]) if row else {}
        except (TypeError, ValueError):
            current = {}
        current.update(changes)
        db.execute("""
            INSERT INTO user_settings_preferences(username, preferences_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                preferences_json=excluded.preferences_json,
                updated_at=excluded.updated_at
        """, (username, json.dumps(current, separators=(",", ":")), now))
    return jsonify({"ok": True, "preferences": current})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)

@app.get("/api/admin/analytics")
def admin_analytics():
    """Aggregate-only, read-only production analytics for the private admin dashboard."""
    import secrets
    import time

    expected = os.environ.get("DASHBOARD_ADMIN_TOKEN", "").strip()
    supplied = request.headers.get("X-Dashboard-Token", "")
    if not expected or not supplied or not secrets.compare_digest(supplied, expected):
        return jsonify({"error": "Unauthorized"}), 401

    from server.db_compat import postgres_enabled
    if not postgres_enabled():
        return jsonify({"error": "Production PostgreSQL is not configured"}), 503

    started = time.perf_counter()
    try:
        with get_db() as db:
            def count_table(table):
                row = db.execute('SELECT COUNT(*) AS total FROM "' + table + '"').fetchone()
                return int(row["total"] or 0)

            totals = {
                "users": count_table("users"),
                "posts": 0,
                "reels": 0,
                "stories": 0,
                "follows": count_table("follows"),
                "post_likes": count_table("post_likes"),
                "post_comments": count_table("post_comments"),
                "reel_likes": count_table("reel_likes"),
                "reel_comments": count_table("reel_comments"),
                "messages": count_table("direct_messages"),
                "notifications": count_table("people_notifications"),
                "sessions": count_table("auth_sessions"),
            }

            for row in db.execute(
                "SELECT kind, COUNT(*) AS total FROM content GROUP BY kind"
            ).fetchall():
                key = str(row["kind"] or "").lower()
                if key in ("posts", "reels", "stories"):
                    totals[key] = int(row["total"] or 0)

            now = datetime.now(timezone.utc)
            active_sessions = 0
            for row in db.execute("SELECT expires_at FROM auth_sessions").fetchall():
                try:
                    expiry = datetime.fromisoformat(str(row["expires_at"]).replace("Z", "+00:00"))
                    if expiry.tzinfo is None:
                        expiry = expiry.replace(tzinfo=timezone.utc)
                    if expiry > now:
                        active_sessions += 1
                except (TypeError, ValueError):
                    continue

            online_users = 0
            for row in db.execute("SELECT last_seen_at FROM user_presence").fetchall():
                try:
                    seen = datetime.fromisoformat(str(row["last_seen_at"]).replace("Z", "+00:00"))
                    if seen.tzinfo is None:
                        seen = seen.replace(tzinfo=timezone.utc)
                    if (now - seen).total_seconds() <= 300:
                        online_users += 1
                except (TypeError, ValueError):
                    continue

            size_row = db.execute(
                "SELECT pg_database_size(current_database()) AS size_bytes"
            ).fetchone()
            database_size_bytes = int(size_row["size_bytes"] or 0)

        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        response = jsonify({
            "ok": True,
            "source": "Neon PostgreSQL production",
            "database": "connected",
            "query_time_ms": elapsed_ms,
            "database_size_bytes": database_size_bytes,
            "online_users_5m": online_users,
            "active_sessions": active_sessions,
            "totals": totals,
            "checked_at": datetime.now(timezone.utc).isoformat(),
        })
        response.headers["Cache-Control"] = "no-store, max-age=0"
        return response
    except Exception:
        app.logger.exception("Admin analytics query failed")
        return jsonify({"ok": False, "error": "Analytics query failed"}), 503



# PRIVATE ADMIN USER DIRECTORY V1
@app.get("/api/admin/users")
def admin_users_directory():
    import secrets
    expected = os.environ.get("DASHBOARD_ADMIN_TOKEN", "").strip()
    supplied = request.headers.get("X-Dashboard-Token", "")
    if not expected or not supplied or not secrets.compare_digest(supplied, expected):
        return jsonify({"error": "Unauthorized"}), 401
    from server.db_compat import postgres_enabled
    if not postgres_enabled():
        return jsonify({"error": "Production PostgreSQL is not configured"}), 503
    query = str(request.args.get("q", "")).strip()[:60]
    try:
        limit = min(200, max(1, int(request.args.get("limit", "100"))))
    except (TypeError, ValueError):
        limit = 100
    pattern = "%" + query.lower() + "%"
    try:
        with get_db() as db:
            rows = db.execute("""
                SELECT u.username,
                       u.created_at AS account_created_at,
                       COALESCE(NULLIF(p.display_name, ''), u.username) AS display_name,
                       p.bio AS bio,
                       p.avatar_url AS avatar_url,
                       COALESCE(fc.followers, 0) AS followers,
                       COALESCE(fg.following, 0) AS following,
                       COALESCE(pc.posts, 0) AS posts,
                       COALESCE(ms.sent, 0) AS messages_sent,
                       COALESCE(mr.received, 0) AS messages_received,
                       pr.last_seen_at AS last_seen_at
                FROM users u
                LEFT JOIN profiles p ON LOWER(p.username)=LOWER(u.username)
                LEFT JOIN (
                    SELECT following, COUNT(*) AS followers FROM follows GROUP BY following
                ) fc ON LOWER(fc.following)=LOWER(u.username)
                LEFT JOIN (
                    SELECT follower, COUNT(*) AS following FROM follows GROUP BY follower
                ) fg ON LOWER(fg.follower)=LOWER(u.username)
                LEFT JOIN (
                    SELECT username, COUNT(*) AS posts FROM content WHERE kind='posts' GROUP BY username
                ) pc ON LOWER(pc.username)=LOWER(u.username)
                LEFT JOIN (
                    SELECT sender_username, COUNT(*) AS sent FROM direct_messages GROUP BY sender_username
                ) ms ON LOWER(ms.sender_username)=LOWER(u.username)
                LEFT JOIN (
                    SELECT recipient_username, COUNT(*) AS received FROM direct_messages GROUP BY recipient_username
                ) mr ON LOWER(mr.recipient_username)=LOWER(u.username)
                LEFT JOIN user_presence pr ON LOWER(pr.username)=LOWER(u.username)
                WHERE (? = '' OR LOWER(u.username) LIKE ? OR LOWER(COALESCE(p.display_name,'')) LIKE ?)
                ORDER BY u.created_at DESC
                LIMIT ?
            """, (query, pattern, pattern, limit)).fetchall()
        now = datetime.now(timezone.utc)
        users = []
        for row in rows:
            item = dict(row)
            seen = item.get("last_seen_at")
            online = False
            if seen:
                try:
                    stamp = datetime.fromisoformat(str(seen).replace("Z", "+00:00"))
                    if stamp.tzinfo is None:
                        stamp = stamp.replace(tzinfo=timezone.utc)
                    online = (now - stamp).total_seconds() <= 300
                except (TypeError, ValueError):
                    pass
            item["is_online"] = online
            # Location is intentionally omitted until the account owner opts in.
            item.pop("password", None)
            item.pop("password_hash", None)
            users.append(item)
        response = jsonify({"ok": True, "users": users, "count": len(users), "limit": limit})
        response.headers["Cache-Control"] = "no-store, max-age=0"
        return response
    except Exception:
        app.logger.exception("Admin user directory query failed")
        return jsonify({"ok": False, "error": "User directory query failed"}), 503


@app.get("/api/admin/users/<username>")
def admin_user_activity_summary(username):
    import secrets
    expected = os.environ.get("DASHBOARD_ADMIN_TOKEN", "").strip()
    supplied = request.headers.get("X-Dashboard-Token", "")
    if not expected or not supplied or not secrets.compare_digest(supplied, expected):
        return jsonify({"error": "Unauthorized"}), 401
    username = str(username or "").strip().lstrip("@")[:50]
    if not username:
        return jsonify({"error": "Invalid username"}), 400
    try:
        with get_db() as db:
            user = db.execute("""
                SELECT u.username, u.created_at AS account_created_at,
                       COALESCE(NULLIF(p.display_name,''),u.username) AS display_name,
                       p.bio, p.avatar_url, pr.last_seen_at
                FROM users u
                LEFT JOIN profiles p ON LOWER(p.username)=LOWER(u.username)
                LEFT JOIN user_presence pr ON LOWER(pr.username)=LOWER(u.username)
                WHERE LOWER(u.username)=LOWER(?) LIMIT 1
            """, (username,)).fetchone()
            if not user:
                return jsonify({"error": "User not found"}), 404
            followers = db.execute("SELECT follower, created_at FROM follows WHERE LOWER(following)=LOWER(?) ORDER BY created_at DESC LIMIT 200", (username,)).fetchall()
            following = db.execute("SELECT following, created_at FROM follows WHERE LOWER(follower)=LOWER(?) ORDER BY created_at DESC LIMIT 200", (username,)).fetchall()
            chats = db.execute("""
                SELECT CASE WHEN LOWER(sender_username)=LOWER(?) THEN recipient_username ELSE sender_username END AS peer,
                       COUNT(*) AS message_count, MIN(created_at) AS first_message_at,
                       MAX(created_at) AS last_message_at
                FROM direct_messages
                WHERE LOWER(sender_username)=LOWER(?) OR LOWER(recipient_username)=LOWER(?)
                GROUP BY peer ORDER BY last_message_at DESC LIMIT 100
            """, (username, username, username)).fetchall()
            # Session history is optional on older production databases.
            # Check the schema first so a missing table cannot abort the whole
            # admin detail request (and PostgreSQL transaction).
            presence_columns = db.execute("PRAGMA table_info(user_presence_history)").fetchall()
            if presence_columns:
                presence_history = db.execute("""
                    SELECT event, changed_at FROM user_presence_history
                    WHERE LOWER(username)=LOWER(?) ORDER BY changed_at DESC LIMIT 200
                """, (username,)).fetchall()
            else:
                presence_history = []
        response = jsonify({
            "ok": True, "user": dict(user),
            "followers": [dict(x) for x in followers],
            "following": [dict(x) for x in following],
            "chat_activity": [dict(x) for x in chats],
            "presence_history": [dict(x) for x in presence_history],
            "privacy_note": "Chat contents are not exposed; only conversation metadata is shown. Location is shown only after explicit user consent and is not yet enabled."
        })
        response.headers["Cache-Control"] = "no-store, max-age=0"
        return response
    except Exception:
        app.logger.exception("Admin user detail query failed")
        return jsonify({"ok": False, "error": "User detail query failed"}), 503
