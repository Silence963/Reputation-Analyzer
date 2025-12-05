import React, { useState, useEffect } from "react";
import CompanySearch from "./CompanySearch";
import SentimentChart from "./SentimentChart";
import ReviewList from "./ReviewList";
import ReviewResponseManager from "./ReviewResponseManager";
import BusinessInsightsDashboard from "./BusinessInsightsDashboard";
import ApiKeyManager from "../API_manager/ApiKeyManager";
import { analyzeGoogleReviews } from "../api/repa";
import { 
  Box, 
  CircularProgress, 
  Typography, 
  Paper, 
  Alert, 
  Backdrop, 
  Button, 
  Fab, 
  Tabs, 
  Tab,
  ToggleButton,
  ToggleButtonGroup,
  Chip
} from "@mui/material";

export default function Dashboard() {
  // Extract userid and firmid from URL parameters
  const [userId, setUserId] = useState(null);
  const [firmId, setFirmId] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [topReviews, setTopReviews] = useState(null);
  const [llmSummary, setLlmSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [showApiManager, setShowApiManager] = useState(false);
  const [activeProvider, setActiveProvider] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [analysisMetadata, setAnalysisMetadata] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [sentimentFilter, setSentimentFilter] = useState(['positive', 'neutral', 'negative']);

  // Parse URL parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userIdParam = urlParams.get('userid');
    const firmIdParam = urlParams.get('firmid');
    
    if (userIdParam) {
      setUserId(parseInt(userIdParam));
    }
    if (firmIdParam) {
      setFirmId(parseInt(firmIdParam));
    }
  }, []);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleSentimentFilterChange = (event, newFilters) => {
    if (newFilters.length > 0) {
      setSentimentFilter(newFilters);
    }
  };

  const handleResponseSent = (review, responseText) => {
    // This would typically send the response to the platform's API
    console.log('Sending response to review:', review.text);
    console.log('Response:', responseText);
    // You can implement actual API call here
    alert('Response sent successfully! (This is a demo - no actual response was sent)');
  };

  const handleProviderSelect = (provider, userId, firmId) => {
    setActiveProvider({ provider, userId, firmId });
    console.log(`Provider ${provider} activated for User ${userId}, Firm ${firmId}`);
  };

  const handleSearch = async (companyId, forceRefresh = false) => {
    setLoading(true);
    setError("");
    setTopReviews(null);
    setChartData(null);
    setLlmSummary("");
    setAnalysisResult(null);
    setCompanyName("");
    setAnalysisMetadata(null);
    try {
      const data = await analyzeGoogleReviews(companyId, forceRefresh);
      setChartData(data.chart_data);
      setTopReviews(data.top_reviews);
      setLlmSummary(data.llm_summary);
      setAnalysisResult(data);
      setCompanyName(data.company_name || "Unknown Company");
      setAnalysisMetadata(data.analysis_metadata || null);
      if (
        (!data.top_reviews.positive.length &&
          !data.top_reviews.neutral.length &&
          !data.top_reviews.negative.length)
      ) {
        setError("No reviews found for this company.");
      }
    } catch (err) {
      setError("Failed to fetch or analyze reviews.");
      setChartData(null);
      setTopReviews(null);
      setLlmSummary("");
      setAnalysisResult(null);
      setCompanyName("");
      setAnalysisMetadata(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Paper elevation={3} sx={{ 
        p: { xs: 2, sm: 3, md: 4 }, 
        maxWidth: 800, 
        margin: { xs: '16px', sm: '24px auto', md: '32px auto' }, 
        position: 'relative' 
      }}>
        <Backdrop open={loading} sx={{
          color: '#1976d2', // light blue
          zIndex: 9999,
          background: 'rgba(220, 240, 255, 0.85)', // solid light blue background
          display: 'flex',
          flexDirection: 'column',
        }}>
          <CircularProgress style={{ color: '#42a5f5' }} size={90} thickness={4.5} />
          <Typography variant="h6" sx={{ mt: 3, color: '#1976d2' }}>
            Analyzing reviews, please wait...
          </Typography>
        </Backdrop>
        
        {/* API Manager Button */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 2,
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 }
        }}>
          <Typography variant="h6" color="primary" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
            REPA Analysis Dashboard
          </Typography>
          <Button
            variant="outlined"
            startIcon={<span>⚙️</span>}
            onClick={() => setShowApiManager(true)}
            size="small"
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            AI Settings
          </Button>
        </Box>
        
        {activeProvider && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Using AI Provider: <strong>{activeProvider.provider}</strong> (User: {activeProvider.userId}, Firm: {activeProvider.firmId})
          </Alert>
        )}
        
        {/* Display warning if userid or firmid is missing */}
        {(!userId || !firmId) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Missing URL parameters. Please access the page with: <code>?userid=YOUR_USER_ID&firmid=YOUR_FIRM_ID</code>
          </Alert>
        )}
        
        <CompanySearch onSearch={handleSearch} />
        {/* Status notices for cache/refresh and backend warnings */}
        {analysisMetadata?.using_cached_data && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Loaded recent cached reviews. Click "Refresh Reviews" to force a fresh scrape.
          </Alert>
        )}
        {analysisMetadata?.scrape_error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Scraper warning: {analysisMetadata.scrape_error}
          </Alert>
        )}
        {analysisMetadata?.db_error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Database notice: {analysisMetadata.db_error.message || 'An issue occurred while accessing the database.'}
          </Alert>
        )}
        {/* Refresh Button */}
        {companyName && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box>
              {analysisMetadata && (
                <span style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: '16px',
                  fontSize: '0.8rem',
                  background: analysisMetadata.using_cached_data ? '#e8f5e9' : '#e3f2fd',
                  color: analysisMetadata.using_cached_data ? '#2e7d32' : '#1565c0',
                  border: '1px solid',
                  borderColor: analysisMetadata.using_cached_data ? '#a5d6a7' : '#90caf9'
                }}>
                  {analysisMetadata.using_cached_data ? 'Cached' : 'Fresh'}
                </span>
              )}
            </Box>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => handleSearch(analysisResult?.company_id || null, true)}
              disabled={loading || !analysisResult?.company_id}
            >
              Refresh Reviews
            </Button>
          </Box>
        )}
        {error && <Alert severity={error === "No reviews found for this company." ? "info" : "error"} sx={{ mt: 2 }}>{error}</Alert>}
        {analysisResult && !error && (
          <>
            {companyName && (
              <Box mt={2} mb={3}>
                <Typography variant="h4" gutterBottom color="primary" sx={{ textAlign: 'center' }}>
                  Analysis Results for: {companyName}
                </Typography>
              </Box>
            )}
            {analysisMetadata && (
              <Box mt={2} mb={3}>
                <Paper variant="outlined" sx={{ p: 2, background: '#f0f7ff' }}>
                  <Typography variant="h6" gutterBottom color="primary">Analysis Information</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                    <Box>
                      <Typography variant="body2" color="textSecondary">Primary Platform:</Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#1976d2' }}>
                        🌐 {analysisMetadata.primary_platform || "Google Reviews"}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="textSecondary">Analysis Performed:</Typography>
                      <Typography variant="body1">{formatTimestamp(analysisMetadata.analyzed_at)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="textSecondary">Total Reviews:</Typography>
                      <Typography variant="body1">{analysisMetadata.total_reviews}</Typography>
                    </Box>
                    {analysisMetadata.platforms && Object.keys(analysisMetadata.platforms).length > 0 && (
                      <Box>
                        <Typography variant="body2" color="textSecondary">Platform Breakdown:</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                          {Object.entries(analysisMetadata.platforms).map(([platform, count]) => (
                            <Typography 
                              key={platform} 
                              variant="body2" 
                              sx={{ 
                                backgroundColor: '#e3f2fd', 
                                px: 1, 
                                py: 0.25, 
                                borderRadius: 1,
                                fontSize: '0.8rem'
                              }}
                            >
                              {platform}: {count}
                            </Typography>
                          ))}
                        </Box>
                      </Box>
                    )}
                    <Box>
                      <Typography variant="body2" color="textSecondary">Data Source:</Typography>
                      <Typography variant="body1">
                        {analysisMetadata.using_cached_data ? "Recent Cache" : "Fresh Scrape"} 
                        {analysisMetadata.using_cached_data && <span style={{color: '#4caf50'}}> ✓</span>}
                      </Typography>
                    </Box>
                    {analysisMetadata.collection_period && (analysisMetadata.collection_period.earliest || analysisMetadata.collection_period.latest) && (
                      <Box>
                        <Typography variant="body2" color="textSecondary">Collection Period:</Typography>
                        <Typography variant="body1" sx={{ fontSize: '0.9rem' }}>
                          {analysisMetadata.collection_period.earliest && formatTimestamp(analysisMetadata.collection_period.earliest)}
                          {analysisMetadata.collection_period.earliest && analysisMetadata.collection_period.latest && " - "}
                          {analysisMetadata.collection_period.latest && analysisMetadata.collection_period.latest !== analysisMetadata.collection_period.earliest && formatTimestamp(analysisMetadata.collection_period.latest)}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Paper>
              </Box>
            )}
            
            {/* Tabbed Results Interface */}
            <Box sx={{ width: '100%', mt: 2 }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={activeTab} onChange={handleTabChange} aria-label="analysis tabs">
                  <Tab label="Overview" />
                  <Tab label="Review Responses" />
                  <Tab label="Business Insights" />
                </Tabs>
              </Box>
              
              {/* Overview Tab */}
              {activeTab === 0 && (
                <Box sx={{ mt: 3 }}>
                  {llmSummary && (
                    <Box mb={4}>
                      <Typography variant="h5" gutterBottom>Summary</Typography>
                      <Paper variant="outlined" sx={{ p: 2, background: '#f9f9f9' }}>
                        <Typography variant="body1" style={{ whiteSpace: 'pre-line' }}>{llmSummary.replace(/\*+/g, '')}</Typography>
                      </Paper>
                    </Box>
                  )}
                  {chartData && (
                    <Box mb={4}>
                      <Typography variant="h6" gutterBottom>Sentiment Distribution</Typography>
                      <SentimentChart chartData={chartData} />
                    </Box>
                  )}
                  {topReviews && (
                    <Box mb={4}>
                      <Typography variant="h6" gutterBottom>Top Reviews by Sentiment</Typography>
                      <ReviewList topReviews={topReviews} />
                    </Box>
                  )}
                </Box>
              )}
              
              {/* Review Responses Tab */}
              {activeTab === 1 && (
                <Box sx={{ mt: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box>
                      <Typography variant="h5" gutterBottom>Review Response Management</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Generate personalized responses and action plans for each review
                      </Typography>
                    </Box>
                  </Box>
                  
                  {/* Sentiment Filter */}
                  <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: { xs: 2, sm: 3 }, backgroundColor: '#f8f9fa' }}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                      Filter by Sentiment:
                    </Typography>
                    <ToggleButtonGroup
                      value={sentimentFilter}
                      onChange={handleSentimentFilterChange}
                      aria-label="sentiment filter"
                      size="small"
                      orientation="horizontal"
                      sx={{ 
                        width: { xs: '100%', sm: 'auto' },
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        gap: { xs: 1, sm: 0 }
                      }}
                    >
                      <ToggleButton value="positive" aria-label="positive reviews" sx={{ textTransform: 'none', width: { xs: '100%', sm: 'auto' } }}>
                        <Chip 
                          label={`Positive (${analysisResult?.reviews?.filter(r => r.sentiment === 'positive').length || 0})`}
                          color="success"
                          size="small"
                          sx={{ pointerEvents: 'none' }}
                        />
                      </ToggleButton>
                      <ToggleButton value="neutral" aria-label="neutral reviews" sx={{ textTransform: 'none', width: { xs: '100%', sm: 'auto' } }}>
                        <Chip 
                          label={`Neutral (${analysisResult?.reviews?.filter(r => r.sentiment === 'neutral').length || 0})`}
                          color="warning"
                          size="small"
                          sx={{ pointerEvents: 'none' }}
                        />
                      </ToggleButton>
                      <ToggleButton value="negative" aria-label="negative reviews" sx={{ textTransform: 'none', width: { xs: '100%', sm: 'auto' } }}>
                        <Chip 
                          label={`Negative (${analysisResult?.reviews?.filter(r => r.sentiment === 'negative').length || 0})`}
                          color="error"
                          size="small"
                          sx={{ pointerEvents: 'none' }}
                        />
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Paper>

                  {/* Filtered Reviews */}
                  {analysisResult?.reviews
                    ?.filter(review => sentimentFilter.includes(review.sentiment))
                    .map((review, index) => (
                      <ReviewResponseManager
                        key={index}
                        review={review}
                        onResponseSent={handleResponseSent}
                      />
                    ))}
                  
                  {/* No Results Message */}
                  {analysisResult?.reviews?.filter(review => sentimentFilter.includes(review.sentiment)).length === 0 && (
                    <Alert severity="info">
                      No reviews match the selected filter. Try selecting different sentiment options.
                    </Alert>
                  )}
                </Box>
              )}
              
              {/* Business Insights Tab */}
              {activeTab === 2 && (
                <Box sx={{ mt: 3 }}>
                  <BusinessInsightsDashboard analysisMetadata={analysisMetadata} />
                </Box>
              )}
            </Box>
          </>
        )}
      </Paper>
      
      {/* Floating Action Button for API Manager */}
      <Fab
        color="primary"
        aria-label="AI Settings"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
        onClick={() => setShowApiManager(true)}
      >
        ⚙️
      </Fab>
      
      {/* API Key Manager Modal */}
      {showApiManager && (
        <ApiKeyManager
          onProviderSelect={handleProviderSelect}
          onClose={() => setShowApiManager(false)}
          currentUserId={userId}
          currentFirmId={firmId}
        />
      )}
    </>
  );
}