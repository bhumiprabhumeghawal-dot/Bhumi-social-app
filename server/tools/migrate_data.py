import argparse
import hashlib
import json
import shutil
import sqlite3
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

SERVER_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = SERVER_DIR / "data"
UPLOAD_DIR = SERVER_DIR / "uploads"
DB_PATH = DATA_DIR / "socialapp.db"
BACKUP_DIR = SERVER_DIR / "backups"


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def export_data(output):
    if not DB_PATH.is_file():
        raise SystemExit("Database file not found.")

    with sqlite3.connect(DB_PATH) as conn:
        result = conn.execute("PRAGMA integrity_check").fetchone()[0]
        if result != "ok":
            raise SystemExit(f"Database integrity check failed: {result}")

    files = [DB_PATH]
    if UPLOAD_DIR.exists():
        files.extend(p for p in UPLOAD_DIR.rglob("*") if p.is_file())

    manifest = {
        "format_version": 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "files": {},
    }

    for path in files:
        relative = path.relative_to(SERVER_DIR).as_posix()
        manifest["files"][relative] = {
            "sha256": sha256_file(path),
            "size": path.stat().st_size,
        }

    output = Path(output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, path.relative_to(SERVER_DIR).as_posix())
        archive.writestr("manifest.json", json.dumps(manifest, indent=2))

    print(f"Export created: {output}")
    print(f"Files included: {len(files)}")
    print(f"Archive size: {output.stat().st_size} bytes")
    print("Keep this archive private; it contains application data.")


def verify_archive(archive):
    names = archive.namelist()
    if len(names) != len(set(names)):
        raise SystemExit("Archive contains duplicate paths.")

    for name in names:
        path = PurePosixPath(name)
        if path.is_absolute() or ".." in path.parts:
            raise SystemExit("Archive contains an unsafe path.")

    if "manifest.json" not in names:
        raise SystemExit("Manifest missing.")

    manifest = json.loads(archive.read("manifest.json"))
    if manifest.get("format_version") != 1:
        raise SystemExit("Unsupported archive format.")

    for name, details in manifest.get("files", {}).items():
        if name not in names:
            raise SystemExit(f"Missing file: {name}")
        data = archive.read(name)
        if len(data) != details["size"]:
            raise SystemExit(f"Size check failed: {name}")
        if hashlib.sha256(data).hexdigest() != details["sha256"]:
            raise SystemExit(f"Checksum failed: {name}")

    if "data/socialapp.db" not in manifest.get("files", {}):
        raise SystemExit("Database missing from manifest.")

    with archive.open("data/socialapp.db") as stream:
        temporary = BACKUP_DIR / "migration_check.db"
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        temporary.write_bytes(stream.read())

    try:
        with sqlite3.connect(temporary) as conn:
            result = conn.execute("PRAGMA integrity_check").fetchone()[0]
            if result != "ok":
                raise SystemExit(f"Database integrity check failed: {result}")
    finally:
        temporary.unlink(missing_ok=True)

    return manifest


def import_data(source, force):
    source = Path(source).expanduser().resolve()
    if not source.is_file():
        raise SystemExit("Import archive not found.")

    with zipfile.ZipFile(source, "r") as archive:
        manifest = verify_archive(archive)
        destinations = []
        for name in manifest["files"]:
            relative = PurePosixPath(name)
            if relative.parts[0] not in {"data", "uploads"}:
                raise SystemExit(f"Unexpected file path: {name}")
            target = SERVER_DIR.joinpath(*relative.parts).resolve()
            if SERVER_DIR.resolve() not in target.parents:
                raise SystemExit("Unsafe destination path.")
            destinations.append((name, target))

        existing = [target for _, target in destinations if target.exists()]
        if existing and not force:
            raise SystemExit(
                "Destination data already exists. Back up first, then use --force to replace it."
            )

        if existing:
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup = BACKUP_DIR / f"before_import_{stamp}.zip"
            export_data(backup)
            print(f"Existing data backed up: {backup}")

        for name, target in destinations:
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_name(target.name + ".importing")
            with archive.open(name) as source_stream, temporary.open("wb") as target_stream:
                shutil.copyfileobj(source_stream, target_stream)
            temporary.replace(target)

    print(f"Import verified: {source}")
    print(f"Files restored: {len(manifest['files'])}")
    print("Restart the application server after import.")


def main():
    parser = argparse.ArgumentParser(description="Export and import SocialApp data.")
    subparsers = parser.add_subparsers(dest="action", required=True)

    export_parser = subparsers.add_parser("export")
    export_parser.add_argument("--output")

    import_parser = subparsers.add_parser("import")
    import_parser.add_argument("archive")
    import_parser.add_argument("--force", action="store_true")

    args = parser.parse_args()

    if args.action == "export":
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output = args.output or str(BACKUP_DIR / f"socialapp_export_{stamp}.zip")
        export_data(output)
    else:
        import_data(args.archive, args.force)


if __name__ == "__main__":
    main()
