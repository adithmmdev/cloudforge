from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base

class AutonomySetting(Base):
    __tablename__ = 'autonomy_settings'
    project_id = Column(Integer, ForeignKey('projects.id', ondelete='CASCADE'), primary_key=True)
    mode = Column(String, nullable=False, default='approve_each')
    
    project = relationship("Project", back_populates="autonomy_setting")
