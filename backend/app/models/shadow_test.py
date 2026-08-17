from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class ShadowTest(Base):
    __tablename__ = 'shadow_tests'
    id = Column(Integer, primary_key=True)
    remediation_action_id = Column(Integer, ForeignKey('remediation_actions.id', ondelete='CASCADE'))
    test_name = Column(String, nullable=False)
    passed = Column(Boolean, nullable=False)
    output = Column(String)
    ran_at = Column(DateTime(timezone=True), server_default=func.now())
    
    remediation_action = relationship("RemediationAction", back_populates="shadow_tests")
