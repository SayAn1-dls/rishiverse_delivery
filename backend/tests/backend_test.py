"""GateFlow backend API tests."""
import os
import time
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@rishihood.edu.in", "password": "admin123"}
GUARD = {"email": "guard@rishihood.edu.in", "password": "guard123"}
LEARNER = {"email": "aarav@rishihood.edu.in", "password": "learner123"}
LEARNER2 = {"email": "diya@rishihood.edu.in", "password": "learner123"}


def _login(session, creds):
    r = session.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and "user" in data
    return data


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    data = _login(s, ADMIN)
    s.headers.update({"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def guard_client():
    s = requests.Session()
    data = _login(s, GUARD)
    s.headers.update({"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def learner_client():
    s = requests.Session()
    data = _login(s, LEARNER)
    s.headers.update({"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"})
    s.user = data["user"]
    return s


@pytest.fixture(scope="module")
def learner2_client():
    s = requests.Session()
    data = _login(s, LEARNER2)
    s.headers.update({"Authorization": f"Bearer {data['access_token']}", "Content-Type": "application/json"})
    s.user = data["user"]
    return s


# ---------- Auth ----------
class TestAuth:
    def test_login_valid_all_roles(self):
        for creds, role in [(ADMIN, "admin"), (GUARD, "guard"), (LEARNER, "learner")]:
            r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
            assert r.status_code == 200
            d = r.json()
            assert d["user"]["role"] == role
            assert d["user"]["email"] == creds["email"]
            assert isinstance(d["access_token"], str) and len(d["access_token"]) > 20

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@rishihood.edu.in", "password": "wrong"})
        assert r.status_code == 401

    def test_unauth_returns_401(self):
        r = requests.get(f"{API}/deliveries")
        assert r.status_code == 401

    def test_me(self, learner_client):
        r = learner_client.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "learner"


# ---------- Role protection ----------
class TestRoleProtection:
    def test_learner_cannot_call_guard(self, learner_client):
        # arrive endpoint requires guard/admin
        r = learner_client.post(f"{API}/deliveries/nonexistent/arrive", json={"storage": "room"})
        assert r.status_code == 403

    def test_learner_cannot_update_capacity(self, learner_client):
        r = learner_client.put(f"{API}/admin/capacity", json={"capacity": 10})
        assert r.status_code == 403

    def test_guard_cannot_create_delivery(self, guard_client):
        r = guard_client.post(f"{API}/deliveries", json={"courier": "Amazon", "item_type": "parcel"})
        assert r.status_code == 403


# ---------- Full delivery flow ----------
class TestDeliveryFlow:
    created_ids = []

    def test_learner_creates_expected(self, learner_client):
        r = learner_client.post(f"{API}/deliveries", json={
            "courier": "Amazon", "tracking_id": "TEST_TRK_001", "item_type": "parcel",
            "description": "test parcel"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "expected"
        assert d["courier"] == "Amazon"
        assert d["otp"] is None
        assert d["slot"] is None
        self.__class__.created_ids.append(d["id"])

        # Verify GET
        r2 = learner_client.get(f"{API}/deliveries")
        ids = [x["id"] for x in r2.json()]
        assert d["id"] in ids

        # Notification exists
        n = learner_client.get(f"{API}/notifications").json()
        assert any(msg["delivery_id"] == d["id"] for msg in n)

    def test_guard_marks_arrived_room(self, guard_client, learner_client):
        did = self.__class__.created_ids[0]
        r = guard_client.post(f"{API}/deliveries/{did}/arrive", json={"storage": "room"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "arrived"
        assert d["storage"] == "room"
        assert isinstance(d["slot"], int) and d["slot"] >= 1
        assert len(d["otp"]) == 6 and d["otp"].isdigit()
        self.__class__.otp = d["otp"]

        # Learner sees ready
        deliveries = learner_client.get(f"{API}/deliveries").json()
        this = next(x for x in deliveries if x["id"] == did)
        assert this["otp"] == d["otp"]
        assert this["status"] == "arrived"

    def test_wrong_otp_fails(self, guard_client):
        did = self.__class__.created_ids[0]
        r = guard_client.post(f"{API}/deliveries/{did}/pickup", json={"otp": "000000"})
        # If the real otp happens to be "000000", try another. Extremely unlikely.
        if self.__class__.otp == "000000":
            r = guard_client.post(f"{API}/deliveries/{did}/pickup", json={"otp": "111111"})
        assert r.status_code == 400
        # verify still arrived
        d = guard_client.get(f"{API}/deliveries").json()
        this = next(x for x in d if x["id"] == did)
        assert this["status"] == "arrived"

    def test_correct_otp_completes(self, guard_client, learner_client):
        did = self.__class__.created_ids[0]
        r = guard_client.post(f"{API}/deliveries/{did}/pickup", json={"otp": self.__class__.otp})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "picked_up"
        # Handed over notif
        n = learner_client.get(f"{API}/notifications").json()
        assert any("Handed over" in m["message"] and m["delivery_id"] == did for m in n)

    def test_learner_can_delete_expected(self, learner_client):
        r = learner_client.post(f"{API}/deliveries", json={"courier": "Flipkart", "item_type": "parcel"})
        did = r.json()["id"]
        d = learner_client.delete(f"{API}/deliveries/{did}")
        assert d.status_code == 200
        # confirm gone
        got = learner_client.get(f"{API}/deliveries").json()
        assert did not in [x["id"] for x in got]

    def test_cannot_delete_arrived(self, learner_client, guard_client):
        r = learner_client.post(f"{API}/deliveries", json={"courier": "BlueDart", "item_type": "parcel"})
        did = r.json()["id"]
        guard_client.post(f"{API}/deliveries/{did}/arrive", json={"storage": "counter"})
        d = learner_client.delete(f"{API}/deliveries/{did}")
        assert d.status_code == 404
        # cleanup: pick up
        deliveries = guard_client.get(f"{API}/deliveries").json()
        this = next(x for x in deliveries if x["id"] == did)
        guard_client.post(f"{API}/deliveries/{did}/pickup", json={"otp": this["otp"]})


# ---------- Walk-in ----------
class TestWalkIn:
    def test_walkin_creates_arrived(self, guard_client, learner_client):
        # get learner id
        me = learner_client.get(f"{API}/auth/me").json()
        r = guard_client.post(f"{API}/deliveries/walkin", json={
            "learner_id": me["id"], "courier": "Zomato", "item_type": "food", "storage": "counter"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "arrived"
        assert d["walk_in"] is True
        assert d["storage"] == "counter"
        assert len(d["otp"]) == 6
        # cleanup
        guard_client.post(f"{API}/deliveries/{d['id']}/pickup", json={"otp": d["otp"]})

    def test_walkin_unknown_learner(self, guard_client):
        r = guard_client.post(f"{API}/deliveries/walkin", json={
            "learner_id": "does-not-exist", "courier": "X", "item_type": "parcel", "storage": "counter"
        })
        assert r.status_code == 404


# ---------- Room & capacity ----------
class TestRoomCapacity:
    def test_room_status(self, learner_client):
        r = learner_client.get(f"{API}/room/status")
        assert r.status_code == 200
        d = r.json()
        assert "capacity" in d and "occupied" in d

    def test_capacity_full_returns_409(self, admin_client, guard_client, learner_client):
        # get current state
        original = admin_client.get(f"{API}/room/status").json()
        original_capacity = original["capacity"]
        occupied = original["occupied"]
        # Set capacity to current occupied so room is full
        new_cap = max(occupied, 1)
        r = admin_client.put(f"{API}/admin/capacity", json={"capacity": new_cap})
        assert r.status_code == 200
        assert r.json()["capacity"] == new_cap

        # Create expected + try to arrive with storage=room
        me = learner_client.get(f"{API}/auth/me").json()
        did = None
        try:
            if occupied >= 1:
                created = learner_client.post(f"{API}/deliveries", json={"courier": "Delhivery", "item_type": "parcel"}).json()
                did = created["id"]
                r = guard_client.post(f"{API}/deliveries/{did}/arrive", json={"storage": "room"})
                assert r.status_code == 409, f"expected 409, got {r.status_code} {r.text}"
            else:
                # occupied == 0, need to make it full first. Set capacity=1, arrive one, then try to arrive another
                admin_client.put(f"{API}/admin/capacity", json={"capacity": 1})
                c1 = learner_client.post(f"{API}/deliveries", json={"courier": "A", "item_type": "parcel"}).json()
                guard_client.post(f"{API}/deliveries/{c1['id']}/arrive", json={"storage": "room"})
                c2 = learner_client.post(f"{API}/deliveries", json={"courier": "B", "item_type": "parcel"}).json()
                r = guard_client.post(f"{API}/deliveries/{c2['id']}/arrive", json={"storage": "room"})
                assert r.status_code == 409
                # cleanup c1
                d1 = next(x for x in guard_client.get(f"{API}/deliveries").json() if x["id"] == c1["id"])
                guard_client.post(f"{API}/deliveries/{c1['id']}/pickup", json={"otp": d1["otp"]})
                # cleanup c2 (delete expected)
                learner_client.delete(f"{API}/deliveries/{c2['id']}")
        finally:
            # cleanup did if arrived
            if did:
                learner_client.delete(f"{API}/deliveries/{did}")
            # Restore capacity to 40 per instructions
            admin_client.put(f"{API}/admin/capacity", json={"capacity": 40})
            final = admin_client.get(f"{API}/room/status").json()
            assert final["capacity"] == 40


# ---------- Admin stats ----------
class TestAdminStats:
    def test_stats(self, admin_client):
        r = admin_client.get(f"{API}/admin/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "by_status", "by_type", "per_day", "avg_pickup_minutes", "capacity", "occupied"):
            assert k in d
        assert isinstance(d["per_day"], list) and len(d["per_day"]) == 7
        assert d["total"] >= 10  # seeded historical

    def test_stats_forbidden_for_learner(self, learner_client):
        r = learner_client.get(f"{API}/admin/stats")
        assert r.status_code == 403


# ---------- Notifications ----------
class TestNotifications:
    def test_notifications_and_read(self, learner_client):
        r = learner_client.get(f"{API}/notifications")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        m = learner_client.post(f"{API}/notifications/read")
        assert m.status_code == 200



# ---------- WhatsApp status & simulated channel (Iteration 2) ----------
class TestWhatsAppStatus:
    def test_status_not_configured(self, learner_client):
        r = learner_client.get(f"{API}/whatsapp/status")
        assert r.status_code == 200
        d = r.json()
        assert d == {"configured": False}, f"expected simulated mode, got {d}"

    def test_status_requires_auth(self):
        r = requests.get(f"{API}/whatsapp/status")
        assert r.status_code == 401

    def test_notifications_channel_simulated(self, learner_client):
        # Create a delivery to force a fresh notification, then check its channel
        r = learner_client.post(f"{API}/deliveries", json={"courier": "TEST_Simulated", "item_type": "parcel"})
        assert r.status_code == 200
        did = r.json()["id"]
        try:
            notifs = learner_client.get(f"{API}/notifications").json()
            match = [n for n in notifs if n.get("delivery_id") == did]
            assert match, "expected a notification for the created delivery"
            assert all(n["channel"] == "simulated" for n in match), \
                f"expected channel=simulated, got {[n.get('channel') for n in match]}"
        finally:
            learner_client.delete(f"{API}/deliveries/{did}")


# ---------- QR pickup scan (Iteration 2) ----------
class TestScanPickup:
    def _create_arrived(self, learner_client, guard_client, storage="room"):
        r = learner_client.post(f"{API}/deliveries", json={"courier": "TEST_Scan", "item_type": "parcel"})
        assert r.status_code == 200
        did = r.json()["id"]
        a = guard_client.post(f"{API}/deliveries/{did}/arrive", json={"storage": storage})
        assert a.status_code == 200, a.text
        return did, a.json()["otp"]

    def test_scan_valid_code_completes(self, guard_client, learner_client):
        did, otp = self._create_arrived(learner_client, guard_client)
        r = guard_client.post(f"{API}/deliveries/pickup/scan", json={"code": f"GATEFLOW:{did}:{otp}"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "picked_up"
        # verify persistence
        after = learner_client.get(f"{API}/deliveries").json()
        this = next(x for x in after if x["id"] == did)
        assert this["status"] == "picked_up"
        # Handed over notification
        n = learner_client.get(f"{API}/notifications").json()
        assert any("Handed over" in m["message"] and m["delivery_id"] == did for m in n)

    def test_scan_invalid_format_returns_400(self, guard_client):
        for bad in ["not-a-qr", "FOO:1:2", "GATEFLOW:only-two", "GATEFLOW:a:b:c:d"]:
            r = guard_client.post(f"{API}/deliveries/pickup/scan", json={"code": bad})
            assert r.status_code == 400, f"{bad} -> {r.status_code} {r.text}"
            assert "Not a valid GateFlow QR code" in r.json().get("detail", "")

    def test_scan_wrong_otp_returns_400(self, guard_client, learner_client):
        did, otp = self._create_arrived(learner_client, guard_client)
        wrong = "000000" if otp != "000000" else "111111"
        try:
            r = guard_client.post(f"{API}/deliveries/pickup/scan", json={"code": f"GATEFLOW:{did}:{wrong}"})
            assert r.status_code == 400
            # still arrived
            after = guard_client.get(f"{API}/deliveries").json()
            this = next(x for x in after if x["id"] == did)
            assert this["status"] == "arrived"
        finally:
            guard_client.post(f"{API}/deliveries/pickup/scan", json={"code": f"GATEFLOW:{did}:{otp}"})

    def test_scan_forbidden_for_learner(self, learner_client, guard_client):
        did, otp = self._create_arrived(learner_client, guard_client)
        try:
            r = learner_client.post(f"{API}/deliveries/pickup/scan", json={"code": f"GATEFLOW:{did}:{otp}"})
            assert r.status_code == 403
        finally:
            guard_client.post(f"{API}/deliveries/pickup/scan", json={"code": f"GATEFLOW:{did}:{otp}"})

    def test_scan_already_picked_up_returns_400(self, guard_client, learner_client):
        did, otp = self._create_arrived(learner_client, guard_client)
        r1 = guard_client.post(f"{API}/deliveries/pickup/scan", json={"code": f"GATEFLOW:{did}:{otp}"})
        assert r1.status_code == 200
        r2 = guard_client.post(f"{API}/deliveries/pickup/scan", json={"code": f"GATEFLOW:{did}:{otp}"})
        assert r2.status_code == 400
        assert "not awaiting pickup" in r2.json().get("detail", "").lower()

    def test_manual_otp_pickup_still_works(self, guard_client, learner_client):
        # Regression on POST /api/deliveries/{id}/pickup after refactor
        did, otp = self._create_arrived(learner_client, guard_client, storage="counter")
        r = guard_client.post(f"{API}/deliveries/{did}/pickup", json={"otp": otp})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "picked_up"
