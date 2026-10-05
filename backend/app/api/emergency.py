import time
import uuid
from typing import Optional
from fastapi import APIRouter, Body, HTTPException, Query
from ..data.safety_data import EMERGENCY_HELPLINES, SAFE_HAVENS, RISK_ZONES
from ..services.geo_service import find_nearest_safe_haven, find_nearest_facility, geofence_status
from ..services.dispatch_service import dispatch_service
from ..core.config import settings

router = APIRouter(prefix="/emergency", tags=["SOS & Emergency System"])

@router.get("/helplines")
async def get_emergency_helplines():
    """Retrieve verified Nashik official emergency numbers (Police, Women Helpline, Disaster, etc.)."""
    return {
        "status": "success",
        "city": "Nashik",
        "state": "Maharashtra",
        "helplines": EMERGENCY_HELPLINES
    }

@router.get("/safe-havens")
async def get_safe_havens():
    """Retrieve verified Safe Havens (Cafes, Police Stations, Medical centers) in Nashik."""
    return {
        "status": "success",
        "safe_havens": SAFE_HAVENS
    }

@router.get("/risk-zones")
async def get_risk_zones():
    """Retrieve active disaster and terrain risk zones in Nashik."""
    return {
        "status": "success",
        "risk_zones": RISK_ZONES
    }

@router.post("/geofence")
async def check_geofence(payload: dict = Body(...)):
    try:
        lat = float(payload["latitude"])
        lng = float(payload["longitude"])
        center_lat = float(payload["center_latitude"])
        center_lng = float(payload["center_longitude"])
        radius = float(payload.get("radius_meters", settings.GEO_FENCE_RADIUS_METERS))
        if not (-90 <= lat <= 90 and -180 <= lng <= 180 and -90 <= center_lat <= 90 and -180 <= center_lng <= 180):
            raise ValueError("Coordinates out of range")
        if not 1 <= radius <= 100000:
            raise ValueError("Radius must be between 1 and 100000 meters")
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid geofence coordinates or radius: {exc}")

    return geofence_status(lat, lng, center_lat, center_lng, radius)

@router.post("/sos")
async def trigger_sos_alert(payload: dict = Body(...)):
    """
    Emergency SOS Alert Dispatcher.
    Receives tourist's GPS coordinates, battery level, emergency contact.
    Locates closest police station and civil hospital and generates emergency dispatch packet.
    """
    user_id = payload.get("user_id", "tourist-guest")
    user_name = payload.get("user_name", "Anonymous Tourist")
    try:
        lat = float(payload.get("lat") or payload.get("latitude"))
        lng = float(payload.get("lng") or payload.get("longitude"))
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            raise ValueError("Coordinates out of range")
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"Valid GPS coordinates are required: {exc}")
    battery = payload.get("battery_level")
    contact = payload.get("emergency_contact")

    alert_id = f"SOS-{int(time.time())}-{str(uuid.uuid4())[:6].upper()}"

    nearest_police = find_nearest_facility(lat, lng, "police")
    nearest_hospital = find_nearest_facility(lat, lng, "hospital")
    nearest_safe_spot = find_nearest_safe_haven(lat, lng)

    dispatch_record = {
        "status": "RECEIVED",
        "alert_id": alert_id,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC"),
        "user": {
            "id": user_id,
            "name": user_name,
            "emergency_contact": contact,
            "battery_level": f"{battery}%" if battery else "Unknown"
        },
        "location": {
            "latitude": lat,
            "longitude": lng,
            "google_maps_pin": f"https://maps.google.com/?q={lat},{lng}"
        },
        "immediate_assistance": {
            "nearest_police": nearest_police,
            "nearest_hospital": nearest_hospital,
            "nearest_safe_hub": nearest_safe_spot
        },
        "priority_helplines": [
            {"service": "Police Control Room", "number": "100"},
            {"service": "Women Safety Helpline", "number": "1091"},
            {"service": "Ambulance Emergency", "number": "108"},
            {"service": "District Disaster Management", "number": "1077"}
        ],
        "safety_instructions": [
            "Stay in a well-lit public area or move toward the nearest safe hub indicated above.",
            "Keep phone on battery saver mode.",
            "If safe to do so, dial 100 or 108 directly."
        ]
    }

    # Persist the alert before attempting external notifications.
    from ..services.supabase_service import supabase_service
    dispatch_record["persistence_status"] = "saved" if supabase_service.save_sos_alert(dispatch_record) else "not_saved"
    dispatch_record["dispatch"] = dispatch_service.notify_sos(dispatch_record, contact)
    dispatch_record["status"] = dispatch_record["dispatch"]["status"].upper()

    return dispatch_record


@router.get("/dispatch/search")
async def search_dispatch_database(
    q: Optional[str] = Query(None, description="Search query for dispatch database / SOS alerts (ID, name, contact, status)"),
    limit: int = Query(50, ge=1, le=100)
):
    """Search emergency dispatch records and SOS alert database."""
    from ..services.supabase_service import supabase_service
    results = supabase_service.search_sos_alerts(query=q, limit=limit)
    return {
        "status": "success",
        "count": len(results),
        "results": results
    }

