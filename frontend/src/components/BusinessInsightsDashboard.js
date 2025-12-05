import React from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Alert,
  Grid,
  Card,
  CardContent,
  LinearProgress
} from '@mui/material';
import {
  Warning as WarningIcon,
  TrendingDown as TrendingDownIcon,
  CheckCircle as CheckCircleIcon,
  Business as BusinessIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';

const BusinessInsightsDashboard = ({ analysisMetadata }) => {
  const { business_insights, business_type, total_reviews, sentiment_counts } = analysisMetadata || {};

  if (!business_insights) {
    return null;
  }

  const positivePercentage = sentiment_counts ? (sentiment_counts.positive / total_reviews) * 100 : 0;
  const negativePercentage = sentiment_counts ? (sentiment_counts.negative / total_reviews) * 100 : 0;

  const getHealthStatus = () => {
    if (business_insights.needs_immediate_attention) return 'error';
    if (negativePercentage > 30) return 'warning';
    if (positivePercentage > 70) return 'success';
    return 'info';
  };

  const getHealthMessage = () => {
    if (business_insights.needs_immediate_attention) {
      return 'Immediate attention required for recurring issues';
    }
    if (negativePercentage > 30) {
      return 'Consider implementing improvement strategies';
    }
    if (positivePercentage > 70) {
      return 'Excellent customer satisfaction levels';
    }
    return 'Overall performance is satisfactory';
  };

  return (
    <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, mt: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 2, sm: 3 } }}>
        <AssessmentIcon sx={{ mr: 1, color: 'primary.main', fontSize: { xs: '1.5rem', sm: '1.75rem' } }} />
        <Typography variant="h5" color="primary" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
          Business Insights & Recommendations
        </Typography>
      </Box>

      <Grid container spacing={{ xs: 2, sm: 3 }}>
        {/* Business Overview */}
        <Grid item xs={12} sm={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <BusinessIcon sx={{ mr: 1, color: 'secondary.main' }} />
                <Typography variant="h6">Business Overview</Typography>
              </Box>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Business Type
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold', textTransform: 'capitalize' }}>
                  {business_type?.replace('_', ' ') || 'General Business'}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Customer Satisfaction
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <Box sx={{ width: '100%', mr: 1 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={positivePercentage} 
                      color={positivePercentage > 70 ? 'success' : positivePercentage > 50 ? 'warning' : 'error'}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 35 }}>
                    {positivePercentage.toFixed(0)}%
                  </Typography>
                </Box>
              </Box>

              <Alert severity={getHealthStatus()} sx={{ mt: 2 }}>
                {getHealthMessage()}
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Critical Issues */}
        <Grid item xs={12} sm={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <WarningIcon sx={{ mr: 1, color: 'error.main' }} />
                <Typography variant="h6">Critical Issues</Typography>
              </Box>

              {business_insights.high_priority_issues && business_insights.high_priority_issues.length > 0 ? (
                <List dense>
                  {business_insights.high_priority_issues.map((issue, index) => (
                    <ListItem key={index} sx={{ pl: 0 }}>
                      <ListItemIcon sx={{ minWidth: 30 }}>
                        <TrendingDownIcon color="error" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={issue.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        secondary="Requires immediate attention"
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', color: 'success.main' }}>
                  <CheckCircleIcon sx={{ mr: 1 }} />
                  <Typography variant="body2">
                    No critical issues identified
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Common Issues Analysis */}
        {business_insights.common_issues && business_insights.common_issues.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Issue Frequency Analysis
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Issues mentioned multiple times in negative reviews
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {business_insights.common_issues.map((item, index) => (
                    <Chip
                      key={index}
                      label={`${item.issue} (${item.frequency}x)`}
                      color={item.frequency >= 3 ? 'error' : item.frequency >= 2 ? 'warning' : 'default'}
                      variant="outlined"
                      size="medium"
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Statistics Summary */}
        <Grid item xs={12}>
          <Card sx={{ backgroundColor: '#f8f9fa' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Review Statistics Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {total_reviews}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Reviews
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main">
                      {sentiment_counts?.positive || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Positive
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="warning.main">
                      {sentiment_counts?.neutral || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Neutral
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="error.main">
                      {business_insights.negative_review_count || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Negative
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default BusinessInsightsDashboard;