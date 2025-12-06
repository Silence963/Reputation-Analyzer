# REPA - Reputation Analytics Platform

## New Features Added

### 🎨 Futuristic Landing Page
- Modern gradient design with glass-morphism effects
- Responsive feature cards highlighting platform capabilities
- Smooth animations and hover effects
- Statistics section showcasing platform metrics

### 👤 User Registration System
- Complete user authentication flow
- Each user gets one dedicated company
- User data stored directly in kf_vendor table
- Secure password hashing with bcrypt
- No separate users table needed

### 🏢 Company Management
- User-company relationship (one-to-one)
- Automatic company filtering by userid/firmid
- Users only see their own company data
- Enhanced CompanySearch with auto-loading

### 🎯 Dashboard Enhancements
- Futuristic gradient theme matching landing page
- Glass-morphism effects and smooth transitions
- Auto-loads user's company on dashboard
- Simplified interface - no manual company ID entry needed

## Installation & Setup

### 1. Install Dependencies

#### Backend
\`\`\`bash
cd backend
npm install
\`\`\`

This will install the new `bcrypt` package for password hashing.

#### Frontend
\`\`\`bash
cd frontend
npm install
\`\`\`

This will install `react-router-dom` for navigation.

### 2. Database Setup

Run the migration to create the REPA_USERS table:

\`\`\`bash
mysql -h 88.150.227.117 -u nrktrn_web_admin -p'GOeg&*$*657' nrkindex_trn < backend/migrations/001_create_repa_users.sql
\`\`\`

This creates:
- `REPA_USERS` table for user authentication
- Indexes for performance
- Foreign key relationship to `kf_vendor` table

### 3. Start the Application

#### Backend
\`\`\`bash
cd backend
npm start
\`\`\`

Backend runs on: http://localhost:8000

#### Frontend
\`\`\`bash
cd frontend
npm start
\`\`\`

Frontend runs on: http://localhost:3000

## Using the New System

### Registration Flow

1. **Visit Landing Page**: Navigate to http://localhost:3000
2. **Click "Get Started"**: Opens registration form
3. **Fill Registration Form**:
   - User Information: Name, Email, Password
   - Company Information: Name, Address, Google Review URL (optional)
4. **Submit**: Creates user account and company
5. **Auto-redirect**: Automatically redirects to dashboard with URL parameters

### Dashboard Access

After registration, you'll be redirected to:
\`\`\`
http://localhost:3000/dashboard?userid=YOUR_USER_ID&firmid=YOUR_FIRM_ID
\`\`\`

The dashboard will:
- Automatically load your company
- Display company name and ID
- Show "Analyze Reviews" button
- Allow Google URL updates via collapsible section

### API Endpoints

#### Registration
\`\`\`
POST /register
Body: {
  userName: string,
  email: string,
  password: string,
  companyName: string,
  companyAddress: string,
  googleReviewUrl?: string
}
\`\`\`

#### Login (Future Use)
\`\`\`
POST /login
Body: {
  email: string,
  password: string
}
\`\`\`

#### Get User's Company
\`\`\`
GET /companies/user/:userId/:firmId
\`\`\`

## Database Schema

### KF_VENDOR Table (Extended)
```sql
Existing columns:
- VEND_ID (INT, Primary Key, Auto Increment)
- VEND_TITL (VARCHAR, Company Name)
- COMPANY_NAME (VARCHAR)
- VEND_CON_ADDR (TEXT, Company Address)
- GOOGLE_RVW_LINK (TEXT)
- CITY, CATEGORY_ID, VEND_DESC

New authentication columns:
- USERID (INT) - User identifier
- FIRMID (INT) - Firm identifier
- USER_EMAIL (VARCHAR(255)) - User's email
- PASSWORD_HASH (VARCHAR(255)) - Hashed password
- USER_NAME (VARCHAR(255)) - User's full name
```

### How It Works
- Each company entry in kf_vendor can have associated user credentials
- USERID + FIRMID combination identifies the user
- One company = One user (stored in same table)
- Users filtered by USERID and FIRMID when accessing dashboard

## Theme Customization

The futuristic theme uses:
- **Gradient**: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- **Glass Effect**: `backdrop-filter: blur(20px)` with `rgba(255,255,255,0.95)`
- **Animations**: Pulse effect on background gradients
- **Colors**: 
  - Primary: #667eea (Purple-Blue)
  - Secondary: #764ba2 (Deep Purple)

To customize, modify the `sx` props in:
- `LandingPage.js`
- `RegisterPage.js`
- `Dashboard.js`

## Security Notes

⚠️ **Important**: The `.env` file is currently tracked in git. In production:
1. Remove `.env` from git: `git rm --cached backend/.env`
2. Change database password
3. Use environment variables in deployment platform
4. Never commit credentials to version control

## Testing

### Test User Registration
1. Visit http://localhost:3000
2. Click "Get Started"
3. Fill form with test data
4. Verify redirect to dashboard
5. Check database for new entries in REPA_USERS and kf_vendor

### Verify Company Isolation
1. Register two different users
2. Note their different userid/firmid values
3. Each should only see their own company on dashboard

## Troubleshooting

### "No company found for this user"
- Check database: `SELECT * FROM kf_vendor WHERE USERID=X AND FIRMID=Y;`
- Verify USERID and FIRMID are not NULL
- Ensure user was registered successfully

### Registration fails
- Check backend logs for errors
- Verify database connection
- Ensure email is unique in kf_vendor table
- Check bcrypt is installed

### Routes not working
- Verify react-router-dom is installed
- Check browser console for errors
- Ensure BrowserRouter wraps all routes in App.js

## Next Steps

Potential enhancements:
- [ ] Implement login functionality
- [ ] Add password reset flow
- [ ] Email verification
- [ ] Multi-company support for enterprise users
- [ ] Role-based access control (admin, user, viewer)
- [ ] Company settings page
- [ ] User profile management
