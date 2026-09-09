from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base

class AWSCopilotSession(Base):
    __tablename__ = 'aws_copilot_sessions'
    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    messages = relationship('AWSCopilotMessage', back_populates='session', cascade='all, delete-orphan', order_by='AWSCopilotMessage.created_at')

