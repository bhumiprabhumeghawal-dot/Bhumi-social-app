import sqlite3
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import server.app as server_app


class VoiceVideoCallApiTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db_patch = patch.object(server_app, "get_db", return_value=self.db)
        self.db_patch.start()
        server_app.init_db()
        server_app.init_auth_tables()
        server_app.init_people_connect_tables()
        now = datetime.now(timezone.utc).isoformat()
        for username in ("alice", "bob", "carol"):
            self.db.execute(
                "INSERT INTO users(username,password_hash,created_at) VALUES(?,?,?)",
                (username, "hash", now),
            )
        self.db.commit()
        self.username = "alice"
        self.auth_patch = patch.object(
            server_app, "_auth_user", side_effect=lambda: self.username
        )
        self.auth_patch.start()
        self.client = server_app.app.test_client()

    def tearDown(self):
        self.auth_patch.stop()
        self.db_patch.stop()
        self.db.close()

    def _active_call(self, caller, callee, call_id="existing-call"):
        now = datetime.now(timezone.utc)
        self.db.execute(
            """
            INSERT INTO call_sessions
                (id, caller_username, callee_username, call_type, room_name,
                 status, created_at, updated_at, expires_at)
            VALUES (?, ?, ?, 'audio', ?, 'ringing', ?, ?, ?)
            """,
            (
                call_id, caller, callee, "room-" + call_id,
                now.isoformat(), now.isoformat(),
                (now + timedelta(seconds=30)).isoformat(),
            ),
        )
        self.db.commit()

    def test_busy_callee_cannot_receive_another_call(self):
        self._active_call("carol", "bob")
        with patch.object(server_app.threading, "Thread"):
            response = self.client.post(
                "/api/calls", json={"username": "bob", "type": "audio"}
            )
        self.assertEqual(response.status_code, 409)

    def test_busy_caller_cannot_start_another_call(self):
        self._active_call("bob", "alice")
        with patch.object(server_app.threading, "Thread"):
            response = self.client.post(
                "/api/calls", json={"username": "carol", "type": "video"}
            )
        self.assertEqual(response.status_code, 409)

    def test_call_state_transitions_are_single_use(self):
        with patch.object(server_app.threading, "Thread"):
            created = self.client.post(
                "/api/calls", json={"username": "bob", "type": "audio"}
            )
        self.assertEqual(created.status_code, 201)
        call_id = created.get_json()["call"]["id"]

        # Only the recipient may accept.
        self.username = "alice"
        forbidden = self.client.post(f"/api/calls/{call_id}/accept", json={})
        self.assertEqual(forbidden.status_code, 403)

        self.username = "bob"
        accepted = self.client.post(f"/api/calls/{call_id}/accept", json={})
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(accepted.get_json()["call"]["status"], "accepted")

        # A second competing action cannot overwrite the accepted state.
        rejected = self.client.post(f"/api/calls/{call_id}/reject", json={})
        self.assertEqual(rejected.status_code, 409)

        self.username = "alice"
        ended = self.client.post(f"/api/calls/{call_id}/end", json={})
        self.assertEqual(ended.status_code, 200)
        self.assertEqual(ended.get_json()["call"]["status"], "ended")
        ended_again = self.client.post(f"/api/calls/{call_id}/end", json={})
        self.assertEqual(ended_again.status_code, 409)


if __name__ == "__main__":
    unittest.main()
