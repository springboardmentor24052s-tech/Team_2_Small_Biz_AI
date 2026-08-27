import os
from alembic import command
from alembic.config import Config

backend_dir = os.path.dirname(os.path.abspath(__file__))
cfg = Config(os.path.join(backend_dir, "alembic.ini"))
cfg.set_main_option("script_location", os.path.join(backend_dir, "migrations"))

# Need to import models so autogenerate sees them
from app import models
from app.database import engine

cfg.set_main_option("sqlalchemy.url", str(engine.url))

command.revision(cfg, autogenerate=True, message="Add notifications and inventory_alerts")
