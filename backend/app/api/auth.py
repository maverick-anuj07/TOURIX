from fastapi import APIRouter, Body, Header, HTTPException

from ..services.auth_service import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication & Identity"])


@router.post("/request-otp")
async def request_otp(payload: dict = Body(...)):
    phone = payload.get("phone")
    email = payload.get("email")
    try:
        result = auth_service.request_otp(phone, email)
        return {"status": "success", **result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.post("/verify-otp")
async def verify_otp(payload: dict = Body(...)):
    contact = payload.get("contact") or payload.get("phone") or payload.get("email")
    otp = payload.get("otp")
    if not contact or not otp:
        raise HTTPException(status_code=400, detail="Contact and OTP are required")

    try:
        verified = auth_service.verify_otp(contact, otp)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    if not verified:
        raise HTTPException(status_code=401, detail="OTP is invalid or expired")

    return {
        "status": "verified",
        "message": "OTP verified successfully",
        "contact": auth_service.normalize_phone(contact) if "@" not in str(contact) else auth_service.normalize_contact(contact),
        "token": auth_service.issue_session({
            "phone": None if "@" in str(contact) else auth_service.normalize_phone(contact),
            "email": auth_service.normalize_contact(contact) if "@" in str(contact) else None,
            "name": "Tourist",
            "verified": True,
        })["token"],
    }


@router.post("/register")
async def register_tourist(payload: dict = Body(...), authorization: str = Header(default="")):
    name = payload.get("name")
    phone = payload.get("phone")
    email = payload.get("email")
    contact = phone or email
    if not name or not contact:
        raise HTTPException(status_code=400, detail="Name and a verified phone number or email are required")

    bearer = authorization.removeprefix("Bearer ").strip()
    claims = auth_service.verify_session(bearer) if bearer else None
    if not claims or not claims.get("verified"):
        raise HTTPException(status_code=401, detail="A verified OTP session is required")
    if auth_service.normalize_verified_contact(claims.get("phone") or claims.get("email")) != auth_service.normalize_verified_contact(contact):
        raise HTTPException(status_code=403, detail="Verified session does not match the registration contact")

    if phone:
        payload["phone"] = auth_service.normalize_phone(phone)
    tourist_id = auth_service.issue_tourist_id(payload)
    payload["tourist_id"] = tourist_id
    payload["verified"] = True

    from ..services.supabase_service import supabase_service
    if not supabase_service.save_tourist_profile(payload):
        raise HTTPException(status_code=503, detail="Tourist profile could not be persisted")

    return {
        "status": "success",
        "message": "Tourist profile created and identity issued",
        "tourist_id": tourist_id,
        "session": auth_service.issue_session(payload),
    }


@router.post("/login")
async def login_tourist(payload: dict = Body(...)):
    contact = payload.get("contact") or payload.get("phone") or payload.get("email")
    if not contact:
        raise HTTPException(status_code=400, detail="Contact is required")

    try:
        result = auth_service.request_otp(
            phone=contact if "@" not in str(contact) else None,
            email=contact if "@" in str(contact) else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=429, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"status": "otp_required", **result}
