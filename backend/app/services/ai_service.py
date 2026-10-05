import json
import re
import logging
from typing import Dict, Any, List, Optional
import google.generativeai as genai
from ..core.config import settings

logger = logging.getLogger(__name__)

# Safely configure Gemini AI only if a valid Google AI API key is provided
ai_initialized = False
try:
    api_key = settings.GEMINI_API_KEY.strip() if settings.GEMINI_API_KEY else ""
    if api_key and not api_key.startswith("AQ.") and len(api_key) > 20:
        genai.configure(api_key=api_key)
        ai_initialized = True
        logger.info("Gemini AI client successfully initialized.")
except Exception as e:
    logger.warning(f"Gemini AI not initialized (running on local expert engine): {e}")

SYSTEM_INSTRUCTION = """
You are 'Tourix AI', the premier personalized AI travel & safety companion for Nashik, Maharashtra, India.
Always greet the user respectfully, consider their personal travel preferences, pace, and interests, and provide concise, accurate, safety-aware answers tailored to mobile devices.
"""

def generate_chat_reply(
    message: str,
    user_profile: Optional[Dict[str, Any]] = None,
    history: Optional[List[Dict[str, Any]]] = None,
    language: str = "en"
) -> str:
    """
    Generate an intelligent, highly personalized conversational reply.
    Combines Gemini Generative AI with a rich local knowledge-graph engine.
    """
    # 1. Parse user personalization context
    profile = user_profile or {}
    user_name = profile.get("name") or "Traveler"
    user_interests = profile.get("interests") or ["Heritage", "Food"]
    user_pace = profile.get("pace") or "balanced"
    user_role = profile.get("role") or "tourist"

    interests_str = ", ".join(user_interests) if user_interests else "Nashik sightseeing"

    # 2. Try Gemini 1.5 Flash if configured
    if ai_initialized:
        try:
            lang_prompt = {
                "hi": "Respond in natural conversational Hindi (Devanagari script) with local Nashik cultural warmth.",
                "mr": "Respond in authentic, warm conversational Marathi (Devanagari script) with local Nashik phrases.",
                "en": "Respond in friendly, expert conversational English."
            }.get(language, "Respond in friendly conversational English.")

            prompt = f"""
            {SYSTEM_INSTRUCTION}
            
            Current User Context:
            - Name: {user_name}
            - Travel Profile: {user_role}
            - Preferred Interests: {interests_str}
            - Preferred Pace: {user_pace}
            - Language: {lang_prompt}
            
            User Message: "{message}"
            
            Provide a personalized, engaging, concise answer (under 4-5 sentences) with practical safety tips where relevant.
            """
            model = genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content(prompt)
            if response and response.text:
                return response.text.strip()
        except Exception as e:
            logger.warning(f"Gemini dynamic fallback invoked: {e}")

    # 3. Personalized Knowledge Engine (Zero-fail, instant, culturally tuned)
    query = (message or "").lower()

    # ---- LANGUAGE: MARATHI (मराठी) ----
    if language == "mr":
        if any(w in query for w in ["wine", "sula", "york", "वाइन", "सुला"]):
            return f"नमस्कार {user_name}! नाशिक हे भारताची वाइन राजधानी आहे. तुमच्यासाठी **सुला व्हाइनयार्ड्स** आणि **यॉर्क वाइनरी** सर्वोत्तम पर्याय आहेत. गंगापूर धरणाच्या बॅकवॉटरवर सूर्यास्त पाहताना वाइन टेस्टिंगचा अनुभव अप्रतिम असतो. संध्याकाळी ५ वाजेपूर्वी भेट देण्याची शिफारस केली जाते."
        elif any(w in query for w in ["trimbak", "jyotirling", "त्र्यंबकेश्वर", "ज्योतिर्लिंग"]):
            return f"नमस्कार {user_name}! **त्र्यंबकेश्वर ज्योतिर्लिंग** हे नाशिक शहरापासून २८ किमी अंतरावर आहे. कमी गर्दीत दर्शनासाठी सकाळी ६ ते ८:३० ही सर्वोत्तम वेळ आहे. गर्भगृहातील अभिषेकासाठी पारंपारिक पोषाख आवश्यक आहे. परत येताना अंजनेरी पर्वताचे विहंगम दृश्य अवश्य पाहा!"
        elif any(w in query for w in ["trek", "harihar", "fort", "anjeneri", "ट्रेक", "किल्ला", "हरीहर"]):
            return f"साहसासाठी {user_name}, **हरीहर किल्ला** हा ८० अंशांच्या कातळ-कोरीव पायऱ्यांसाठी प्रसिद्ध आहे, मात्र हा मध्यम-कठीण ट्रेक आहे. नवशिक्यांसाठी **पांडवलेणी** उत्तम आहे. ट्रेकिंग नेहमी दिवसा उजेडातच पूर्ण करा आणि पाण्याची बाटली सोबत ठेवा."
        elif any(w in query for w in ["misal", "food", "eat", "मिसळ", "जेवण", "खाणे"]):
            return f"{user_name}, नाशिकची **साधना चूलिवरची मिसळ** आणि सातपूरची **श्यामसुंदर मिसळ** नक्की ट्राय करा! गोड खाण्यासाठी जुन्या नाशिकमधील **सायंतराची गरमागरम जिलेबी आणि बासुंदी** प्रसिद्ध आहे."
        elif any(w in query for w in ["safe", "emergency", "police", "सुरक्षा", "पोलीस"]):
            return f"तुमची सुरक्षा ही पहिली प्राथमिकता आहे, {user_name}! नाशिक पोलीस नियंत्रण कक्ष: **100 / 112**, महिला हेल्पलाइन: **1091**, जिल्हा आपत्ती व्यवस्थापन: **1077**. नदीकाठ आणि ट्रेकवर असताना नेहमी सावध राहा."
        elif any(w in query for w in ["hi", "hello", "namaste", "हाय", "हॅलो", "नमस्कार"]):
            return f"नमस्कार {user_name}! मी तुमचा टूरिक्स एआय मार्गदर्शक आहे. तुमच्या **{interests_str}** आवडीनुसार आणि **{user_pace}** वेगाला साजेसा नाशिकचा सुंदर आणि सुरक्षित प्लॅन तयार करण्यासाठी मला काहीही विचारा!"
        else:
            return f"नमस्कार {user_name}! तुमच्या **{interests_str}** आवडीनुसार, नाशिकमध्ये त्र्यंबकेश्वर, पंचवटी घाट, सुला वाइनयार्ड्स आणि पांडवलेणी ही प्रमुख आकर्षणे आहेत. तुम्हाला कोणत्या ठिकाणाबद्दल सविस्तर माहिती किंवा सुरक्षित प्रवासाचा मार्ग हवा आहे?"

    # ---- LANGUAGE: HINDI (हिंदी) ----
    if language == "hi":
        if any(w in query for w in ["wine", "sula", "york", "वाइन", "सुला"]):
            return f"नमस्ते {user_name}! नाशिक को भारत की वाइन कैपिटल कहा जाता है। आपके लिए **सुला वाइनयार्ड्स** और **यॉर्क वाइनरी** बेहतरीन जगहें हैं। गंगापुर डैम के किनारे सूर्यास्त के समय वाइन टेस्टिंग का अनुभव शानदार रहता है। शाम ५ बजे से पहले पहुंचना सबसे अच्छा रहता है।"
        elif any(w in query for w in ["trimbak", "jyotirling", "त्र्यंबकेश्वर", "ज्योतिर्लिंग"]):
            return f"नमस्ते {user_name}! **त्र्यंबकेश्वर ज्योतिर्लिंग** नाशिक से लगभग २८ किमी दूर ब्रह्मगिरि पर्वत की तलहटी में स्थित है। सुबह ६:०० से ८:३० बजे के बीच दर्शन के लिए सबसे कम भीड़ होती है। दर्शन के बाद पास ही स्थित अंजनेरी पर्वत का रुख कर सकते हैं।"
        elif any(w in query for w in ["trek", "harihar", "fort", "anjeneri", "ट्रेक", "किला", "हरिहर"]):
            return f"रोमांच पसंद यात्रियों के लिए {user_name}, **हरिहर किला** की ८० डिग्री की सीढ़ियां विश्व प्रसिद्ध हैं, पर यह कठिन ट्रेक है। आसान और सुंदर अनुभव के लिए **पांडवलेनी गुफाएं** या **अंजनेरी हिल** चुनें। ट्रेक हमेशा सूर्यास्त से पहले पूरा करें।"
        elif any(w in query for w in ["misal", "food", "eat", "मिसल", "खाना"]):
            return f"{user_name}, नाशिक की मशहूर **साधना चूलिवरची मिसल** (गंगापुर) या **श्यामसुंदर मिसल** जरूर चखें! मीठे में भद्रकाली स्थित **सायंतरा की गरम-गरम जलेबी व रबड़ी** और कपालेश्वर के पास पेड़े लाजवाब हैं।"
        elif any(w in query for w in ["safe", "emergency", "police", "सुरक्षा", "पुलिस"]):
            return f"{user_name}, आपकी सुरक्षा हमारी प्राथमिकता है! आपातकालीन हेल्पलाइन: पुलिस: **100 / 112**, महिला हेल्पलाइन: **1091**, आपदा प्रबंधन: **1077**। अकेले यात्रा करते समय टूरिक्स ग्रुप सेफ्टी रडार ऑन रखें।"
        elif any(w in query for w in ["hi", "hello", "namaste", "हाय", "हेलो", "नमस्ते"]):
            return f"नमस्ते {user_name}! मैं टूरिक्स एआई हूँ। आपके चुने हुए शौक **{interests_str}** और **{user_pace}** गति के अनुसार नाशिक की सबसे बेहतरीन और सुरक्षित यात्रा की योजना बनाने में मैं आपकी मदद करूँगा। क्या जानना चाहते हैं?"
        else:
            return f"नमस्ते {user_name}! आपकी **{interests_str}** पसंद के अनुसार, नाशिक में त्र्यंबकेश्वर ज्योतिर्लिंग, पंचवटी गोदावरी घाट, सुला वाइनयार्ड्स और ऐतिहासिक पांडवलेनी प्रमुख हैं। किसी खास जगह या बजट के बारे में पूछें!"

    # ---- LANGUAGE: ENGLISH (Default) ----
    if any(w in query for w in ["wine", "sula", "york", "vineyard", "tasting"]):
        return (
            f"Hello {user_name}! As India's Wine Capital, Nashik is famous for **Sula Vineyards** and **York Winery**. "
            f"Since you enjoy {interests_str}, York offers stunning lakefront sunset views over Gangapur Dam backwaters, "
            f"while Sula offers guided winery tours and tasting sessions. Best time to visit is between 11:30 AM and 4:30 PM."
        )
    elif any(w in query for w in ["trimbak", "jyotirling", "shiva", "temple"]):
        return (
            f"Namaste {user_name}! **Trimbakeshwar Jyotirlinga** is 28 km from central Nashik at the base of the sacred Brahmagiri hills. "
            f"Pro tip: visit early between 06:00 AM and 08:30 AM for the smoothest darshan experience. "
            f"Traditional attire is required for the inner sanctum. On your way back, stop by the serene Anjaneri hills!"
        )
    elif any(w in query for w in ["trek", "harihar", "fort", "anjeneri", "adventure", "hike"]):
        return (
            f"For outdoor exploration, {user_name}, **Harihar Fort** is famous for its thrilling 80° rock-cut staircase, "
            f"suitable for fit adventurers with proper trekking shoes. For a scenic beginner-to-intermediate hike, **Pandavleni Caves** "
            f"(250 steps) or **Anjaneri Hill** (birthplace of Lord Hanuman) are fantastic. Always descend before sunset!"
        )
    elif any(w in query for w in ["food", "misal", "eat", "restaurant", "snack", "sweet"]):
        return (
            f"{user_name}, Nashik's food scene is unforgettable! Head to **Sadhana Chulivarchi Misal** near Gangapur for clay-pot cooked misal "
            f"in a rural garden setting, or **Shamsundar Misal** in Satpur. For dessert, do not miss **Sayantara's hot Jalebi with cold Rabdi** "
            f"and fresh Pedas near Panchavati."
        )
    elif any(w in query for w in ["safe", "emergency", "police", "helpline", "women", "hospital"]):
        return (
            f"Your safety is our top priority, {user_name}! Key verified contacts: Nashik Police Control: **100 / 112**, "
            f"Women Safety Helpline: **1091**, Disaster Response: **1077**, Civil Hospital: **0253-2576106**. "
            f"Use the in-app TOURIX Group Radar to monitor your companions within our 300m safety perimeter."
        )
    elif any(w in query for w in ["budget", "cost", "3000", "2000", "5000", "hours", "4 hrs", "half day"]):
        return (
            f"Here is a smart plan tailored for you, {user_name}: Start at **Panchavati & Kalaram Temple** (free, 1.5 hrs), "
            f"enjoy a local Misal breakfast (approx ₹150), explore the ancient **Pandavleni Caves** (₹25 ticket, 1.5 hrs), "
            f"and wrap up with sunset views at **Gangapur Dam Promenade**. This fits easily within 4-5 hours and ₹1,000-₹2,500 budget!"
        )
    elif any(w in query for w in ["couple", "romantic", "partner"]):
        return (
            f"For couples visiting Nashik, {user_name}, a romantic afternoon at **York Winery's open-air deck** overlooking the reservoir, "
            f"followed by dinner at **Little Italy (Sula)** or a private boat cruise at Gangapur Dam Boat Club offers the ideal romantic ambiance!"
        )
    elif any(w in query for w in ["hi", "hello", "hey", "namaste"]):
        return (
            f"Hello {user_name}! I am Tourix, your personalized travel & safety companion. "
            f"I have customized my recommendations for your **{interests_str}** preferences at a **{user_pace}** pace. "
            f"Ask me about safe itineraries, authentic food spots, vineyard tours, or temple timings!"
        )
    else:
        return (
            f"Hello {user_name}! Based on your interest in **{interests_str}**, top nearby highlights include "
            f"Trimbakeshwar, Panchavati Ramkund, Sula Vineyards, and Pandavleni Caves. "
            f"Tell me what you'd like to do—sightseeing, finding great food, or planning a safe route—and I will guide you!"
        )


def generate_smart_itinerary(
    hours: int,
    preference: str,
    pace: str = "balanced",
    budget: str = "moderate",
    available_places: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """Generate structured itinerary using Gemini AI with fallback."""
    places_subset = []
    if available_places:
        for p in available_places[:15]:
            places_subset.append({
                "name": p.get("name"),
                "category": p.get("category"),
                "duration": p.get("estimated_visit_duration", "1-2 hours"),
                "safety": p.get("safety_notes", "Daylight hours recommended.")
            })

    places_json = json.dumps(places_subset)

    prompt = f"""
    {SYSTEM_INSTRUCTION}
    Create a realistic, chronological Nashik itinerary for:
    - Available Time: {hours} hours
    - Preference: {preference}
    - Travel Pace: {pace}
    - Budget: {budget}

    Verified Places Pool:
    {places_json}

    Return strict JSON with NO markdown backticks, NO extra explanation. Format:
    {{
      "itinerary": [
        {{
          "time": "09:00 AM",
          "title": "Place Name",
          "desc": "Short description with time management & local tip",
          "safety_level": "Safe | Moderate | High Caution",
          "category": "Category",
          "est_duration": "1.5 hours"
        }}
      ],
      "safety_briefing": "Overall safety summary for this trip in Nashik"
    }}
    """

    if ai_initialized:
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content(prompt)
            clean_text = re.sub(r'```json\n|```\n|```', '', response.text).strip()
            data = json.loads(clean_text)
            return {
                "status": "success",
                "itinerary": data.get("itinerary", []),
                "safety_briefing": data.get("safety_briefing", "Enjoy your trip safely in Nashik.")
            }
        except Exception as e:
            logger.warning(f"Gemini Itinerary fallback: {e}")

    # Fallback Curated Itineraries based on Preference
    if preference.lower() == "spiritual":
        fallback_items = [
            {"time": "08:30 AM", "title": "Trimbakeshwar Jyotirlinga Temple", "desc": "Visit early to experience morning aarti with minimal queue.", "safety_level": "Safe", "category": "Spiritual", "est_duration": "2 hours"},
            {"time": "12:00 PM", "title": "Panchavati & Kalaram Temple", "desc": "Explore historical Ramayana heritage complex.", "safety_level": "Safe", "category": "Heritage", "est_duration": "1.5 hours"},
            {"time": "02:30 PM", "title": "Ramkund & Godavari Ghats", "desc": "Witness afternoon rituals along the river banks.", "safety_level": "Caution near deep waters", "category": "Spiritual", "est_duration": "1 hour"}
        ]
    elif preference.lower() == "vineyards":
        fallback_items = [
            {"time": "11:00 AM", "title": "Sula Vineyards", "desc": "Guided winery tour, grape-crushing history and wine tasting session.", "safety_level": "Safe", "category": "Vineyards", "est_duration": "2.5 hours"},
            {"time": "02:30 PM", "title": "York Winery & Tasting Room", "desc": "Picturesque vineyard overlooking Gangapur lake.", "safety_level": "Safe", "category": "Vineyards", "est_duration": "1.5 hours"},
            {"time": "04:30 PM", "title": "Gangapur Dam Promenade", "desc": "Sunset views along the reservoir corridor.", "safety_level": "Safe", "category": "Nature", "est_duration": "1 hour"}
        ]
    elif preference.lower() == "adventure":
        fallback_items = [
            {"time": "07:30 AM", "title": "Anjaneri Hill Trek", "desc": "Morning scenic climb to the birthplace of Lord Hanuman.", "safety_level": "Safe - carry hydration", "category": "Adventure", "est_duration": "3 hours"},
            {"time": "12:30 PM", "title": "Sadhana Chulivarchi Misal", "desc": "Authentic rural clay-pot lunch to recharge.", "safety_level": "Safe", "category": "Food", "est_duration": "1 hour"},
            {"time": "03:00 PM", "title": "Pandavleni Buddhist Caves", "desc": "Ascend 250 steps for panoramic valley vistas.", "safety_level": "Safe - daylight required", "category": "Heritage", "est_duration": "1.5 hours"}
        ]
    else:
        fallback_items = [
            {"time": "09:00 AM", "title": "Pandavleni Buddhist Caves", "desc": "Morning hike up the 2nd century BCE rock-cut caves for panoramic city views.", "safety_level": "Safe - wear sports shoes", "category": "Heritage", "est_duration": "2 hours"},
            {"time": "12:00 PM", "title": "Old Nashik Cultural Walking Tour", "desc": "Sarkarwada and historic spice markets.", "safety_level": "Safe", "category": "Culture", "est_duration": "1.5 hours"},
            {"time": "03:30 PM", "title": "Someshwar Waterfalls & Temple", "desc": "Picturesque waterfall on river Godavari.", "safety_level": "Caution during heavy monsoon", "category": "Nature", "est_duration": "1.5 hours"}
        ]

    return {
        "status": "fallback",
        "itinerary": fallback_items,
        "safety_briefing": "Tour completed during daylight hours with verified tourist corridors."
    }
