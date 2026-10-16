"""create_classes_and_enrollments

Revision ID: efebbb6789d3
Revises: 13964d6595ad
Create Date: 2026-10-10 18:33:13.512479

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'efebbb6789d3'
down_revision: Union[str, Sequence[str], None] = '13964d6595ad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Create assignflow.classes table
    op.create_table(
        'classes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('join_code', sa.String(length=12), nullable=False),
        sa.Column('teacher_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['teacher_id'], ['assignflow.users.id'], name='fk_classes_teacher_id_users', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema='assignflow',
    )
    op.create_index(
        op.f('ix_assignflow_classes_id'),
        'classes',
        ['id'],
        unique=False,
        schema='assignflow',
    )
    op.create_index(
        op.f('ix_assignflow_classes_join_code'),
        'classes',
        ['join_code'],
        unique=True,
        schema='assignflow',
    )
    op.create_index(
        op.f('ix_assignflow_classes_teacher_id'),
        'classes',
        ['teacher_id'],
        unique=False,
        schema='assignflow',
    )

    # 2. Create assignflow.class_enrollments table
    op.create_table(
        'class_enrollments',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('class_id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('enrolled_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['class_id'], ['assignflow.classes.id'], name='fk_enrollments_class_id_classes', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['assignflow.users.id'], name='fk_enrollments_student_id_users', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('class_id', 'student_id', name='uq_class_student'),
        schema='assignflow',
    )
    op.create_index(
        op.f('ix_assignflow_class_enrollments_id'),
        'class_enrollments',
        ['id'],
        unique=False,
        schema='assignflow',
    )
    op.create_index(
        op.f('ix_assignflow_class_enrollments_class_id'),
        'class_enrollments',
        ['class_id'],
        unique=False,
        schema='assignflow',
    )
    op.create_index(
        op.f('ix_assignflow_class_enrollments_student_id'),
        'class_enrollments',
        ['student_id'],
        unique=False,
        schema='assignflow',
    )

    # 3. Add nullable class_id foreign key on assignflow.assignments
    op.add_column(
        'assignments',
        sa.Column('class_id', sa.Integer(), nullable=True),
        schema='assignflow',
    )
    op.create_foreign_key(
        'fk_assignments_class_id_classes',
        'assignments',
        'classes',
        ['class_id'],
        ['id'],
        source_schema='assignflow',
        referent_schema='assignflow',
        ondelete='SET NULL',
    )
    op.create_index(
        op.f('ix_assignflow_assignments_class_id'),
        'assignments',
        ['class_id'],
        unique=False,
        schema='assignflow',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_assignflow_assignments_class_id'), table_name='assignments', schema='assignflow')
    op.drop_constraint('fk_assignments_class_id_classes', 'assignments', schema='assignflow', type_='foreignkey')
    op.drop_column('assignments', 'class_id', schema='assignflow')

    op.drop_index(op.f('ix_assignflow_class_enrollments_student_id'), table_name='class_enrollments', schema='assignflow')
    op.drop_index(op.f('ix_assignflow_class_enrollments_class_id'), table_name='class_enrollments', schema='assignflow')
    op.drop_index(op.f('ix_assignflow_class_enrollments_id'), table_name='class_enrollments', schema='assignflow')
    op.drop_table('class_enrollments', schema='assignflow')

    op.drop_index(op.f('ix_assignflow_classes_teacher_id'), table_name='classes', schema='assignflow')
    op.drop_index(op.f('ix_assignflow_classes_join_code'), table_name='classes', schema='assignflow')
    op.drop_index(op.f('ix_assignflow_classes_id'), table_name='classes', schema='assignflow')
    op.drop_table('classes', schema='assignflow')
