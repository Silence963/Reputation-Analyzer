from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey, JSON
from .database import Base

class KF_VENDOR(Base):
    __tablename__ = "kf_vendor"
    VEND_ID = Column(Integer, primary_key=True, index=True)
    VEND_TITL = Column(String(255))  # Primary company name field
    COMPANY_NAME = Column(String(255))  # Secondary company name field
    PORTAL_ID = Column(Integer)
    MEMBERID = Column(String(255))
    VEND_DESC = Column(Text)
    VEND_CON_ADDR = Column(Text)
    VEND_STATUS = Column(String(50))
    VEND_URL = Column(String(500))
    CITY = Column(String(100))
    STATE = Column(String(100))
    COUNTRY = Column(String(100))
    GOOGLE_RVW_LINK = Column(String(500))
    GOOGLE_RVW_COUNT = Column(Integer)
    # Add other fields as needed

class COMPANY_ANALYSIS(Base):
    __tablename__ = "COMPANY_ANALYSIS"
    ID = Column(Integer, primary_key=True, index=True)
    COMPANY_ID = Column(Integer, ForeignKey("kf_vendor.VEND_ID"))
    ANALYZED_AT = Column(DateTime)
    SOURCE = Column(String(50))
    SENTIMENT_POSITIVE = Column(Float)
    SENTIMENT_NEUTRAL = Column(Float)
    SENTIMENT_NEGATIVE = Column(Float)
    LLM_SUMMARY = Column(Text)
    REVIEW_COUNT = Column(Integer)
    REVIEWS_JSON = Column(JSON) 

class COMPANY_REVIEWS(Base):
    __tablename__ = "COMPANY_REVIEWS"
    REVIEW_ID = Column(Integer, primary_key=True, autoincrement=True)
    COMPANY_ID = Column(Integer, ForeignKey("kf_vendor.VEND_ID"), nullable=False)
    USERID = Column(Integer, nullable=False)
    FIRMID = Column(Integer, nullable=False)
    REVIEWER_NAME = Column(String(255), nullable=True)
    RATING = Column(Float, nullable=True)
    REVIEW_TEXT = Column(Text)
    REVIEW_DATE = Column(String(100), nullable=True)
    SENTIMENT = Column(String(20))
    POLARITY = Column(Float)
    INSERTED_AT = Column(DateTime)
    SOURCE = Column(String(50), default='GOOGLE') 