from typing import Optional, List
from pydantic import BaseModel, Field

class HelplineModel(BaseModel):
    id: str
    name: str
    number: str
    alt_number: Optional[str] = None
    icon: str
    category: str
    available_24_7: bool

class SOSAlertRequest(BaseModel):
    user_id: Optional[str] = "tourist-guest"
    user_name: Optional[str] = "Tourist in Need"
    latitude: float
    longitude: float
    battery_level: Optional[int] = None
    emergency_contact: Optional[str] = None
    note: Optional[str] = None

class SOSAlertResponse(BaseModel):
    status: str = "active"
    alert_id: str
    timestamp: str
    received_location: dict
    nearest_police_station: Optional[dict] = None
    nearest_hospital: Optional[dict] = None
    direct_helplines: List[dict]
    action_instructions: List[str]
