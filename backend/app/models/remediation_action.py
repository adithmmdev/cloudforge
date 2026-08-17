from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class RemediationAction(Base):
    __tablename__ = 'remediation_actions'
    id = Column(Integer, primary_key=True)
    diagnosis_id = Column(Integer, ForeignKey('diagnoses.id', ondelete='CASCADE'))
    deployment_id = Column(Integer, ForeignKey('deployments.id', ondelete='CASCADE'))
    action_type = Column(String, nullable=False)
    params = Column(JSONB, nullable=False)
    status = Column(String, nullable=False, default='proposed')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    diagnosis = relationship("Diagnosis", back_populates="remediation_actions")
    deployment = relationship("Deployment", back_populates="remediation_actions")
    shadow_tests = relationship("ShadowTest", back_populates="remediation_action", cascade="all, delete-orphan")
