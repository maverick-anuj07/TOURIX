from typing import List, Optional
from pydantic import BaseModel, Field

class PlaceBase(BaseModel):
    id: str
    name: str
    category: str
    subcategory: Optional[str] = None
    description: str
    short_description: Optional[str] = None
    city: str
    district: str
    state: str
    country: str = "India"
    latitude: float
    longitude: float
    estimated_visit_duration: Optional[str] = None
    best_time: Optional[str] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    entry_fee: Optional[str] = None
    rating: float = Field(default=4.5, ge=0.0, le=5.0)
    review_count: Optional[int] = 0
    distance_from_nashik_km: Optional[float] = 0.0
    family_friendly: Optional[bool] = True
    couple_friendly: Optional[bool] = True
    solo_friendly: Optional[bool] = True
    senior_citizen_friendly: Optional[bool] = True
    budget_level: Optional[str] = "budget"
    adventure_level: Optional[str] = "low"
    indoor_outdoor: Optional[str] = "outdoor"
    food_available: Optional[bool] = True
    parking_available: Optional[bool] = True
    washroom_available: Optional[bool] = True
    public_transport: Optional[str] = None
    safety_notes: Optional[str] = None
    tags: List[str] = []
    icon: Optional[str] = "fa-location-dot"
    source: Optional[str] = "Maharashtra Tourism"
    is_verified: bool = True

class PlaceDetail(PlaceBase):
    distance_km: Optional[float] = None

class PlaceFilter(BaseModel):
    category: Optional[str] = None
    search: Optional[str] = None
    budget: Optional[str] = None
    adventure: Optional[str] = None
    min_rating: Optional[float] = None
