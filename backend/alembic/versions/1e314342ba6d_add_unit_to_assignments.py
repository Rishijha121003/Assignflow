"""add_unit_to_assignments

Revision ID: 1e314342ba6d
Revises: d2e5a1b3c4f7
Create Date: 2026-10-17 08:58:32.266577

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1e314342ba6d'
down_revision: Union[str, Sequence[str], None] = 'd2e5a1b3c4f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: ensure unit column and uq_class_subject_unit index exist."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = [c['name'] for c in inspector.get_columns('assignments', schema='assignflow')]
    if 'unit' not in cols:
        op.add_column(
            'assignments',
            sa.Column('unit', sa.Integer(), nullable=False, server_default='1'),
            schema='assignflow',
        )
    indexes = [i['name'] for i in inspector.get_indexes('assignments', schema='assignflow')]
    if 'uq_class_subject_unit' not in indexes:
        op.create_index(
            'uq_class_subject_unit',
            'assignments',
            ['class_id', 'subject', 'unit'],
            unique=True,
            schema='assignflow',
        )


def downgrade() -> None:
    """Downgrade schema: remove uq_class_subject_unit index and unit column."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = [i['name'] for i in inspector.get_indexes('assignments', schema='assignflow')]
    if 'uq_class_subject_unit' in indexes:
        op.drop_index('uq_class_subject_unit', table_name='assignments', schema='assignflow')
    cols = [c['name'] for c in inspector.get_columns('assignments', schema='assignflow')]
    if 'unit' in cols:
        op.drop_column('assignments', 'unit', schema='assignflow')
