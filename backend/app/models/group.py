from typing import Optional, List
from pydantic import BaseModel, Field

class SafeHavenPoint(BaseModel):
    id: str
    name: str
    category: str
    latitude: float
    longitude: float
    address: str
    distance_meters: float

class GroupMemberUpdate(BaseModel):
    user_id: str
    name: str
    latitude: float
    longitude: float
    battery_level: Optional[int] = None
    is_anchor: Optional[bool] = False

class SeparationAlert(BaseModel):
    separated_user_id: str
    separated_user_name: str
    distance_meters: float
    threshold_meters: float
    is_separated: bool
    regroup_point: Optional[SafeHavenPoint] = None
    timestamp: str

class GroupStatusResponse(BaseModel):
    group_id: str
    total_members: int
    members: List[dict]
    active_alerts: List[SeparationAlert]
