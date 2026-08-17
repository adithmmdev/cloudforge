from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from .base import Base

class AWSSetupState(Base):
    __tablename__ = 'aws_setup_state'
    id = Column(Integer, primary_key=True)
    security_group_id = Column(String)
    key_pair_name = Column(String)
    ssh_key_path = Column(String)
    ami_id = Column(String)
    subnet_id = Column(String)
    iam_validated = Column(Boolean, nullable=False, default=False)
    setup_status = Column(String, nullable=False, default='pending')
    error_detail = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
