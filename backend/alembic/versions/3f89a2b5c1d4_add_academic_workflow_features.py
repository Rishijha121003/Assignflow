"""add_academic_workflow_features

Revision ID: 3f89a2b5c1d4
Revises: 1e314342ba6d
Create Date: 2026-10-17 10:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3f89a2b5c1d4'
down_revision: Union[str, Sequence[str], None] = '1e314342ba6d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # 1. Update assignments columns
    asgn_cols = [c['name'] for c in inspector.get_columns('assignments', schema='assignflow')]
    if 'grace_period_minutes' not in asgn_cols:
        op.add_column('assignments', sa.Column('grace_period_minutes', sa.Integer(), nullable=False, server_default='0'), schema='assignflow')
    if 'allow_late' not in asgn_cols:
        op.add_column('assignments', sa.Column('allow_late', sa.Boolean(), nullable=False, server_default='true'), schema='assignflow')
    if 'late_penalty_percent' not in asgn_cols:
        op.add_column('assignments', sa.Column('late_penalty_percent', sa.Float(), nullable=False, server_default='0.0'), schema='assignflow')

    # 2. Update submissions columns
    sub_cols = [c['name'] for c in inspector.get_columns('submissions', schema='assignflow')]
    if 'resubmission_allowed' not in sub_cols:
        op.add_column('submissions', sa.Column('resubmission_allowed', sa.Boolean(), nullable=False, server_default='false'), schema='assignflow')
    if 'resubmission_deadline' not in sub_cols:
        op.add_column('submissions', sa.Column('resubmission_deadline', sa.DateTime(timezone=True), nullable=True), schema='assignflow')
    if 'resubmission_note' not in sub_cols:
        op.add_column('submissions', sa.Column('resubmission_note', sa.Text(), nullable=True), schema='assignflow')
    if 'attempt_number' not in sub_cols:
        op.add_column('submissions', sa.Column('attempt_number', sa.Integer(), nullable=False, server_default='1'), schema='assignflow')

    # 3. Create deadline_extensions table
    tables = inspector.get_table_names(schema='assignflow')
    if 'deadline_extensions' not in tables:
        op.create_table(
            'deadline_extensions',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('assignment_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('extended_due_date', sa.DateTime(timezone=True), nullable=False),
            sa.Column('reason', sa.Text(), nullable=True),
            sa.Column('granted_by_id', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['assignment_id'], ['assignflow.assignments.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['student_id'], ['assignflow.users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['granted_by_id'], ['assignflow.users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('assignment_id', 'student_id', name='uq_extension_assignment_student'),
            schema='assignflow',
        )
        op.create_index('ix_deadline_extensions_assignment_id', 'deadline_extensions', ['assignment_id'], schema='assignflow')
        op.create_index('ix_deadline_extensions_student_id', 'deadline_extensions', ['student_id'], schema='assignflow')

    # 4. Create submission_history table
    if 'submission_history' not in tables:
        op.create_table(
            'submission_history',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('submission_id', sa.Integer(), nullable=False),
            sa.Column('assignment_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('attempt_number', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('file_path', sa.String(500), nullable=False),
            sa.Column('file_name', sa.String(255), nullable=False),
            sa.Column('file_size', sa.Integer(), nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('is_late', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('grade', sa.Float(), nullable=True),
            sa.Column('feedback', sa.Text(), nullable=True),
            sa.Column('status', sa.String(20), nullable=False),
            sa.Column('archived_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['submission_id'], ['assignflow.submissions.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['assignment_id'], ['assignflow.assignments.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['student_id'], ['assignflow.users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            schema='assignflow',
        )
        op.create_index('ix_submission_history_submission_id', 'submission_history', ['submission_id'], schema='assignflow')

    # 5. Create grade_corrections table
    if 'grade_corrections' not in tables:
        op.create_table(
            'grade_corrections',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('submission_id', sa.Integer(), nullable=False),
            sa.Column('previous_grade', sa.Float(), nullable=True),
            sa.Column('new_grade', sa.Float(), nullable=False),
            sa.Column('previous_feedback', sa.Text(), nullable=True),
            sa.Column('new_feedback', sa.Text(), nullable=True),
            sa.Column('reason', sa.Text(), nullable=False),
            sa.Column('changed_by_id', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['submission_id'], ['assignflow.submissions.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['changed_by_id'], ['assignflow.users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
            schema='assignflow',
        )
        op.create_index('ix_grade_corrections_submission_id', 'grade_corrections', ['submission_id'], schema='assignflow')

    # 6. Create reevaluation_requests table
    if 'reevaluation_requests' not in tables:
        op.create_table(
            'reevaluation_requests',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('submission_id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('reason', sa.Text(), nullable=False),
            sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
            sa.Column('decision_notes', sa.Text(), nullable=True),
            sa.Column('previous_grade', sa.Float(), nullable=True),
            sa.Column('revised_grade', sa.Float(), nullable=True),
            sa.Column('decided_by_id', sa.Integer(), nullable=True),
            sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.CheckConstraint("status IN ('pending', 'approved', 'rejected')", name='chk_reevaluation_status'),
            sa.ForeignKeyConstraint(['submission_id'], ['assignflow.submissions.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['student_id'], ['assignflow.users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['decided_by_id'], ['assignflow.users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
            schema='assignflow',
        )
        op.create_index('ix_reevaluation_requests_submission_id', 'reevaluation_requests', ['submission_id'], schema='assignflow')

    # 7. Create notifications table
    if 'notifications' not in tables:
        op.create_table(
            'notifications',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('title', sa.String(200), nullable=False),
            sa.Column('message', sa.Text(), nullable=False),
            sa.Column('type', sa.String(50), nullable=False, server_default='general'),
            sa.Column('link_url', sa.String(300), nullable=True),
            sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['assignflow.users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            schema='assignflow',
        )
        op.create_index('ix_notifications_user_id', 'notifications', ['user_id'], schema='assignflow')

    # 8. Create notification_preferences table
    if 'notification_preferences' not in tables:
        op.create_table(
            'notification_preferences',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('in_app_enabled', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('email_enabled', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('email_on_grade_released', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('email_on_deadline', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('email_on_reevaluation', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['assignflow.users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id', name='uq_notification_preferences_user_id'),
            schema='assignflow',
        )

    # 9. Create finalized_results table
    if 'finalized_results' not in tables:
        op.create_table(
            'finalized_results',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('class_id', sa.Integer(), nullable=False),
            sa.Column('subject', sa.String(100), nullable=False),
            sa.Column('required_units', sa.String(200), nullable=False),
            sa.Column('results_summary', sa.Text(), nullable=True),
            sa.Column('finalized_by_id', sa.Integer(), nullable=True),
            sa.Column('finalized_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['class_id'], ['assignflow.classes.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['finalized_by_id'], ['assignflow.users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('class_id', 'subject', name='uq_finalized_class_subject'),
            schema='assignflow',
        )
        op.create_index('ix_finalized_results_class_id', 'finalized_results', ['class_id'], schema='assignflow')


def downgrade() -> None:
    # Drop created tables in reverse dependency order
    op.drop_table('finalized_results', schema='assignflow')
    op.drop_table('notification_preferences', schema='assignflow')
    op.drop_table('notifications', schema='assignflow')
    op.drop_table('reevaluation_requests', schema='assignflow')
    op.drop_table('grade_corrections', schema='assignflow')
    op.drop_table('submission_history', schema='assignflow')
    op.drop_table('deadline_extensions', schema='assignflow')

    # Drop added columns
    op.drop_column('submissions', 'attempt_number', schema='assignflow')
    op.drop_column('submissions', 'resubmission_note', schema='assignflow')
    op.drop_column('submissions', 'resubmission_deadline', schema='assignflow')
    op.drop_column('submissions', 'resubmission_allowed', schema='assignflow')

    op.drop_column('assignments', 'late_penalty_percent', schema='assignflow')
    op.drop_column('assignments', 'allow_late', schema='assignflow')
    op.drop_column('assignments', 'grace_period_minutes', schema='assignflow')
