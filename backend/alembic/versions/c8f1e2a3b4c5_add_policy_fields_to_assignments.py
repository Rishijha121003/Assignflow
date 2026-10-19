"""add_policy_fields_to_assignments

Revision ID: c8f1e2a3b4c5
Revises: b7e9a1c2d3f4
Create Date: 2026-10-18 22:16:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8f1e2a3b4c5'
down_revision: Union[str, Sequence[str], None] = 'b7e9a1c2d3f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'assignments',
        sa.Column('allow_late', sa.Boolean(), server_default='true', nullable=False),
        schema='assignflow'
    )
    op.add_column(
        'assignments',
        sa.Column('resubmission_policy', sa.String(length=50), server_default='until_due', nullable=False),
        schema='assignflow'
    )


def downgrade() -> None:
    op.drop_column('assignments', 'resubmission_policy', schema='assignflow')
    op.drop_column('assignments', 'allow_late', schema='assignflow')
