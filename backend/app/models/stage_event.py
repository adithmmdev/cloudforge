from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class StageEvent(Base):
    __tablename__ = 'stage_events'
    id = Column(Integer, primary_key=True)
    deployment_id = Column(Integer, ForeignKey('deployments.id', ondelete='CASCADE'))
    stage = Column(String, nullable=False)
    detail = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    deployment = relationship("Deployment", back_populates="stage_events")
