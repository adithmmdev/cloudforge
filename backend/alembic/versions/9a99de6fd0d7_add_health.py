"""add health

Revision ID: 9a99de6fd0d7
Revises: 8f88de6fd0d6
Create Date: 2026-08-31 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a99de6fd0d7'
down_revision: Union[str, None] = '8f88de6fd0d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('deployments', sa.Column('health_check_result', sa.String(), nullable=True))
    op.add_column('deployments', sa.Column('health_check_ms', sa.Integer(), nullable=True))
    op.add_column('deployments', sa.Column('health_check_method', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('deployments', 'health_check_method')
    op.drop_column('deployments', 'health_check_ms')
    op.drop_column('deployments', 'health_check_result')
