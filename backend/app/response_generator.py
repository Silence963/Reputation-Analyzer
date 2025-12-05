"""
Review Response and Recommendation Generator

This module generates personalized responses to reviews and provides actionable
recommendations for business improvement based on review content and sentiment.
"""

import re
import random
from typing import Dict, List, Tuple, Optional
from datetime import datetime

# Business type categories for tailored responses
BUSINESS_TYPES = {
    "restaurant": {
        "name": "Restaurant/Food Service",
        "keywords": ["food", "meal", "service", "waiter", "chef", "menu", "taste", "kitchen"],
        "common_issues": ["food quality", "service speed", "cleanliness", "staff attitude", "pricing"]
    },
    "retail": {
        "name": "Retail/Shopping",
        "keywords": ["product", "price", "staff", "store", "shopping", "quality", "return"],
        "common_issues": ["product quality", "customer service", "pricing", "store cleanliness", "stock availability"]
    },
    "hotel": {
        "name": "Hotel/Hospitality",
        "keywords": ["room", "stay", "hotel", "bed", "clean", "front desk", "amenities"],
        "common_issues": ["room cleanliness", "staff service", "amenities", "noise", "booking issues"]
    },
    "healthcare": {
        "name": "Healthcare",
        "keywords": ["doctor", "appointment", "treatment", "staff", "waiting", "care"],
        "common_issues": ["wait times", "staff professionalism", "facility cleanliness", "communication", "appointment scheduling"]
    },
    "automotive": {
        "name": "Automotive",
        "keywords": ["car", "service", "repair", "mechanic", "price", "quality"],
        "common_issues": ["service quality", "pricing transparency", "communication", "timeliness", "expertise"]
    },
    "general": {
        "name": "General Business",
        "keywords": [],
        "common_issues": ["customer service", "quality", "pricing", "communication", "professionalism"]
    }
}

# Response templates for different sentiment types
RESPONSE_TEMPLATES = {
    "positive": {
        "gratitude": [
            "Thank you so much for taking the time to share your wonderful experience! We're thrilled that you enjoyed {specific_aspect}.",
            "We're absolutely delighted to hear about your positive experience! Your kind words about {specific_aspect} mean the world to us.",
            "What a fantastic review! We're so grateful for your feedback about {specific_aspect} and for choosing us.",
            "Thank you for this amazing review! It's customers like you who make what we do so rewarding.",
            "We're over the moon to read your review! Thank you for highlighting {specific_aspect}."
        ],
        "appreciation": [
            "Your support means everything to our team, and we can't wait to welcome you back soon!",
            "We truly appreciate your business and look forward to serving you again!",
            "Thank you for being such a valued customer. We're here whenever you need us!",
            "Your loyalty and support help us continue to improve and grow. Thank you!",
            "We're honored to have earned your recommendation and trust."
        ]
    },
    "neutral": {
        "acknowledgment": [
            "Thank you for taking the time to share your feedback with us.",
            "We appreciate you sharing your experience and providing us with your honest feedback.",
            "Thank you for your review. Your input helps us understand how we're doing.",
            "We value your feedback and appreciate you taking the time to share your experience."
        ],
        "improvement": [
            "We're always working to improve our services and your feedback is valuable to us.",
            "Your comments help us identify areas where we can enhance our customer experience.",
            "We take all feedback seriously as it helps us serve our customers better.",
            "We're committed to continuous improvement and appreciate your perspective."
        ]
    },
    "negative": {
        "apology": [
            "We sincerely apologize that your experience didn't meet your expectations.",
            "We're truly sorry to hear about the issues you encountered during your visit.",
            "I want to personally apologize for the disappointment you experienced.",
            "We're genuinely sorry that we fell short of providing you with the service you deserve.",
            "Please accept our heartfelt apologies for the problems you faced."
        ],
        "accountability": [
            "We take full responsibility for {specific_issue} and understand your frustration.",
            "Your concerns about {specific_issue} are completely valid, and we own this mistake.",
            "We acknowledge that {specific_issue} is unacceptable and we're taking immediate action.",
            "You're absolutely right to be upset about {specific_issue}, and we're committed to fixing this."
        ],
        "resolution": [
            "We would love the opportunity to make this right. Please contact us directly so we can resolve this issue.",
            "We're taking immediate steps to address {specific_issue} and would appreciate the chance to discuss this further.",
            "Your feedback is helping us implement changes to prevent this from happening again.",
            "We're committed to turning your experience around and would welcome the opportunity to do better."
        ]
    }
}

# Action recommendation templates based on common issues
ACTION_RECOMMENDATIONS = {
    "food_quality": {
        "immediate": ["Review kitchen procedures and food preparation standards", "Conduct staff training on food quality control"],
        "short_term": ["Implement regular food quality audits", "Update menu items based on customer feedback"],
        "long_term": ["Consider sourcing higher quality ingredients", "Establish partnerships with reliable suppliers"]
    },
    "service_speed": {
        "immediate": ["Review current staffing levels during peak hours", "Optimize service workflow and procedures"],
        "short_term": ["Implement service time tracking system", "Provide additional staff training on efficiency"],
        "long_term": ["Consider technology solutions for faster service", "Expand staff during busy periods"]
    },
    "staff_attitude": {
        "immediate": ["Address specific staff behavior issues", "Conduct customer service refresher training"],
        "short_term": ["Implement customer service standards and monitoring", "Regular staff feedback and coaching sessions"],
        "long_term": ["Review hiring practices and customer service criteria", "Develop employee recognition and incentive programs"]
    },
    "cleanliness": {
        "immediate": ["Conduct immediate deep cleaning of affected areas", "Review and enforce cleaning schedules"],
        "short_term": ["Implement more frequent cleaning protocols", "Provide additional housekeeping staff training"],
        "long_term": ["Invest in better cleaning equipment and supplies", "Consider professional cleaning service partnerships"]
    },
    "pricing": {
        "immediate": ["Review pricing transparency and communication", "Ensure all costs are clearly displayed"],
        "short_term": ["Conduct market research on competitive pricing", "Consider value-added services to justify pricing"],
        "long_term": ["Develop pricing strategy based on value proposition", "Implement loyalty programs or discounts"]
    },
    "communication": {
        "immediate": ["Improve staff communication training", "Establish clear communication protocols"],
        "short_term": ["Implement customer communication standards", "Regular staff meetings to discuss customer feedback"],
        "long_term": ["Develop comprehensive customer communication strategy", "Invest in communication tools and systems"]
    },
    "wait_times": {
        "immediate": ["Review scheduling and appointment systems", "Optimize staff allocation during peak times"],
        "short_term": ["Implement wait time tracking and management", "Provide customers with accurate wait time estimates"],
        "long_term": ["Consider expanding capacity or operating hours", "Implement online booking and queue management systems"]
    }
}

def detect_business_type(company_name: str, company_description: str = "") -> str:
    """Detect business type based on company name and description."""
    text = f"{company_name} {company_description}".lower()
    
    # Score each business type based on keyword matches
    scores = {}
    for biz_type, config in BUSINESS_TYPES.items():
        if biz_type == "general":
            continue
        score = sum(1 for keyword in config["keywords"] if keyword in text)
        if score > 0:
            scores[biz_type] = score
    
    # Return the business type with the highest score, or general if no matches
    return max(scores, key=scores.get) if scores else "general"

def extract_specific_issues(review_text: str, business_type: str) -> List[str]:
    """Extract specific issues mentioned in the review."""
    review_lower = review_text.lower()
    issues = []
    
    # Common issue keywords mapping
    issue_keywords = {
        "food_quality": ["food", "taste", "quality", "fresh", "cold", "overcooked", "undercooked", "stale"],
        "service_speed": ["slow", "wait", "long time", "delay", "quick", "fast", "speed"],
        "staff_attitude": ["rude", "unfriendly", "attitude", "behavior", "polite", "helpful", "professional"],
        "cleanliness": ["dirty", "clean", "mess", "hygiene", "sanitize", "spotless"],
        "pricing": ["expensive", "price", "cost", "money", "value", "cheap", "overpriced"],
        "communication": ["explain", "told", "information", "communicate", "understand"],
        "wait_times": ["wait", "appointment", "time", "schedule", "delay", "on time"]
    }
    
    for issue, keywords in issue_keywords.items():
        if any(keyword in review_lower for keyword in keywords):
            issues.append(issue)
    
    return issues

def generate_personalized_response(
    review_text: str, 
    sentiment: str, 
    reviewer_name: str = None,
    business_type: str = "general",
    company_name: str = ""
) -> Dict[str, str]:
    """Generate a personalized response to a review."""
    
    # Extract specific aspects mentioned in positive reviews
    specific_aspects = []
    if sentiment == "positive":
        positive_keywords = ["service", "food", "staff", "experience", "quality", "atmosphere"]
        for keyword in positive_keywords:
            if keyword in review_text.lower():
                specific_aspects.append(keyword)
    
    # Extract specific issues for negative reviews
    specific_issues = []
    if sentiment == "negative":
        specific_issues = extract_specific_issues(review_text, business_type)
    
    # Build response
    response_parts = []
    
    # Greeting
    if reviewer_name:
        response_parts.append(f"Dear {reviewer_name},")
    
    # Main response based on sentiment
    if sentiment == "positive":
        # Gratitude
        gratitude = random.choice(RESPONSE_TEMPLATES["positive"]["gratitude"])
        aspect = specific_aspects[0] if specific_aspects else "your visit"
        response_parts.append(gratitude.format(specific_aspect=aspect))
        
        # Appreciation
        response_parts.append(random.choice(RESPONSE_TEMPLATES["positive"]["appreciation"]))
        
    elif sentiment == "negative":
        # Apology
        response_parts.append(random.choice(RESPONSE_TEMPLATES["negative"]["apology"]))
        
        # Accountability if specific issues identified
        if specific_issues:
            accountability = random.choice(RESPONSE_TEMPLATES["negative"]["accountability"])
            issue_desc = specific_issues[0].replace("_", " ")
            response_parts.append(accountability.format(specific_issue=issue_desc))
        
        # Resolution
        resolution = random.choice(RESPONSE_TEMPLATES["negative"]["resolution"])
        if specific_issues:
            issue_desc = specific_issues[0].replace("_", " ")
            response_parts.append(resolution.format(specific_issue=issue_desc))
        else:
            response_parts.append(resolution.format(specific_issue="these concerns"))
            
    else:  # neutral
        response_parts.append(random.choice(RESPONSE_TEMPLATES["neutral"]["acknowledgment"]))
        response_parts.append(random.choice(RESPONSE_TEMPLATES["neutral"]["improvement"]))
    
    # Closing
    if company_name:
        response_parts.append(f"\nBest regards,\nThe {company_name} Team")
    else:
        response_parts.append("\nBest regards,\nManagement")
    
    return {
        "suggested_response": " ".join(response_parts),
        "tone": "professional" if sentiment == "negative" else "friendly",
        "length": "standard"
    }

def generate_action_recommendations(
    review_text: str, 
    sentiment: str, 
    business_type: str = "general"
) -> Dict[str, List[str]]:
    """Generate actionable recommendations based on review content."""
    
    if sentiment != "negative":
        return {
            "immediate": ["Continue current excellent practices"],
            "short_term": ["Monitor feedback to maintain quality"],
            "long_term": ["Expand successful strategies"]
        }
    
    # Extract specific issues
    issues = extract_specific_issues(review_text, business_type)
    
    if not issues:
        # Generic recommendations for negative reviews without specific issues
        return {
            "immediate": ["Reach out to customer for detailed feedback", "Review recent service standards"],
            "short_term": ["Implement customer feedback tracking system", "Provide additional staff training"],
            "long_term": ["Develop comprehensive customer satisfaction program", "Regular service quality audits"]
        }
    
    # Combine recommendations for all identified issues
    recommendations = {"immediate": [], "short_term": [], "long_term": []}
    
    for issue in issues[:3]:  # Limit to top 3 issues to avoid overwhelming
        if issue in ACTION_RECOMMENDATIONS:
            for timeframe in recommendations.keys():
                recommendations[timeframe].extend(ACTION_RECOMMENDATIONS[issue][timeframe])
    
    # Remove duplicates while preserving order
    for timeframe in recommendations.keys():
        recommendations[timeframe] = list(dict.fromkeys(recommendations[timeframe]))
    
    return recommendations

def analyze_review_for_response(
    review_data: Dict,
    company_name: str = "",
    company_description: str = "",
    business_type: str = None
) -> Dict:
    """Complete analysis of a review to generate response and recommendations."""
    
    # Auto-detect business type if not provided
    if not business_type:
        business_type = detect_business_type(company_name, company_description)
    
    # Extract review details
    review_text = review_data.get("text", "")
    sentiment = review_data.get("sentiment", "neutral")
    reviewer_name = review_data.get("reviewer_name")
    
    # Generate response
    response_data = generate_personalized_response(
        review_text, sentiment, reviewer_name, business_type, company_name
    )
    
    # Generate recommendations
    recommendations = generate_action_recommendations(
        review_text, sentiment, business_type
    )
    
    # Extract key issues for display
    issues = extract_specific_issues(review_text, business_type) if sentiment == "negative" else []
    
    return {
        "response_suggestion": response_data,
        "action_recommendations": recommendations,
        "identified_issues": issues,
        "business_type": business_type,
        "priority_level": "high" if sentiment == "negative" else "medium" if sentiment == "neutral" else "low"
    }