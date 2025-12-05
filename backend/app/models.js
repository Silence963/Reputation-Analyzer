const { sequelize, DataTypes } = require('./database');

// KF_VENDOR model
const KF_VENDOR = sequelize.define('KF_VENDOR', {
  VEND_ID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  VEND_TITL: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  COMPANY_NAME: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  VEND_CON_ADDR: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  VEND_DESC: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  CITY: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  CATEGORY_ID: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  GOOGLE_RVW_LINK: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'kf_vendor',
  timestamps: false
});

// COMPANY_REVIEWS model
const COMPANY_REVIEWS = sequelize.define('COMPANY_REVIEWS', {
  REVIEW_ID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  COMPANY_ID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: KF_VENDOR,
      key: 'VEND_ID'
    }
  },
  USERID: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  FIRMID: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  REVIEWER_NAME: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  RATING: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  REVIEW_TEXT: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  REVIEW_DATE: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  SENTIMENT: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  POLARITY: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  INSERTED_AT: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  SOURCE: {
    type: DataTypes.STRING(50),
    defaultValue: 'GOOGLE'
  }
}, {
  tableName: 'COMPANY_REVIEWS',
  freezeTableName: true,
  timestamps: false
});

// LLM_DETAILS model
const LLM_DETAILS = sequelize.define('LLM_DETAILS', {
  ID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  USERID: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  FIRMID: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  LLM_PROVIDER_TYPE: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  LLM_PROVIDER: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  API_KEY: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  STATUS: {
    type: DataTypes.STRING(20),
    defaultValue: 'ACTIVE'
  },
  INSRT_DTM: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  UPD_DTM: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'LLM_DETAILS',
  timestamps: false
});

// MOB_NOTIFICATIONS model
const MOB_NOTIFICATIONS = sequelize.define('MOB_NOTIFICATIONS', {
  ID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  USER_ID: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  VOICE_FILE_URL: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  NOTI_TEXT: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  CREATED_AT: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
  },
  SEEN: {
    type: DataTypes.BOOLEAN,
    defaultValue: 0
  },
  DELETED: {
    type: DataTypes.BOOLEAN,
    defaultValue: 0
  },
  STATUS: {
    type: DataTypes.ENUM('SUCCESS', 'FAILURE'),
    allowNull: false
  },
  NOTIFICATION_TYPE: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  NOTIFICATION_PRIORITY: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  COMPANY_ID: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  ALERT_TYPE: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  DESCRIPTION: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  tableName: 'MOB_NOTIFICATIONS',
  timestamps: false,
  freezeTableName: true
});

// COMPANY_ANALYSIS model
const COMPANY_ANALYSIS = sequelize.define('COMPANY_ANALYSIS', {
  ID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  COMPANY_ID: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  ANALYZED_AT: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  SOURCE: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  SENTIMENT_POSITIVE: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  SENTIMENT_NEUTRAL: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  SENTIMENT_NEGATIVE: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  LLM_SUMMARY: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  REVIEW_COUNT: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  REVIEWS_JSON: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'company_analysis',
  timestamps: false
});

// Define associations
KF_VENDOR.hasMany(COMPANY_REVIEWS, { foreignKey: 'COMPANY_ID' });
COMPANY_REVIEWS.belongsTo(KF_VENDOR, { foreignKey: 'COMPANY_ID' });

KF_VENDOR.hasMany(COMPANY_ANALYSIS, { foreignKey: 'COMPANY_ID' });
COMPANY_ANALYSIS.belongsTo(KF_VENDOR, { foreignKey: 'COMPANY_ID' });

module.exports = {
  sequelize,
  KF_VENDOR,
  COMPANY_REVIEWS,
  LLM_DETAILS,
  MOB_NOTIFICATIONS,
  COMPANY_ANALYSIS
};