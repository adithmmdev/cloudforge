from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class Failure(Base):
    __tablename__ = 'failures'
    id = Column(Integer, primary_key=True)
    deployment_id = Column(Integer, ForeignKey('deployments.id', ondelete='CASCADE'))
    raw_error_excerpt = Column(String)
    error_class = Column(String)
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    
    deployment = relationship("Deployment", back_populates="failures")
    diagnoses = relationship("Diagnosis", back_populates="failure", cascade="all, delete-orphan")
    disclosures = relationship("Disclosure", back_populates="failure", cascade="all, delete-orphan")
