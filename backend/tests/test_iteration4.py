"""Iteration 4: Shift summary, learner signup, admin escalation."""
import os
import time
import pytest
import requests
from datetime import datetime, timezone, timedelta
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = backend_env.get("MONGO_URL", "mongodb://localhost:27017").strip('"')
DB_NAME = backend_env.get("DB_NAME", "test_database").strip('"')

ADMIN = {"email": "admin@rishihood.edu.in", "password": "admin123"}
GUARD = {"email": "guard@rishihood.edu.in", "password": "guard123"}
LEARNER = {"email": "aarav@rishihood.edu.in", "password": "learner123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _sess(creds):
    d = _login(creds)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {d['access_token']}"})
    s.user = d["user"]
    s.token = d["access_token"]
    return s


@pytest.fixture(scope="module")
def admin_s(): return _sess(ADMIN)
@pytest.fixture(scope="module")
def guard_s(): return _sess(GUARD)
@pytest.fixture(scope="module")
def learner_s(): return _sess(LEARNER)


@pytest.fixture(scope="module")
def mongo_db():
    return MongoClient(MONGO_URL)[DB_NAME]


# ---------- Shift Summary ----------
class TestShiftSummary:
    def test_learner_forbidden(self, learner_s):
        r = learner_s.get(f"{API}/guard/shift-summary")
        assert r.status_code == 403

    def test_admin_can_access(self, admin_s):
        r = admin_s.get(f"{API}/guard/shift-summary")
        assert r.status_code == 200
        d = r.json()
        for k in ("date", "received", "walk_ins", "handed_over", "waiting",
                  "waiting_room", "waiting_counter", "avg_pickup_minutes", "waiting_list"):
            assert k in d, f"missing {k}"

    def test_summary_reflects_flow(self, guard_s, learner_s):
        # baseline
        before = guard_s.get(f"{API}/guard/shift-summary").json()
        # create + arrive
        r = learner_s.post(f"{API}/deliveries",
                           json={"courier": "TEST_Shift", "item_type": "parcel"})
        did = r.json()["id"]
        a = guard_s.post(f"{API}/deliveries/{did}/arrive", json={"storage": "room"})
        assert a.status_code == 200
        otp = a.json()["otp"]

        after_arrive = guard_s.get(f"{API}/guard/shift-summary").json()
        assert after_arrive["received"] == before["received"] + 1
        assert after_arrive["waiting"] == before["waiting"] + 1
        assert after_arrive["waiting_room"] == before["waiting_room"] + 1
        assert any(x["id"] == did for x in after_arrive["waiting_list"])

        # pickup
        p = guard_s.post(f"{API}/deliveries/{did}/pickup", json={"otp": otp})
        assert p.status_code == 200

        after_pickup = guard_s.get(f"{API}/guard/shift-summary").json()
        assert after_pickup["handed_over"] >= before["handed_over"] + 1
        # waiting decreased by 1 relative to arrive snapshot (parallel tests may add others)
        assert after_pickup["waiting"] == after_arrive["waiting"] - 1
        assert not any(x["id"] == did for x in after_pickup["waiting_list"])


# ---------- Learner Signup ----------
class TestSignup:
    def test_signup_new_learner_and_login(self):
        email = f"test_signup_{int(time.time()*1000)}@rishihood.edu.in"
        payload = {"name": "Signup Tester", "email": email,
                   "password": "secret123", "phone": "+91 90000 00000"}
        r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["role"] == "learner"
        assert d["user"]["email"] == email.lower()
        token = d["access_token"]
        assert isinstance(token, str) and len(token) > 20

        # /auth/me works with returned token
        me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["email"] == email.lower()
        assert me.json()["role"] == "learner"

    def test_duplicate_email_returns_400(self):
        r = requests.post(f"{API}/auth/register", json={
            "name": "Dup", "email": "aarav@rishihood.edu.in",
            "password": "secret123", "phone": "+91 90000 00001"})
        assert r.status_code == 400


# ---------- Admin Escalation ----------
class TestEscalation:
    def test_escalation_via_aging_monitor(self, admin_s, guard_s, learner_s, mongo_db):
        # Ensure aging threshold is small so cutoff logic keeps sending
        admin_s.put(f"{API}/admin/aging", json={"hours": 1})
        r = learner_s.post(f"{API}/deliveries",
                           json={"courier": "TEST_Escalate", "item_type": "parcel"})
        did = r.json()["id"]
        otp = None
        try:
            a = guard_s.post(f"{API}/deliveries/{did}/arrive", json={"storage": "room"})
            assert a.status_code == 200
            otp = a.json()["otp"]

            # Preload reminder_count=2, arrived 5 days ago, last reminder 2 days ago
            arrived_at = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
            last_rem = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
            mongo_db.deliveries.update_one({"id": did}, {"$set": {
                "arrived_at": arrived_at,
                "last_reminder_at": last_rem,
                "reminder_count": 2,
                "escalated": False,
            }})

            # Wait for aging monitor cycle (~60s). Poll up to 90s
            deadline = time.time() + 95
            escalated_row = None
            while time.time() < deadline:
                stats = admin_s.get(f"{API}/admin/stats").json()
                match = [e for e in stats.get("escalated", []) if e["id"] == did]
                if match:
                    escalated_row = match[0]
                    break
                time.sleep(5)
            assert escalated_row is not None, "Escalation did not appear in admin stats"
            assert escalated_row["reminder_count"] >= 3
            assert "learner_name" in escalated_row and "courier" in escalated_row
            assert "slot" in escalated_row

            # DB verifies escalated flag
            doc = mongo_db.deliveries.find_one({"id": did})
            assert doc.get("escalated") is True
            assert doc.get("reminder_count", 0) >= 3

            # After pickup, escalation should disappear
            p = guard_s.post(f"{API}/deliveries/{did}/pickup", json={"otp": otp})
            assert p.status_code == 200
            otp = None
            stats2 = admin_s.get(f"{API}/admin/stats").json()
            assert not any(e["id"] == did for e in stats2.get("escalated", []))
        finally:
            if otp:
                guard_s.post(f"{API}/deliveries/{did}/pickup", json={"otp": otp})
            admin_s.put(f"{API}/admin/aging", json={"hours": 24})
