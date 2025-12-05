# REPA Frontend

This is the React frontend for the REPA (Reputation Analysis) project.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm start
   ```
3. The app will be available at [http://localhost:3000](http://localhost:3000).

## Features
- Search for a company by ID and name
- Trigger review and sentiment analysis
- View sentiment chart and reviews grouped by sentiment

## Configuration
- The backend API base URL is set to `http://localhost:8000` in `src/api/repa.js`. Change it if your backend runs elsewhere. 