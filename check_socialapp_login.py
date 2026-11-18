import getpass
import json
import urllib.request
import urllib.error

base = "https://bhumi-social-app-fresh.onrender.com"
username = input("Username: ").strip()
password = getpass.getpass("Password (hidden): ")

payload = json.dumps({"username": username, "password": password}).encode()
req = urllib.request.Request(
    base + "/api/auth/login",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST"
)

try:
    with urllib.request.urlopen(req, timeout=40) as response:
        data = json.loads(response.read().decode())
        token = data.get("token", "")
        print("LOGIN STATUS:", response.status)
        print("USERNAME:", data.get("username", "not returned"))
        print("TOKEN RECEIVED:", bool(token))
        if token:
            check = urllib.request.Request(
                base + "/api/auth/me",
                headers={"Authorization": "Bearer " + token}
            )
            with urllib.request.urlopen(check, timeout=40) as result:
                me = json.loads(result.read().decode())
                print("SESSION STATUS:", result.status)
                print("SESSION USER:", me.get("username", "not returned"))
except urllib.error.HTTPError as e:
    print("LOGIN STATUS:", e.code)
    try:
        print("SERVER MESSAGE:", json.loads(e.read().decode()).get("error", "No error message"))
    except Exception:
        print("Could not read server error.")
except Exception as e:
    print("CONNECTION ERROR:", type(e).__name__, str(e))
