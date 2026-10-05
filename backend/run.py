import uvicorn
import os
import sys

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    from app.core.config import settings
    print(f"🚀 Starting {settings.PROJECT_NAME} v{settings.VERSION} on http://{settings.HOST}:{settings.PORT}")
    print(f"📚 Swagger UI docs available at: http://{settings.HOST}:{settings.PORT}/docs")
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
