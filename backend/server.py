from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import random
import logging
import asyncio
import bcrypt
import jwt
from twilio.rest import Client as TwilioClient
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, UploadFile, File
from fastapi.responses import Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=8000,
    connectTimeoutMS=8000,
    socketTimeoutMS=20000,
)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

TWILIO_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM = os.environ.get("TWILIO_WHATSAPP_FROM", "")
twilio_client = TwilioClient(TWILIO_SID, TWILIO_TOKEN) if TWILIO_SID and TWILIO_TOKEN else None



logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def resolve_user(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await resolve_user(token)


def require_role(*roles):
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker


# ---------- Models ----------
class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = ""


class DeliveryCreate(BaseModel):
    courier: str
    tracking_id: Optional[str] = ""
    item_type: str = "parcel"
    description: Optional[str] = ""


class ArriveRequest(BaseModel):
    storage: str  # "room" | "counter"


class WalkInRequest(BaseModel):
    learner_id: str
    courier: str
    tracking_id: Optional[str] = ""
    item_type: str = "parcel"
    storage: str = "room"


class PickupRequest(BaseModel):
    otp: str


class ScanRequest(BaseModel):
    code: str


class CapacityUpdate(BaseModel):
    capacity: int = Field(gt=0, le=500)


class AgingUpdate(BaseModel):
    hours: int = Field(gt=0, le=720)


# ---------- Helpers ----------
def _send_whatsapp_sync(phone: str, message: str):
    twilio_client.messages.create(from_=f"whatsapp:{TWILIO_FROM}", to=f"whatsapp:{phone}", body=message)


async def send_whatsapp(phone: Optional[str], message: str) -> str:
    if not (twilio_client and TWILIO_FROM and phone):
        return "simulated"
    try:
        await asyncio.to_thread(_send_whatsapp_sync, phone.replace(" ", ""), message)
        return "whatsapp"
    except Exception as e:
        logger.warning(f"WhatsApp send failed: {e}")
        return "failed"


async def create_notification(user_id: str, message: str, delivery_id: str = ""):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "phone": 1})
    channel = await send_whatsapp(user.get("phone") if user else None, message)
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id, "message": message,
        "delivery_id": delivery_id, "read": False, "channel": channel,
        "created_at": now_iso()
    })


async def get_room_state():
    settings = await db.settings.find_one({"key": "room"}, {"_id": 0})
    capacity = settings["capacity"] if settings else 40
    active = await db.deliveries.find(
        {"status": "arrived", "storage": "room"}, {"_id": 0, "slot": 1}).to_list(1000)
    used_slots = sorted([d["slot"] for d in active if d.get("slot")])
    return capacity, used_slots


def next_free_slot(capacity, used_slots):
    used = set(used_slots)
    for s in range(1, capacity + 1):
        if s not in used:
            return s
    return None


# ---------- Auth ----------
@api_router.post("/auth/register")
async def register(body: RegisterRequest):
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {"id": str(uuid.uuid4()), "name": body.name.strip(), "email": email,
            "phone": body.phone, "role": "learner", "created_at": now_iso()}
    await db.users.insert_one({**user, "password_hash": hash_password(body.password)})
    token = create_access_token(user["id"], email, "learner")
    return {"user": user, "access_token": token}


@api_router.post("/auth/login")
async def login(body: LoginRequest):
    email = body.email.strip().lower()
    doc = await db.users.find_one({"email": email})
    if not doc or not verify_password(body.password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user = {k: v for k, v in doc.items() if k not in ("_id", "password_hash")}
    token = create_access_token(user["id"], email, user["role"])
    return {"user": user, "access_token": token}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------- Deliveries ----------
@api_router.post("/deliveries")
async def create_delivery(body: DeliveryCreate, user: dict = Depends(require_role("learner"))):
    delivery = {
        "id": str(uuid.uuid4()), "learner_id": user["id"], "learner_name": user["name"],
        "courier": body.courier, "tracking_id": body.tracking_id or "",
        "item_type": body.item_type, "description": body.description or "",
        "status": "expected", "storage": None, "slot": None, "otp": None, "photo_path": None,
        "walk_in": False, "created_at": now_iso(), "arrived_at": None, "picked_up_at": None
    }
    await db.deliveries.insert_one({**delivery})
    delivery.pop("_id", None)
    await create_notification(
        user["id"],
        f"Hi {user['name'].split()[0]}! ✅ Your expected delivery from *{body.courier}* has been registered. We'll message you the moment it reaches Gate No. 2.",
        delivery["id"])
    return delivery


@api_router.get("/deliveries")
async def list_deliveries(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if user["role"] == "learner":
        query["learner_id"] = user["id"]
    if status:
        query["status"] = status
    docs = await db.deliveries.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api_router.delete("/deliveries/{delivery_id}")
async def delete_delivery(delivery_id: str, user: dict = Depends(require_role("learner"))):
    result = await db.deliveries.delete_one(
        {"id": delivery_id, "learner_id": user["id"], "status": "expected"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Delivery not found or already arrived")
    return {"ok": True}


@api_router.post("/deliveries/{delivery_id}/arrive")
async def mark_arrived(delivery_id: str, body: ArriveRequest,
                       user: dict = Depends(require_role("guard", "admin"))):
    delivery = await db.deliveries.find_one({"id": delivery_id}, {"_id": 0})
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if delivery["status"] != "expected":
        raise HTTPException(status_code=400, detail="Delivery already processed")
    slot = None
    storage = body.storage
    if storage == "room":
        capacity, used = await get_room_state()
        slot = next_free_slot(capacity, used)
        if slot is None:
            raise HTTPException(status_code=409, detail="Delivery room is full. Use collect-immediately instead.")
    otp = f"{random.randint(0, 999999):06d}"
    update = {"status": "arrived", "storage": storage, "slot": slot,
              "otp": otp, "arrived_at": now_iso()}
    await db.deliveries.update_one({"id": delivery_id}, {"$set": update})
    if storage == "room":
        msg = f"📦 *Package arrived at Gate No. 2!* Your {delivery['item_type']} from *{delivery['courier']}* is safely stored in the Delivery Room — *Slot {slot}*. Show pickup code *{otp}* to the guard whenever convenient."
    else:
        msg = f"🚨 *Collect immediately!* Your {delivery['item_type']} from *{delivery['courier']}* is waiting at the Gate No. 2 counter and can't be stored. Please head over now with pickup code *{otp}*."
    await create_notification(delivery["learner_id"], msg, delivery_id)
    return {**delivery, **update}


@api_router.post("/deliveries/walkin")
async def walk_in(body: WalkInRequest, user: dict = Depends(require_role("guard", "admin"))):
    learner = await db.users.find_one({"id": body.learner_id, "role": "learner"}, {"_id": 0})
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")
    slot = None
    if body.storage == "room":
        capacity, used = await get_room_state()
        slot = next_free_slot(capacity, used)
        if slot is None:
            raise HTTPException(status_code=409, detail="Delivery room is full. Use collect-immediately instead.")
    otp = f"{random.randint(0, 999999):06d}"
    delivery = {
        "id": str(uuid.uuid4()), "learner_id": learner["id"], "learner_name": learner["name"],
        "courier": body.courier, "tracking_id": body.tracking_id or "",
        "item_type": body.item_type, "description": "", "status": "arrived",
        "storage": body.storage, "slot": slot, "otp": otp, "walk_in": True, "photo_path": None,
        "created_at": now_iso(), "arrived_at": now_iso(), "picked_up_at": None
    }
    await db.deliveries.insert_one({**delivery})
    delivery.pop("_id", None)
    if body.storage == "room":
        msg = f"📦 *Unexpected package at Gate No. 2!* A {body.item_type} from *{body.courier}* arrived for you and is stored in the Delivery Room — *Slot {slot}*. Pickup code: *{otp}*."
    else:
        msg = f"🚨 *Collect immediately!* A {body.item_type} from *{body.courier}* just arrived for you at Gate No. 2 and can't be stored. Pickup code: *{otp}*."
    await create_notification(learner["id"], msg, delivery["id"])
    return delivery


async def complete_pickup(delivery_id: str, otp: str):
    delivery = await db.deliveries.find_one({"id": delivery_id}, {"_id": 0})
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if delivery["status"] != "arrived":
        raise HTTPException(status_code=400, detail="Delivery is not awaiting pickup")
    if otp.strip() != delivery["otp"]:
        raise HTTPException(status_code=400, detail="Incorrect OTP. Please check with the learner.")
    update = {"status": "picked_up", "picked_up_at": now_iso()}
    await db.deliveries.update_one({"id": delivery_id}, {"$set": update})
    await create_notification(
        delivery["learner_id"],
        f"✅ *Handed over!* Your {delivery['item_type']} from *{delivery['courier']}* was collected at Gate No. 2. Thanks for keeping campus deliveries smooth!",
        delivery_id)
    return {**delivery, **update}


@api_router.post("/deliveries/pickup/scan")
async def scan_pickup(body: ScanRequest, user: dict = Depends(require_role("guard", "admin"))):
    parts = body.code.strip().split(":")
    if len(parts) != 3 or parts[0] != "GATEFLOW":
        raise HTTPException(status_code=400, detail="Not a valid GateFlow QR code")
    return await complete_pickup(parts[1], parts[2])


@api_router.post("/deliveries/{delivery_id}/pickup")
async def verify_pickup(delivery_id: str, body: PickupRequest,
                        user: dict = Depends(require_role("guard", "admin"))):
    return await complete_pickup(delivery_id, body.otp)


@api_router.get("/whatsapp/status")
async def whatsapp_status(user: dict = Depends(get_current_user)):
    return {"configured": bool(twilio_client and TWILIO_FROM)}


# ---------- Package Photos ----------
ALLOWED_EXT = {"jpg", "jpeg", "png", "webp"}


@api_router.post("/deliveries/{delivery_id}/photo")
async def upload_photo(delivery_id: str, file: UploadFile = File(...),
                       user: dict = Depends(require_role("guard", "admin"))):
    delivery = await db.deliveries.find_one({"id": delivery_id}, {"_id": 0})
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXT:
        ext = "jpg"
    import base64
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Photo too large (max 8MB)")
    photo_b64 = base64.b64encode(data).decode("utf-8")
    content_type = file.content_type or "image/jpeg"
    photo_path = f"deliveries/{delivery_id}/photo.{ext}"
    await db.deliveries.update_one(
        {"id": delivery_id},
        {"$set": {"photo_data": photo_b64, "photo_content_type": content_type, "photo_path": photo_path}}
    )
    return {"photo_path": photo_path}


@api_router.get("/deliveries/{delivery_id}/photo")
async def get_photo(delivery_id: str, request: Request, auth: Optional[str] = None):
    token = auth
    if not token:
        token = request.cookies.get("access_token")
        auth_header = request.headers.get("Authorization", "")
        if not token and auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = await resolve_user(token)
    delivery = await db.deliveries.find_one({"id": delivery_id}, {"_id": 0})
    if not delivery or not delivery.get("photo_path"):
        raise HTTPException(status_code=404, detail="Photo not found")
    if user["role"] == "learner" and delivery["learner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    import base64
    photo_b64 = delivery.get("photo_data")
    if not photo_b64:
        raise HTTPException(status_code=404, detail="Photo not found")
    data = base64.b64decode(photo_b64)
    content_type = delivery.get("photo_content_type", "image/jpeg")
    return Response(content=data, media_type=content_type)


# ---------- Room ----------
async def get_aging_info():
    settings = await db.settings.find_one({"key": "room"}) or {}
    aging_hours = settings.get("aging_hours", 24)
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=aging_hours)).isoformat()
    aging_count = await db.deliveries.count_documents(
        {"status": "arrived", "storage": "room", "arrived_at": {"$lt": cutoff}})
    return aging_hours, aging_count


@api_router.get("/room/status")
async def room_status(user: dict = Depends(get_current_user)):
    capacity, used_slots = await get_room_state()
    aging_hours, aging_count = await get_aging_info()
    return {"capacity": capacity, "occupied": len(used_slots), "used_slots": used_slots,
            "aging_hours": aging_hours, "aging_count": aging_count}


@api_router.put("/admin/capacity")
async def update_capacity(body: CapacityUpdate, user: dict = Depends(require_role("admin"))):
    await db.settings.update_one({"key": "room"}, {"$set": {"capacity": body.capacity}}, upsert=True)
    return {"capacity": body.capacity}


@api_router.put("/admin/aging")
async def update_aging(body: AgingUpdate, user: dict = Depends(require_role("admin"))):
    await db.settings.update_one({"key": "room"}, {"$set": {"aging_hours": body.hours}}, upsert=True)
    return {"aging_hours": body.hours}


# ---------- Stats ----------
@api_router.get("/admin/stats")
async def stats(user: dict = Depends(require_role("admin", "guard"))):
    docs = await db.deliveries.find({}, {"_id": 0}).to_list(5000)
    by_status, by_type = {}, {}
    pickup_minutes = []
    per_day = {}
    today = datetime.now(timezone.utc).date()
    for i in range(6, -1, -1):
        per_day[(today - timedelta(days=i)).isoformat()] = 0
    for d in docs:
        by_status[d["status"]] = by_status.get(d["status"], 0) + 1
        by_type[d["item_type"]] = by_type.get(d["item_type"], 0) + 1
        day = d["created_at"][:10]
        if day in per_day:
            per_day[day] += 1
        if d.get("picked_up_at") and d.get("arrived_at"):
            delta = datetime.fromisoformat(d["picked_up_at"]) - datetime.fromisoformat(d["arrived_at"])
            pickup_minutes.append(delta.total_seconds() / 60)
    capacity, used_slots = await get_room_state()
    aging_hours, aging_count = await get_aging_info()
    escalated = [
        {"id": d["id"], "learner_name": d["learner_name"], "courier": d["courier"],
         "item_type": d["item_type"], "slot": d.get("slot"), "arrived_at": d.get("arrived_at"),
         "reminder_count": d.get("reminder_count", 0)}
        for d in docs if d.get("escalated") and d["status"] == "arrived"
    ]
    return {
        "total": len(docs),
        "by_status": by_status,
        "by_type": by_type,
        "per_day": [{"date": k, "count": v} for k, v in per_day.items()],
        "avg_pickup_minutes": round(sum(pickup_minutes) / len(pickup_minutes), 1) if pickup_minutes else 0,
        "capacity": capacity, "occupied": len(used_slots),
        "aging_hours": aging_hours, "aging_count": aging_count,
        "escalated": escalated
    }


@api_router.get("/guard/shift-summary")
async def shift_summary(user: dict = Depends(require_role("guard", "admin"))):
    today = datetime.now(timezone.utc).date().isoformat()
    docs = await db.deliveries.find({}, {"_id": 0}).to_list(5000)
    received = [d for d in docs if (d.get("arrived_at") or "")[:10] == today]
    handed = [d for d in docs if (d.get("picked_up_at") or "")[:10] == today]
    waiting = [d for d in docs if d["status"] == "arrived"]
    mins = []
    for d in handed:
        if d.get("arrived_at"):
            mins.append((datetime.fromisoformat(d["picked_up_at"]) - datetime.fromisoformat(d["arrived_at"])).total_seconds() / 60)
    return {
        "date": today,
        "received": len(received),
        "walk_ins": len([d for d in received if d.get("walk_in")]),
        "handed_over": len(handed),
        "waiting": len(waiting),
        "waiting_room": len([d for d in waiting if d["storage"] == "room"]),
        "waiting_counter": len([d for d in waiting if d["storage"] == "counter"]),
        "avg_pickup_minutes": round(sum(mins) / len(mins), 1) if mins else 0,
        "waiting_list": [
            {"id": d["id"], "learner_name": d["learner_name"], "courier": d["courier"],
             "item_type": d["item_type"], "slot": d.get("slot")}
            for d in waiting]
    }


# ---------- Notifications ----------
@api_router.get("/notifications")
async def get_notifications(user: dict = Depends(get_current_user)):
    docs = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api_router.post("/notifications/read")
async def mark_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ---------- Users ----------
@api_router.get("/users/learners")
async def list_learners(user: dict = Depends(require_role("guard", "admin"))):
    docs = await db.users.find({"role": "learner"}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return docs


# ---------- Seeding ----------
SEED_USERS = [
    {"name": "Ops Admin", "email": "admin@rishihood.edu.in", "password": "admin123", "role": "admin", "phone": "+91 98100 00001"},
    {"name": "Gate 2 Guard", "email": "guard@rishihood.edu.in", "password": "guard123", "role": "guard", "phone": "+91 98100 00002"},
    {"name": "Aarav Sharma", "email": "aarav@rishihood.edu.in", "password": "learner123", "role": "learner", "phone": "+91 98100 00003"},
    {"name": "Diya Patel", "email": "diya@rishihood.edu.in", "password": "learner123", "role": "learner", "phone": "+91 98100 00004"},
]


async def seed():
    await db.users.create_index("email", unique=True)
    for u in SEED_USERS:
        existing = await db.users.find_one({"email": u["email"]})
        if existing is None:
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "name": u["name"], "email": u["email"],
                "phone": u["phone"], "role": u["role"],
                "password_hash": hash_password(u["password"]), "created_at": now_iso()})
        elif not verify_password(u["password"], existing["password_hash"]):
            await db.users.update_one({"email": u["email"]}, {"$set": {"password_hash": hash_password(u["password"])}})
    if not await db.settings.find_one({"key": "room"}):
        await db.settings.insert_one({"key": "room", "capacity": 40, "aging_hours": 24})
    if await db.deliveries.count_documents({}) == 0:
        aarav = await db.users.find_one({"email": "aarav@rishihood.edu.in"}, {"_id": 0})
        diya = await db.users.find_one({"email": "diya@rishihood.edu.in"}, {"_id": 0})
        samples = []
        couriers = ["Amazon", "Flipkart", "BlueDart", "Zomato", "Delhivery", "Myntra"]
        types = ["parcel", "parcel", "food", "document", "parcel", "fragile"]
        for i in range(10):
            learner = aarav if i % 2 == 0 else diya
            created = datetime.now(timezone.utc) - timedelta(days=6 - (i % 7), hours=i)
            arrived = created + timedelta(hours=2)
            picked = arrived + timedelta(minutes=30 + i * 12)
            samples.append({
                "id": str(uuid.uuid4()), "learner_id": learner["id"], "learner_name": learner["name"],
                "courier": couriers[i % 6], "tracking_id": f"TRK{100200 + i * 37}",
                "item_type": types[i % 6], "description": "", "status": "picked_up",
                "storage": "room" if types[i % 6] != "food" else "counter",
                "slot": None, "otp": f"{random.randint(0, 999999):06d}", "walk_in": i % 4 == 3,
                "created_at": created.isoformat(), "arrived_at": arrived.isoformat(),
                "picked_up_at": picked.isoformat()})
        await db.deliveries.insert_many(samples)


# ---------- Aging Monitor ----------
async def check_aging():
    settings = await db.settings.find_one({"key": "room"}) or {}
    hours = settings.get("aging_hours", 24)
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours)
    docs = await db.deliveries.find({"status": "arrived", "storage": "room"}, {"_id": 0}).to_list(1000)
    for d in docs:
        arrived = datetime.fromisoformat(d["arrived_at"])
        if arrived > cutoff:
            continue
        last = d.get("last_reminder_at")
        if last and datetime.fromisoformat(last) > cutoff:
            continue
        hrs_stored = int((now - arrived).total_seconds() // 3600)
        await create_notification(
            d["learner_id"],
            f"⏰ *Reminder from Gate No. 2!* Your {d['item_type']} from *{d['courier']}* has been waiting in the Delivery Room (Slot {d['slot']}) for {hrs_stored}+ hours. Space is limited — please collect it soon with code *{d['otp']}*.",
            d["id"])
        new_count = (d.get("reminder_count") or 0) + 1
        update = {"$set": {"last_reminder_at": now_iso()}, "$inc": {"reminder_count": 1}}
        if new_count >= 3:
            update["$set"]["escalated"] = True
        await db.deliveries.update_one({"id": d["id"]}, update)


async def aging_monitor():
    while True:
        try:
            await check_aging()
        except Exception as e:
            logger.warning(f"Aging check failed: {e}")
        await asyncio.sleep(60)


@app.on_event("startup")
async def on_startup():
    try:
        await seed()
    except Exception as e:
        import logging
        logging.getLogger("rishiverse").error(f"Seed failed (DB may not be ready): {e}")
    asyncio.create_task(aging_monitor())


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
