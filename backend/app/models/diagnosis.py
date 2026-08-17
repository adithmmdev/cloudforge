from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class Diagnosis(Base):
    __tablename__ = 'diagnoses'
    id = Column(Integer, primary_key=True)
    failure_id = Column(Integer, ForeignKey('failures.id', ondelete='CASCADE'))
    model_tier = Column(String, nullable=False)
    cloud_provider = Column(String)
    confidence = Column(Float, nullable=False)
    action_type = Column(String)
    params = Column(JSONB)
    reasoning = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    failure = relationship("Failure", back_populates="diagnoses")
    remediation_actions = relationship("RemediationAction", back_populates="diagnosis", cascade="all, delete-orphan")
