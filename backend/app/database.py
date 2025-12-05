from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DB_URL = "mysql+pymysql://nrktrn_web_admin:GOeg&*$*657@88.150.227.117/nrkindex_trn"
engine = create_engine(
    DB_URL,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 60}  # timeout in seconds
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    print("[DB] Connecting to database...")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        print("[DB] Database connection closed.")