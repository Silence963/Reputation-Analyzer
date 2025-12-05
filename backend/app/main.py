import logging
logging.getLogger("asyncio").setLevel(logging.ERROR)

from fastapi import FastAPI, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import text
from .database import get_db
from .scrapers.google import get_google_reviews
from .nlp.sentiment import analyze_sentiment
from .crud import save_company_analysis, insert_company_review, get_recent_reviews, get_recent_analysis
from .models import KF_VENDOR
from .constants.platforms import get_platform_display_name, get_platform_info
from .response_generator import analyze_review_for_response, detect_business_type
import requests
import json
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for API key management
class APIKeyRequest(BaseModel):
    USERID: str
    FIRMID: str
    LLM_PROVIDER_TYPE: str
    LLM_PROVIDER: str
    API_KEY: str

class ToggleStatusRequest(BaseModel):
    id: int
    userid: int  # Changed from str to int
    firmid: int  # Changed from str to int
    provider_type: str
    action: str

@app.get("/companies")
def list_companies(city: str = Query(None), category: str = Query(None), search: str = Query(None), db: Session = Depends(get_db)):
    query = db.query(KF_VENDOR)
    if city:
        query = query.filter(KF_VENDOR.CITY.ilike(f"%{city}%"))
    if category:
        query = query.filter(KF_VENDOR.CATEGORY_ID == category)
    if search:
        query = query.filter(KF_VENDOR.COMPANY_NAME.ilike(f"%{search}%"))
    return query.all()

@app.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT CONFIG_ID, CFG_PRNT_CD FROM kf_doc_config WHERE DOC_CATEGRY_ID=122"))
    return [dict(row) for row in result]

# API Key Management Endpoints for LLM_DETAILS table
@app.post("/add-llm-provider")
def add_llm_provider(request: APIKeyRequest, db: Session = Depends(get_db)):
    """Add or update an LLM provider in LLM_DETAILS table"""
    try:
        # Check if record exists
        existing = db.execute(
            text("""
            SELECT ID FROM LLM_DETAILS 
            WHERE USERID = :userid AND FIRMID = :firmid 
            AND LLM_PROVIDER_TYPE = :provider_type AND LLM_PROVIDER = :provider
            """),
            {
                "userid": request.USERID,
                "firmid": request.FIRMID,
                "provider_type": request.LLM_PROVIDER_TYPE,
                "provider": request.LLM_PROVIDER
            }
        ).fetchone()
        
        if existing:
            # Update existing record
            db.execute(
                text("""
                UPDATE LLM_DETAILS 
                SET API_KEY = :api_key, UPD_DTM = NOW(), STATUS = 'ACTIVE'
                WHERE ID = :id
                """),
                {
                    "api_key": request.API_KEY,
                    "id": existing.ID
                }
            )
            
            # Deactivate other providers of the same type for this user/firm
            db.execute(
                text("""
                UPDATE LLM_DETAILS 
                SET STATUS = 'INACTIVE'
                WHERE USERID = :userid AND FIRMID = :firmid 
                AND LLM_PROVIDER_TYPE = :provider_type AND ID != :id
                """),
                {
                    "userid": request.USERID,
                    "firmid": request.FIRMID,
                    "provider_type": request.LLM_PROVIDER_TYPE,
                    "id": existing.ID
                }
            )
        else:
            # Create new record
            db.execute(
                text("""
                INSERT INTO LLM_DETAILS 
                (USERID, FIRMID, LLM_PROVIDER_TYPE, LLM_PROVIDER, API_KEY, STATUS, INSRT_DTM, UPD_DTM)
                VALUES (:userid, :firmid, :provider_type, :provider, :api_key, 'ACTIVE', NOW(), NOW())
                """),
                {
                    "userid": request.USERID,
                    "firmid": request.FIRMID,
                    "provider_type": request.LLM_PROVIDER_TYPE,
                    "provider": request.LLM_PROVIDER,
                    "api_key": request.API_KEY
                }
            )
            
            # Deactivate other providers of the same type for this user/firm
            db.execute(
                text("""
                UPDATE LLM_DETAILS 
                SET STATUS = 'INACTIVE'
                WHERE USERID = :userid AND FIRMID = :firmid 
                AND LLM_PROVIDER_TYPE = :provider_type AND LLM_PROVIDER != :provider
                """),
                {
                    "userid": request.USERID,
                    "firmid": request.FIRMID,
                    "provider_type": request.LLM_PROVIDER_TYPE,
                    "provider": request.LLM_PROVIDER
                }
            )
        
        db.commit()
        return {"success": True, "message": "LLM provider added/updated successfully"}
    
    except Exception as e:
        db.rollback()
        print(f"Error adding LLM provider: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/llm-details")
def get_llm_details(userid: str = Query(...), firmid: str = Query(...), db: Session = Depends(get_db)):
    """Get all LLM provider configurations from LLM_DETAILS table"""
    try:
        result = db.execute(
            text("""
            SELECT ID, USERID, FIRMID, LLM_PROVIDER_TYPE, LLM_PROVIDER, API_KEY, STATUS, INSRT_DTM, UPD_DTM
            FROM LLM_DETAILS 
            WHERE USERID = :userid AND FIRMID = :firmid
            ORDER BY UPD_DTM DESC
            """),
            {"userid": int(userid), "firmid": int(firmid)}
        )
        
        records = []
        for row in result:
            records.append({
                "ID": row[0],
                "USERID": row[1], 
                "FIRMID": row[2],
                "LLM_PROVIDER_TYPE": row[3],
                "LLM_PROVIDER": row[4],
                "API_KEY": row[5],
                "STATUS": row[6],
                "INSRT_DTM": row[7].isoformat() if row[7] else None,
                "UPD_DTM": row[8].isoformat() if row[8] else None
            })
        
        return records
    
    except Exception as e:
        print(f"Error fetching LLM details: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/add-api-key")
def add_api_key(request: APIKeyRequest, db: Session = Depends(get_db)):
    """Add or update an API key for a user/firm/provider combination"""
    try:
        # Check if record exists
        existing = db.execute(
            text("""
            SELECT ID FROM LLM_DETAILS 
            WHERE USERID = :userid AND FIRMID = :firmid 
            AND LLM_PROVIDER_TYPE = :provider_type AND LLM_PROVIDER = :provider
            """),
            {
                "userid": int(request.USERID),
                "firmid": int(request.FIRMID),
                "provider_type": request.LLM_PROVIDER_TYPE,
                "provider": request.LLM_PROVIDER
            }
        ).fetchone()
        
        if existing:
            # Update existing record
            db.execute(
                text("""
                UPDATE LLM_DETAILS 
                SET API_KEY = :api_key, UPD_DTM = NOW(), STATUS = 'ACTIVE'
                WHERE ID = :id
                """),
                {
                    "api_key": request.API_KEY,
                    "id": existing[0]
                }
            )
            
            # Deactivate other providers of the same type for this user/firm
            db.execute(
                text("""
                UPDATE LLM_DETAILS 
                SET STATUS = 'INACTIVE'
                WHERE USERID = :userid AND FIRMID = :firmid 
                AND LLM_PROVIDER_TYPE = :provider_type AND ID != :id
                """),
                {
                    "userid": int(request.USERID),
                    "firmid": int(request.FIRMID),
                    "provider_type": request.LLM_PROVIDER_TYPE,
                    "id": existing[0]
                }
            )
        else:
            # Create new record
            db.execute(
                text("""
                INSERT INTO LLM_DETAILS 
                (USERID, FIRMID, LLM_PROVIDER_TYPE, LLM_PROVIDER, API_KEY, STATUS, INSRT_DTM, UPD_DTM)
                VALUES (:userid, :firmid, :provider_type, :provider, :api_key, 'ACTIVE', NOW(), NOW())
                """),
                {
                    "userid": int(request.USERID),
                    "firmid": int(request.FIRMID),
                    "provider_type": request.LLM_PROVIDER_TYPE,
                    "provider": request.LLM_PROVIDER,
                    "api_key": request.API_KEY
                }
            )
            
            # Deactivate other providers of the same type for this user/firm
            db.execute(
                text("""
                UPDATE LLM_DETAILS 
                SET STATUS = 'INACTIVE'
                WHERE USERID = :userid AND FIRMID = :firmid 
                AND LLM_PROVIDER_TYPE = :provider_type AND LLM_PROVIDER != :provider
                """),
                {
                    "userid": int(request.USERID),
                    "firmid": int(request.FIRMID),
                    "provider_type": request.LLM_PROVIDER_TYPE,
                    "provider": request.LLM_PROVIDER
                }
            )
        
        db.commit()
        return {"success": True, "message": "API key added/updated successfully"}
    
    except Exception as e:
        db.rollback()
        print(f"Error adding API key: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/toggle-llm-status")
def toggle_llm_status(request: ToggleStatusRequest, db: Session = Depends(get_db)):
    """Toggle the status of an LLM provider in LLM_DETAILS table"""
    try:
        new_status = 'ACTIVE' if request.action == 'ACTIVATE' else 'INACTIVE'
        
        # Update the target record
        db.execute(
            text("""
            UPDATE LLM_DETAILS 
            SET STATUS = :status, UPD_DTM = NOW()
            WHERE ID = :id
            """),
            {"status": new_status, "id": request.id}
        )
        
        # If activating, deactivate other providers of the same type
        if request.action == 'ACTIVATE':
            db.execute(
                text("""
                UPDATE LLM_DETAILS 
                SET STATUS = 'INACTIVE'
                WHERE USERID = :userid AND FIRMID = :firmid 
                AND LLM_PROVIDER_TYPE = :provider_type AND ID != :id
                """),
                {
                    "userid": request.userid,
                    "firmid": request.firmid,
                    "provider_type": request.provider_type,
                    "id": request.id
                }
            )
        
        db.commit()
        return {"success": True, "newStatus": new_status}
    
    except Exception as e:
        db.rollback()
        print(f"Error toggling LLM status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def get_active_llm_provider(db: Session, user_id: int = 1481, firm_id: int = 2):
    """Get the active LLM provider configuration for text generation"""
    try:
        print(f"[DEBUG] Looking for active LLM provider for user_id={user_id}, firm_id={firm_id}")
        
        # First, let's check all providers for this user/firm
        all_providers = db.execute(
            text("""
            SELECT LLM_PROVIDER, LLM_PROVIDER_TYPE, STATUS, API_KEY
            FROM LLM_DETAILS 
            WHERE USERID = :userid AND FIRMID = :firmid
            """),
            {"userid": user_id, "firmid": firm_id}
        ).fetchall()
        
        print(f"[DEBUG] Found {len(all_providers)} total providers for user {user_id}, firm {firm_id}")
        for provider in all_providers:
            print(f"[DEBUG] Provider: {provider.LLM_PROVIDER}, Type: {provider.LLM_PROVIDER_TYPE}, Status: {provider.STATUS}")
        
        # Now look for active TEXT-TO-TEXT provider
        result = db.execute(
            text("""
            SELECT LLM_PROVIDER, API_KEY 
            FROM LLM_DETAILS 
            WHERE USERID = :userid AND FIRMID = :firmid 
            AND LLM_PROVIDER_TYPE = 'TEXT-TO-TEXT' AND STATUS = 'ACTIVE'
            LIMIT 1
            """),
            {"userid": user_id, "firmid": firm_id}
        ).fetchone()
        
        if result:
            print(f"[DEBUG] Found active TEXT-TO-TEXT provider: {result.LLM_PROVIDER}")
            return {"provider": result.LLM_PROVIDER, "api_key": result.API_KEY}
        else:
            print(f"[DEBUG] No active TEXT-TO-TEXT provider found")
            # Check if there are any TEXT-TO-TEXT providers at all (even inactive)
            text_providers = db.execute(
                text("""
                SELECT LLM_PROVIDER, STATUS
                FROM LLM_DETAILS 
                WHERE USERID = :userid AND FIRMID = :firmid 
                AND LLM_PROVIDER_TYPE = 'TEXT-TO-TEXT'
                """),
                {"userid": user_id, "firmid": firm_id}
            ).fetchall()
            print(f"[DEBUG] TEXT-TO-TEXT providers found: {[(p.LLM_PROVIDER, p.STATUS) for p in text_providers]}")
            return None
    except Exception as e:
        print(f"[ERROR] Error getting active LLM provider: {e}")
        import traceback
        traceback.print_exc()
        return None

def get_llm_summary(positive, neutral, negative, db=None):
    """Generate LLM summary using the active provider"""
    # Check if database is available
    if not db:
        print("[LLM] No database connection available - cannot generate summary")
        return "AI summary unavailable: No database connection"
    
    # Get active provider from API manager
    llm_config = get_active_llm_provider(db, user_id=1481, firm_id=2)
    if not llm_config:
        print("[LLM] No active LLM provider configured - please configure one in API manager")
        return "AI summary unavailable: No LLM provider configured. Please set up an API key in the API manager."
    
    provider = llm_config["provider"]
    api_key = llm_config["api_key"]
    print(f"[LLM] Using configured provider: {provider}")
    print(f"[LLM] Processing {len(positive)} positive, {len(neutral)} neutral, {len(negative)} negative reviews")
    
    def review_lines(reviews):
        # Format: [date] text
        lines = []
        for r in reviews[:10]:
            date = r.get("review_date") or r.get("date") or "Unknown date"
            text = r.get("text") or ""
            lines.append(f"[{date}] {text}")
        return lines

    prompt = (
        "You are a world-class reputation strategist and business analyst with years of experience in brand management and crisis response. "
        "Given the following customer reviews (with their posting dates), analyze the company's reputation trends over time. "
        "Identify periods of improvement or decline, and provide actionable, time-aware recommendations.\n"
        "\nYour summary must include:\n"
        "- An executive summary of overall customer sentiment and how it has changed over time.\n"
        "- Key positive, negative, and neutral themes, with examples and their posting dates.\n"
        "- A timeline or commentary on when reputation was best or worst, and possible reasons.\n"
        "- Actionable, time-sensitive recommendations for the business.\n"
        "\nFormat your response with clear section headers: EXECUTIVE SUMMARY, REPUTATION TIMELINE, POSITIVE THEMES, NEGATIVE THEMES, NEUTRAL THEMES, RECOMMENDATIONS.\n\n"
        "POSITIVE REVIEWS (with dates):\n" + "\n".join(review_lines(positive)) + "\n\n"
        "NEUTRAL REVIEWS (with dates):\n" + "\n".join(review_lines(neutral)) + "\n\n"
        "NEGATIVE REVIEWS (with dates):\n" + "\n".join(review_lines(negative))
    )
    
    # Provider-specific configurations
    if provider == "GROQ":
        endpoint = "https://api.groq.com/openai/v1/chat/completions"
        model = "llama-3.1-8b-instant"
    elif provider == "OPENROUTER":
        endpoint = "https://openrouter.ai/api/v1/chat/completions"
        model = "meta-llama/llama-3.1-8b-instruct:free"
    elif provider == "DEEPSEEK":
        endpoint = "https://api.deepseek.com/chat/completions"
        model = "deepseek-chat"
    elif provider == "MISTRAL":
        endpoint = "https://api.mistral.ai/v1/chat/completions"
        model = "mistral-small-latest"
    elif provider == "TOGETHER":
        endpoint = "https://api.together.xyz/v1/chat/completions"
        model = "meta-llama/Llama-3.1-8B-Instruct-Turbo"
    elif provider == "TOGETHER_AI":
        endpoint = "https://api.together.xyz/v1/chat/completions"
        model = "meta-llama/Llama-3.1-8B-Instruct-Turbo"
    elif provider == "OPENAI_GPT4":
        endpoint = "https://api.openai.com/v1/chat/completions"
        model = "gpt-4o-mini"
    elif provider == "CLAUDE":
        endpoint = "https://api.anthropic.com/v1/messages"
        model = "claude-3-haiku-20240307"
    elif provider == "GEMINI":
        endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
        model = "gemini-1.5-flash"
    elif provider == "OLLAMA":
        endpoint = "http://localhost:11434/api/generate"
        model = "llama3.1"
    elif provider == "COHERE":
        endpoint = "https://api.cohere.ai/v1/generate"
        model = "command"
    elif provider == "HUGGINGFACE":
        endpoint = "https://api-inference.huggingface.co/models/microsoft/DialoGPT-large"
        model = "microsoft/DialoGPT-large"
    elif provider == "GPT2":
        endpoint = "https://api-inference.huggingface.co/models/gpt2"
        model = "gpt2"
    elif provider == "LLAMA3.2":
        endpoint = "https://api-inference.huggingface.co/models/meta-llama/Llama-3.2-3B-Instruct"
        model = "meta-llama/Llama-3.2-3B-Instruct"
    elif provider == "REPLICATE":
        endpoint = "https://api.replicate.com/v1/predictions"
        model = "meta/llama-2-70b-chat"
    else:
        print(f"[ERROR] Unsupported provider: {provider}")
        return f"AI summary failed: Unsupported provider '{provider}'. Please configure a supported provider in the API manager."
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    # Handle different API formats
    headers = {"Content-Type": "application/json"}
    
    if provider == "GEMINI":
        # Gemini uses a different API format
        headers["x-goog-api-key"] = api_key
        data = {
            "contents": [{
                "parts": [{
                    "text": f"You are a helpful assistant that summarizes customer reviews for business reputation analysis.\n\n{prompt}"
                }]
            }],
            "generationConfig": {
                "maxOutputTokens": 512,
                "temperature": 0.7
            }
        }
    elif provider == "CLAUDE":
        # Claude uses a different format
        headers["x-api-key"] = api_key
        headers["anthropic-version"] = "2023-06-01"
        data = {
            "model": model,
            "max_tokens": 512,
            "messages": [{"role": "user", "content": prompt}]
        }
    elif provider == "COHERE":
        # Cohere uses a different format
        headers["Authorization"] = f"Bearer {api_key}"
        data = {
            "model": model,
            "prompt": f"You are a helpful assistant that summarizes customer reviews for business reputation analysis.\n\n{prompt}",
            "max_tokens": 512,
            "temperature": 0.7
        }
    elif provider in ["HUGGINGFACE", "GPT2", "LLAMA3.2"]:
        # HuggingFace Inference API
        headers["Authorization"] = f"Bearer {api_key}"
        data = {
            "inputs": f"You are a helpful assistant that summarizes customer reviews for business reputation analysis.\n\n{prompt}",
            "parameters": {
                "max_length": 512,
                "temperature": 0.7,
                "return_full_text": False
            }
        }
    elif provider == "OLLAMA":
        # Ollama local server (no API key needed)
        data = {
            "model": model,
            "prompt": f"You are a helpful assistant that summarizes customer reviews for business reputation analysis.\n\n{prompt}",
            "stream": False
        }
    elif provider == "REPLICATE":
        # Replicate uses a different format
        headers["Authorization"] = f"Token {api_key}"
        data = {
            "version": "02e509c789964a7ea8736978a43525956ef40397be9033abf9fd2badfe68c9e3",
            "input": {
                "prompt": f"You are a helpful assistant that summarizes customer reviews for business reputation analysis.\n\n{prompt}",
                "max_length": 512,
                "temperature": 0.7
            }
        }
    else:
        # Standard OpenAI-compatible format (GROQ, OPENROUTER, DEEPSEEK, MISTRAL, TOGETHER, OPENAI)
        headers["Authorization"] = f"Bearer {api_key}"
        data = {
            "model": model,
            "messages": [
                {"role": "system", "content": "You are a helpful assistant that summarizes customer reviews for business reputation analysis."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 512,
            "temperature": 0.7
        }
    
    try:
        print(f"[LLM] Making API request to {endpoint}")
        response = requests.post(endpoint, headers=headers, json=data, timeout=60)
        response.raise_for_status()
        result = response.json()
        
        # Handle different response formats
        if provider == "GEMINI":
            summary = result["candidates"][0]["content"]["parts"][0]["text"]
        elif provider == "CLAUDE":
            summary = result["content"][0]["text"]
        elif provider == "COHERE":
            summary = result["generations"][0]["text"]
        elif provider in ["HUGGINGFACE", "GPT2", "LLAMA3.2"]:
            # HuggingFace returns an array
            if isinstance(result, list) and len(result) > 0:
                summary = result[0].get("generated_text", str(result))
            else:
                summary = str(result)
        elif provider == "OLLAMA":
            summary = result["response"]
        elif provider == "REPLICATE":
            # Replicate returns a prediction object, we need to poll for completion
            prediction_url = result["urls"]["get"]
            import time
            for _ in range(30):  # Wait up to 30 seconds
                time.sleep(1)
                poll_response = requests.get(prediction_url, headers=headers)
                poll_result = poll_response.json()
                if poll_result["status"] == "succeeded":
                    summary = "".join(poll_result["output"])
                    break
                elif poll_result["status"] == "failed":
                    raise Exception(f"Replicate prediction failed: {poll_result.get('error', 'Unknown error')}")
            else:
                raise Exception("Replicate prediction timed out")
        else:
            # Standard OpenAI-compatible format
            summary = result["choices"][0]["message"]["content"]
            
        print(f"[LLM] Summary generated successfully using {provider}. Length: {len(summary)} characters")
        return summary
        
    except requests.exceptions.HTTPError as e:
        error_detail = ""
        try:
            error_detail = f" - {e.response.json()}"
        except:
            error_detail = f" - {e.response.text}"
        print(f"[LLM] HTTP Error with {provider}: {e}{error_detail}")
        return f"AI summary failed: {e}{error_detail}. Please check your API key configuration in the API manager."
    except Exception as e:
        print(f"[LLM] Error with {provider}: {e}")
        return f"AI summary failed: {str(e)}. Please check your API key configuration in the API manager."

def insert_notification(db, company_id, noti_text, alert_type="NEGATIVE_REVIEW_ALERT"):
    priority = 10 if alert_type.upper() == "NEGATIVE" else 1
    db.execute(
        text("""
        INSERT INTO MOB_NOTIFICATIONS (USER_ID, NOTI_TEXT, CREATED_AT, STATUS, NOTIFICATION_TYPE, NOTIFICATION_PRIORITY, COMPANY_ID, ALERT_TYPE, VOICE_FILE_URL, DESCRIPTION)
        VALUES (:user_id, :noti_text, NOW(), :status, :noti_type, :priority, :company_id, :alert_type, :voice_file_url, :description)
        """),
        {
            "user_id": 1,
            "noti_text": noti_text,
            "status": "SUCCESS",
            "noti_type": "REPA",
            "priority": priority,
            "company_id": company_id,
            "alert_type": alert_type,
            "voice_file_url": "",
            "description": ""
        }
    )
    db.commit()

def save_analysis_report(db, company_id, source, sentiment_counts, llm_summary, reviews_json):
    import json
    print(f"[DEBUG] Type of reviews_json: {type(reviews_json)}")
    if not isinstance(reviews_json, str):
        reviews_json = json.dumps(reviews_json)
    reviews_list = json.loads(reviews_json)
    db.execute(
        text("""
        INSERT INTO company_analysis
        (company_id, analyzed_at, source, sentiment_positive, sentiment_neutral, sentiment_negative, llm_summary, review_count, reviews_json)
        VALUES (:company_id, NOW(), :source, :positive, :neutral, :negative, :llm_summary, :review_count, :reviews_json)
        """),
        {
            "company_id": company_id,
            "source": source,
            "positive": sentiment_counts["positive"],
            "neutral": sentiment_counts["neutral"],
            "negative": sentiment_counts["negative"],
            "llm_summary": llm_summary,
            "review_count": len(reviews_list),
            "reviews_json": reviews_json
        }
    )
    db.execute(
        text("""
        INSERT INTO analysis_documents (company_id, doc_type, title, content)
        VALUES (:company_id, :doc_type, :title, :content)
        """),
        {
            "company_id": company_id,
            "doc_type": "sentiment_report",
            "title": f"Sentiment Analysis Report - {source.title()} - {datetime.now().date()}",
            "content": json.dumps({
                "summary": llm_summary,
                "sentiment": sentiment_counts,
                "details": reviews_list
            })
        }
    )
    db.commit()

@app.get("/companies/{company_id}")
def get_company_details(company_id: int, db: Session = Depends(get_db)):
    """Get detailed information about a specific company"""
    company = db.query(KF_VENDOR).filter(KF_VENDOR.VEND_ID == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Get all attributes of the company object
    company_data = {}
    for column in KF_VENDOR.__table__.columns:
        company_data[column.name] = getattr(company, column.name)
    
    return {
        "company_id": company_id,
        "data": company_data,
        "available_fields": list(company_data.keys()),
        "company_name_status": {
            "COMPANY_NAME": company_data.get("COMPANY_NAME"),
            "is_null": company_data.get("COMPANY_NAME") is None,
            "is_empty": company_data.get("COMPANY_NAME") == "" if company_data.get("COMPANY_NAME") is not None else False
        }
    }

from fastapi import Request

@app.post("/analyze/google/")
def analyze_google_reviews(company_id: int, request: Request, db: Session = Depends(get_db)):
    # Allow force refresh via query param or POST body
    force_refresh = False
    try:
        data = request.query_params or {}
        if "force_refresh" in data and str(data["force_refresh"]).lower() in ("1", "true", "yes"): 
            force_refresh = True
    except Exception:
        pass
    try:
        body = request._json if hasattr(request, '_json') else None
        if body and "force_refresh" in body and str(body["force_refresh"]).lower() in ("1", "true", "yes"):
            force_refresh = True
    except Exception:
        pass
    print(f"[INFO] Looking up company info for company_id={company_id}")
    company = db.query(KF_VENDOR).filter(KF_VENDOR.VEND_ID == company_id).first()
    if not company:
        print(f"[ERROR] Company with ID {company_id} not found in KF_VENDOR.")
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Check if company name is available
    company_name = company.VEND_TITL  # Use VEND_TITL instead of COMPANY_NAME
    company_address = company.VEND_CON_ADDR  # Get company address
    
    if not company_name or company_name.strip() == "":
        print(f"[ERROR] Company with ID {company_id} has no company title set")
        # Try fallback to COMPANY_NAME if VEND_TITL is empty
        company_name = company.COMPANY_NAME or f"Company_{company_id}"
        print(f"[INFO] Using fallback name: {company_name}")
    
    print(f"[INFO] Found company: {company_name}")
    
    # Detect business type for personalized responses
    company_description = getattr(company, 'VEND_DESC', '') or ""
    business_type = detect_business_type(company_name, company_description)
    print(f"[INFO] Detected business type: {business_type}")
    
    # Check for existing reviews scraped within the last 2 days, unless force_refresh is set
    print(f"[INFO] Checking for recent reviews within last 2 days... (force_refresh={force_refresh})")
    recent_reviews = get_recent_reviews(db, company_id, days=2) if not force_refresh else []
    recent_analysis = get_recent_analysis(db, company_id, days=2) if not force_refresh else None
    
    if recent_reviews and len(recent_reviews) > 0:
        print(f"[INFO] Found {len(recent_reviews)} recent reviews. Using existing data instead of scraping.")
        
        # Convert existing reviews to the format expected by the rest of the function
        reviews = []
        sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
        
        for review in recent_reviews:
            review_data = {
                "text": review.REVIEW_TEXT,
                "sentiment": review.SENTIMENT,
                "polarity": review.POLARITY,
                "reviewer_name": review.REVIEWER_NAME,
                "rating": review.RATING,
                "review_date": review.REVIEW_DATE,
                "collected_at": review.INSERTED_AT.isoformat() if review.INSERTED_AT else None,
                "platform": get_platform_display_name(review.SOURCE),
                "source": review.SOURCE
            }
            
            # Generate response suggestions and recommendations
            response_analysis = analyze_review_for_response(
                review_data, company_name, company_description, business_type
            )
            review_data.update(response_analysis)
            
            reviews.append(review_data)
            sentiment_counts[review.SENTIMENT] += 1
        
        print(f"[INFO] Using {len(reviews)} existing reviews. Sentiment distribution: {sentiment_counts}")
        
        # If we have a recent analysis with LLM summary, use that too
        if recent_analysis and recent_analysis.LLM_SUMMARY:
            print(f"[INFO] Using existing LLM summary from {recent_analysis.ANALYZED_AT}")
            llm_summary = recent_analysis.LLM_SUMMARY
        else:
            print(f"[INFO] No recent LLM summary found. Generating new summary from existing reviews...")
            positive = [r for r in reviews if r["sentiment"] == "positive"]
            neutral = [r for r in reviews if r["sentiment"] == "neutral"]
            negative = [r for r in reviews if r["sentiment"] == "negative"]
            
            try:
                llm_summary = get_llm_summary(positive, neutral, negative, db)
                print(f"[INFO] New LLM summary generated successfully. Length: {len(llm_summary)} characters")
            except Exception as e:
                print(f"[ERROR] LLM summary failed: {e}")
                llm_summary = f"AI summary failed: {str(e)}. Please check your API key configuration in the API manager."
        
    else:
        print(f"[INFO] No recent reviews found. Proceeding with scraping...")
        if company_address and company_address.strip():
            print(f"[INFO] Company address: {company_address}")
            print(f"[INFO] Scraping Google reviews for '{company_name}' at '{company_address}'...")
        else:
            print(f"[INFO] No address available, scraping for '{company_name}' only...")
            print(f"[INFO] Scraping Google reviews for '{company_name}'...")
        
        try:
            raw_reviews = get_google_reviews(company, max_reviews=150, include_meta=True)
        except Exception as e:
            print(f"[ERROR] Scraping failed: {e}")
            return {"error": "Failed to scrape reviews."}
        
        print(f"[INFO] {len(raw_reviews)} reviews scraped. Analyzing sentiment...")
        reviews = []
        sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
        
        for review_data in raw_reviews:
            # Handle both old format (string) and new format (dict with metadata)
            if isinstance(review_data, dict):
                text = review_data.get("text", "")
                reviewer_name = review_data.get("reviewer", None)
                rating = review_data.get("rating", None)
                review_date = review_data.get("date", None)
            else:
                # Backward compatibility for string format
                text = review_data
                reviewer_name = None
                rating = None
                review_date = None
            
            if not text or text.strip() == "":
                continue  # Skip empty reviews
                
            sentiment, polarity = analyze_sentiment(text)
            
            # Create review data structure
            review_entry = {
                "text": text, 
                "sentiment": sentiment, 
                "polarity": polarity,
                "reviewer_name": reviewer_name,
                "rating": rating,
                "review_date": review_date,
                "collected_at": datetime.utcnow().isoformat(),
                "platform": get_platform_display_name("GOOGLE"),
                "source": "GOOGLE"
            }
            
            # Generate response suggestions and recommendations
            response_analysis = analyze_review_for_response(
                review_entry, company_name, company_description, business_type
            )
            review_entry.update(response_analysis)
            
            reviews.append(review_entry)
            sentiment_counts[sentiment] += 1
            
            # Insert into COMPANY_REVIEWS with all metadata
            insert_company_review(
                db=db,
                company_id=company_id,
                user_id=1,
                firm_id=1,
                reviewer_name=reviewer_name,
                rating=rating,
                review_text=text,
                review_date=review_date,
                sentiment=sentiment,
                polarity=polarity,
                source="GOOGLE"
            )
            
            # Insert notification for each review
            insert_notification(
                db=db,
                company_id=company_id,
                noti_text=f"New review inserted with sentiment: {sentiment}",
                alert_type=sentiment.upper()
            )
        
        positive = [r for r in reviews if r["sentiment"] == "positive"]
        neutral = [r for r in reviews if r["sentiment"] == "neutral"]
        negative = [r for r in reviews if r["sentiment"] == "negative"]
        
        print("[INFO] Generating LLM summary...")
        try:
            llm_summary = get_llm_summary(positive, neutral, negative, db)
            print(f"[INFO] LLM summary generated successfully. Length: {len(llm_summary)} characters")
        except Exception as e:
            print(f"[ERROR] LLM summary failed: {e}")
            llm_summary = f"AI summary failed: {str(e)}. Please check your API key configuration in the API manager."
    
    # Common processing for both existing and new reviews
    positive = [r for r in reviews if r["sentiment"] == "positive"]
    neutral = [r for r in reviews if r["sentiment"] == "neutral"]
    negative = [r for r in reviews if r["sentiment"] == "negative"]
    
    top_reviews = {
        "positive": positive[:5],
        "neutral": neutral[:5],
        "negative": negative[:5],
    }
    
    chart_data = [
        {"sentiment": "positive", "count": sentiment_counts["positive"]},
        {"sentiment": "neutral", "count": sentiment_counts["neutral"]},
        {"sentiment": "negative", "count": sentiment_counts["negative"]},
    ]
    
    print(f"[INFO] Analysis complete. Returning results.")
    
    # Calculate collection timeframe and platform breakdown
    collection_dates = [r.get("collected_at") for r in reviews if r.get("collected_at")]
    earliest_collection = min(collection_dates) if collection_dates else None
    latest_collection = max(collection_dates) if collection_dates else None
    
    # Get platform breakdown
    platform_counts = {}
    for review in reviews:
        platform = review.get("platform", "Unknown")
        platform_counts[platform] = platform_counts.get(platform, 0) + 1
    
    # Generate overall business insights
    negative_reviews = [r for r in reviews if r["sentiment"] == "negative"]
    high_priority_issues = []
    common_negative_issues = []
    
    if negative_reviews:
        # Collect all identified issues from negative reviews
        all_issues = []
        for review in negative_reviews:
            issues = review.get("identified_issues", [])
            all_issues.extend(issues)
        
        # Count issue frequency
        issue_counts = {}
        for issue in all_issues:
            issue_counts[issue] = issue_counts.get(issue, 0) + 1
        
        # Get most common issues
        common_negative_issues = sorted(issue_counts.items(), key=lambda x: x[1], reverse=True)[:3]
        high_priority_issues = [issue for issue, count in common_negative_issues if count >= 2]
    
    return {
        "company_id": company_id,
        "company_name": company_name,  # Use the processed company name (VEND_TITL)
        "sentiment_counts": sentiment_counts,
        "chart_data": chart_data,
        "top_reviews": top_reviews,
        "llm_summary": llm_summary,
        "reviews": reviews,
        "source": "google",
        "analysis_metadata": {
            "analyzed_at": datetime.utcnow().isoformat(),
            "total_reviews": len(reviews),
            "platforms": platform_counts,
            "primary_platform": get_platform_display_name("GOOGLE"),
            "business_type": business_type,
            "collection_period": {
                "earliest": earliest_collection,
                "latest": latest_collection
            },
            "using_cached_data": len(recent_reviews) > 0 if recent_reviews else False,
            "business_insights": {
                "high_priority_issues": high_priority_issues,
                "common_issues": [{"issue": issue.replace("_", " "), "frequency": count} for issue, count in common_negative_issues],
                "negative_review_count": len(negative_reviews),
                "needs_immediate_attention": len(high_priority_issues) > 0
            }
        }
    }