from app.database import engine
from sqlalchemy import text

with engine.begin() as conn:
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR DEFAULT 'USD'"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR DEFAULT 'UTC'"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color VARCHAR DEFAULT '#3B82F6'"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR"))
