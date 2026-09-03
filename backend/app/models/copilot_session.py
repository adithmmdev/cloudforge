from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base

class CopilotSession(Base):
    __tablename__ = 'copilot_sessions'
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey('projects.id', ondelete='SET NULL'), nullable=True)
    deployment_id = Column(Integer, ForeignKey('deployments.id', ondelete='SET NULL'), nullable=True)
    title = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    messages = relationship('CopilotMessage', back_populates='session', cascade='all, delete-orphan', order_by='CopilotMessage.created_at')
