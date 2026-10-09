import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

script = Path(__file__).resolve().parents[1] / "scripts" / "backup_postgres_encrypted.py"
spec = importlib.util.spec_from_file_location("backup_postgres_encrypted", script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class GuardTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.env = {
            "PG_BACKUP_URL":"postgresql://postgres.jnlfmiwczpglojqytrbw:FAKE@aws-0-us-west-2.pooler.supabase.com:5432/postgres",
            "AGE_RECIPIENT":"age1"+"q"*58,
            "BACKUP_OUTPUT_DIR":self.tmp.name,
        }
        self.which = patch.object(module.shutil, "which", return_value="/fake/binary")
        self.version = patch.object(module.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout="pg_dump (PostgreSQL) 17.6"))
        self.which.start()
        self.version.start()
    def tearDown(self):
        self.which.stop()
        self.version.stop()
        self.tmp.cleanup()
    def test_dry_run_does_not_access_database(self):
        with patch.object(module.subprocess,"Popen",side_effect=AssertionError("Network call attempted")):
            self.assertEqual(module.run(self.env,execute=False),0)
    def test_bad_tenant_rejected(self):
        self.env["PG_BACKUP_URL"]=self.env["PG_BACKUP_URL"].replace("jnlfmiwczpglojqytrbw","zqxouixpokuprqqscnwf")
        with self.assertRaisesRegex(ValueError,"WRONG_TENANT"):
            module.check_environment(self.env)
    def test_transaction_pooler_rejected(self):
        self.env["PG_BACKUP_URL"]=self.env["PG_BACKUP_URL"].replace(":5432/",":6543/")
        with self.assertRaisesRegex(ValueError,"SESSION_PORT"):
            module.check_environment(self.env)
    def test_missing_password_rejected(self):
        self.env["PG_BACKUP_URL"]=self.env["PG_BACKUP_URL"].replace(":FAKE@", "@")
        with self.assertRaisesRegex(ValueError,"MISSING_DB_PASSWORD"):
            module.check_environment(self.env)
    def test_local_repo_output_rejected(self):
        self.env["BACKUP_OUTPUT_DIR"]=str(script.parent)
        with self.assertRaisesRegex(ValueError,"OUTPUT_INSIDE_REPO"):
            module.check_environment(self.env)
    def test_missing_recipient_rejected(self):
        self.env["AGE_RECIPIENT"]="not-a-recipient"
        with self.assertRaisesRegex(ValueError,"MISSING_AGE_RECIPIENT"):
            module.check_environment(self.env)
    def test_old_pg_dump_rejected(self):
        with patch.object(module.subprocess,"run",return_value=SimpleNamespace(returncode=0,stdout="pg_dump (PostgreSQL) 14.1")):
            with self.assertRaisesRegex(ValueError,"VERSION_17_REQUIRED"):
                module.check_environment(self.env)

if __name__=="__main__":
    unittest.main()
