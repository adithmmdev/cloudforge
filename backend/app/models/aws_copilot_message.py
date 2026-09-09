from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base

class AWSCopilotMessage(Base):
    __tablename__ = 'aws_copilot_messages'
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey('aws_copilot_sessions.id', ondelete='CASCADE'), nullable=False)
    role = Column(String, nullable=False)  # 'user' | 'assistant'
    content = Column(String, nullable=False)
    tool_calls = Column(JSON, nullable=True)  # To store the decision trace/tools used
    tokens_in = Column(Integer, nullable=True)
    tokens_out = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    session = relationship('AWSCopilotSession', back_populates='messages')
