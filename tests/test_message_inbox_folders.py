import sqlite3
import unittest
from unittest.mock import patch

import server.app as server_app


class MessageInboxFolderApiTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db_patch = patch.object(server_app, "get_db", return_value=self.db)
        self.db_patch.start()
        server_app.init_chat_tables()
        self.db.execute(
            """
            INSERT INTO direct_messages
                (id, sender_username, recipient_username, body, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            ("message-1", "alice", "bob", "Hello", "2026-11-22T10:00:00+00:00"),
        )
        self.db.commit()
        self.client = server_app.app.test_client()

    def tearDown(self):
        self.db_patch.stop()
        self.db.close()

    def test_folder_table_is_created_by_chat_initializer(self):
        row = self.db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='message_inbox_folders'"
        ).fetchone()
        self.assertIsNotNone(row)

    def test_authenticated_user_can_save_general_folder(self):
        with patch.object(server_app, "_chat_current_user", return_value="alice"):
            response = self.client.patch(
                "/api/messages/conversations/bob/folder",
                json={"folder": "general"},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["folder"], "general")
        row = self.db.execute(
            """
            SELECT folder FROM message_inbox_folders
            WHERE LOWER(username)=LOWER(?) AND LOWER(peer_username)=LOWER(?)
            """,
            ("alice", "bob"),
        ).fetchone()
        self.assertEqual(row["folder"], "general")

    def test_folder_update_rejects_unknown_folder(self):
        with patch.object(server_app, "_chat_current_user", return_value="alice"):
            response = self.client.patch(
                "/api/messages/conversations/bob/folder",
                json={"folder": "archive"},
            )
        self.assertEqual(response.status_code, 400)

    def test_folder_update_rejects_nonexistent_conversation(self):
        with patch.object(server_app, "_chat_current_user", return_value="alice"):
            response = self.client.patch(
                "/api/messages/conversations/charlie/folder",
                json={"folder": "primary"},
            )
        self.assertEqual(response.status_code, 404)

    def test_folder_update_requires_authentication(self):
        with patch.object(server_app, "_chat_current_user", return_value=None):
            response = self.client.patch(
                "/api/messages/conversations/bob/folder",
                json={"folder": "primary"},
            )
        self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
