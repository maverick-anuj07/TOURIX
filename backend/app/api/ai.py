import os
import json
from typing import Optional
from fastapi import APIRouter, Body
from ..models.ai import ChatRequest, ChatResponse, ItineraryRequest, ItineraryResponse, RouteRiskRequest, RouteRiskResponse
from ..services.ai_service import generate_chat_reply, generate_smart_itinerary
from ..services.geo_service import check_risk_zones, haversine_km, get_route, geofence_status

router = APIRouter(prefix="/ai", tags=["AI Travel & Safety Companion"])

# Load places database for AI context
DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "places.json")
with open(DATA_FILE, "r", encoding="utf-8") as f:
    PLACES_DB = json.load(f)

@router.post("/chat")
async def chat_with_tourix(payload: dict = Body(...)):
    """
    Conversational AI travel assistant for Nashik.
    Accepts message, user personalization profile, language, and history.
    """
    user_msg = payload.get("message", "")
    language = payload.get("language", "en")
    history = payload.get("history", [])
    user_data = payload.get("user", {})

    if not user_msg:
        user_name = user_data.get("name") if isinstance(user_data, dict) and user_data.get("name") else "Traveler"
        return {"status": "success", "reply": f"Hi {user_name}! How can I help plan your trip to Nashik today?"}

    reply = generate_chat_reply(
        message=user_msg,
        user_profile=user_data,
        history=history,
        language=language
    )
    return {
        "status": "success",
        "reply": reply
    }

@router.post("/generate-itinerary")
async def generate_itinerary(payload: dict = Body(...)):
    """
    Generate an AI itinerary for Nashik based on available hours, travel preference, pace, and budget.
    """
    hours = int(payload.get("hours", 6))
    preference = str(payload.get("preference", "Heritage"))
    pace = str(payload.get("pace", "balanced"))
    budget = str(payload.get("budget", "moderate"))

    # Filter places matching preference
    matched_places = [
        p for p in PLACES_DB 
        if p.get("category", "").lower() == preference.lower()
    ]
    if not matched_places:
        matched_places = PLACES_DB

    result = generate_smart_itinerary(
        hours=hours,
        preference=preference,
        pace=pace,
        budget=budget,
        available_places=matched_places
    )
    itinerary_list = result.get("itinerary", [])
    safety_summary = result.get("safety_briefing", "")

    # Save to Supabase itineraries table
    from ..services.supabase_service import supabase_service
    user_id = payload.get("user_id", "tourist-guest")
    supabase_service.save_itinerary(
        user_id=user_id,
        hours=hours,
        preference=preference,
        pace=pace,
        stops=itinerary_list,
        safety_briefing=safety_summary
    )

    return {
        "status": result.get("status", "success"),
        "total_hours": hours,
        "preference": preference,
        "itinerary": itinerary_list,
        "safety_briefing": safety_summary
    }

@router.post("/route-risk")
async def analyze_route_safety(payload: dict = Body(...)):
    """
    Analyzes route coordinates and waypoints against Nashik disaster & terrain risk zones.
    """
    origin = payload.get("origin", {})
    dest = payload.get("destination", {})
    waypoints = payload.get("waypoints", [])
    mode = payload.get("mode", "car")

    all_points = [origin] + waypoints + [dest]
    route_summary = await get_route(origin, dest, waypoints, mode=mode)
    all_warnings = list(route_summary.get("warnings", []))
    warning_ids = {warning.get("zone_id") for warning in all_warnings}
    geofence = None

    if origin and dest:
        geofence = geofence_status(
            float(origin.get("lat", 0.0)),
            float(origin.get("lng", 0.0)),
            float(dest.get("lat", 0.0)),
            float(dest.get("lng", 0.0)),
            radius_meters=100,
        )

    for pt in all_points:
        lat = pt.get("lat")
        lng = pt.get("lng")
        if lat is not None and lng is not None:
            warnings = check_risk_zones(lat, lng)
            for warning in warnings:
                if warning.get("zone_id") not in warning_ids:
                    warning_ids.add(warning.get("zone_id"))
                    all_warnings.append(warning)

    risk_score = 100 - (len(all_warnings) * 25)
    risk_score = max(20, min(100, risk_score))

    is_safe = len(all_warnings) == 0

    return {
        "is_safe": is_safe and route_summary["safe_route"],
        "risk_score": risk_score,
        "warnings": all_warnings,
        "recommended_alternative": route_summary["recommended_alternative"],
        "route": route_summary,
        "geofence": geofence,
    }
