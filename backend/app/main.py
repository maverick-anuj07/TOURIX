from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .api import places, ai, group, emergency, tourists, auth
from .services.supabase_service import supabase_service

def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description=settings.DESCRIPTION,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health check
    @app.get("/health", tags=["System"])
    async def health_check():
        return {
            "status": "healthy",
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "environment": "development" if settings.DEBUG else "production",
            "database": "supabase" if supabase_service.client else "sqlite_fallback"
        }

    # Mount API routers under /api
    app.include_router(places.router, prefix=settings.API_V1_PREFIX)
    app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
    app.include_router(ai.router, prefix=settings.API_V1_PREFIX)
    app.include_router(emergency.router, prefix=settings.API_V1_PREFIX)
    app.include_router(tourists.router, prefix=settings.API_V1_PREFIX)
    
    # Mount group router (includes /ws/group/{group_id} and /api/group/...)
    app.include_router(group.router, prefix=settings.API_V1_PREFIX)
    app.include_router(group.router) # Root level mount for /ws/group/{group_id}

    return app

app = create_application()
