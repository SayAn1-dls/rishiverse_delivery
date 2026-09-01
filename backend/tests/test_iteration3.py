"""Iteration 3: Package photos + aging alerts."""
import os
import io
import time
import struct
import zlib
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
LEARNER2 = {"email": "diya@rishihood.edu.in", "password": "learner123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _auth_session(creds):
    d = _login(creds)
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {d['access_token']}"})
    s.user = d["user"]
    s.token = d["access_token"]
    return s


@pytest.fixture(scope="module")
def admin_s():
    return _auth_session(ADMIN)


@pytest.fixture(scope="module")
def guard_s():
    return _auth_session(GUARD)


@pytest.fixture(scope="module")
def learner_s():
    return _auth_session(LEARNER)


@pytest.fixture(scope="module")
def learner2_s():
    return _auth_session(LEARNER2)


@pytest.fixture(scope="module")
def mongo_db():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


def _tiny_jpg():
    # minimal valid JPEG bytes
    return bytes.fromhex(
        "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc00011080001000103012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda000c03010002110311003f00fbfcbf7fffd9"
    )


# ---------- Photo upload/download ----------
class TestPhotos:
    def test_photo_upload_and_download(self, guard_s, learner_s):
        # create + arrive
        r = learner_s.post(f"{API}/deliveries",
                           json={"courier": "TEST_Photo", "item_type": "parcel"})
        assert r.status_code == 200
        did = r.json()["id"]
        try:
            a = guard_s.post(f"{API}/deliveries/{did}/arrive", json={"storage": "room"})
            assert a.status_code == 200, a.text
            otp = a.json()["otp"]

            # guard uploads photo
            files = {"file": ("pkg.jpg", _tiny_jpg(), "image/jpeg")}
            u = guard_s.post(f"{API}/deliveries/{did}/photo", files=files)
            assert u.status_code == 200, u.text
            assert "photo_path" in u.json() and u.json()["photo_path"]

            # learner sees photo_path in listing
            lst = learner_s.get(f"{API}/deliveries").json()
            this = next(x for x in lst if x["id"] == did)
            assert this["photo_path"]

            # learner GETs image via ?auth=
            g = requests.get(f"{API}/deliveries/{did}/photo",
                             params={"auth": learner_s.token})
            assert g.status_code == 200
            assert g.content.startswith(b"\xff\xd8")  # JPEG magic
            assert "image" in g.headers.get("Content-Type", "")
        finally:
            guard_s.post(f"{API}/deliveries/{did}/pickup", json={"otp": otp})

    def test_photo_other_learner_forbidden(self, guard_s, learner_s, learner2_s):
        r = learner_s.post(f"{API}/deliveries",
                           json={"courier": "TEST_Photo2", "item_type": "parcel"})
        did = r.json()["id"]
        try:
            a = guard_s.post(f"{API}/deliveries/{did}/arrive", json={"storage": "room"})
            otp = a.json()["otp"]
            files = {"file": ("p.jpg", _tiny_jpg(), "image/jpeg")}
            guard_s.post(f"{API}/deliveries/{did}/photo", files=files)

            # learner2 (not owner) forbidden
            g = requests.get(f"{API}/deliveries/{did}/photo",
                             params={"auth": learner2_s.token})
            assert g.status_code == 403
        finally:
            guard_s.post(f"{API}/deliveries/{did}/pickup", json={"otp": otp})

    def test_learner_cannot_upload_photo(self, learner_s, guard_s):
        r = learner_s.post(f"{API}/deliveries",
                           json={"courier": "TEST_PhotoRole", "item_type": "parcel"})
        did = r.json()["id"]
        try:
            files = {"file": ("p.jpg", _tiny_jpg(), "image/jpeg")}
            u = learner_s.post(f"{API}/deliveries/{did}/photo", files=files)
            assert u.status_code == 403
        finally:
            learner_s.delete(f"{API}/deliveries/{did}")

    def test_get_photo_without_photo_404(self, guard_s, learner_s):
        r = learner_s.post(f"{API}/deliveries",
                           json={"courier": "TEST_NoPhoto", "item_type": "parcel"})
        did = r.json()["id"]
        try:
            a = guard_s.post(f"{API}/deliveries/{did}/arrive", json={"storage": "room"})
            otp = a.json()["otp"]
            g = requests.get(f"{API}/deliveries/{did}/photo",
                             params={"auth": learner_s.token})
            assert g.status_code == 404
        finally:
            guard_s.post(f"{API}/deliveries/{did}/pickup", json={"otp": otp})


# ---------- Aging threshold admin API ----------
class TestAgingAdmin:
    def test_learner_cannot_update_aging(self, learner_s):
        r = learner_s.put(f"{API}/admin/aging", json={"hours": 1})
        assert r.status_code == 403

    def test_admin_updates_aging_reflects_everywhere(self, admin_s, learner_s):
        try:
            r = admin_s.put(f"{API}/admin/aging", json={"hours": 1})
            assert r.status_code == 200
            assert r.json()["aging_hours"] == 1

            rs = learner_s.get(f"{API}/room/status").json()
            assert rs["aging_hours"] == 1
            assert "aging_count" in rs

            st = admin_s.get(f"{API}/admin/stats").json()
            assert st["aging_hours"] == 1
            assert "aging_count" in st
        finally:
            admin_s.put(f"{API}/admin/aging", json={"hours": 24})


# ---------- Aging monitor background loop ----------
class TestAgingMonitor:
    def test_aging_reminder_sent_once(self, admin_s, guard_s, learner_s, mongo_db):
        # Set threshold to 1h
        admin_s.put(f"{API}/admin/aging", json={"hours": 1})
        r = learner_s.post(f"{API}/deliveries",
                           json={"courier": "TEST_Aging", "item_type": "parcel"})
        did = r.json()["id"]
        otp = None
        try:
            a = guard_s.post(f"{API}/deliveries/{did}/arrive", json={"storage": "room"})
            assert a.status_code == 200
            otp = a.json()["otp"]

            # Backdate arrived_at 2 days ago
            past = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
            mongo_db.deliveries.update_one({"id": did}, {"$set": {"arrived_at": past}})

            # Poll up to 80s for reminder notification
            reminder = None
            deadline = time.time() + 85
            while time.time() < deadline:
                notifs = learner_s.get(f"{API}/notifications").json()
                match = [n for n in notifs
                         if n.get("delivery_id") == did
                         and "Reminder from Gate No. 2" in n.get("message", "")]
                if match:
                    reminder = match[0]
                    break
                time.sleep(5)
            assert reminder is not None, "Aging reminder not sent within 85s"

            # DB fields updated
            doc = mongo_db.deliveries.find_one({"id": did})
            assert doc.get("reminder_count", 0) >= 1
            assert doc.get("last_reminder_at")

            # aging_count >= 1
            rs = learner_s.get(f"{API}/room/status").json()
            assert rs["aging_count"] >= 1

            # No duplicate reminder on next cycle
            count_before = doc["reminder_count"]
            time.sleep(70)
            doc2 = mongo_db.deliveries.find_one({"id": did})
            assert doc2["reminder_count"] == count_before, \
                f"Duplicate reminder: {count_before} -> {doc2['reminder_count']}"
        finally:
            if otp:
                guard_s.post(f"{API}/deliveries/{did}/pickup", json={"otp": otp})
            else:
                learner_s.delete(f"{API}/deliveries/{did}")
            admin_s.put(f"{API}/admin/aging", json={"hours": 24})
