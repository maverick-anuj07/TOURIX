"""
TOURIX Backend Entrypoint
Delegates to the modular FastAPI application under backend/app/
"""

import sys
import os
import uvicorn

# Add backend directory to sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.main import app
from app.core.config import settings

if __name__ == "__main__":
    print(f"===========================================================")
    print(f"🌟 TOURIX Smart Travel & Safety Backend v{settings.VERSION}")
    print(f"🌐 Server running at: http://{settings.HOST}:{settings.PORT}")
    print(f"📖 Interactive Swagger Docs: http://{settings.HOST}:{settings.PORT}/docs")
    print(f"===========================================================")
    uvicorn.run(app, host=settings.HOST, port=settings.PORT)