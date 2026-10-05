import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

class Settings(BaseSettings):
    PROJECT_NAME: str = "TOURIX Backend API"
    VERSION: str = "2.0.0"
    DESCRIPTION: str = "AI-Powered Travel Companion & Smart Safety Engine for Nashik, Maharashtra"
    API_V1_PREFIX: str = "/api"
    
    # Server settings
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    DEBUG: bool = True

    # Security / identity
    JWT_SECRET: str = Field(
        default=os.getenv("JWT_SECRET", ""),
        description="Secret used to sign tourist sessions and identity tokens"
    )
    OTP_TTL_SECONDS: int = 600
    OTP_MAX_ATTEMPTS: int = 5
    OTP_RESEND_COOLDOWN_SECONDS: int = 60
    DATABASE_PATH: str = Field(
        default=os.getenv("DATABASE_PATH", os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "tourix.db")),
        description="Local SQLite database path used when Supabase is unavailable"
    )

    # Messaging providers
    SMS_PROVIDER: str = Field(default=os.getenv("SMS_PROVIDER", "none"), description="sms provider: msg91, twilio, none")
    TWILIO_ACCOUNT_SID: str = Field(default=os.getenv("TWILIO_ACCOUNT_SID", ""))
    TWILIO_AUTH_TOKEN: str = Field(default=os.getenv("TWILIO_AUTH_TOKEN", ""))
    TWILIO_FROM_NUMBER: str = Field(default=os.getenv("TWILIO_FROM_NUMBER", ""))
    MSG91_AUTH_KEY: str = Field(default=os.getenv("MSG91_AUTH_KEY", ""))
    MSG91_OTP_TEMPLATE_ID: str = Field(default=os.getenv("MSG91_OTP_TEMPLATE_ID", ""))
    SMTP_HOST: str = Field(default=os.getenv("SMTP_HOST", ""))
    SMTP_PORT: int = Field(default=int(os.getenv("SMTP_PORT", "587")))
    SMTP_USERNAME: str = Field(default=os.getenv("SMTP_USERNAME", ""))
    SMTP_PASSWORD: str = Field(default=os.getenv("SMTP_PASSWORD", ""))
    SMTP_FROM_EMAIL: str = Field(default=os.getenv("SMTP_FROM_EMAIL", ""))
    EMERGENCY_DISPATCH_SMS_TO: str = Field(default=os.getenv("EMERGENCY_DISPATCH_SMS_TO", ""))
    EMERGENCY_DISPATCH_EMAIL_TO: str = Field(default=os.getenv("EMERGENCY_DISPATCH_EMAIL_TO", ""))

    # Routing and geofence
    ROUTING_PROVIDER: str = Field(default=os.getenv("ROUTING_PROVIDER", "local"), description="local, openrouteservice")
    OPENROUTESERVICE_KEY: str = Field(default=os.getenv("OPENROUTESERVICE_KEY", ""))
    GEO_FENCE_RADIUS_METERS: int = 100
    
    # Gemini AI API Key
    # Defaults to provided key or environment variable
    GEMINI_API_KEY: str = Field(
        default=os.getenv("GEMINI_API_KEY", ""),
        description="Google Gemini AI API Key"
    )
    
    # CORS
    CORS_ORIGINS: List[str] = ["*"]
    
    # Supabase Database
    SUPABASE_URL: str = Field(
        default=os.getenv("SUPABASE_URL", ""),
        description="Supabase Project URL"
    )
    SUPABASE_KEY: str = Field(
        default=os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_KEY", "")),
        description="Server-only Supabase service role key; never expose in frontend"
    )
    
    # Geofence & Group Safety Thresholds
    GROUP_SEPARATION_THRESHOLD_METERS: float = 10.0  # Alert if distance > 10m for prototype
    DEFAULT_NASHIK_LAT: float = 20.0063
    DEFAULT_NASHIK_LNG: float = 73.7910
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
