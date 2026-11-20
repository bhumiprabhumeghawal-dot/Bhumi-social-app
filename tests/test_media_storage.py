import json
import os
import unittest
from unittest.mock import patch

from server import media_storage


class MediaStorageConfigTests(unittest.TestCase):
    def test_empty_config_preserves_local_storage(self):
        with patch.dict(os.environ, {"MEDIA_STORAGE_PROVIDERS": ""}, clear=False):
            self.assertEqual(media_storage.configured_providers(), [])

    def test_valid_providers_are_parsed(self):
        config = [{
            "id": "r2",
            "endpoint_url": "https://example.r2.cloudflarestorage.com",
            "bucket": "media",
            "access_key": "access",
            "secret_key": "secret",
            "region": "auto",
        }]
        with patch.dict(os.environ, {"MEDIA_STORAGE_PROVIDERS": json.dumps(config)}, clear=False):
            providers = media_storage.configured_providers()
        self.assertEqual([item["id"] for item in providers], ["r2"])

    def test_invalid_and_duplicate_provider_ids_are_ignored(self):
        config = [
            {"id": "bad/id", "endpoint_url": "x", "bucket": "b", "access_key": "a", "secret_key": "s"},
            {"id": "r2", "endpoint_url": "x", "bucket": "b", "access_key": "a", "secret_key": "s"},
            {"id": "r2", "endpoint_url": "y", "bucket": "b", "access_key": "a", "secret_key": "s"},
        ]
        with patch.dict(os.environ, {"MEDIA_STORAGE_PROVIDERS": json.dumps(config)}, clear=False):
            providers = media_storage.configured_providers()
        self.assertEqual(len(providers), 1)
        self.assertEqual(providers[0]["endpoint_url"], "x")

    def test_remote_filename_parser_rejects_path_traversal(self):
        self.assertTrue(media_storage.is_remote_media_filename("r2__photo.jpg"))
        self.assertFalse(media_storage.is_remote_media_filename("../photo.jpg"))
        self.assertFalse(media_storage.is_remote_media_filename("r2__../photo.jpg"))


if __name__ == "__main__":
    unittest.main()
