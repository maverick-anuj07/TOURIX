import os
import json
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from ..models.places import PlaceBase, PlaceDetail
from ..services.geo_service import haversine_km
from ..services.supabase_service import supabase_service

router = APIRouter(prefix="", tags=["Places & Attractions"])

# Load local backup places database
DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "places.json")
with open(DATA_FILE, "r", encoding="utf-8") as f:
    PLACES_DB = json.load(f)

@router.get("/places", response_model=List[dict])
async def get_places(
    category: Optional[str] = Query(None, description="Filter by category (Spiritual, Heritage, Nature, Vineyards, Adventure, etc.)"),
    search: Optional[str] = Query(None, description="Search keyword in name, tags, or description"),
    limit: Optional[int] = Query(50, ge=1, le=100)
):
    """Retrieve verified Nashik places from Supabase with fallback to local database."""
    # Attempt Supabase query first
    sb_places = supabase_service.get_places(category=category, search=search, limit=limit)
    if sb_places is not None and len(sb_places) > 0:
        return sb_places

    # Fallback to local DB
    results = PLACES_DB

    if category and category.lower() != "all":
        results = [p for p in results if p.get("category", "").lower() == category.lower()]

    if search:
        s = search.lower()
        results = [
            p for p in results
            if s in p.get("name", "").lower()
            or s in p.get("description", "").lower()
            or any(s in tag.lower() for tag in p.get("tags", []))
        ]

    return results[:limit]

@router.get("/places/categories")
async def get_categories():
    """List all categories with place counts."""
    cats = {}
    for p in PLACES_DB:
        c = p.get("category", "Other")
        cats[c] = cats.get(c, 0) + 1
    return [{"category": k, "count": v} for k, v in cats.items()]

@router.get("/places/highlights")
async def get_highlights(limit: int = 6):
    """Get top-rated highlight attractions in Nashik."""
    sorted_places = sorted(PLACES_DB, key=lambda x: x.get("rating", 0.0), reverse=True)
    return sorted_places[:limit]

@router.get("/places/near-me")
async def get_places_near_me(
    lat: float = Query(..., description="User latitude"),
    lng: float = Query(..., description="User longitude"),
    radius_km: float = Query(10.0, ge=0.5, le=100.0, description="Search radius in kilometers"),
    limit: int = Query(10, ge=1, le=50)
):
    """Find attractions within radius_km of the user's location, sorted by distance."""
    nearby = []
    for p in PLACES_DB:
        p_lat = p.get("latitude")
        p_lng = p.get("longitude")
        if p_lat is not None and p_lng is not None:
            dist = haversine_km(lat, lng, p_lat, p_lng)
            if dist <= radius_km:
                item = dict(p)
                item["distance_km"] = round(dist, 2)
                nearby.append(item)

    nearby.sort(key=lambda x: x["distance_km"])
    return nearby[:limit]

@router.get("/places/{place_id}")
async def get_place_by_id(place_id: str):
    """Get complete verified details for a single place."""
    for p in PLACES_DB:
        if p.get("id") == place_id:
            return p
    raise HTTPException(status_code=404, detail=f"Place '{place_id}' not found.")
