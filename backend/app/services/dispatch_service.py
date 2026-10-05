import logging
import smtplib
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

import httpx

from ..core.config import settings

logger = logging.getLogger(__name__)


class DispatchService:
    def notify_sos(self, alert: Dict[str, Any], emergency_contact: Optional[str]) -> Dict[str, Any]:
        targets: List[Dict[str, str]] = []
        if emergency_contact:
            channel = "email" if "@" in emergency_contact else "sms"
            targets.append({"channel": channel, "to": emergency_contact})
        if settings.EMERGENCY_DISPATCH_SMS_TO:
            targets.append({"channel": "sms", "to": settings.EMERGENCY_DISPATCH_SMS_TO})
        if settings.EMERGENCY_DISPATCH_EMAIL_TO:
            targets.append({"channel": "email", "to": settings.EMERGENCY_DISPATCH_EMAIL_TO})

        outcomes = [self._send(target["channel"], target["to"], alert) for target in targets]
        return {
            "status": "notifications_sent" if any(outcomes) else "recorded_only",
            "notifications_attempted": len(targets),
            "notifications_sent": sum(1 for sent in outcomes if sent),
            "agency_dispatch": "not_integrated",
        }

    def _send(self, channel: str, recipient: str, alert: Dict[str, Any]) -> bool:
        location = alert.get("location", {})
        message = (
            f"TOURIX SOS: {alert.get('user', {}).get('name', 'Tourist')} needs assistance. "
            f"Location: https://maps.google.com/?q={location.get('latitude')},{location.get('longitude')}. "
            f"Alert ID: {alert.get('alert_id')}"
        )
        if channel == "sms":
            return self._send_sms(recipient, message)
        return self._send_email(recipient, "TOURIX SOS alert", message)

    @staticmethod
    def _send_sms(recipient: str, body: str) -> bool:
        if not (settings.SMS_PROVIDER.lower() == "twilio" and settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_FROM_NUMBER):
            return False
        try:
            response = httpx.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json",
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                data={"From": settings.TWILIO_FROM_NUMBER, "To": recipient, "Body": body},
                timeout=15,
            )
            response.raise_for_status()
            return True
        except httpx.HTTPError as exc:
            logger.error("SOS SMS notification failed: %s", exc)
            return False

    @staticmethod
    def _send_email(recipient: str, subject: str, body: str) -> bool:
        if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
            return False
        message = MIMEText(body)
        message["Subject"] = subject
        message["From"] = settings.SMTP_FROM_EMAIL
        message["To"] = recipient
        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
                if settings.SMTP_USERNAME:
                    smtp.starttls()
                    smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                smtp.send_message(message)
            return True
        except (OSError, smtplib.SMTPException) as exc:
            logger.error("SOS email notification failed: %s", exc)
            return False


dispatch_service = DispatchService()