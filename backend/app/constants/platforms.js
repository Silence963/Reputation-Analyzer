/**
 * Platform configuration and display information
 */

const PLATFORMS = {
  GOOGLE: {
    name: 'Google Reviews',
    icon: '🌐',
    color: 'primary',
    url_pattern: /maps\.google\.com/
  },
  YELP: {
    name: 'Yelp',
    icon: '⭐',
    color: 'error',
    url_pattern: /yelp\.com/
  },
  FACEBOOK: {
    name: 'Facebook',
    icon: '📘',
    color: 'info',
    url_pattern: /facebook\.com/
  },
  TRIPADVISOR: {
    name: 'TripAdvisor',
    icon: '🦉',
    color: 'success',
    url_pattern: /tripadvisor\.com/
  }
};

/**
 * Get platform display name
 * @param {string} source - Platform source code
 * @returns {string} - Display name
 */
function getPlatformDisplayName(source) {
  return PLATFORMS[source]?.name || source;
}

/**
 * Get platform information
 * @param {string} source - Platform source code
 * @returns {Object} - Platform info object
 */
function getPlatformInfo(source) {
  return PLATFORMS[source] || {
    name: source,
    icon: '📝',
    color: 'default'
  };
}

module.exports = {
  PLATFORMS,
  getPlatformDisplayName,
  getPlatformInfo
};