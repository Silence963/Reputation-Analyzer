from sqlalchemy.orm import Session
from .models import COMPANY_ANALYSIS, COMPANY_REVIEWS
from datetime import datetime, timedelta
from typing import Optional, List

def save_company_analysis(db: Session, company_id: int, source: str, reviews: list, sentiment_counts: dict, llm_summary: str):
    analysis = COMPANY_ANALYSIS(
        COMPANY_ID=company_id,
        ANALYZED_AT=datetime.utcnow(),
        SOURCE=source,
        SENTIMENT_POSITIVE=sentiment_counts["positive"],
        SENTIMENT_NEUTRAL=sentiment_counts["neutral"],
        SENTIMENT_NEGATIVE=sentiment_counts["negative"],
        LLM_SUMMARY=llm_summary,
        REVIEW_COUNT=len(reviews),
        REVIEWS_JSON=reviews
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis

def insert_company_review(
    db: Session,
    company_id: int,
    user_id: int,
    firm_id: int,
    reviewer_name: Optional[str] = None,
    rating: Optional[float] = None,
    review_text: str = '',
    review_date: Optional[str] = None,
    sentiment: str = '',
    polarity: float = 0.0,
    source: str = 'GOOGLE'
):
    from datetime import datetime
    review = COMPANY_REVIEWS(
        COMPANY_ID=company_id,
        USERID=user_id,
        FIRMID=firm_id,
        REVIEWER_NAME=reviewer_name,
        RATING=rating,
        REVIEW_TEXT=review_text,
        REVIEW_DATE=review_date,
        SENTIMENT=sentiment,
        POLARITY=polarity,
        INSERTED_AT=datetime.utcnow(),
        SOURCE=source
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    print(f"[DB] Inserting review for company_id={company_id}, user_id={user_id}, firm_id={firm_id}, sentiment={sentiment}, polarity={polarity}")
    return review 

def get_recent_reviews(db: Session, company_id: int, days: int = 2) -> List[COMPANY_REVIEWS]:
    """
    Get reviews for a company that were scraped within the last specified days.
    
    Args:
        db: Database session
        company_id: The company ID to search for
        days: Number of days to look back (default: 2)
    
    Returns:
        List of COMPANY_REVIEWS objects
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    recent_reviews = db.query(COMPANY_REVIEWS).filter(
        COMPANY_REVIEWS.COMPANY_ID == company_id,
        COMPANY_REVIEWS.INSERTED_AT >= cutoff_date,
        COMPANY_REVIEWS.SOURCE == 'GOOGLE'
    ).all()
    
    print(f"[DB] Found {len(recent_reviews)} reviews for company_id={company_id} within last {days} days")
    return recent_reviews

def get_recent_analysis(db: Session, company_id: int, days: int = 2) -> Optional[COMPANY_ANALYSIS]:
    """
    Get the most recent analysis for a company within the specified days.
    
    Args:
        db: Database session
        company_id: The company ID to search for
        days: Number of days to look back (default: 2)
    
    Returns:
        COMPANY_ANALYSIS object or None
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    recent_analysis = db.query(COMPANY_ANALYSIS).filter(
        COMPANY_ANALYSIS.COMPANY_ID == company_id,
        COMPANY_ANALYSIS.ANALYZED_AT >= cutoff_date,
        COMPANY_ANALYSIS.SOURCE == 'GOOGLE'
    ).order_by(COMPANY_ANALYSIS.ANALYZED_AT.desc()).first()
    
    if recent_analysis:
        print(f"[DB] Found recent analysis for company_id={company_id} from {recent_analysis.ANALYZED_AT}")
    else:
        print(f"[DB] No recent analysis found for company_id={company_id} within last {days} days")
    
    return recent_analysis 