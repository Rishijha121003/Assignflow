"""create_semesters_table_and_link_classes_assignments

Revision ID: fda63a83a753
Revises: d2e5a1b3c4f7
Create Date: 2026-10-18 09:06:15.479023

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fda63a83a753'
down_revision: Union[str, Sequence[str], None] = 'd2e5a1b3c4f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create semesters table
    op.create_table(
        'semesters',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('academic_year', sa.String(length=50), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('status', sa.String(length=30), server_default=sa.text("'active'"), nullable=False),
        sa.Column('program', sa.String(length=100), server_default=sa.text("'B.Tech CSE'"), nullable=True),
        sa.Column('teacher_id', sa.Integer(), nullable=False),
        sa.Column('is_finalized', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('finalized_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('finalized_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['teacher_id'], ['assignflow.users.id'], name='fk_semesters_teacher_id', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['finalized_by_id'], ['assignflow.users.id'], name='fk_semesters_finalized_by_id', ondelete='SET NULL'),
        sa.CheckConstraint('start_date <= end_date', name='chk_semester_dates'),
        sa.CheckConstraint("status IN ('active', 'completed', 'archived')", name='chk_semester_status'),
        sa.PrimaryKeyConstraint('id'),
        schema='assignflow',
    )
    op.create_index(op.f('ix_assignflow_semesters_id'), 'semesters', ['id'], unique=False, schema='assignflow')
    op.create_index(op.f('ix_assignflow_semesters_teacher_id'), 'semesters', ['teacher_id'], unique=False, schema='assignflow')
    op.create_index(op.f('ix_assignflow_semesters_status'), 'semesters', ['status'], unique=False, schema='assignflow')

    # 2. Add semester_id to classes table
    op.add_column(
        'classes',
        sa.Column('semester_id', sa.Integer(), nullable=True),
        schema='assignflow',
    )
    op.create_foreign_key(
        'fk_classes_semester_id',
        'classes',
        'semesters',
        ['semester_id'],
        ['id'],
        source_schema='assignflow',
        referent_schema='assignflow',
        ondelete='SET NULL',
    )
    op.create_index(
        op.f('ix_assignflow_classes_semester_id'),
        'classes',
        ['semester_id'],
        unique=False,
        schema='assignflow',
    )

    # 3. Add semester_id and assignment_type to assignments table
    op.add_column(
        'assignments',
        sa.Column('semester_id', sa.Integer(), nullable=True),
        schema='assignflow',
    )
    op.add_column(
        'assignments',
        sa.Column('assignment_type', sa.String(length=50), server_default=sa.text("'Assignment'"), nullable=False),
        schema='assignflow',
    )
    op.create_foreign_key(
        'fk_assignments_semester_id',
        'assignments',
        'semesters',
        ['semester_id'],
        ['id'],
        source_schema='assignflow',
        referent_schema='assignflow',
        ondelete='SET NULL',
    )
    op.create_index(
        op.f('ix_assignflow_assignments_semester_id'),
        'assignments',
        ['semester_id'],
        unique=False,
        schema='assignflow',
    )


def downgrade() -> None:
    # 3. Drop from assignments
    op.drop_index(op.f('ix_assignflow_assignments_semester_id'), table_name='assignments', schema='assignflow')
    op.drop_constraint('fk_assignments_semester_id', 'assignments', schema='assignflow', type_='foreignkey')
    op.drop_column('assignments', 'assignment_type', schema='assignflow')
    op.drop_column('assignments', 'semester_id', schema='assignflow')

    # 2. Drop from classes
    op.drop_index(op.f('ix_assignflow_classes_semester_id'), table_name='classes', schema='assignflow')
    op.drop_constraint('fk_classes_semester_id', 'classes', schema='assignflow', type_='foreignkey')
    op.drop_column('classes', 'semester_id', schema='assignflow')

    # 1. Drop semesters table
    op.drop_index(op.f('ix_assignflow_semesters_status'), table_name='semesters', schema='assignflow')
    op.drop_index(op.f('ix_assignflow_semesters_teacher_id'), table_name='semesters', schema='assignflow')
    op.drop_index(op.f('ix_assignflow_semesters_id'), table_name='semesters', schema='assignflow')
    op.drop_table('semesters', schema='assignflow')
