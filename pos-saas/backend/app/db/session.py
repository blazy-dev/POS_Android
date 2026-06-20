from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Determinar si estamos usando SQLite
is_sqlite = settings.DATABASE_URL.startswith("sqlite")

connect_args = {}
if is_sqlite:
    # Necesario para SQLite en multihilo con FastAPI
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True  # Detectar conexiones caídas y reestablecerlas
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
