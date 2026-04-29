from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.api import auth, categories, assets, admin_templates, public_templates, designs, ai, utils

# 创建数据库表
Base.metadata.create_all(bind=engine)


def init_admin():
    """启动时检查是否存在管理员，不存在则创建默认管理员"""
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == "admin").first()
        if not admin:
            admin = User(
                email="admin@example.com",
                username="admin",
                hashed_password=get_password_hash("admin123"),
                role="admin",
            )
            db.add(admin)
            db.commit()
            print("默认管理员已创建: admin@example.com / admin123")
    finally:
        db.close()


init_admin()

app = FastAPI(title=settings.PROJECT_NAME, version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件服务
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "thumbnails"), exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "rembg"), exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "fonts"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# 注册路由
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(categories.router, prefix=settings.API_V1_PREFIX)
app.include_router(assets.router, prefix=settings.API_V1_PREFIX)
app.include_router(admin_templates.router, prefix=settings.API_V1_PREFIX)
app.include_router(public_templates.router, prefix=settings.API_V1_PREFIX)
app.include_router(designs.router, prefix=settings.API_V1_PREFIX)
app.include_router(ai.router, prefix=settings.API_V1_PREFIX)
app.include_router(utils.router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def root():
    return {"message": "电商模板DIY设计系统 API", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
