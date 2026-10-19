"""create_subjects_table_and_link_to_classes

Revision ID: b7e9a1c2d3f4
Revises: fda63a83a753
Create Date: 2026-10-18 21:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7e9a1c2d3f4'
down_revision: Union[str, Sequence[str], None] = 'fda63a83a753'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create subjects table in assignflow schema
    op.create_table(
        'subjects',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('class_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['class_id'], ['assignflow.classes.id'], name='fk_subjects_class_id_classes', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('class_id', 'name', name='uq_class_subject_name'),
        schema='assignflow',
    )
    op.create_index(op.f('ix_assignflow_subjects_id'), 'subjects', ['id'], unique=False, schema='assignflow')
    op.create_index(op.f('ix_assignflow_subjects_class_id'), 'subjects', ['class_id'], unique=False, schema='assignflow')

    # 2. Add nullable subject_id to assignments table
    op.add_column(
        'assignments',
        sa.Column('subject_id', sa.Integer(), nullable=True),
        schema='assignflow',
    )
    op.create_foreign_key(
        'fk_assignments_subject_id_subjects',
        'assignments',
        'subjects',
        ['subject_id'],
        ['id'],
        source_schema='assignflow',
        referent_schema='assignflow',
        ondelete='SET NULL',
    )
    op.create_index(
        op.f('ix_assignflow_assignments_subject_id'),
        'assignments',
        ['subject_id'],
        unique=False,
        schema='assignflow',
    )

    # 3. Data backfill: populate subjects from existing assignments and semester classes
    connection = op.get_bind()
    # Backfill subjects from existing assignments with non-null class_id
    connection.execute(sa.text("""
        INSERT INTO assignflow.subjects (class_id, name, created_at, updated_at)
        SELECT DISTINCT a.class_id, trim(a.subject), now(), now()
        FROM assignflow.assignments a
        JOIN assignflow.classes c ON c.id = a.class_id
        WHERE a.class_id IS NOT NULL AND a.subject IS NOT NULL AND trim(a.subject) != ''
        ON CONFLICT (class_id, name) DO NOTHING;
    """))

    # Backfill subjects for semester-linked classes using class name
    connection.execute(sa.text("""
        INSERT INTO assignflow.subjects (class_id, name, created_at, updated_at)
        SELECT c.id, trim(c.name), now(), now()
        FROM assignflow.classes c
        WHERE c.semester_id IS NOT NULL AND trim(c.name) != ''
        ON CONFLICT (class_id, name) DO NOTHING;
    """))

    # Link existing assignments to their newly populated subject_id
    connection.execute(sa.text("""
        UPDATE assignflow.assignments a
        SET subject_id = s.id
        FROM assignflow.subjects s
        WHERE a.class_id = s.class_id
          AND lower(trim(a.subject)) = lower(trim(s.name))
          AND a.subject_id IS NULL;
    """))


def downgrade() -> None:
    op.drop_index(op.f('ix_assignflow_assignments_subject_id'), table_name='assignments', schema='assignflow')
    op.drop_constraint('fk_assignments_subject_id_subjects', 'assignments', schema='assignflow', type_='foreignkey')
    op.drop_column('assignments', 'subject_id', schema='assignflow')

    op.drop_index(op.f('ix_assignflow_subjects_class_id'), table_name='subjects', schema='assignflow')
    op.drop_index(op.f('ix_assignflow_subjects_id'), table_name='subjects', schema='assignflow')
    op.drop_table('subjects', schema='assignflow')
