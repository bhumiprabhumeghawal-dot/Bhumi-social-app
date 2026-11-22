import sqlite3
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

import server.app as server_app


class NotificationPreferenceApiTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db_patch = patch.object(server_app, "get_db", return_value=self.db)
        self.db_patch.start()
        server_app.init_db()
        server_app.init_profile_tables()
        server_app.init_auth_tables()
        server_app.init_people_connect_tables()
        now = datetime.now(timezone.utc).isoformat()
        self.db.execute(
            "INSERT INTO users(username,password_hash,created_at) VALUES(?,?,?)",
            ("alice", "hash", now),
        )
        self.db.commit()
        self.auth_patch = patch.object(server_app, "_auth_user", return_value="alice")
        self.auth_patch.start()
        self.client = server_app.app.test_client()

    def tearDown(self):
        self.auth_patch.stop()
        self.db_patch.stop()
        self.db.close()

    def test_follow_request_preference_defaults_to_enabled(self):
        response = self.client.get("/api/settings/notifications/details")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["requests"])

    def test_follow_request_preference_can_be_disabled_and_reloaded(self):
        saved = self.client.patch(
            "/api/settings/notifications/details",
            json={"requests": False},
        )
        self.assertEqual(saved.status_code, 200)
        self.assertFalse(saved.get_json()["requests"])

        loaded = self.client.get("/api/settings/notifications/details")
        self.assertEqual(loaded.status_code, 200)
        self.assertFalse(loaded.get_json()["requests"])

    def test_unknown_notification_preference_is_rejected(self):
        response = self.client.patch(
            "/api/settings/notifications/details",
            json={"not_a_real_category": False},
        )
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
