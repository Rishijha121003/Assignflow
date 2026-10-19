"""merge academic workflow and semester hierarchy

Revision ID: 0e1264ec285d
Revises: 3f89a2b5c1d4, c8f1e2a3b4c5
Create Date: 2026-10-19 17:35:14.872221

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0e1264ec285d'
down_revision: Union[str, Sequence[str], None] = ('3f89a2b5c1d4', 'c8f1e2a3b4c5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
