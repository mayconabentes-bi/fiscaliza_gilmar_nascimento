#!/usr/bin/env python3
"""Backup PostgreSQL de produção: leitura apenas, streaming pg_dump -> age.

Não imprime credenciais ou linhas de dados. NÃO realiza restore, DDL ou DELETE.
Requer PG_BACKUP_URL (Supabase Session Pooler :5432), AGE_RECIPIENT e
BACKUP_OUTPUT_DIR (diretório absoluto fora do repo, de preferência disco externo).
A chave privada age NUNCA deve ficar no mesmo local do backup.
"""
from __future__ import annotations
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from urllib.parse import urlparse, unquote

REF = "jnlfmiwczpglojqytrbw"
USAGE = "Uso: python scripts/backup_postgres_encrypted.py --execute (sem --execute: preflight sem dados)"
HEADER = b"age-encryption.org/v1"
RECIPIENT = re.compile(r"^age1[023456789acdefghjklmnpqrstuvwxyz]{50,80}$")

def check_environment(env):
    url = env.get("PG_BACKUP_URL", "")
    parsed = urlparse(url)
    if parsed.scheme not in ("postgres", "postgresql"):
        raise ValueError("BACKUP_GUARD=INVALID_URL")
    hostname = (parsed.hostname or "").lower()
    username = unquote(parsed.username or "").lower()
    if not (
        (hostname == "db." + REF + ".supabase.co" and username in ("postgres", "postgres." + REF))
        or (re.fullmatch(r"[a-z0-9-]+\.pooler\.supabase\.com", hostname) and username == "postgres." + REF)
    ):
        raise ValueError("BACKUP_GUARD=WRONG_TENANT")
    if parsed.port != 5432 or parsed.path not in ("/postgres",):
        raise ValueError("BACKUP_GUARD=SESSION_PORT_5432_REQUIRED")
    if not parsed.password:
        raise ValueError("BACKUP_GUARD=MISSING_DB_PASSWORD")
    if env.get("AGE_RECIPIENT") is None or not RECIPIENT.fullmatch(env["AGE_RECIPIENT"]):
        raise ValueError("BACKUP_GUARD=MISSING_AGE_RECIPIENT")
    target = Path(env.get("BACKUP_OUTPUT_DIR", ""))
    if not target.is_absolute() or not target.is_dir():
        raise ValueError("BACKUP_GUARD=EXTERNAL_DIRECTORY_REQUIRED")
    root = Path(__file__).resolve().parent.parent
    if target.resolve() == root or root in target.resolve().parents:
        raise ValueError("BACKUP_GUARD=OUTPUT_INSIDE_REPO")
    if not shutil.which("pg_dump") or not shutil.which("age"):
        raise ValueError("BACKUP_GUARD=PG_DUMP_OR_AGE_MISSING")
    version = subprocess.run(["pg_dump", "--version"], capture_output=True, text=True, timeout=10)
    match = re.search(r"(\d+)(?:\.\d+)?", version.stdout)
    if version.returncode != 0 or not match or int(match.group(1)) < 17:
        raise ValueError("BACKUP_GUARD=PG_DUMP_VERSION_17_REQUIRED")
    return parsed, target

def run(env, execute=False):
    parsed, target = check_environment(env)
    print("BACKUP_GUARD=OK", flush=True)
    if not execute:
        print("BACKUP_MODE=DRY_RUN_NO_DATABASE_ACCESS", flush=True)
        return 0
    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    name = f"fiscalize-postgres-{timestamp}.dump.age"
    final = target / name
    partial = target / (name + ".partial")
    if partial.exists() or final.exists():
        raise ValueError("BACKUP_GUARD=OUTPUT_ALREADY_EXISTS")
    db_env = os.environ.copy()
    db_env.update({
        "PGHOST": parsed.hostname or "",
        "PGPORT": "5432",
        "PGUSER": unquote(parsed.username or ""),
        "PGPASSWORD": unquote(parsed.password or ""),
        "PGDATABASE": "postgres",
        "PGSSLMODE": "verify-full" if env.get("PGSSLROOTCERT") else "require",
        "PGCONNECT_TIMEOUT": "12",
    })
    # pg_dump --format custom captura schemas public/private; não inclui objetos
    # binários Supabase Storage nem funções/roles gerenciadas fora desses schemas.
    command = ["pg_dump", "--format=custom", "--no-owner", "--no-privileges",
               "--schema=public", "--schema=private", "--compress=6", "--file=-"]
    dump = None
    cipher = None
    try:
        dump = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                env=db_env, close_fds=True)
        cipher = subprocess.Popen(["age", "-r", env["AGE_RECIPIENT"], "-o", str(partial)],
                                  stdin=dump.stdout, stderr=subprocess.DEVNULL, close_fds=True)
        dump.stdout.close()
        encrypted_result = cipher.wait(timeout=3600)
        dump_result = dump.wait(timeout=30)
        if encrypted_result != 0 or dump_result != 0:
            raise RuntimeError("BACKUP_FAILED_PG_DUMP_OR_ENCRYPTION")
        if not partial.is_file() or partial.stat().st_size < 128:
            raise RuntimeError("BACKUP_FAILED_EMPTY_CIPHERTEXT")
        with partial.open("rb") as fp:
            if fp.read(len(HEADER)) != HEADER:
                raise RuntimeError("BACKUP_FAILED_INVALID_AGE_HEADER")
        partial.replace(final)
        digest = hashlib.sha256()
        with final.open("rb") as fp:
            for block in iter(lambda: fp.read(1024*1024), b""):
                digest.update(block)
        manifest = {"format":"pg_dump-custom+age-v1","created_at_utc":timestamp,
                    "file":name,"ciphertext_bytes":final.stat().st_size,
                    "sha256_ciphertext":digest.hexdigest(),
                    "source":"Supabase-Postgres-production","scope":["public","private"],
                    "storage_objects_included":False,"restore_tested":False}
        (target / (name + ".manifest.json")).write_text(
            json.dumps(manifest, indent=2)+"\n", encoding="utf-8")
        print("BACKUP_ENCRYPTED=OK")
        print("BACKUP_MANIFEST=OK")
        print("BACKUP_RESTORE=NAO_TESTADO")
        print("BACKUP_STORAGE_OBJECTS=NAO_INCLUIDOS")
        return 0
    finally:
        if dump is not None and dump.poll() is None:
            dump.kill()
            dump.wait()
        if cipher is not None and cipher.poll() is None:
            cipher.kill()
            cipher.wait()
        partial.unlink(missing_ok=True)

if __name__ == "__main__":
    try:
        args = sys.argv[1:]
        if args not in ([], ["--execute"]):
            raise ValueError("BACKUP_GUARD=INVALID_ARGUMENTS")
        sys.exit(run(os.environ, execute=bool(args)))
    except Exception as exc:
        reason = str(exc)
        if not reason.startswith("BACKUP_GUARD=") and not reason.startswith("BACKUP_FAILED_"):
            reason = "BACKUP_FAILED_INCONCLUSIVE"
        print(reason)
        sys.exit(2)
