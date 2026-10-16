"""add_grading_and_release_to_submissions

Revision ID: d2e5a1b3c4f7
Revises: c1f930e42d8a
Create Date: 2026-10-16 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2e5a1b3c4f7'
down_revision: Union[str, Sequence[str], None] = 'c1f930e42d8a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add max_marks to assignments
    op.add_column(
        'assignments',
        sa.Column('max_marks', sa.Float(), server_default=sa.text('100.0'), nullable=False),
        schema='assignflow',
    )

    # 2. Add grading columns to submissions
    op.add_column('submissions', sa.Column('grade', sa.Float(), nullable=True), schema='assignflow')
    op.add_column('submissions', sa.Column('feedback', sa.Text(), nullable=True), schema='assignflow')
    op.add_column(
        'submissions',
        sa.Column('status', sa.String(length=20), server_default=sa.text("'submitted'"), nullable=False),
        schema='assignflow',
    )
    op.add_column('submissions', sa.Column('graded_at', sa.DateTime(timezone=True), nullable=True), schema='assignflow')
    op.add_column('submissions', sa.Column('graded_by_id', sa.Integer(), nullable=True), schema='assignflow')
    op.add_column('submissions', sa.Column('released_at', sa.DateTime(timezone=True), nullable=True), schema='assignflow')

    op.create_foreign_key(
        'fk_submissions_graded_by_id',
        'submissions',
        'users',
        ['graded_by_id'],
        ['id'],
        source_schema='assignflow',
        referent_schema='assignflow',
        ondelete='SET NULL',
    )
    op.create_index(
        op.f('ix_assignflow_submissions_status'),
        'submissions',
        ['status'],
        unique=False,
        schema='assignflow',
    )
    op.create_check_constraint(
        'chk_assignment_max_marks',
        'assignments',
        'max_marks > 0',
        schema='assignflow',
    )
    op.create_check_constraint(
        'chk_grade_positive',
        'submissions',
        'grade IS NULL OR grade >= 0',
        schema='assignflow',
    )
    op.create_check_constraint(
        'chk_submission_status',
        'submissions',
        "status IN ('submitted', 'graded', 'released')",
        schema='assignflow',
    )


def downgrade() -> None:
    op.drop_constraint('chk_submission_status', 'submissions', schema='assignflow', type_='check')
    op.drop_constraint('chk_grade_positive', 'submissions', schema='assignflow', type_='check')
    op.drop_constraint('chk_assignment_max_marks', 'assignments', schema='assignflow', type_='check')
    op.drop_index(op.f('ix_assignflow_submissions_status'), table_name='submissions', schema='assignflow')
    op.drop_constraint('fk_submissions_graded_by_id', 'submissions', schema='assignflow', type_='foreignkey')
    op.drop_column('submissions', 'released_at', schema='assignflow')
    op.drop_column('submissions', 'graded_by_id', schema='assignflow')
    op.drop_column('submissions', 'graded_at', schema='assignflow')
    op.drop_column('submissions', 'status', schema='assignflow')
    op.drop_column('submissions', 'feedback', schema='assignflow')
    op.drop_column('submissions', 'grade', schema='assignflow')
    op.drop_column('assignments', 'max_marks', schema='assignflow')
