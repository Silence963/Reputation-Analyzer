import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Divider,
  Alert,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Reply as ReplyIcon,
  Lightbulb as LightbulbIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';

const ReviewResponseManager = ({ review, onResponseSent }) => {
  const [responseDialog, setResponseDialog] = useState(false);
  const [customResponse, setCustomResponse] = useState('');
  const [selectedReplyOption, setSelectedReplyOption] = useState('suggested');
  const [expandedPanels, setExpandedPanels] = useState({});

  const handlePanelChange = (panel) => (event, isExpanded) => {
    setExpandedPanels(prev => ({
      ...prev,
      [panel]: isExpanded
    }));
  };

  const handleResponseDialog = (open) => {
    setResponseDialog(open);
    if (open && review.response_suggestion) {
      setSelectedReplyOption('suggested');
      setCustomResponse(review.response_suggestion.suggested_response || '');
    }
  };
  
  const handleReplyOptionChange = (event) => {
    const option = event.target.value;
    setSelectedReplyOption(option);
    
    if (option === 'suggested') {
      setCustomResponse(review.response_suggestion?.suggested_response || '');
    } else if (option === 'none') {
      setCustomResponse('');
    } else if (option === 'custom') {
      setCustomResponse('');
    }
  };

  const handleCopyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // You might want to add a toast notification here
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'positive': return 'success';
      case 'negative': return 'error';
      case 'neutral': return 'warning';
      default: return 'default';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'high': return <WarningIcon color="error" />;
      case 'medium': return <ScheduleIcon color="warning" />;
      case 'low': return <CheckCircleIcon color="success" />;
      default: return <CheckCircleIcon color="success" />;
    }
  };

  const formatTimeframe = (timeframe) => {
    return timeframe.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Card sx={{ 
      mb: 2, 
      border: `2px solid ${getSentimentColor(review.sentiment) === 'error' ? '#f44336' : getSentimentColor(review.sentiment) === 'success' ? '#4caf50' : '#ff9800'}` 
    }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        {/* Review Header */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start', 
          mb: 2,
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 }
        }}>
          <Box>
            <Chip 
              label={review.sentiment.toUpperCase()} 
              color={getSentimentColor(review.sentiment)}
              size="small"
              sx={{ mr: 1 }}
            />
            {review.priority_level && (
              <Chip 
                icon={getPriorityIcon(review.priority_level)}
                label={`${review.priority_level.toUpperCase()} PRIORITY`}
                variant="outlined"
                size="small"
              />
            )}
          </Box>
          <Box>
            <Tooltip title="Generate Response">
              <IconButton 
                color="primary" 
                onClick={() => handleResponseDialog(true)}
                disabled={!review.response_suggestion}
              >
                <ReplyIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Review Text */}
        <Typography variant="body1" sx={{ 
          mb: 2, 
          fontStyle: 'italic',
          fontSize: { xs: '0.9rem', sm: '1rem' }
        }}>
          "{review.text}"
        </Typography>

        {/* Review Metadata */}
        <Box sx={{ 
          display: 'flex', 
          gap: { xs: 0.5, sm: 1 }, 
          flexWrap: 'wrap', 
          mb: 2 
        }}>
          {review.reviewer_name && (
            <Chip label={`By: ${review.reviewer_name}`} size="small" variant="outlined" />
          )}
          {review.rating && (
            <Chip label={`⭐ ${review.rating}/5`} size="small" variant="outlined" color="primary" />
          )}
          {review.platform && (
            <Chip label={review.platform} size="small" variant="filled" color="secondary" />
          )}
          <Chip 
            label={`Sentiment: ${review.polarity.toFixed(2)}`} 
            size="small" 
            variant="outlined" 
          />
        </Box>

        {/* Response Suggestion */}
        {review.response_suggestion && (
          <Accordion 
            expanded={expandedPanels.response}
            onChange={handlePanelChange('response')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ReplyIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Suggested Response</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Paper sx={{ p: { xs: 1.5, sm: 2 }, backgroundColor: '#f8f9fa' }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line', mb: 2, fontSize: { xs: '0.85rem', sm: '0.875rem' } }}>
                  {review.response_suggestion.suggested_response}
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  gap: 1,
                  flexDirection: { xs: 'column', sm: 'row' }
                }}>
                  <Button
                    variant="contained"
                    startIcon={<ReplyIcon />}
                    onClick={() => handleResponseDialog(true)}
                    size="small"
                    fullWidth={{ xs: true, sm: false }}
                  >
                    Use Response
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<CopyIcon />}
                    onClick={() => handleCopyToClipboard(review.response_suggestion.suggested_response)}
                    size="small"
                    fullWidth={{ xs: true, sm: false }}
                  >
                    Copy
                  </Button>
                </Box>
              </Paper>
            </AccordionDetails>
          </Accordion>
        )}
        

        {/* Action Recommendations */}
        {review.action_recommendations && Object.entries(review.action_recommendations).some(([_, actions]) => actions && actions.length > 0) && (
          <Accordion 
            expanded={expandedPanels.recommendations}
            onChange={handlePanelChange('recommendations')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <LightbulbIcon sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6">Action Recommendations</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {Object.entries(review.action_recommendations)
                  .filter(([_, actions]) => actions && actions.length > 0)
                  .map(([timeframe, actions], idx, arr) => (
                  <Box key={timeframe}>
                    <Typography variant="subtitle1" color="primary" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                      {timeframe === 'immediate' && <WarningIcon sx={{ mr: 1, fontSize: 20 }} />}
                      {timeframe === 'short_term' && <ScheduleIcon sx={{ mr: 1, fontSize: 20 }} />}
                      {timeframe === 'long_term' && <TrendingUpIcon sx={{ mr: 1, fontSize: 20 }} />}
                      {formatTimeframe(timeframe)} Actions
                    </Typography>
                    <List dense>
                      {actions.map((action, index) => (
                        <ListItem key={index} sx={{ pl: 0 }}>
                          <ListItemIcon sx={{ minWidth: 30 }}>
                            <Typography variant="body2" color="text.secondary">
                              {index + 1}.
                            </Typography>
                          </ListItemIcon>
                          <ListItemText primary={action} />
                        </ListItem>
                      ))}
                    </List>
                    {idx < arr.length - 1 && <Divider sx={{ my: 1 }} />}
                  </Box>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Identified Issues */}
        {review.identified_issues && review.identified_issues.length > 0 && (
          <Accordion 
            expanded={expandedPanels.issues}
            onChange={handlePanelChange('issues')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <WarningIcon sx={{ mr: 1, color: 'error.main' }} />
                <Typography variant="h6">Identified Issues</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {review.identified_issues.map((issue, index) => (
                  <Chip
                    key={index}
                    label={issue.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    color="error"
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}
      </CardContent>

      {/* Response Dialog */}
      <Dialog 
        open={responseDialog} 
        onClose={() => handleResponseDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={{ xs: true, sm: false }}
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: 0, sm: 2 }
          }
        }}
      >
        <DialogTitle sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ReplyIcon sx={{ mr: 1 }} />
            Respond to Review
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, fontSize: { xs: '0.85rem', sm: '0.875rem' } }}>
            You can customize the suggested response below before sending it to the reviewer.
          </Alert>
          
          {/* Reply Options Dropdown */}
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel id="reply-option-label">Response Option</InputLabel>
            <Select
              labelId="reply-option-label"
              id="reply-option-select"
              value={selectedReplyOption}
              onChange={handleReplyOptionChange}
              label="Response Option"
            >
              <MenuItem value="suggested">
                💡 Use Suggested Response (Personalized with reviewer name)
              </MenuItem>
              <MenuItem value="custom">
                ✍️ Write Custom Reply
              </MenuItem>
              <MenuItem value="none">
                🚫 No Reply Needed
              </MenuItem>
            </Select>
          </FormControl>
          
          {/* Response Text Field */}
          {selectedReplyOption !== 'none' && (
            <TextField
              fullWidth
              multiline
              rows={{ xs: 6, sm: 8 }}
              value={customResponse}
              onChange={(e) => setCustomResponse(e.target.value)}
              label={selectedReplyOption === 'suggested' ? 'Suggested Response' : 'Your Custom Reply'}
              variant="outlined"
              placeholder={selectedReplyOption === 'suggested' ? 'AI-generated response (you can edit)' : 'Type your response here...'}
              helperText={selectedReplyOption === 'custom' ? 'Remember to mention the reviewer\'s name for a personal touch!' : ''}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ 
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 },
          p: { xs: 2, sm: 1 }
        }}>
          <Button 
            onClick={() => handleResponseDialog(false)}
            fullWidth={{ xs: true, sm: false }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (selectedReplyOption === 'none') {
                // For "no reply" option, confirm and close
                if (window.confirm('Are you sure you don\'t want to reply to this review?')) {
                  if (onResponseSent) {
                    onResponseSent(review, null, 'skipped');
                  }
                  handleResponseDialog(false);
                }
              } else {
                // For suggested or custom reply
                if (onResponseSent) {
                  onResponseSent(review, customResponse, selectedReplyOption);
                }
                handleResponseDialog(false);
              }
            }}
            disabled={selectedReplyOption !== 'none' && !customResponse.trim()}
            fullWidth={{ xs: true, sm: false }}
          >
            {selectedReplyOption === 'none' ? 'Skip This Review' : 'Send Response'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default ReviewResponseManager;