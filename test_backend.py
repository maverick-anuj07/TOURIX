import sys
import os

# Add backend directory to path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE_DIR, "backend"))

from fastapi.testclient import TestClient
from app.main import app
from app.services.auth_service import auth_service
from app.core.config import settings
from app.services.supabase_service import supabase_service

# Keep smoke tests independent of whichever remote Supabase schema is configured locally.
supabase_service.client = None

client = TestClient(app)

def test_endpoints():
    print("Testing /health...")
    r = client.get("/health")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    print("  -> Passed:", r.json())

    print("\nTesting /api/places...")
    r = client.get("/api/places")
    assert r.status_code == 200
    places = r.json()
    assert len(places) > 0, "No places found"
    print(f"  -> Passed: {len(places)} places returned")

    print("\nTesting /api/places/near-me...")
    r = client.get("/api/places/near-me?lat=20.0063&lng=73.7910&radius_km=15")
    assert r.status_code == 200
    nearby = r.json()
    assert len(nearby) > 0
    print(f"  -> Passed: {len(nearby)} nearby places found. Closest: {nearby[0]['name']} ({nearby[0]['distance_km']} km)")

    print("\nTesting /api/ai/chat...")
    r = client.post("/api/ai/chat", json={"message": "Suggest safe places to visit in Nashik"})
    assert r.status_code == 200
    chat_res = r.json()
    assert "reply" in chat_res
    print(f"  -> Passed AI reply preview: {chat_res['reply'][:90]}...")

    print("\nTesting /api/ai/generate-itinerary...")
    r = client.post("/api/ai/generate-itinerary", json={"hours": 4, "preference": "Heritage"})
    assert r.status_code == 200
    itin = r.json()
    assert "itinerary" in itin
    print(f"  -> Passed: Itinerary with {len(itin['itinerary'])} stops generated")

    print("\nTesting /api/emergency/helplines...")
    r = client.get("/api/emergency/helplines")
    assert r.status_code == 200
    helplines = r.json()
    print(f"  -> Passed: {len(helplines['helplines'])} emergency helplines returned")

    print("\nTesting /api/emergency/sos...")
    r = client.post("/api/emergency/sos", json={"lat": 20.0050, "lng": 73.7900, "user_name": "Test Tourist"})
    assert r.status_code == 200
    sos_res = r.json()
    assert sos_res["persistence_status"] == "saved"
    assert sos_res["dispatch"]["status"] == "recorded_only"

    print("\nTesting /api/emergency/geofence...")
    r = client.post("/api/emergency/geofence", json={
        "latitude": 20.0,
        "longitude": 73.0,
        "center_latitude": 20.0,
        "center_longitude": 73.0,
        "radius_meters": 100
    })
    assert r.status_code == 200
    assert r.json()["inside_geofence"] is True

    print("\nTesting /api/ai/route-risk...")
    r = client.post("/api/ai/route-risk", json={
        "origin": {"lat": 20.0059, "lng": 73.7903},
        "destination": {"lat": 19.9328, "lng": 73.5308}
    })
    assert r.status_code == 200
    assert r.json()["route"]["distance_km"] > 0
    assert r.json()["route"]["provider"] in ("local", "openrouteservice", "osrm")

    print("\nTesting OTP authentication...")
    phone = "9876543210"
    configured_sms_provider = settings.SMS_PROVIDER
    configured_debug = settings.DEBUG
    settings.SMS_PROVIDER = "free"
    settings.DEBUG = True
    supabase_service.delete_auth_otp("+919876543212")
    r_any = client.post("/api/auth/request-otp", json={"phone": "9876543212"})
    assert r_any.status_code == 200
    assert "debug_otp" in r_any.json()

    supabase_service.delete_auth_otp("+919876543210")
    r = client.post("/api/auth/request-otp", json={"phone": phone})
    assert r.status_code == 200
    assert "debug_otp" in r.json()
    otp = r.json()["debug_otp"]
    wrong_otp = str((int(otp) + 1) % 1000000).zfill(6)
    invalid = client.post("/api/auth/verify-otp", json={"contact": phone, "otp": wrong_otp})
    assert invalid.status_code == 401
    r = client.post("/api/auth/verify-otp", json={"contact": phone, "otp": otp})
    assert r.status_code == 200
    auth_token = r.json()["token"]

    original_msg91_key = settings.MSG91_AUTH_KEY
    original_msg91_template = settings.MSG91_OTP_TEMPLATE_ID
    settings.SMS_PROVIDER = "msg91"
    settings.MSG91_AUTH_KEY = "test-auth-key"
    settings.MSG91_OTP_TEMPLATE_ID = "test-template"
    msg91_calls = []
    auth_service._send_msg91_otp = lambda destination: msg91_calls.append(destination) or True
    valid_msg91_destinations = {"+919876543213", "+14155552671", "+447911123456"}
    auth_service._verify_msg91_otp = lambda destination, code: destination in valid_msg91_destinations and code == "123456"
    msg91_test_numbers = [
        ("9876543213", "+919876543213"),
        ("+14155552671", "+14155552671"),
        ("+447911123456", "+447911123456"),
    ]
    for entered_number, expected_number in msg91_test_numbers:
        r = client.post("/api/auth/request-otp", json={"phone": entered_number})
        assert r.status_code == 200
        assert "demo_code" not in r.json()
        r = client.post("/api/auth/verify-otp", json={"contact": entered_number, "otp": "123456"})
        assert r.status_code == 200
    assert msg91_calls == [expected for _, expected in msg91_test_numbers]
    settings.SMS_PROVIDER = configured_sms_provider
    settings.DEBUG = configured_debug
    settings.MSG91_AUTH_KEY = original_msg91_key
    settings.MSG91_OTP_TEMPLATE_ID = original_msg91_template

    print("\nTesting /api/tourists/register...")
    registration_payload = {
        "name": "Omkar Chandre",
        "phone": phone,
        "role": "tourist",
        "interests": ["Heritage", "Vineyards"],
        "emergency_contact": "+919876543211",
        "verified": True
    }
    r = client.post("/api/tourists/register", json=registration_payload)
    assert r.status_code == 401
    r = client.post("/api/tourists/register", json={
        **registration_payload
    }, headers={"Authorization": f"Bearer {auth_token}"})
    assert r.status_code == 200
    print("  -> Passed tourist registration:", r.json()["message"])

    print("\nTesting WebSocket /ws/group/nashik-tourists...")
    import json
    with client.websocket_connect("/ws/group/nashik-tourists") as websocket:
        websocket.send_text(json.dumps({
            "user": "Aditi",
            "lat": 20.0050,
            "lng": 73.7900,
            "is_anchor": True
        }))
        res1 = json.loads(websocket.receive_text())
        assert res1["user"] == "Aditi"
        assert res1["is_separated"] is False

        websocket.send_text(json.dumps({
            "user": "Hasti",
            "lat": 20.0120,
            "lng": 73.7960,
            "is_anchor": False
        }))
        res2 = json.loads(websocket.receive_text())
        assert res2["user"] == "Hasti"
        assert res2["is_separated"] is True
        assert res2["regroup_suggestion"] is not None
        print(f"  -> Passed: Separation flagged at {res2['distance']}m, Nearest Haven: {res2['regroup_suggestion']}")

    print("\nTesting /api/emergency/dispatch/search...")
    r = client.get("/api/emergency/dispatch/search?q=SOS")
    assert r.status_code == 200
    search_res = r.json()
    assert search_res["status"] == "success"
    assert "results" in search_res
    print(f"  -> Passed: Dispatch search returned {search_res['count']} records")

    print("\n[SUCCESS] ALL REST & WEBSOCKET TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_endpoints()


