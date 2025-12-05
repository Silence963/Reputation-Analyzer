# REPA Backend - Node.js/Express API

A powerful sentiment analysis and review management system built with Node.js, Express, and PostgreSQL.

## 🚀 Features

- **Multi-platform Review Scraping**: Google Maps reviews with Puppeteer
- **Advanced Sentiment Analysis**: Using Natural.js and Sentiment libraries
- **AI-Powered Summaries**: Support for multiple LLM providers (OpenAI, Groq, Gemini, etc.)
- **Reputation Timeline Analysis**: Time-aware sentiment tracking
- **Business Intelligence**: Automated insights and recommendations
- **RESTful API**: Complete Express.js API with validation and rate limiting
- **Database Integration**: PostgreSQL with Sequelize ORM
- **Robust Error Handling**: Comprehensive logging and error management

## 📋 Prerequisites

- Node.js (v16+)
- PostgreSQL (v12+)
- npm or yarn

## 🛠️ Installation

1. **Clone and navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment**
   ```bash
   npm run setup:env
   ```

4. **Configure your database**
   Edit `.env` file with your PostgreSQL credentials:
   ```env
   DB_NAME=repa_db
   DB_USER=your_username
   DB_PASSWORD=your_password
   DB_HOST=localhost
   DB_PORT=5432
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

## 🗄️ Database Setup

Make sure you have PostgreSQL running and create the required database:

```sql
CREATE DATABASE repa_db;
```

The application will automatically create the required tables on startup.

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_NAME` | PostgreSQL database name | `repa_db` |
| `DB_USER` | Database username | `postgres` |
| `DB_PASSWORD` | Database password | `password` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `PORT` | Server port | `8000` |
| `NODE_ENV` | Environment | `development` |
| `LOG_LEVEL` | Logging level | `info` |

### LLM Provider Setup

Configure AI providers through the API:

1. Access the frontend API manager
2. Add your API keys for supported providers:
   - OpenAI GPT-4
   - Google Gemini
   - Groq
   - OpenRouter
   - DeepSeek
   - And more...

## 📡 API Endpoints

### Companies
- `GET /companies` - List companies with filters
- `GET /companies/:id` - Get company details

### Analysis
- `POST /analyze/google?company_id=123` - Analyze Google reviews
- `POST /analyze/google?company_id=123&force_refresh=true` - Force fresh scrape

### LLM Management
- `GET /llm-details?userid=123&firmid=456` - Get LLM configurations
- `POST /add-llm-provider` - Add/update LLM provider
- `POST /toggle-llm-status` - Enable/disable LLM provider

### Utilities
- `GET /health` - Health check
- `GET /categories` - List business categories

## 🔍 Key Features Explained

### Review Scraping
- **Google Maps Integration**: Advanced Puppeteer-based scraper
- **Robust Date Extraction**: Multiple fallback selectors for review dates
- **Content Expansion**: Automatically expands truncated reviews
- **Duplicate Prevention**: Hash-based deduplication

### Sentiment Analysis
- **Multi-library Approach**: Combines Natural.js and Sentiment libraries
- **Normalized Scoring**: Consistent polarity scoring (-1 to 1)
- **Batch Processing**: Efficient analysis of multiple reviews

### AI Integration
- **Multiple Providers**: Support for 10+ LLM providers
- **Strategic Prompting**: Time-aware reputation analysis
- **Fallback Handling**: Graceful degradation when AI services fail
- **Cost Optimization**: Smart caching and provider selection

### Business Intelligence
- **Timeline Analysis**: Track reputation changes over time
- **Issue Identification**: Automated problem detection
- **Response Generation**: AI-powered response suggestions
- **Industry-Specific Insights**: Tailored analysis by business type

## 🚦 Running the Application

### Development Mode
```bash
npm run dev
```
Starts the server with nodemon for auto-reloading.

### Production Mode
```bash
npm start
```
Starts the server in production mode.

### Health Check
Visit `http://localhost:8000/health` to verify the server is running.

## 📊 Monitoring & Logging

- **Winston Logging**: Structured logging with multiple transports
- **Health Monitoring**: Built-in health check endpoint
- **Error Tracking**: Comprehensive error handling and reporting
- **Performance Metrics**: Request timing and database query monitoring

## 🛡️ Security Features

- **Helmet.js**: Security headers
- **Rate Limiting**: Request throttling
- **CORS Protection**: Configurable cross-origin policies
- **Input Validation**: Request validation with express-validator
- **SQL Injection Prevention**: Parameterized queries with Sequelize

## 🔄 Migration from Python

This Node.js backend maintains API compatibility with the original Python/FastAPI version:

- **Same Endpoints**: All routes preserved
- **Identical Responses**: Response formats unchanged
- **Database Compatibility**: Uses same PostgreSQL schema
- **Feature Parity**: All Python features implemented

## 🤝 Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Ensure all tests pass

## 📝 License

MIT License - see LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify credentials in `.env`
   - Ensure database exists

2. **Puppeteer Issues**
   - Install Chrome/Chromium
   - Check for missing dependencies
   - Set `headless: true` for server environments

3. **LLM API Errors**
   - Verify API keys are correct
   - Check provider status in dashboard
   - Review rate limits

### Performance Tips

- Use `force_refresh=false` to leverage caching
- Configure appropriate rate limits
- Monitor database connection pool
- Optimize LLM provider selection

## 📞 Support

For issues and questions:
- Check the logs in `logs/` directory
- Review error messages in console
- Verify environment configuration
- Check database connectivity

---

🎉 **Your Node.js REPA backend is ready to deliver powerful sentiment analysis and review management!**