import logging
import os
import sqlite3
from typing import List, Dict, Any, Optional
from supabase import create_client, Client
from ..core.config import settings

logger = logging.getLogger(__name__)

class SupabaseService:
    def __init__(self):
        self.client: Optional[Client] = None
        self.db_path = settings.DATABASE_PATH
        self._init_client()
        self._init_sqlite()

    def _init_sqlite(self):
        try:
            directory = os.path.dirname(self.db_path)
            if directory and not os.path.exists(directory):
                os.makedirs(directory, exist_ok=True)

            conn = sqlite3.connect(self.db_path)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS tourists (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    phone TEXT,
                    email TEXT,
                    role TEXT,
                    emergency_contact TEXT,
                    pace TEXT,
                    interests TEXT,
                    verified INTEGER DEFAULT 0,
                    tourist_id TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sos_alerts (
                    id TEXT PRIMARY KEY,
                    user_name TEXT,
                    emergency_contact TEXT,
                    latitude REAL,
                    longitude REAL,
                    battery_level INTEGER,
                    status TEXT,
                    payload TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS itineraries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT,
                    title TEXT,
                    hours INTEGER,
                    preference TEXT,
                    pace TEXT,
                    stops TEXT,
                    safety_briefing TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS group_members (
                    group_id TEXT,
                    user_name TEXT,
                    latitude REAL,
                    longitude REAL,
                    is_anchor INTEGER,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (group_id, user_name)
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS auth_otps (
                    contact TEXT PRIMARY KEY,
                    code_hash TEXT NOT NULL,
                    expires_at REAL NOT NULL,
                    requested_at REAL NOT NULL,
                    attempts INTEGER NOT NULL DEFAULT 0
                )
            """)
            conn.commit()
            conn.close()
        except Exception as exc:
            logger.warning(f"SQLite fallback initialization failed: {exc}")

    def _sqlite_insert(self, table: str, data: Dict[str, Any]) -> bool:
        try:
            conn = sqlite3.connect(self.db_path)
            columns = ', '.join(data.keys())
            placeholders = ', '.join(['?'] * len(data))
            values = tuple(data.values())
            conn.execute(f"INSERT OR REPLACE INTO {table} ({columns}) VALUES ({placeholders})", values)
            conn.commit()
            conn.close()
            return True
        except Exception as exc:
            logger.warning(f"SQLite insert failed for {table}: {exc}")
            return False

    def get_auth_otp(self, contact: str) -> Optional[Dict[str, Any]]:
        if not self.client or settings.SMS_PROVIDER.lower() in {"free", "mock"}:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT * FROM auth_otps WHERE contact = ?", (contact,)).fetchone()
            conn.close()
            return dict(row) if row else None
        try:
            result = self.client.table("auth_otps").select("*").eq("contact", contact).limit(1).execute()
            return result.data[0] if result.data else None
        except Exception as exc:
            logger.error("Failed to read OTP state from Supabase: %s", exc)
            raise RuntimeError("OTP storage is unavailable") from exc

    def save_auth_otp(self, contact: str, code_hash: str, expires_at: float, requested_at: float) -> bool:
        record = {"contact": contact, "code_hash": code_hash, "expires_at": expires_at, "requested_at": requested_at, "attempts": 0}
        if not self.client or settings.SMS_PROVIDER.lower() in {"free", "mock"}:
            conn = sqlite3.connect(self.db_path)
            try:
                conn.execute(
                    "INSERT OR REPLACE INTO auth_otps (contact, code_hash, expires_at, requested_at, attempts) VALUES (?, ?, ?, ?, 0)",
                    (contact, code_hash, expires_at, requested_at),
                )
                conn.commit()
                return True
            finally:
                conn.close()
        try:
            self.client.table("auth_otps").upsert(record, on_conflict="contact").execute()
            return True
        except Exception as exc:
            logger.error("Failed to save OTP state to Supabase: %s", exc)
            raise RuntimeError("OTP storage is unavailable") from exc

    def increment_auth_otp_attempts(self, contact: str, attempts: int) -> None:
        if not self.client or settings.SMS_PROVIDER.lower() in {"free", "mock"}:
            conn = sqlite3.connect(self.db_path)
            try:
                conn.execute("UPDATE auth_otps SET attempts = ? WHERE contact = ?", (attempts, contact))
                conn.commit()
            finally:
                conn.close()
            return
        try:
            self.client.table("auth_otps").update({"attempts": attempts}).eq("contact", contact).execute()
        except Exception as exc:
            logger.error("Failed to update OTP attempts in Supabase: %s", exc)
            raise RuntimeError("OTP storage is unavailable") from exc

    def delete_auth_otp(self, contact: str) -> None:
        if not self.client or settings.SMS_PROVIDER.lower() in {"free", "mock"}:
            conn = sqlite3.connect(self.db_path)
            try:
                conn.execute("DELETE FROM auth_otps WHERE contact = ?", (contact,))
                conn.commit()
            finally:
                conn.close()
            return
        try:
            self.client.table("auth_otps").delete().eq("contact", contact).execute()
        except Exception as exc:
            logger.error("Failed to delete OTP state from Supabase: %s", exc)
            raise RuntimeError("OTP storage is unavailable") from exc

    def _init_client(self):
        try:
            if settings.SUPABASE_URL and settings.SUPABASE_KEY:
                self.client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
                logger.info(f"Supabase Client initialized with {settings.SUPABASE_URL}")
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            self.client = None

    def get_places(self, category: Optional[str] = None, search: Optional[str] = None, limit: int = 50) -> Optional[List[Dict[str, Any]]]:
        """Fetch places from Supabase with optional filters."""
        if not self.client:
            return None
        try:
            query = self.client.table("places").select("*")
            if category and category.lower() != "all":
                query = query.ilike("category", category)
            if search:
                query = query.ilike("name", f"%{search}%")
            
            res = query.limit(limit).execute()
            return res.data if res.data else []
        except Exception as e:
            logger.warning(f"Error fetching places from Supabase: {e}")
            return None

    def save_sos_alert(self, alert_data: Dict[str, Any]) -> bool:
        """Persist an SOS emergency alert to Supabase."""
        if not self.client:
            import json
            return self._sqlite_insert(
                "sos_alerts",
                {
                    "id": alert_data.get("alert_id") or f"SOS-{int(__import__('time').time())}",
                    "user_name": alert_data.get("user", {}).get("name", "Tourist"),
                    "emergency_contact": alert_data.get("user", {}).get("emergency_contact"),
                    "latitude": alert_data.get("location", {}).get("latitude"),
                    "longitude": alert_data.get("location", {}).get("longitude"),
                    "battery_level": int(str(alert_data.get("user", {}).get("battery_level", "0")).replace('%', '')) if alert_data.get("user", {}).get("battery_level") not in (None, "Unknown") else None,
                    "status": "ACTIVE",
                    "payload": json.dumps(alert_data),
                }
            )
        try:
            record = {
                "id": alert_data.get("alert_id"),
                "user_name": alert_data.get("user", {}).get("name", "Tourist"),
                "emergency_contact": alert_data.get("user", {}).get("emergency_contact"),
                "latitude": alert_data.get("location", {}).get("latitude"),
                "longitude": alert_data.get("location", {}).get("longitude"),
                "battery_level": int(str(alert_data.get("user", {}).get("battery_level", "0")).replace("%", "")) if alert_data.get("user", {}).get("battery_level") != "Unknown" else None,
                "status": "ACTIVE",
                "nearest_police": alert_data.get("immediate_assistance", {}).get("nearest_police"),
                "nearest_hospital": alert_data.get("immediate_assistance", {}).get("nearest_hospital")
            }
            self.client.table("sos_alerts").insert(record).execute()
            return True
        except Exception as e:
            logger.error(f"Error saving SOS alert to Supabase: {e}")
            return False

    def search_sos_alerts(self, query: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Search emergency dispatch records and SOS alerts."""
        if not self.client:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            try:
                if query:
                    q = f"%{query}%"
                    rows = conn.execute(
                        "SELECT * FROM sos_alerts WHERE id LIKE ? OR user_name LIKE ? OR emergency_contact LIKE ? OR status LIKE ? ORDER BY created_at DESC LIMIT ?",
                        (q, q, q, q, limit)
                    ).fetchall()
                else:
                    rows = conn.execute("SELECT * FROM sos_alerts ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
                return [dict(row) for row in rows]
            finally:
                conn.close()
        try:
            db_query = self.client.table("sos_alerts").select("*")
            if query:
                db_query = db_query.or_(f"id.ilike.%{query}%,user_name.ilike.%{query}%,emergency_contact.ilike.%{query}%")
            result = db_query.order("created_at", desc=True).limit(limit).execute()
            return result.data if result.data else []
        except Exception as exc:
            logger.error("Error searching SOS alerts in Supabase: %s", exc)
            return []

    def save_itinerary(self, user_id: str, hours: int, preference: str, pace: str, stops: List[Dict[str, Any]], safety_briefing: str) -> bool:
        """Save generated itinerary to Supabase."""
        if not self.client:
            import json
            return self._sqlite_insert(
                "itineraries",
                {
                    "user_id": user_id,
                    "title": f"Nashik {preference} Tour ({hours}h)",
                    "hours": hours,
                    "preference": preference,
                    "pace": pace,
                    "stops": json.dumps(stops),
                    "safety_briefing": safety_briefing,
                }
            )
        try:
            record = {
                "title": f"Nashik {preference} Tour ({hours}h)",
                "user_id": user_id,
                "hours": hours,
                "preference": preference,
                "pace": pace,
                "stops": stops,
                "safety_briefing": safety_briefing
            }
            self.client.table("itineraries").insert(record).execute()
            return True
        except Exception as e:
            logger.error(f"Error saving itinerary to Supabase: {e}")
            return False

    def update_group_member(self, group_id: str, member_name: str, lat: float, lng: float, is_anchor: bool = False) -> bool:
        """Upsert group and update member location in Supabase."""
        if not self.client:
            return self._sqlite_insert(
                "group_members",
                {
                    "group_id": group_id,
                    "user_name": member_name,
                    "latitude": lat,
                    "longitude": lng,
                    "is_anchor": 1 if is_anchor else 0,
                }
            )
        try:
            # Ensure group exists
            self.client.table("groups").upsert({
                "id": group_id,
                "name": f"Group {group_id}"
            }).execute()

            # Insert/update member
            self.client.table("group_members").upsert({
                "group_id": group_id,
                "user_name": member_name,
                "latitude": lat,
                "longitude": lng,
                "is_anchor": is_anchor
            }, on_conflict="group_id,user_name").execute()
            return True
        except Exception as e:
            logger.warning(f"Error updating group in Supabase: {e}")
            return False

    def save_tourist_profile(self, profile: Dict[str, Any]) -> bool:
        """Save tourist profile onboarding data into Supabase."""
        if not self.client or settings.SMS_PROVIDER.lower() in {"free", "mock"}:
            import json
            return self._sqlite_insert(
                "tourists",
                {
                    "id": profile.get("tourist_id") or profile.get("phone") or f"tourist-{int(__import__('time').time())}",
                    "name": profile.get("name", "Tourist"),
                    "phone": profile.get("phone"),
                    "email": profile.get("email"),
                    "role": profile.get("role", "tourist"),
                    "emergency_contact": profile.get("emergency_contact"),
                    "pace": profile.get("pace", "balanced"),
                    "interests": json.dumps(profile.get("interests", [])),
                    "verified": 1 if profile.get("verified") else 0,
                    "tourist_id": profile.get("tourist_id"),
                }
            )
        try:
            self.client.table("tourists").insert({
                "name": profile.get("name", "Tourist"),
                "phone": profile.get("phone"),
                "email": profile.get("email"),
                "role": profile.get("role", "tourist"),
                "emergency_contact": profile.get("emergency_contact"),
                "pace": profile.get("pace", "balanced"),
                "interests": profile.get("interests", []),
                "verified": profile.get("verified", False),
                "tourist_id": profile.get("tourist_id")
            }).execute()
            return True
        except Exception as e:
            logger.error(f"Error saving tourist profile to Supabase: {e}")
            return False

supabase_service = SupabaseService()
