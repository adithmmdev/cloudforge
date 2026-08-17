from sqlalchemy import Column, Integer, ForeignKey, DateTime, Float, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class Metric(Base):
    __tablename__ = 'metrics'
    id = Column(Integer, primary_key=True)
    container_id = Column(Integer, ForeignKey('containers.id', ondelete='CASCADE'))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    cpu_percent = Column(Float)
    mem_usage_mb = Column(Float)
    net_in_bytes = Column(BigInteger)
    net_out_bytes = Column(BigInteger)
    
    container = relationship("Container", back_populates="metrics")
