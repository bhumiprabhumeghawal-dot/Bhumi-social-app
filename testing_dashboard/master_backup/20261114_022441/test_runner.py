import json
import time
import urllib.request
import urllib.error
from urllib.parse import urlparse

import bug_reporter

API_BASE_URL = "https://bhumi-social-app-1.onrender.com"
ALLOWED_HOST = "bhumi-social-app-1.onrender.com"
TIMEOUT = 20
MAX_RESPONSE_BYTES = 1024 * 1024

def check_endpoint(path, expected_status, validator=None, method='GET'):
    url = API_BASE_URL + path
    parsed = urlparse(url)

    if parsed.scheme != "https" or parsed.hostname != ALLOWED_HOST:
        raise RuntimeError("API host is not allowlisted")

    request = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": "BhumiAuditBot-SmokeTest/1.0"},
        method=method
    )

    started = time.monotonic()
    status = None

    try:
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
                status = response.status
                body = response.read(MAX_RESPONSE_BYTES + 1)
        except urllib.error.HTTPError as error:
            status = error.code
            body = error.read(MAX_RESPONSE_BYTES + 1)

        duration = int((time.monotonic() - started) * 1000)

        if len(body) > MAX_RESPONSE_BYTES:
            raise ValueError("Response exceeded the 1 MB safety limit")

        if status not in (expected_status if isinstance(expected_status, tuple) else (expected_status,)):
            return False, status, duration, (
                f"Expected HTTP {expected_status}, received HTTP {status}"
            )

        if validator:
            try:
                data = json.loads(body.decode("utf-8"))
            except Exception:
                return False, status, duration, "Response was not valid JSON"

            valid, message = validator(data)
            if not valid:
                return False, status, duration, message

        return True, status, duration, None

    except Exception as error:
        duration = int((time.monotonic() - started) * 1000)
        return False, status, duration, f"{type(error).__name__}: {str(error)[:300]}"

def is_json_object(data):
    return isinstance(data, dict), "Expected a JSON object"

def valid_health(data):
    if not isinstance(data, dict):
        return False, "Health endpoint did not return a JSON object"
    return True, ""

def valid_version(data):
    if not isinstance(data, dict):
        return False, "App-version endpoint did not return a JSON object"
    required = ("version", "download_url", "apk_url")
    missing = [key for key in required if not data.get(key)]
    if missing:
        return False, "Missing expected fields: " + ", ".join(missing)
    return True, ""

def valid_home(data):
    if not isinstance(data, dict):
        return False, "Homepage did not return a JSON object"
    if data.get("service") != "SocialApp Server":
        return False, "Unexpected service identification"
    return True, ""

TESTS = [
    ("System", "Backend Health", "/api/health", 200, valid_health, "GET"),
    ("System", "App Version API", "/api/app-version", 200, valid_version, "GET"),
    ("System", "Backend Homepage", "/", 200, valid_home, "GET"),
    ("Authentication & Sessions", "Unauthenticated Auth Gate", "/api/auth/me", 401, None, "GET"),

    ("Home Feed", "Home Feed Posts", "/api/posts", 200, is_json_object, "GET"),
    ("Posts", "Posts Feed", "/api/posts", 200, is_json_object, "GET"),
    ("Reels", "Reels Feed", "/api/reels", 200, is_json_object, "GET"),

    ("Profile", "Profile Visibility Check", "/api/profile/BhumiAuditBot", (200, 404), is_json_object, "GET"),
    ("Follows", "Followers Privacy Check", "/api/profile/BhumiAuditBot/followers", (200, 404), is_json_object, "GET"),
    ("Follows", "Following Privacy Check", "/api/profile/BhumiAuditBot/following", (200, 404), is_json_object, "GET"),

    ("Follows", "Follow Requests Access Gate", "/api/follow-requests", 401, None, "GET"),
    ("Settings", "Account Settings Access Gate", "/api/account/settings", 401, None, "GET"),
    ("Settings", "Notification Settings Access Gate", "/api/settings/notifications", 401, None, "GET"),
    ("Settings", "Notification Details Access Gate", "/api/settings/notifications/details", 401, None, "GET"),
    ("Settings", "Restricted Accounts Access Gate", "/api/settings/restricted-accounts", 401, None, "GET"),
    ("Settings", "Blocked Accounts Access Gate", "/api/settings/blocked-accounts", 401, None, "GET"),
    ("Security & Privacy", "Notifications Access Gate", "/api/notifications", 401, None, "GET"),
    ("Security & Privacy", "Saved Posts Access Gate", "/api/saved", 401, None, "GET"),
    ("Security & Privacy", "Messages Access Gate", "/api/messages/conversations", 401, None, "GET"),
    ("Security & Privacy", "Notes Access Gate", "/api/notes", 401, None, "GET"),

    ("Follows", "Follow Mutation Auth Gate", "/api/profile/BhumiAuditBot/follow", 401, None, "POST"),
    ("Follows", "Unfollow Mutation Auth Gate", "/api/profile/BhumiAuditBot/follow", 401, None, "DELETE"),
    ("Likes", "Post Like Auth Gate", "/api/posts/1/like", 401, None, "POST"),
    ("Comments", "Post Comment Auth Gate", "/api/posts/1/comments", 401, None, "POST"),
    ("Likes", "Reel Like Auth Gate", "/api/reels/1/like", 401, None, "POST"),
    ("Comments", "Reel Comment Auth Gate", "/api/reels/1/comments", 401, None, "POST"),
    ("Profile", "Profile Edit Auth Gate", "/api/profile/BhumiAuditBot", 401, None, "PATCH"),
    ("Settings", "Account Settings Edit Auth Gate", "/api/account/settings", 401, None, "PATCH"),
    ("Settings", "Notification Settings Edit Auth Gate", "/api/settings/notifications", 401, None, "PATCH"),
    ("Settings", "Notification Details Edit Auth Gate", "/api/settings/notifications/details", 401, None, "PATCH"),
    ("Security & Privacy", "Notification Read Auth Gate", "/api/notifications/read-all", 401, None, "PATCH"),
    ("Posts", "Saved Content Add Auth Gate", "/api/content/posts/1/save", 401, None, "POST"),
    ("Posts", "Saved Content Remove Auth Gate", "/api/content/posts/1/save", 401, None, "DELETE"),
    ("Stories", "Story Upload Auth Gate", "/api/stories", 401, None, "POST"),
    ("Reels", "Reel Upload Auth Gate", "/api/reels", 401, None, "POST"),
    ("Posts", "Post Upload Auth Gate", "/api/posts", 401, None, "POST"),
]

def main():
    print("Bhumi Social AI - Safe API Smoke Tests")
    print("Target:", API_BASE_URL)
    print("Mode: read-only GET + unauthenticated mutation-gate checks")
    print("-" * 48)

    run_id = bug_reporter.start_run(
        environment="remote-smoke",
        app_version=None,
        base_url=API_BASE_URL
    )

    passed = 0
    failed = 0

    try:
        for module, name, path, expected, validator, method in TESTS:
            ok, http_status, duration, error = check_endpoint(
                path, expected, validator, method
            )

            result = bug_reporter.record_result(
                run_id=run_id,
                module=module,
                test_name=name,
                status="passed" if ok else "failed",
                duration_ms=duration,
                http_status=http_status,
                error_code=None if ok else "API_SMOKE_FAILURE",
                error_message=error,
                request_path=path,
                details={
                    "method": method,
                    "expected_status": expected,
                    "actual_status": http_status
                },
                severity="high" if path == "/api/health" else "medium",
                priority="high" if path == "/api/health" else "normal",
                description=None if ok else error,
                expected_result=f"HTTP {expected}",
                actual_result=f"HTTP {http_status}" if http_status else "No response"
            )

            if ok:
                passed += 1
                print(f"PASS  {name} ({duration} ms)")
            else:
                failed += 1
                print(f"FAIL  {name}: {error}")
                if result.get("bug_id"):
                    print("      Bug ID:", result["bug_id"])

        final_status = "failed" if failed else "passed"
        bug_reporter.finish_run(
            run_id,
            status=final_status,
            summary={
                "passed": passed,
                "failed": failed,
                "total": len(TESTS),
                "mode": "GET + unauthenticated mutation-gate checks"
            }
        )

    except Exception:
        bug_reporter.finish_run(
            run_id,
            status="error",
            summary={"passed": passed, "failed": failed, "total": len(TESTS)}
        )
        raise

    print("-" * 48)
    print(f"RESULT: {passed} passed, {failed} failed")
    print("Run ID:", run_id)
    print("Bug reports saved in the dashboard database.")

if __name__ == "__main__":
    main()
