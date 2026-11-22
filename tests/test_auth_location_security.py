import hashlib
import sqlite3
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import server.app as server_app


class AuthLocationSecurityApiTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db_patch = patch.object(server_app, "get_db", return_value=self.db)
        self.db_patch.start()
        server_app.init_auth_tables()
        self.db.execute("""
            CREATE TABLE follows (
                follower TEXT NOT NULL,
                following TEXT NOT NULL,
                created_at TEXT
            )
        """)
        self.db.execute(
            "INSERT INTO users(username,password_hash,created_at) VALUES(?,?,?)",
            ("alice", server_app.generate_password_hash("secret123"), datetime.now(timezone.utc).isoformat()),
        )
        self.db.execute(
            "INSERT INTO users(username,password_hash,created_at) VALUES(?,?,?)",
            ("bob", server_app.generate_password_hash("secret123"), datetime.now(timezone.utc).isoformat()),
        )
        self.db.commit()
        self.client = server_app.app.test_client()

    def tearDown(self):
        self.db_patch.stop()
        self.db.close()

    def _auth(self, username="alice"):
        token = "test-token-for-" + username + "-with-enough-entropy"
        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        now = datetime.now(timezone.utc).isoformat()
        self.db.execute(
            "INSERT OR REPLACE INTO auth_sessions(token_hash,username,created_at,expires_at,device_label,last_seen_at) VALUES(?,?,?,?,?,?)",
            (digest, username, now, "9999-12-31T23:59:59+00:00", "Test Android", now),
        )
        self.db.commit()
        return token

    def test_successful_login_is_recorded_and_visible_in_history(self):
        response = self.client.post(
            "/api/auth/login",
            json={"username": "alice", "password": "secret123"},
            headers={"User-Agent": "Bhumi Social AI Android Test"},
        )
        self.assertEqual(response.status_code, 200)
        token = response.get_json()["token"]
        history = self.client.get(
            "/api/auth/login-history",
            headers={"Authorization": "Bearer " + token},
        )
        self.assertEqual(history.status_code, 200)
        item = history.get_json()["items"][0]
        self.assertEqual(item["device_label"], "Bhumi Social AI Android Test")
        self.assertTrue(item["is_current"])
        self.assertTrue(item["session_active"])

    def test_active_sessions_can_be_listed_and_other_session_revoked(self):
        current = self._auth()
        other = "test-token-for-other-session-with-entropy"
        other_digest = hashlib.sha256(other.encode("utf-8")).hexdigest()
        now = datetime.now(timezone.utc).isoformat()
        self.db.execute(
            "INSERT INTO auth_sessions(token_hash,username,created_at,expires_at,device_label,last_seen_at) VALUES(?,?,?,?,?,?)",
            (other_digest, "alice", now, "9999-12-31T23:59:59+00:00", "Old phone", now),
        )
        self.db.commit()
        headers = {"Authorization": "Bearer " + current}
        listed = self.client.get("/api/auth/sessions", headers=headers)
        self.assertEqual(listed.status_code, 200)
        old_session = next(item for item in listed.get_json()["items"] if not item["is_current"])
        revoked = self.client.delete("/api/auth/sessions/" + old_session["id"], headers=headers)
        self.assertEqual(revoked.status_code, 200)
        self.assertIsNone(self.db.execute("SELECT 1 FROM auth_sessions WHERE token_hash=?", (other_digest,)).fetchone())

    def test_location_sharing_requires_mutual_follow(self):
        token = self._auth()
        response = self.client.post(
            "/api/location/shares",
            json={"recipient_username": "bob", "latitude": 23.02, "longitude": 72.57, "duration_minutes": 60},
            headers={"Authorization": "Bearer " + token},
        )
        self.assertEqual(response.status_code, 403)

    def test_mutual_followers_can_share_and_either_side_can_stop(self):
        token = self._auth()
        now = datetime.now(timezone.utc).isoformat()
        self.db.executemany(
            "INSERT INTO follows(follower,following,created_at) VALUES(?,?,?)",
            [("alice", "bob", now), ("bob", "alice", now)],
        )
        self.db.commit()
        headers = {"Authorization": "Bearer " + token}
        created = self.client.post(
            "/api/location/shares",
            json={"recipient_username": "bob", "latitude": 23.02, "longitude": 72.57, "duration_minutes": 60},
            headers=headers,
        )
        self.assertEqual(created.status_code, 200)
        share_id = created.get_json()["share_id"]
        incoming = self.client.get("/api/location/shares", headers=headers)
        self.assertEqual(incoming.status_code, 200)
        self.assertEqual(len(incoming.get_json()["outgoing"]), 1)
        stopped = self.client.delete("/api/location/shares/" + share_id, headers=headers)
        self.assertEqual(stopped.status_code, 200)
        refreshed = self.client.get("/api/location/shares", headers=headers)
        self.assertEqual(refreshed.get_json()["outgoing"], [])
        self.assertEqual(len(refreshed.get_json()["history"]), 1)

    def test_invalid_location_coordinates_are_rejected(self):
        token = self._auth()
        now = datetime.now(timezone.utc).isoformat()
        self.db.executemany(
            "INSERT INTO follows(follower,following,created_at) VALUES(?,?,?)",
            [("alice", "bob", now), ("bob", "alice", now)],
        )
        self.db.commit()
        response = self.client.post(
            "/api/location/shares",
            json={"recipient_username": "bob", "latitude": 150, "longitude": 72.57, "duration_minutes": 60},
            headers={"Authorization": "Bearer " + token},
        )
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
