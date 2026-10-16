"""create users table and link assignments

Revision ID: 13964d6595ad
Revises: a79a6819e052
Create Date: 2026-10-10 18:13:00.979626

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '13964d6595ad'
down_revision: Union[str, Sequence[str], None] = 'a79a6819e052'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Create assignflow.users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=150), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False, server_default='student'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        schema='assignflow',
    )
    op.create_index(
        op.f('ix_assignflow_users_id'),
        'users',
        ['id'],
        unique=False,
        schema='assignflow',
    )
    op.create_index(
        op.f('ix_assignflow_users_email'),
        'users',
        ['email'],
        unique=True,
        schema='assignflow',
    )

    # 2. Add nullable created_by_id foreign key on assignflow.assignments
    op.add_column(
        'assignments',
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        schema='assignflow',
    )
    op.create_foreign_key(
        'fk_assignments_created_by_id_users',
        'assignments',
        'users',
        ['created_by_id'],
        ['id'],
        source_schema='assignflow',
        referent_schema='assignflow',
        ondelete='SET NULL',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        'fk_assignments_created_by_id_users',
        'assignments',
        schema='assignflow',
        type_='foreignkey',
    )
    op.drop_column('assignments', 'created_by_id', schema='assignflow')
    op.drop_index(op.f('ix_assignflow_users_email'), table_name='users', schema='assignflow')
    op.drop_index(op.f('ix_assignflow_users_id'), table_name='users', schema='assignflow')
    op.drop_table('users', schema='assignflow')
