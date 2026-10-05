import json
import time
from typing import Dict, List, Any, Optional
from fastapi import WebSocket
from ..core.config import settings
from .geo_service import haversine_meters, find_nearest_safe_haven

class GroupRoom:
    def __init__(self, group_id: str):
        self.group_id: str = group_id
        self.connections: List[WebSocket] = []
        # user_id -> { "name": str, "lat": float, "lng": float, "is_anchor": bool, "last_seen": float }
        self.members: Dict[str, Dict[str, Any]] = {}
        self.breach_counts: Dict[str, int] = {}
        self.anchor_user_id: Optional[str] = None

class GroupService:
    def __init__(self):
        self.rooms: Dict[str, GroupRoom] = {}

    def get_or_create_room(self, group_id: str) -> GroupRoom:
        if group_id not in self.rooms:
            self.rooms[group_id] = GroupRoom(group_id)
        return self.rooms[group_id]

    async def connect(self, websocket: WebSocket, group_id: str):
        await websocket.accept()
        room = self.get_or_create_room(group_id)
        room.connections.append(websocket)

    def disconnect(self, websocket: WebSocket, group_id: str):
        if group_id in self.rooms:
            room = self.rooms[group_id]
            if websocket in room.connections:
                room.connections.remove(websocket)
            if not room.connections and not room.members:
                del self.rooms[group_id]

    async def broadcast_to_group(self, group_id: str, data: Dict[str, Any]):
        if group_id in self.rooms:
            room = self.rooms[group_id]
            disconnected = []
            for conn in room.connections:
                try:
                    await conn.send_text(json.dumps(data))
                except Exception:
                    disconnected.append(conn)
            for bad_conn in disconnected:
                if bad_conn in room.connections:
                    room.connections.remove(bad_conn)

    async def process_member_ping(self, group_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a location ping from a group member.
        Determines distance from group anchor and flags separation if threshold exceeded.
        """
        room = self.get_or_create_room(group_id)
        
        user_name = payload.get("user") or payload.get("name") or "Tourist"
        user_id = payload.get("user_id") or user_name.lower().replace(" ", "_")
        lat = float(payload.get("lat", settings.DEFAULT_NASHIK_LAT))
        lng = float(payload.get("lng", settings.DEFAULT_NASHIK_LNG))
        is_anchor = bool(payload.get("is_anchor", False))

        # Designate first member as anchor if none exists
        if not room.anchor_user_id or is_anchor:
            room.anchor_user_id = user_id
            is_anchor = True

        room.members[user_id] = {
            "user_id": user_id,
            "name": user_name,
            "lat": lat,
            "lng": lng,
            "is_anchor": is_anchor,
            "last_seen": time.time()
        }

        anchor = room.members.get(room.anchor_user_id, room.members[user_id])
        dist = haversine_meters(lat, lng, anchor["lat"], anchor["lng"])
        is_separated = dist > settings.GROUP_SEPARATION_THRESHOLD_METERS

        regroup_haven = None
        if is_separated:
            # Find closest safe haven between user and anchor
            mid_lat = (lat + anchor["lat"]) / 2.0
            mid_lng = (lng + anchor["lng"]) / 2.0
            regroup_haven = find_nearest_safe_haven(mid_lat, mid_lng)

        broadcast_payload = {
            "type": "location_update",
            "group_id": group_id,
            "user": user_name,
            "user_id": user_id,
            "lat": lat,
            "lng": lng,
            "distance": round(dist),
            "distance_meters": round(dist, 1),
            "is_separated": is_separated,
            "threshold_meters": settings.GROUP_SEPARATION_THRESHOLD_METERS,
            "anchor_user": anchor["name"],
            "regroup_suggestion": regroup_haven["name"] if regroup_haven else None,
            "regroup_point": regroup_haven,
            "timestamp": time.strftime("%H:%M:%S")
        }

        await self.broadcast_to_group(group_id, broadcast_payload)
        return broadcast_payload

group_service = GroupService()
