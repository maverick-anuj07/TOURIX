import json
import os
from supabase import create_client, Client

SUPABASE_URL = "https://bwnkfzzipsikvqnvdunu.supabase.co"
SUPABASE_KEY = "sb_publishable_4CSpiBQZIi-EF-_11dXrUQ_bIa_9UcH"

# Test connecting
print(f"Connecting to Supabase at {SUPABASE_URL}...")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Load places
with open("backend/app/data/places.json", "r", encoding="utf-8") as f:
    places = json.load(f)

print(f"Loaded {len(places)} places. Upserting into Supabase...")

# Format places records
records = []
for p in places:
    records.append({
        "id": p["id"],
        "name": p["name"],
        "category": p.get("category", "General"),
        "subcategory": p.get("subcategory"),
        "description": p.get("description", ""),
        "short_description": p.get("short_description"),
        "latitude": p["latitude"],
        "longitude": p["longitude"],
        "estimated_visit_duration": p.get("estimated_visit_duration"),
        "best_time": p.get("best_time"),
        "opening_time": p.get("opening_time"),
        "closing_time": p.get("closing_time"),
        "entry_fee": p.get("entry_fee"),
        "rating": p.get("rating", 4.5),
        "review_count": p.get("review_count", 0),
        "safety_notes": p.get("safety_notes"),
        "icon": p.get("icon", "fa-location-dot"),
        "tags": p.get("tags", [])
    })

# Batch upsert in chunks of 20
for i in range(0, len(records), 20):
    chunk = records[i:i+20]
    res = supabase.table("places").upsert(chunk).execute()
    print(f"Upserted chunk {i//20 + 1}: {len(chunk)} records.")

# Also sync risk zones and safe havens
from backend.app.data.safety_data import RISK_ZONES, SAFE_HAVENS

rz_records = []
for rz in RISK_ZONES:
    rz_records.append({
        "id": rz["id"],
        "title": rz["title"],
        "type": rz["type"],
        "severity": rz["severity"],
        "latitude": rz["latitude"],
        "longitude": rz["longitude"],
        "radius_meters": rz["radius_meters"],
        "description": rz["description"],
        "recommended_action": rz["recommended_action"],
        "is_active": rz.get("is_active", True)
    })
supabase.table("risk_zones").upsert(rz_records).execute()
print(f"Upserted {len(rz_records)} risk zones.")

sh_records = []
for sh in SAFE_HAVENS:
    sh_records.append({
        "id": sh["id"],
        "name": sh["name"],
        "category": sh["category"],
        "latitude": sh["latitude"],
        "longitude": sh["longitude"],
        "address": sh["address"],
        "phone": sh.get("phone"),
        "has_first_aid": sh.get("has_first_aid", True),
        "has_wifi": sh.get("has_wifi", True)
    })
supabase.table("safe_havens").upsert(sh_records).execute()
print(f"Upserted {len(sh_records)} safe havens.")

# Verify by querying count
res = supabase.table("places").select("id, name", count="exact").execute()
print(f"Total places in Supabase: {len(res.data)}")
