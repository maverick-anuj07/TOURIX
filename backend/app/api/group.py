import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Body
from ..services.group_service import group_service

router = APIRouter(tags=["Group Safety & Real-time Live Tracking"])

@router.websocket("/ws/group/{group_id}")
async def group_websocket_endpoint(websocket: WebSocket, group_id: str):
    """
    Real-time WebSocket endpoint for group tracking and automatic separation alert detection.
    Clients send:
    { "user": "Aditi", "lat": 20.0050, "lng": 73.7900, "is_anchor": false }
    Server broadcasts location & separation updates to all group members.
    """
    await group_service.connect(websocket, group_id)
    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                data = json.loads(raw_text)
                await group_service.process_member_ping(group_id, data)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"error": "Invalid JSON format"}))
    except WebSocketDisconnect:
        group_service.disconnect(websocket, group_id)

@router.get("/group/{group_id}/status")
async def get_group_status(group_id: str):
    """Get active members and current status of a group."""
    room = group_service.rooms.get(group_id)
    if not room:
        return {
            "group_id": group_id,
            "active_members_count": 0,
            "members": []
        }
    return {
        "group_id": group_id,
        "active_members_count": len(room.members),
        "anchor_user_id": room.anchor_user_id,
        "members": list(room.members.values())
    }

@router.post("/group/{group_id}/ping")
async def http_group_ping(group_id: str, payload: dict = Body(...)):
    """HTTP fallback endpoint to update location and receive separation alerts."""
    result = await group_service.process_member_ping(group_id, payload)
    return result
