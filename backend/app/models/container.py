from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from .base import Base

class Container(Base):
    __tablename__ = 'containers'
    id = Column(Integer, primary_key=True)
    deployment_id = Column(Integer, ForeignKey('deployments.id', ondelete='CASCADE'))
    service_name = Column(String, nullable=False, default='app')
    image_tag = Column(String)
    container_id = Column(String)
    host_ip = Column(String)
    host_port = Column(Integer)
    status = Column(String)
    started_at = Column(DateTime(timezone=True))
    stopped_at = Column(DateTime(timezone=True))
    
    deployment = relationship("Deployment", back_populates="containers")
    metrics = relationship("Metric", back_populates="container", cascade="all, delete-orphan")
