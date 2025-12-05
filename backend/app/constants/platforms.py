# Platform configuration for multi-platform review analysis

PLATFORMS = {
    "GOOGLE": {
        "name": "Google Reviews",
        "display_name": "Google Reviews",
        "icon": "🔍",
        "code": "GOOGLE"
    },
    "FACEBOOK": {
        "name": "Facebook",
        "display_name": "Facebook",
        "icon": "📘",
        "code": "FACEBOOK"
    },
    "TWITTER": {
        "name": "Twitter",
        "display_name": "Twitter/X",
        "icon": "🐦",
        "code": "TWITTER"
    },
    "INSTAGRAM": {
        "name": "Instagram",
        "display_name": "Instagram",
        "icon": "📷",
        "code": "INSTAGRAM"
    },
    "LINKEDIN": {
        "name": "LinkedIn",
        "display_name": "LinkedIn",
        "icon": "💼",
        "code": "LINKEDIN"
    },
    "YELP": {
        "name": "Yelp",
        "display_name": "Yelp",
        "icon": "🍽️",
        "code": "YELP"
    },
    "TRIPADVISOR": {
        "name": "TripAdvisor",
        "display_name": "TripAdvisor",
        "icon": "🏨",
        "code": "TRIPADVISOR"
    }
}

def get_platform_display_name(platform_code):
    """Get the display name for a platform code."""
    platform = PLATFORMS.get(platform_code.upper() if platform_code else None)
    if platform:
        return platform["display_name"]
    return platform_code or "Unknown Platform"

def get_platform_info(platform_code):
    """Get complete platform information."""
    return PLATFORMS.get(platform_code.upper() if platform_code else None, {
        "name": "Unknown",
        "display_name": "Unknown Platform",
        "icon": "🌐",
        "code": "UNKNOWN"
    })

def get_available_platforms():
    """Get list of all available platforms."""
    return list(PLATFORMS.keys())

# Platform-specific configuration for future scrapers
PLATFORM_CONFIG = {
    "GOOGLE": {
        "max_reviews": 150,
        "rate_limit": 1000,  # ms between requests
        "requires_auth": False,
        "scraper_module": "scrapers.google"
    },
    "FACEBOOK": {
        "max_reviews": 100,
        "rate_limit": 2000,
        "requires_auth": True,
        "scraper_module": "scrapers.facebook"  # Future implementation
    },
    "TWITTER": {
        "max_reviews": 200,
        "rate_limit": 1500,
        "requires_auth": True,
        "scraper_module": "scrapers.twitter"  # Future implementation
    },
    "INSTAGRAM": {
        "max_reviews": 100,
        "rate_limit": 2000,
        "requires_auth": True,
        "scraper_module": "scrapers.instagram"  # Future implementation
    }
}