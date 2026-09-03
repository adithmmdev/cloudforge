"""add copilot tables

Revision ID: a1b2c3d4e5f6
Revises: 9a99de6fd0d7
Create Date: 2026-09-02
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = '9a99de6fd0d7'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('copilot_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='SET NULL'), nullable=True),
        sa.Column('deployment_id', sa.Integer(), sa.ForeignKey('deployments.id', ondelete='SET NULL'), nullable=True),
        sa.Column('title', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_copilot_sessions_project', 'copilot_sessions', ['project_id'])
    
    op.create_table('copilot_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('copilot_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(), nullable=False),
        sa.Column('content', sa.String(), nullable=False),
        sa.Column('model', sa.String(), nullable=True),
        sa.Column('evidence_refs', sa.JSON(), nullable=True),
        sa.Column('tokens_in', sa.Integer(), nullable=True),
        sa.Column('tokens_out', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_copilot_messages_session', 'copilot_messages', ['session_id'])

def downgrade():
    op.drop_table('copilot_messages')
    op.drop_table('copilot_sessions')
