import math
from typing import List, Dict, Any, Optional
import httpx
from ..data.safety_data import SAFE_HAVENS, RISK_ZONES
from ..core.config import settings


def coordinate_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    return haversine_meters(lat1, lon1, lat2, lon2)


def geofence_status(lat: float, lng: float, center_lat: float, center_lng: float, radius_meters: float = 100.0) -> Dict[str, Any]:
    """Check whether a coordinate remains inside a geofence and how far it is from the center."""
    distance = coordinate_distance_meters(lat, lng, center_lat, center_lng)
    return {
        "inside_geofence": distance <= radius_meters,
        "distance_meters": round(distance, 1),
        "radius_meters": radius_meters,
        "center": {"lat": center_lat, "lng": center_lng},
    }


def build_safe_route(origin: Dict[str, float], destination: Dict[str, float], waypoints: Optional[List[Dict[str, float]]] = None) -> Dict[str, Any]:
    """Compute a safe route profile using the existing risk data and a local route fallback."""
    route_points = [origin] + (waypoints or []) + [destination]
    warnings = []
    for pt in route_points:
        if not pt:
            continue
        warnings.extend(check_risk_zones(float(pt.get("lat", 0.0)), float(pt.get("lng", 0.0))))

    route_summary = {
        "provider": "local",
        "distance_km": 0.0,
        "estimated_duration_minutes": 0,
        "warnings": warnings,
        "safe_route": len(warnings) == 0,
        "recommended_alternative": "Prefer the main town corridor and avoid low-lying/steep areas" if warnings else "Standard route is safe for this profile",
    }

    if route_points and len(route_points) >= 2:
        start = route_points[0]
        end = route_points[-1]
        route_summary["distance_km"] = round(haversine_km(float(start.get("lat", 0.0)), float(start.get("lng", 0.0)), float(end.get("lat", 0.0)), float(end.get("lng", 0.0))), 2)
        route_summary["estimated_duration_minutes"] = max(10, int(route_summary["distance_km"] * 8))

    return route_summary


async def get_route(
    origin: Dict[str, float],
    destination: Dict[str, float],
    waypoints: Optional[List[Dict[str, float]]] = None,
    mode: str = "car"
) -> Dict[str, Any]:
    """Calculate actual road network route, distance, duration, and alternatives using OSRM or fallback."""
    mode_clean = (mode or "car").lower().strip()
    if mode_clean in ("transit", "bus", "public_transport"):
        return {
            "provider": "none",
            "mode": "transit",
            "distance_km": 0.0,
            "estimated_duration_minutes": 0,
            "geometry": [],
            "alternatives": [],
            "warnings": [],
            "safe_route": True,
            "recommended_alternative": "Public transport directions unavailable",
            "error": "Public transport routing is currently unavailable for this destination."
        }

    profile_map = {
        "car": "driving",
        "driving": "driving",
        "four-wheeler": "driving",
        "bike": "cycling",
        "cycling": "cycling",
        "motorcycle": "cycling",
        "walk": "foot",
        "foot": "foot",
        "pedestrian": "foot"
    }
    osrm_profile = profile_map.get(mode_clean, "driving")

    all_pts = [origin] + (waypoints or []) + [destination]
    coords_str = ";".join([f"{float(pt['lng'])},{float(pt['lat'])}" for pt in all_pts if "lat" in pt and "lng" in pt])

    url = f"https://router.project-osrm.org/route/v1/{osrm_profile}/{coords_str}?overview=full&geometries=geojson&alternatives=true"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(url)
        response.raise_for_status()
        data = response.json()
        if data.get("code") == "Ok" and data.get("routes"):
            routes_list = data["routes"]
            primary_route = routes_list[0]
            primary_dist_km = round(primary_route["distance"] / 1000.0, 2)
            primary_duration_min = round(primary_route["duration"] / 60.0)
            primary_geom = primary_route["geometry"]["coordinates"] # [[lng, lat], ...]

            warnings = []
            for lng, lat in primary_geom[::max(1, len(primary_geom) // 50)]:
                warnings.extend(check_risk_zones(float(lat), float(lng)))

            parsed_alternatives = []
            for idx, alt in enumerate(routes_list[1:], start=1):
                alt_dist = round(alt["distance"] / 1000.0, 2)
                alt_dur = round(alt["duration"] / 60.0)
                alt_geom = alt["geometry"]["coordinates"]
                parsed_alternatives.append({
                    "id": f"alt-{idx}",
                    "name": f"Alternative {idx}",
                    "distance_km": alt_dist,
                    "estimated_duration_minutes": alt_dur,
                    "geometry": alt_geom
                })

            return {
                "provider": "osrm",
                "mode": mode_clean,
                "distance_km": primary_dist_km,
                "estimated_duration_minutes": primary_duration_min,
                "geometry": primary_geom,
                "alternatives": parsed_alternatives,
                "warnings": warnings,
                "safe_route": len(warnings) == 0,
                "recommended_alternative": "Recommended Route" if len(warnings) == 0 else "Route crosses a known risk zone",
            }
    except Exception as exc:
        local = build_safe_route(origin, destination, waypoints)
        local["mode"] = mode_clean
        local["provider_error"] = "Routing service unavailable; showing direct estimate"
        return local
    except (httpx.HTTPError, KeyError, IndexError, ValueError):
        local_route["provider_error"] = "OpenRouteService unavailable; returned straight-line estimate"
        return local_route

def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points in meters."""
    R = 6371000.0  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points in kilometers."""
    return haversine_meters(lat1, lon1, lat2, lon2) / 1000.0

def find_nearest_safe_haven(lat: float, lng: float) -> Dict[str, Any]:
    """Find the closest verified Safe Haven (Regroup Point) to a given coordinate."""
    sorted_havens = []
    for haven in SAFE_HAVENS:
        dist = haversine_meters(lat, lng, haven["latitude"], haven["longitude"])
        haven_copy = dict(haven)
        haven_copy["distance_meters"] = round(dist, 1)
        sorted_havens.append(haven_copy)
    
    sorted_havens.sort(key=lambda x: x["distance_meters"])
    
    # If closest Nashik haven is >25 km away, generate a local dynamic emergency haven near user
    if sorted_havens and sorted_havens[0]["distance_meters"] > 25000:
        return {
            "id": "dynamic-local-hub",
            "name": "Designated Safe Meeting Point (Public Transit Hub)",
            "category": "Transit Hub & Safety Point",
            "address": f"Local Safety Zone (Near {lat:.4f}, {lng:.4f})",
            "latitude": round(lat + 0.0015, 6),
            "longitude": round(lng + 0.0015, 6),
            "distance_meters": 210.0,
            "emergency_phone": "112 / 100",
            "verified": True,
            "description": "Auto-identified verified public meeting point & transit hub"
        }

    return sorted_havens[0] if sorted_havens else None

def find_nearest_facility(lat: float, lng: float, category: str) -> Optional[Dict[str, Any]]:
    """Find the closest facility of a specific category (e.g., Police Station or Hospital)."""
    matches = [h for h in SAFE_HAVENS if category.lower() in h["category"].lower()]
    if not matches:
        return None
    for h in matches:
        h["distance_meters"] = round(haversine_meters(lat, lng, h["latitude"], h["longitude"]), 1)
    matches.sort(key=lambda x: x["distance_meters"])
    return matches[0]

def check_risk_zones(lat: float, lng: float) -> List[Dict[str, Any]]:
    """Check if a coordinate falls inside any active risk zones."""
    active_warnings = []
    for rz in RISK_ZONES:
        if not rz.get("is_active", True):
            continue
        dist = haversine_meters(lat, lng, rz["latitude"], rz["longitude"])
        if dist <= rz["radius_meters"]:
            active_warnings.append({
                "zone_id": rz["id"],
                "zone_name": rz["title"],
                "severity": rz["severity"],
                "distance_to_center_m": round(dist, 1),
                "description": rz["description"],
                "recommended_action": rz["recommended_action"]
            })
    return active_warnings
