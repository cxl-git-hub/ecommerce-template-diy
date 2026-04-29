from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "电商模板DIY设计系统"
    API_V1_PREFIX: str = "/api"
    
    # JWT
    SECRET_KEY: str = "your_secret_key_here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = "mysql+pymysql://root:your-pass-word@localhost:3306/diy_template"
    
    # File storage
    UPLOAD_DIR: str = "uploads"
    FONT_DIR: str = "fonts"
    MAX_UPLOAD_SIZE: int = 20 * 1024 * 1024  # 20MB
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
