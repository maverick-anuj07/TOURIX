from typing import List, Optional
from pydantic import BaseModel, Field

class ChatMessage(BaseModel):
    role: str = "user" # "user" or "assistant"
    content: str

class UserContext(BaseModel):
    name: Optional[str] = "Traveler"
    role: Optional[str] = "tourist" # tourist, family, solo, couple
    interests: Optional[List[str]] = []
    pace: Optional[str] = "balanced"
    location: Optional[dict] = None
    saved_places: Optional[List[str]] = []

class ChatRequest(BaseModel):
    message: str = Field(..., description="User query or message")
    user: Optional[UserContext] = Field(default=None, description="Personalized user context")
    history: Optional[List[dict]] = Field(default=[], description="Previous conversation history")
    language: Optional[str] = Field(default="en", description="Preferred language (en, hi, mr)")
    user_location: Optional[dict] = Field(default=None, description="Optional user current lat/lng")

class ChatResponse(BaseModel):
    reply: str
    status: str = "success"
    safety_advisory: Optional[str] = None
    suggested_places: Optional[List[str]] = None

class ItineraryItem(BaseModel):
    time: str
    title: str
    desc: str
    safety_level: Optional[str] = "Safe"
    category: Optional[str] = None
    est_duration: Optional[str] = None

class ItineraryRequest(BaseModel):
    hours: int = Field(default=6, ge=1, le=72, description="Total available duration in hours")
    preference: str = Field(default="Heritage", description="Travel preference: Heritage, Spiritual, Nature, Adventure, Vineyards")
    pace: Optional[str] = Field(default="balanced", description="relaxed, balanced, or packed")
    budget: Optional[str] = Field(default="moderate", description="budget, moderate, luxury")
    start_time: Optional[str] = Field(default="09:00 AM", description="Trip start time")

class ItineraryResponse(BaseModel):
    status: str
    itinerary: List[ItineraryItem]
    total_hours: int
    preference: str
    safety_briefing: str

class RouteRiskRequest(BaseModel):
    origin: dict = Field(..., description="{'lat': float, 'lng': float, 'name': str}")
    destination: dict = Field(..., description="{'lat': float, 'lng': float, 'name': str}")
    waypoints: Optional[List[dict]] = []
    travel_time: Optional[str] = "daylight"

class RiskWarning(BaseModel):
    zone_id: str
    zone_name: str
    severity: str
    description: str
    recommended_action: str

class RouteRiskResponse(BaseModel):
    is_safe: bool
    risk_score: int = Field(..., ge=0, le=100, description="0=Dangerous, 100=Safest")
    warnings: List[RiskWarning] = []
    recommended_alternative: Optional[str] = None
