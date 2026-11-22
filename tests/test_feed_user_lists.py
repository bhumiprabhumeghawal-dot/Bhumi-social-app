import sqlite3
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

import server.app as server_app


class FeedUserListsApiTests(unittest.TestCase):
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
        for name in ("alice", "bob", "charlie"):
            self.db.execute(
                "INSERT INTO users(username,password_hash,created_at) VALUES(?,?,?)",
                (name, "hash", now),
            )
            self.db.execute(
                "INSERT INTO profiles(username,display_name,created_at) VALUES(?,?,?)",
                (name, name.title(), now),
            )
        self.db.commit()
        self.auth_patch = patch.object(server_app, "_auth_user", return_value="alice")
        self.auth_patch.start()
        self.client = server_app.app.test_client()

    def tearDown(self):
        self.auth_patch.stop()
        self.db_patch.stop()
        self.db.close()

    def test_add_and_list_favorite_account(self):
        added = self.client.post(
            "/api/feed/lists",
            json={"list_type": "favorite", "username": "@bob"},
        )
        self.assertEqual(added.status_code, 200)
        listed = self.client.get("/api/feed/lists")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.get_json()["favorites"][0]["username"], "bob")
        self.assertEqual(listed.get_json()["favorites"][0]["displayName"], "Bob")

    def test_muting_account_removes_favorite_and_hides_feed_content(self):
        self.client.post("/api/feed/lists", json={"list_type": "favorite", "username": "bob"})
        muted = self.client.post("/api/feed/lists", json={"list_type": "muted", "username": "bob"})
        self.assertEqual(muted.status_code, 200)
        lists = self.client.get("/api/feed/lists").get_json()
        self.assertEqual(lists["favorites"], [])
        self.assertEqual([item["username"] for item in lists["muted"]], ["bob"])

        now = datetime.now(timezone.utc).isoformat()
        for owner, media in (("bob", "/bob.jpg"), ("charlie", "/charlie.jpg")):
            self.db.execute(
                "INSERT INTO content(kind,username,caption,media_url,media_type,created_at) VALUES(?,?,?,?,?,?)",
                ("posts", owner, "", media, "image", now),
            )
        self.db.commit()
        feed = self.client.get("/api/posts")
        self.assertEqual(feed.status_code, 200)
        self.assertEqual([item["user"] for item in feed.get_json()["items"]], ["charlie"])

    def test_favorite_accounts_are_prioritized_without_hiding_others(self):
        now = datetime.now(timezone.utc).isoformat()
        for owner, media in (("charlie", "/charlie.jpg"), ("bob", "/bob.jpg")):
            self.db.execute(
                "INSERT INTO content(kind,username,caption,media_url,media_type,created_at) VALUES(?,?,?,?,?,?)",
                ("posts", owner, "", media, "image", now),
            )
        self.db.commit()
        self.client.post("/api/feed/lists", json={"list_type": "favorite", "username": "bob"})
        feed = self.client.get("/api/posts")
        self.assertEqual([item["user"] for item in feed.get_json()["items"]], ["bob", "charlie"])

    def test_remove_account_from_list(self):
        self.client.post("/api/feed/lists", json={"list_type": "muted", "username": "bob"})
        removed = self.client.delete("/api/feed/lists/muted/bob")
        self.assertEqual(removed.status_code, 200)
        self.assertEqual(self.client.get("/api/feed/lists").get_json()["muted"], [])

    def test_invalid_target_and_list_type_are_rejected(self):
        self.assertEqual(
            self.client.post("/api/feed/lists", json={"list_type": "unknown", "username": "bob"}).status_code,
            400,
        )
        self.assertEqual(
            self.client.post("/api/feed/lists", json={"list_type": "favorite", "username": "missing"}).status_code,
            404,
        )
        self.assertEqual(
            self.client.post("/api/feed/lists", json={"list_type": "favorite", "username": "alice"}).status_code,
            400,
        )


if __name__ == "__main__":
    unittest.main()
