from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class DeploymentReport(Base):
    __tablename__ = 'deployment_reports'
    id = Column(Integer, primary_key=True)
    deployment_id = Column(Integer, ForeignKey('deployments.id', ondelete='CASCADE'), unique=True)
    report_markdown = Column(String, nullable=False)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    
    deployment = relationship("Deployment", back_populates="deployment_report")
