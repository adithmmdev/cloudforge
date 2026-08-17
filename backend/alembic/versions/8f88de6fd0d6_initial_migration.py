"""Initial migration

Revision ID: 8f88de6fd0d6
Revises: 
Create Date: 2026-08-17 15:46:44.281210

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '8f88de6fd0d6'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(), nullable=False),
        sa.Column('password_hash', sa.String(), nullable=False),
        sa.Column('role', sa.String(), server_default='developer', nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username')
    )
    # 2. projects
    op.create_table(
        'projects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('repo_url', sa.String(), nullable=True),
        sa.Column('framework', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    # 3. autonomy_settings
    op.create_table(
        'autonomy_settings',
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('mode', sa.String(), server_default='approve_each', nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('project_id')
    )
    # 4. instances
    op.create_table(
        'instances',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('aws_instance_id', sa.String(), nullable=False),
        sa.Column('public_ip', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('tag', sa.String(), server_default='cloudforge-managed', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('aws_instance_id')
    )
    op.create_index('idx_instances_status', 'instances', ['status'])
    # 5. aws_setup_state
    op.create_table(
        'aws_setup_state',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('security_group_id', sa.String(), nullable=True),
        sa.Column('key_pair_name', sa.String(), nullable=True),
        sa.Column('ssh_key_path', sa.String(), nullable=True),
        sa.Column('ami_id', sa.String(), nullable=True),
        sa.Column('subnet_id', sa.String(), nullable=True),
        sa.Column('iam_validated', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('setup_status', sa.String(), server_default='pending', nullable=False),
        sa.Column('error_detail', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    # 6. deployments
    op.create_table(
        'deployments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('instance_id', sa.Integer(), nullable=True),
        sa.Column('deployment_type', sa.String(), server_default='single_container', nullable=False),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['instance_id'], ['instances.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_deployments_project', 'deployments', ['project_id'])
    # 7. stage_events
    op.create_table(
        'stage_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('deployment_id', sa.Integer(), nullable=True),
        sa.Column('stage', sa.String(), nullable=False),
        sa.Column('detail', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.ForeignKeyConstraint(['deployment_id'], ['deployments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_stage_events_deployment', 'stage_events', ['deployment_id'])
    # 8. containers
    op.create_table(
        'containers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('deployment_id', sa.Integer(), nullable=True),
        sa.Column('service_name', sa.String(), server_default='app', nullable=False),
        sa.Column('image_tag', sa.String(), nullable=True),
        sa.Column('container_id', sa.String(), nullable=True),
        sa.Column('host_ip', sa.String(), nullable=True),
        sa.Column('host_port', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('stopped_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['deployment_id'], ['deployments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_containers_deployment', 'containers', ['deployment_id'])
    # 9. metrics
    op.create_table(
        'metrics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('container_id', sa.Integer(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.Column('cpu_percent', sa.Float(), nullable=True),
        sa.Column('mem_usage_mb', sa.Float(), nullable=True),
        sa.Column('net_in_bytes', sa.BigInteger(), nullable=True),
        sa.Column('net_out_bytes', sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(['container_id'], ['containers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_metrics_container_ts', 'metrics', ['container_id', 'timestamp'])
    # 10. failures
    op.create_table(
        'failures',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('deployment_id', sa.Integer(), nullable=True),
        sa.Column('raw_error_excerpt', sa.String(), nullable=True),
        sa.Column('error_class', sa.String(), nullable=True),
        sa.Column('detected_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.ForeignKeyConstraint(['deployment_id'], ['deployments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    # 11. diagnoses
    op.create_table(
        'diagnoses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('failure_id', sa.Integer(), nullable=True),
        sa.Column('model_tier', sa.String(), nullable=False),
        sa.Column('cloud_provider', sa.String(), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('action_type', sa.String(), nullable=True),
        sa.Column('params', postgresql.JSONB(), nullable=True),
        sa.Column('reasoning', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.ForeignKeyConstraint(['failure_id'], ['failures.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    # 12. disclosures
    op.create_table(
        'disclosures',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('failure_id', sa.Integer(), nullable=True),
        sa.Column('content_sent', sa.String(), nullable=False),
        sa.Column('destination', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.ForeignKeyConstraint(['failure_id'], ['failures.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    # 13. remediation_actions
    op.create_table(
        'remediation_actions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('diagnosis_id', sa.Integer(), nullable=True),
        sa.Column('deployment_id', sa.Integer(), nullable=True),
        sa.Column('action_type', sa.String(), nullable=False),
        sa.Column('params', postgresql.JSONB(), nullable=False),
        sa.Column('status', sa.String(), server_default='proposed', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.ForeignKeyConstraint(['deployment_id'], ['deployments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['diagnosis_id'], ['diagnoses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    # 14. shadow_tests
    op.create_table(
        'shadow_tests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('remediation_action_id', sa.Integer(), nullable=True),
        sa.Column('test_name', sa.String(), nullable=False),
        sa.Column('passed', sa.Boolean(), nullable=False),
        sa.Column('output', sa.String(), nullable=True),
        sa.Column('ran_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.ForeignKeyConstraint(['remediation_action_id'], ['remediation_actions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    # 15. deployment_reports
    op.create_table(
        'deployment_reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('deployment_id', sa.Integer(), nullable=True),
        sa.Column('report_markdown', sa.String(), nullable=False),
        sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.ForeignKeyConstraint(['deployment_id'], ['deployments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('deployment_id')
    )



def downgrade() -> None:
    op.drop_table('deployment_reports')
    op.drop_table('shadow_tests')
    op.drop_table('remediation_actions')
    op.drop_table('disclosures')
    op.drop_table('diagnoses')
    op.drop_table('failures')
    op.drop_table('metrics')
    op.drop_table('containers')
    op.drop_table('stage_events')
    op.drop_table('deployments')
    op.drop_table('aws_setup_state')
    op.drop_table('instances')
    op.drop_table('autonomy_settings')
    op.drop_table('projects')
    op.drop_table('users')
