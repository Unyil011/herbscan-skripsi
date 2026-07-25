from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    google_id = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    picture = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relasi ke history
    histories = relationship("History", back_populates="owner")

class History(Base):
    __tablename__ = "histories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    plant_name = Column(String, index=True)
    disease_class = Column(String)
    confidence = Column(Float)
    recommendation = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    # (Opsional) jika kita ingin menyimpan nama file gambar
    image_filename = Column(String, nullable=True)

    # Relasi balik ke user
    owner = relationship("User", back_populates="histories")
