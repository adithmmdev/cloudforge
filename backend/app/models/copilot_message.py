from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base

class CopilotMessage(Base):
    __tablename__ = 'copilot_messages'
    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey('copilot_sessions.id', ondelete='CASCADE'), nullable=False)
    role = Column(String, nullable=False)  # 'user' | 'assistant'
    content = Column(String, nullable=False)
    model = Column(String, nullable=True)  # 'kimi-k3' | 'deterministic'
    evidence_refs = Column(JSON, nullable=True)  # structured metadata only
    tokens_in = Column(Integer, nullable=True)
    tokens_out = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    session = relationship('CopilotSession', back_populates='messages')
