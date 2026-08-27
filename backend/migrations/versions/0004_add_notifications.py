"""Add notifications and inventory_alerts

Revision ID: 0004_add_notifications
Revises: 0003_ai_and_inventory_tables
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '0004_add_notifications'
down_revision = '0003_ai_and_inventory_tables'

def _tables(bind):
    return set(inspect(bind).get_table_names())

def upgrade():
    bind = op.get_bind()
    existing = _tables(bind)
    
    if "notifications" not in existing:
        op.create_table(
            "notifications",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("business_id", sa.Integer(), sa.ForeignKey("businesses.id"), nullable=False),
            sa.Column("type", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("level", sa.String(), nullable=True, server_default="info"),
            sa.Column("link", sa.String(), nullable=True),
            sa.Column("source_type", sa.String(), nullable=True),
            sa.Column("source_id", sa.Integer(), nullable=True),
            sa.Column("read", sa.Boolean(), nullable=True, server_default="false"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )

    if "inventory_alerts" not in existing:
        op.create_table(
            "inventory_alerts",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("business_id", sa.Integer(), sa.ForeignKey("businesses.id"), nullable=False),
            sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("level", sa.String(), nullable=True, server_default="warning"),
            sa.Column("resolved", sa.Boolean(), nullable=True, server_default="false"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )

def downgrade():
    op.drop_table("notifications")
    op.drop_table("inventory_alerts")
