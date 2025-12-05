// Platform configuration for multi-platform review analysis
export const PLATFORMS = {
  GOOGLE: {
    name: "Google Reviews",
    icon: "🔍",
    color: "primary",
    code: "GOOGLE"
  },
  FACEBOOK: {
    name: "Facebook",
    icon: "📘",
    color: "info",
    code: "FACEBOOK"
  },
  TWITTER: {
    name: "Twitter/X",
    icon: "🐦",
    color: "info",
    code: "TWITTER"
  },
  INSTAGRAM: {
    name: "Instagram",
    icon: "📷",
    color: "secondary",
    code: "INSTAGRAM"
  },
  LINKEDIN: {
    name: "LinkedIn",
    icon: "💼",
    color: "primary",
    code: "LINKEDIN"
  },
  YELP: {
    name: "Yelp",
    icon: "🍽️",
    color: "error",
    code: "YELP"
  },
  TRIPADVISOR: {
    name: "TripAdvisor",
    icon: "🏨",
    color: "success",
    code: "TRIPADVISOR"
  },
  UNKNOWN: {
    name: "Unknown Platform",
    icon: "🌐",
    color: "default",
    code: "UNKNOWN"
  }
};

// Helper function to get platform info by name or code
export const getPlatformInfo = (platformIdentifier) => {
  if (!platformIdentifier) return PLATFORMS.UNKNOWN;
  
  const identifier = platformIdentifier.toString().toLowerCase();
  
  // Check by name
  for (const [, platform] of Object.entries(PLATFORMS)) {
    if (platform.name.toLowerCase().includes(identifier) || 
        platform.code.toLowerCase() === identifier ||
        identifier.includes(platform.name.toLowerCase())) {
      return platform;
    }
  }
  
  return PLATFORMS.UNKNOWN;
};

// Helper function to get all available platforms
export const getAvailablePlatforms = () => {
  return Object.values(PLATFORMS).filter(p => p.code !== "UNKNOWN");
};

// Future: Configuration for platform-specific scraping settings
export const PLATFORM_CONFIG = {
  GOOGLE: {
    maxReviews: 150,
    rateLimit: 1000, // ms between requests
    requiresAuth: false
  },
  FACEBOOK: {
    maxReviews: 100,
    rateLimit: 2000,
    requiresAuth: true
  },
  TWITTER: {
    maxReviews: 200,
    rateLimit: 1500,
    requiresAuth: true
  },
  INSTAGRAM: {
    maxReviews: 100,
    rateLimit: 2000,
    requiresAuth: true
  }
};