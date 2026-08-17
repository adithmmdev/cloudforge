from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class Disclosure(Base):
    __tablename__ = 'disclosures'
    id = Column(Integer, primary_key=True)
    failure_id = Column(Integer, ForeignKey('failures.id', ondelete='CASCADE'))
    content_sent = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    failure = relationship("Failure", back_populates="disclosures")
