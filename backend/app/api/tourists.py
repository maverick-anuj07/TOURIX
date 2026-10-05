from fastapi import APIRouter, Body, Header, HTTPException
from ..services.supabase_service import supabase_service
from ..services.auth_service import auth_service

router = APIRouter(prefix="/tourists", tags=["Tourists & Profiles"])

@router.post("/register")
async def register_tourist(payload: dict = Body(...), authorization: str = Header(default="")):
    """
    Register or save a tourist profile directly into Supabase.
    """
    name = payload.get("name")
    contact = payload.get("phone") or payload.get("email")
    if not name or not contact:
        raise HTTPException(status_code=400, detail="Name and contact are required")

    bearer = authorization.removeprefix("Bearer ").strip()
    claims = auth_service.verify_session(bearer) if bearer else None
    if not claims or not claims.get("verified"):
        raise HTTPException(status_code=401, detail="A verified OTP session is required")
    if auth_service.normalize_verified_contact(claims.get("phone") or claims.get("email")) != auth_service.normalize_verified_contact(contact):
        raise HTTPException(status_code=403, detail="Verified session does not match the registration contact")

    if payload.get("phone"):
        payload["phone"] = auth_service.normalize_phone(payload["phone"])
    payload["verified"] = True

    success = supabase_service.save_tourist_profile(payload)
    if not success:
        raise HTTPException(status_code=503, detail="Tourist profile could not be persisted")
    return {
        "status": "success",
        "message": "Tourist profile registered successfully",
        "profile": payload
    }
