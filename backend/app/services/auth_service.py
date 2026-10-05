import base64
import hashlib
import hmac
import json
import re
import secrets
import smtplib
import sqlite3
import time
from email.mime.text import MIMEText
from typing import Any, Dict, Optional

import httpx

from ..core.config import settings


class AuthService:
    def __init__(self):
        self.db_path = settings.DATABASE_PATH

    @staticmethod
    def _secret() -> str:
        if settings.JWT_SECRET:
            return settings.JWT_SECRET
        if settings.DEBUG:
            return "local-development-only-change-before-deploy"
        raise RuntimeError("JWT_SECRET must be configured outside development")

    @staticmethod
    def normalize_contact(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip().lower()
        return cleaned or None

    @staticmethod
    def normalize_phone(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        digits = re.sub(r"\D", "", value)
        if len(digits) == 11 and digits.startswith("0"):
            digits = digits[1:]
        if len(digits) == 10:
            digits = "91" + digits
        if len(digits) == 12 and digits.startswith("91"):
            digits = "+" + digits
        elif value.strip().startswith("+"):
            digits = "+" + digits
        else:
            return None
        return digits if re.fullmatch(r"\+[1-9]\d{7,14}", digits) else None

    @classmethod
    def normalize_verified_contact(cls, value: Optional[str]) -> Optional[str]:
        if value and "@" in value:
            return cls.normalize_contact(value)
        return cls.normalize_phone(value)

    @classmethod
    def _sign(cls, payload: Dict[str, Any]) -> str:
        header = {"alg": "HS256", "typ": "JWT"}
        encoded_header = base64.urlsafe_b64encode(json.dumps(header, separators=(",", ":")).encode()).decode().rstrip("=")
        payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        encoded_payload = base64.urlsafe_b64encode(payload_json).decode().rstrip("=")
        signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")
        signature = hmac.new(cls._secret().encode("utf-8"), signing_input, hashlib.sha256).digest()
        encoded_signature = base64.urlsafe_b64encode(signature).decode("utf-8").rstrip("=")
        return f"{encoded_header}.{encoded_payload}.{encoded_signature}"

    @classmethod
    def verify_session(cls, token: str) -> Optional[Dict[str, Any]]:
        try:
            encoded_header, encoded_payload, encoded_signature = token.split(".")
            signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")
            expected = hmac.new(cls._secret().encode("utf-8"), signing_input, hashlib.sha256).digest()
            supplied = base64.urlsafe_b64decode(encoded_signature + "=" * (-len(encoded_signature) % 4))
            if not hmac.compare_digest(expected, supplied):
                return None
            payload = json.loads(base64.urlsafe_b64decode(encoded_payload + "=" * (-len(encoded_payload) % 4)))
            if int(payload.get("exp", 0)) <= int(time.time()):
                return None
            return payload
        except (ValueError, TypeError, json.JSONDecodeError):
            return None

    def issue_session(self, user_payload: Dict[str, Any]) -> Dict[str, Any]:
        issued_at = int(time.time())
        payload = {
            "sub": user_payload.get("user_id") or user_payload.get("phone") or user_payload.get("email") or "tourist",
            "name": user_payload.get("name") or "Tourist",
            "phone": user_payload.get("phone"),
            "email": user_payload.get("email"),
            "role": user_payload.get("role") or "tourist",
            "verified": bool(user_payload.get("verified", False)),
            "tourist_id": user_payload.get("tourist_id"),
            "iat": issued_at,
            "exp": issued_at + 86400,
        }
        return {
            "token": self._sign(payload),
            "session": payload,
        }

    def request_otp(self, phone: Optional[str], email: Optional[str]) -> Dict[str, Any]:
        normalized_phone = self.normalize_phone(phone) if phone else None
        normalized_email = self.normalize_contact(email) if email else None
        contact = normalized_phone or normalized_email
        if not contact:
            raise ValueError("Enter a valid mobile number or email address")

        self._secret()
        now = time.time()
        from .supabase_service import supabase_service
        previous = supabase_service.get_auth_otp(contact)
        if previous and now - float(previous["requested_at"]) < settings.OTP_RESEND_COOLDOWN_SECONDS:
            raise ValueError("Please wait before requesting another OTP")

        provider = settings.SMS_PROVIDER.lower()
        code = f"{secrets.randbelow(900000) + 100000:06d}" if provider != "msg91" else ""
        if normalized_phone and provider == "msg91":
            delivered = self._send_msg91_otp(normalized_phone)
        elif provider in ("free", "mock"):
            delivered = True
        else:
            delivered = self._deliver_verification(contact, code, phone=normalized_phone, email=normalized_email if not normalized_phone else None)

        if not delivered:
            raise RuntimeError("SMS delivery is not configured.")

        code_hash = hashlib.sha256(f"{contact}:{code or 'msg91-managed'}:{self._secret()}".encode("utf-8")).hexdigest()
        supabase_service.save_auth_otp(contact, code_hash, now + settings.OTP_TTL_SECONDS, now)

        response_payload = {
            "status": "success",
            "message": "One-time password sent on screen.",
            "expires_in": settings.OTP_TTL_SECONDS,
            "contact": contact,
            "debug_otp": code or f"{secrets.randbelow(900000) + 100000:06d}",
        }
        return response_payload

    def verify_otp(self, contact_value: str, otp_code: str) -> bool:
        normalized = self.normalize_phone(contact_value) if "@" not in contact_value else self.normalize_contact(contact_value)
        if not normalized:
            return False

        from .supabase_service import supabase_service
        record = supabase_service.get_auth_otp(normalized)
        if not record or float(record["expires_at"]) < time.time() or int(record["attempts"]) >= settings.OTP_MAX_ATTEMPTS:
            supabase_service.delete_auth_otp(normalized)
            return False

        if settings.SMS_PROVIDER.lower() == "msg91":
            if self._verify_msg91_otp(normalized, str(otp_code).strip()):
                supabase_service.delete_auth_otp(normalized)
                return True
            supabase_service.increment_auth_otp_attempts(normalized, int(record["attempts"]) + 1)
            return False

        candidate = hashlib.sha256(f"{normalized}:{str(otp_code).strip()}:{self._secret()}".encode("utf-8")).hexdigest()
        if not hmac.compare_digest(record["code_hash"], candidate):
            supabase_service.increment_auth_otp_attempts(normalized, int(record["attempts"]) + 1)
            return False

        supabase_service.delete_auth_otp(normalized)
        return True

    def issue_tourist_id(self, profile: Dict[str, Any]) -> str:
        raw_text = (
            profile.get("phone")
            or profile.get("email")
            or profile.get("name")
            or "tourist"
        )
        digest = hashlib.sha256(f"{raw_text}-{secrets.token_urlsafe(18)}".encode("utf-8")).hexdigest()[:16]
        return f"TX-{digest.upper()}"

    def _deliver_verification(self, contact: str, code: str, phone: Optional[str], email: Optional[str]) -> bool:
        if phone:
            return self._send_sms(phone, f"Your TOURIX OTP is {code}. Valid for {settings.OTP_TTL_SECONDS // 60} minutes.")
        elif email:
            return self._send_email(email, "TOURIX verification code", f"Your TOURIX OTP is {code}. It is valid for {settings.OTP_TTL_SECONDS // 60} minutes.")
        return False

    def _send_sms(self, phone: str, message: str) -> bool:
        provider = settings.SMS_PROVIDER.lower()
        if provider == "twilio" and settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_FROM_NUMBER:
            try:
                response = httpx.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json",
                    auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                    data={
                        "From": settings.TWILIO_FROM_NUMBER,
                        "To": phone,
                        "Body": message,
                    },
                    timeout=15,
                )
                response.raise_for_status()
                return True
            except httpx.HTTPError as exc:
                raise RuntimeError("SMS provider rejected the OTP request") from exc
        return False

    @staticmethod
    def _send_msg91_otp(phone: str) -> bool:
        if not settings.MSG91_AUTH_KEY or not settings.MSG91_OTP_TEMPLATE_ID:
            return False
        try:
            response = httpx.post(
                "https://control.msg91.com/api/v5/otp",
                params={"template_id": settings.MSG91_OTP_TEMPLATE_ID, "mobile": phone.lstrip("+")},
                headers={"authkey": settings.MSG91_AUTH_KEY, "content-type": "application/json"},
                timeout=15,
            )
            response.raise_for_status()
            result = response.json()
            return str(result.get("type", "")).lower() == "success"
        except (httpx.HTTPError, ValueError) as exc:
            raise RuntimeError("MSG91 could not send the OTP. Check provider settings and template approval.") from exc

    @staticmethod
    def _verify_msg91_otp(phone: str, otp: str) -> bool:
        if not settings.MSG91_AUTH_KEY:
            raise RuntimeError("MSG91 auth key is not configured")
        try:
            response = httpx.get(
                "https://control.msg91.com/api/v5/otp/verify",
                params={"mobile": phone.lstrip("+"), "otp": otp},
                headers={"authkey": settings.MSG91_AUTH_KEY},
                timeout=15,
            )
            response.raise_for_status()
            result = response.json()
            return str(result.get("type", "")).lower() == "success"
        except (httpx.HTTPError, ValueError) as exc:
            raise RuntimeError("MSG91 OTP verification service is unavailable") from exc

    def _send_email(self, email: str, subject: str, body: str) -> bool:
        if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
            return False

        message = MIMEText(body)
        message["Subject"] = subject
        message["From"] = settings.SMTP_FROM_EMAIL
        message["To"] = email

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
            if settings.SMTP_USERNAME:
                smtp.starttls()
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
        return True


auth_service = AuthService()
