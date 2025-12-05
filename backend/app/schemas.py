from pydantic import BaseModel
from typing import List

class Review(BaseModel):
    text: str
    sentiment: str  # "positive", "neutral", "negative"
    polarity: float

class CompanyAnalysisCreate(BaseModel):
    company_id: int
    source: str
    reviews: List[Review] 