"""create_submissions_table

Revision ID: c1f930e42d8a
Revises: efebbb6789d3
Create Date: 2026-10-16 08:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1f930e42d8a'
down_revision: Union[str, Sequence[str], None] = 'efebbb6789d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to add assignflow.submissions table."""
    op.create_table(
        'submissions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('assignment_id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_late', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.ForeignKeyConstraint(['assignment_id'], ['assignflow.assignments.id'], name='fk_submissions_assignment_id', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['assignflow.users.id'], name='fk_submissions_student_id', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('assignment_id', 'student_id', name='uq_assignment_student'),
        schema='assignflow',
    )
    op.create_index(
        op.f('ix_assignflow_submissions_id'),
        'submissions',
        ['id'],
        unique=False,
        schema='assignflow',
    )
    op.create_index(
        op.f('ix_assignflow_submissions_assignment_id'),
        'submissions',
        ['assignment_id'],
        unique=False,
        schema='assignflow',
    )
    op.create_index(
        op.f('ix_assignflow_submissions_student_id'),
        'submissions',
        ['student_id'],
        unique=False,
        schema='assignflow',
    )


def downgrade() -> None:
    """Downgrade schema to remove assignflow.submissions table."""
    op.drop_index(op.f('ix_assignflow_submissions_student_id'), table_name='submissions', schema='assignflow')
    op.drop_index(op.f('ix_assignflow_submissions_assignment_id'), table_name='submissions', schema='assignflow')
    op.drop_index(op.f('ix_assignflow_submissions_id'), table_name='submissions', schema='assignflow')
    op.drop_table('submissions', schema='assignflow')
