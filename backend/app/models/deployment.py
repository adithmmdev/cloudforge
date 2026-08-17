from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class Deployment(Base):
    __tablename__ = 'deployments'
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete='CASCADE'))
    instance_id = Column(Integer, ForeignKey('instances.id', ondelete='SET NULL'))
    deployment_type = Column(String, nullable=False, default='single_container')
    status = Column(String)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True))
    
    project = relationship("Project", back_populates="deployments")
    containers = relationship("Container", back_populates="deployment", cascade="all, delete-orphan")
    stage_events = relationship("StageEvent", back_populates="deployment", cascade="all, delete-orphan")
    failures = relationship("Failure", back_populates="deployment", cascade="all, delete-orphan")
    remediation_actions = relationship("RemediationAction", back_populates="deployment", cascade="all, delete-orphan")
    deployment_report = relationship("DeploymentReport", back_populates="deployment", uselist=False, cascade="all, delete-orphan")
