from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from .base import Base

class Instance(Base):
    __tablename__ = 'instances'
    id = Column(Integer, primary_key=True)
    aws_instance_id = Column(String, unique=True, nullable=False)
    public_ip = Column(String)
    status = Column(String, nullable=False)
    tag = Column(String, nullable=False, default='cloudforge-managed')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
