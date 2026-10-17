import os
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"
DB_PATH = DATA_DIR / "socialapp.db"

MAX_UPLOAD_BYTES = 50 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    "posts": {"jpg", "jpeg", "png", "webp", "gif", "mp4", "mov", "webm"},
    "stories": {"jpg", "jpeg", "png", "webp", "mp4", "mov", "webm"},
    "reels": {"mp4", "mov", "webm"},
}

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


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
                created_at TEXT NOT NULL,
                expires_at TEXT
            )
        """)
        db.execute("""
            CREATE INDEX IF NOT EXISTS idx_content_kind_id
            ON content(kind, id DESC)
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


def content_json(row):
    return {
        "id": row["id"],
        "type": row["kind"],
        "user": row["username"],
        "caption": row["caption"],
        "mediaUrl": row["media_url"],
        "mediaType": row["media_type"],
        "createdAt": row["created_at"],
        "expiresAt": row["expires_at"],
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


@app.get("/api/health")
def health():
    return jsonify({
        "ok": True,
        "service": "SocialApp Server",
        "time": datetime.now(timezone.utc).isoformat(),
    })


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

    return jsonify({"items": [content_json(row) for row in rows]})


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
    username = request.form.get("username", "you").strip() or "you"

    folder = UPLOAD_DIR / kind
    stored_name = f"{uuid.uuid4().hex}.{extension}"
    destination = folder / stored_name

    try:
        media.save(destination)

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
        media_url = f"/uploads/{kind}/{stored_name}"

        with get_db() as db:
            cursor = db.execute(
                """
                INSERT INTO content
                    (kind, username, caption, media_url, media_type,
                     created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    kind, username, caption, media_url, media_type,
                    created_at, expires_at,
                ),
            )
            row = db.execute(
                "SELECT * FROM content WHERE id=?",
                (cursor.lastrowid,),
            ).fetchone()

        return jsonify({"ok": True, "item": content_json(row)}), 201

    except Exception:
        destination.unlink(missing_ok=True)
        app.logger.exception("Could not save uploaded media")
        return jsonify({"error": "Could not save media"}), 500


@app.get("/uploads/<kind>/<filename>")
def uploaded_file(kind, filename):
    if kind not in ALLOWED_EXTENSIONS and kind != "profiles":
        return jsonify({"error": "Unknown media type"}), 404

    return send_from_directory(UPLOAD_DIR / kind, filename)


@app.errorhandler(413)
def file_too_large(error):
    return jsonify({"error": "File exceeds the 50 MB upload limit"}), 413


@app.get("/")
def index():
    return jsonify({
        "service": "SocialApp Server",
        "health": "/api/health",
        "endpoints": ["/api/posts", "/api/stories", "/api/reels"],
    })


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
            CREATE TABLE IF NOT EXISTS user_settings (
                username TEXT PRIMARY KEY,
                is_private INTEGER NOT NULL DEFAULT 0,
                show_activity INTEGER NOT NULL DEFAULT 1,
                allow_messages INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL
            )
        """)


def profile_json(db, username):
    row = db.execute(
        "SELECT * FROM profiles WHERE username=?", (username,)
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
            "SELECT * FROM profiles WHERE username=?", (username,)
        ).fetchone()

    posts = db.execute(
        "SELECT COUNT(*) FROM content WHERE kind='posts' AND username=?",
        (username,),
    ).fetchone()[0]
    followers = db.execute(
        "SELECT COUNT(*) FROM follows WHERE following=?", (username,)
    ).fetchone()[0]
    following = db.execute(
        "SELECT COUNT(*) FROM follows WHERE follower=?", (username,)
    ).fetchone()[0]
    return {
        "username": row["username"],
        "displayName": row["display_name"],
        "bio": row["bio"],
        "avatarUrl": row["avatar_url"],
        "postsCount": posts,
        "followersCount": followers,
        "followingCount": following,
    }


@app.get("/api/profile/<username>")
def get_profile(username):
    username = username.strip().lstrip("@")
    if not username or len(username) > 30:
        return jsonify({"error": "Invalid username"}), 400
    with get_db() as db:
        result = profile_json(db, username)
        viewer = request.args.get("viewer", "you").strip().lstrip("@") or "you"
        result["isFollowing"] = bool(db.execute(
            "SELECT 1 FROM follows WHERE follower=? AND following=?",
            (viewer, username),
        ).fetchone())
    return jsonify({"profile": result})


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
                            "error": f"Display name अगली बार {next_date} से बदल सकते हैं।"
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
    username = username.strip().lstrip("@")
    data = request.get_json(silent=True) or {}
    viewer = str(data.get("viewer", "you")).strip().lstrip("@") or "you"
    if username == viewer:
        return jsonify({"error": "You cannot follow yourself"}), 400
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        profile_json(db, username)
        profile_json(db, viewer)
        db.execute(
            "INSERT OR IGNORE INTO follows (follower, following, created_at) VALUES (?, ?, ?)",
            (viewer, username, now),
        )
        result = profile_json(db, username)
    return jsonify({"ok": True, "profile": result})


@app.delete("/api/profile/<username>/follow")
def unfollow_profile(username):
    username = username.strip().lstrip("@")
    viewer = request.args.get("viewer", "you").strip().lstrip("@") or "you"
    with get_db() as db:
        db.execute("DELETE FROM follows WHERE follower=? AND following=?",
                   (viewer, username))
        result = profile_json(db, username)
    return jsonify({"ok": True, "profile": result})


@app.get("/api/profile/<username>/followers")
def list_followers(username):
    username = username.strip().lstrip("@")
    with get_db() as db:
        rows = db.execute(
            "SELECT follower FROM follows WHERE following=? ORDER BY created_at DESC",
            (username,),
        ).fetchall()
    return jsonify({"users": [r["follower"] for r in rows]})


@app.get("/api/profile/<username>/following")
def list_following(username):
    username = username.strip().lstrip("@")
    with get_db() as db:
        rows = db.execute(
            "SELECT following FROM follows WHERE follower=? ORDER BY created_at DESC",
            (username,),
        ).fetchall()
    return jsonify({"users": [r["following"] for r in rows]})


# SOCIALAPP_PRIVACY_SETTINGS_V1
@app.get("/api/profile/<username>/settings")
def get_user_settings(username):
    username = username.strip().lstrip("@")
    if not username:
        return jsonify({"error": "Username is required"}), 400

    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        db.execute(
            """INSERT OR IGNORE INTO user_settings
               (username, updated_at) VALUES (?, ?)""",
            (username, now),
        )
        row = db.execute(
            "SELECT is_private, show_activity, allow_messages FROM user_settings WHERE username=?",
            (username,),
        ).fetchone()

    return jsonify({
        "settings": {
            "isPrivate": bool(row["is_private"]),
            "showActivity": bool(row["show_activity"]),
            "allowMessages": bool(row["allow_messages"]),
        }
    })


@app.patch("/api/profile/<username>/settings")
def update_user_settings(username):
    username = username.strip().lstrip("@")
    if not username:
        return jsonify({"error": "Username is required"}), 400

    data = request.get_json(silent=True) or {}
    fields = {
        "isPrivate": "is_private",
        "showActivity": "show_activity",
        "allowMessages": "allow_messages",
    }

    if not data or any(key not in fields for key in data):
        return jsonify({"error": "Provide valid settings"}), 400

    if any(not isinstance(value, bool) for value in data.values()):
        return jsonify({"error": "Setting values must be true or false"}), 400

    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        db.execute(
            "INSERT OR IGNORE INTO user_settings (username, updated_at) VALUES (?, ?)",
            (username, now),
        )
        for key, value in data.items():
            db.execute(
                f"UPDATE user_settings SET {fields[key]}=?, updated_at=? WHERE username=?",
                (int(value), now, username),
            )
        row = db.execute(
            "SELECT is_private, show_activity, allow_messages FROM user_settings WHERE username=?",
            (username,),
        ).fetchone()

    return jsonify({
        "ok": True,
        "settings": {
            "isPrivate": bool(row["is_private"]),
            "showActivity": bool(row["show_activity"]),
            "allowMessages": bool(row["allow_messages"]),
        }
    })

# SOCIALAPP_POST_INTERACTIONS_V1
@app.post("/api/posts/<int:content_id>/like")
def toggle_post_like(content_id):
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "you")).strip() or "you"
    now = datetime.now(timezone.utc).isoformat()

    with get_db() as db:
        post = db.execute(
            "SELECT id FROM content WHERE id=? AND kind='posts'",
            (content_id,),
        ).fetchone()
        if post is None:
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

        count = db.execute(
            "SELECT COUNT(*) AS total FROM post_likes WHERE content_id=?",
            (content_id,),
        ).fetchone()["total"]

    return jsonify({"ok": True, "liked": liked, "likes": count})


@app.get("/api/posts/<int:content_id>/comments")
def list_post_comments(content_id):
    with get_db() as db:
        post = db.execute(
            "SELECT id FROM content WHERE id=? AND kind='posts'",
            (content_id,),
        ).fetchone()
        if post is None:
            return jsonify({"error": "Post not found"}), 404

        rows = db.execute(
            """SELECT id, username, text, created_at
               FROM post_comments WHERE content_id=?
               ORDER BY id ASC""",
            (content_id,),
        ).fetchall()

    return jsonify({
        "ok": True,
        "comments": [
            {
                "id": row["id"],
                "username": row["username"],
                "text": row["text"],
                "createdAt": row["created_at"],
            }
            for row in rows
        ],
    })


@app.post("/api/posts/<int:content_id>/comments")
def create_post_comment(content_id):
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "you")).strip() or "you"
    text = str(data.get("text", "")).strip()

    if not text:
        return jsonify({"error": "Comment cannot be empty"}), 400
    if len(text) > 2000:
        return jsonify({"error": "Comment is too long"}), 400

    now = datetime.now(timezone.utc).isoformat()

    with get_db() as db:
        post = db.execute(
            "SELECT id FROM content WHERE id=? AND kind='posts'",
            (content_id,),
        ).fetchone()
        if post is None:
            return jsonify({"error": "Post not found"}), 404

        cursor = db.execute(
            """INSERT INTO post_comments
               (content_id, username, text, created_at)
               VALUES (?, ?, ?, ?)""",
            (content_id, username, text, now),
        )
        row = db.execute(
            "SELECT id, username, text, created_at FROM post_comments WHERE id=?",
            (cursor.lastrowid,),
        ).fetchone()

    return jsonify({
        "ok": True,
        "comment": {
            "id": row["id"],
            "username": row["username"],
            "text": row["text"],
            "createdAt": row["created_at"],
        },
    }), 201



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
        columns = {row["name"] for row in db.execute("PRAGMA table_info(users)")}
        if "phone_number" not in columns:
            db.execute("ALTER TABLE users ADD COLUMN phone_number TEXT")
        db.execute("""
            CREATE TABLE IF NOT EXISTS auth_sessions (
                token_hash TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
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
    return row["username"] if row else None

@app.before_request
def enforce_authenticated_mutations():
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return None
    if request.path in ("/api/auth/register", "/api/auth/login"):
        return None
    if not request.path.startswith("/api/"):
        return None

    username = _auth_user()
    if not username:
        return jsonify({"error": "कृपया पहले लॉगिन करें।"}), 401

    g.auth_username = username
    supplied = request.form.get("username")
    if supplied and supplied.strip().lstrip("@").lower() != username.lower():
        return jsonify({"error": "लॉगिन अकाउंट से ही पोस्ट करें।"}), 403

    if request.path.startswith("/api/profile/"):
        parts = request.path.split("/")
        if len(parts) >= 4:
            target = parts[3].strip().lstrip("@")
            if target and target.lower() != username.lower():
                return jsonify({"error": "दूसरे अकाउंट में बदलाव की अनुमति नहीं है।"}), 403

    data = request.get_json(silent=True) or {}
    supplied_json = data.get("username") or data.get("viewer")
    if supplied_json and str(supplied_json).strip().lstrip("@").lower() != username.lower():
        return jsonify({"error": "लॉगिन अकाउंट से ही यह काम करें।"}), 403
    return None

@app.post("/api/auth/register")
def auth_register():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip().lstrip("@")
    password = str(data.get("password", ""))
    phone_number = str(data.get("phone_number", "")).strip()
    phone_digits = "".join(ch for ch in phone_number if ch.isdigit())
    if len(phone_digits) < 10 or len(phone_digits) > 15:
        return jsonify({"error": "कृपया सही मोबाइल नंबर दर्ज करें।"}), 400
    if not username or not username.replace("_", "").replace(".", "").isalnum() or len(username) < 3 or len(username) > 30:
        return jsonify({"error": "यूज़रनेम 3 से 30 अक्षरों का होना चाहिए।"}), 400
    if len(password) < 8 or len(password) > 128:
        return jsonify({"error": "पासवर्ड 8 से 128 अक्षरों का रखें।"}), 400

    now = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(32)
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    expires = (now + timedelta(days=30)).isoformat()
    try:
        with get_db() as db:
            db.execute(
                "INSERT INTO users(username,password_hash,created_at,phone_number) VALUES(?,?,?,?)",
                (username, generate_password_hash(password), now.isoformat(), phone_number)
            )
            db.execute(
                "INSERT INTO auth_sessions(token_hash,username,created_at,expires_at) VALUES(?,?,?,?)",
                (digest, username, now.isoformat(), expires)
            )
            profile_json(db, username)
            db.execute(
                "INSERT OR IGNORE INTO user_settings(username,updated_at) VALUES(?,?)",
                (username, now.isoformat())
            )
    except sqlite3.IntegrityError:
        return jsonify({"error": "यह यूज़रनेम पहले से मौजूद है।"}), 409
    return jsonify({"ok": True, "username": username, "token": token}), 201

@app.post("/api/auth/login")
def auth_login():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip().lstrip("@")
    password = str(data.get("password", ""))
    with get_db() as db:
        row = db.execute(
            "SELECT username,password_hash FROM users WHERE username=? COLLATE NOCASE",
            (username,)
        ).fetchone()
        if not row or not check_password_hash(row["password_hash"], password):
            return jsonify({"error": "यूज़रनेम या पासवर्ड गलत है।"}), 401
        now = datetime.now(timezone.utc)
        token = secrets.token_urlsafe(32)
        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        expires = (now + timedelta(days=30)).isoformat()
        db.execute(
            "INSERT INTO auth_sessions(token_hash,username,created_at,expires_at) VALUES(?,?,?,?)",
            (digest, row["username"], now.isoformat(), expires)
        )
    return jsonify({"ok": True, "username": row["username"], "token": token})

@app.get("/api/auth/me")
def auth_me():
    username = _auth_user()
    if not username:
        return jsonify({"error": "लॉगिन आवश्यक है।"}), 401
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


# Initialize database only after all functions and routes are defined.
init_db()
init_profile_tables()
init_auth_tables()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)
