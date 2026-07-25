import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Muat variabel environment dari file .env
load_dotenv()

# Path ke file database SQLite (Fallback)
DB_DIR = os.path.dirname(os.path.abspath(__file__))
SQLITE_URL = f"sqlite:///{os.path.join(DB_DIR, 'herbscan.db')}"

# Ambil DATABASE_URL dari .env (Supabase), jika tidak ada gunakan SQLite
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", SQLITE_URL)

# Paksa menggunakan driver pg8000 (Pure Python) agar aman di Vercel/AWS Lambda
if SQLALCHEMY_DATABASE_URL.startswith("postgres"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgresql://", "postgresql+pg8000://")
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql+pg8000://")

# Konfigurasi koneksi (Jika menggunakan PostgreSQL/Supabase, hapus check_same_thread)
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    # Supabase PostgreSQL connection
    # Penting: Supabase URI biasanya postgresql:// tapi beberapa driver butuh postgres://
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Membuat SessionLocal untuk interaksi dengan DB
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class untuk Model
Base = declarative_base()

# Dependency untuk mengambil session DB di FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
