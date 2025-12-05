import React from "react";
import { Box, Typography, List, ListItem, Divider, Chip } from "@mui/material";
import { getPlatformInfo } from "../constants/platforms";

export default function ReviewList({ topReviews }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      // Handle ISO format dates
      if (dateStr.includes('T')) {
        return new Date(dateStr).toLocaleDateString();
      }
      // Handle relative dates like "3 months ago"
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const formatRating = (rating) => {
    if (!rating) return null;
    return `⭐ ${rating}/5`;
  };

  return (
    <Box mt={{ xs: 2, sm: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>Top Reviews</Typography>
      {Object.keys(topReviews).map(sentiment => (
        <Box key={sentiment} mb={2}>
          <Typography variant="h6" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }} color={
            sentiment === "positive" ? "green" : sentiment === "negative" ? "red" : "textPrimary"
          }>
            {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
          </Typography>
          <List dense>
            {topReviews[sentiment].map((r, idx) => (
              <ListItem key={idx} sx={{ flexDirection: 'column', alignItems: 'flex-start', pb: 2, px: { xs: 1, sm: 2 } }}>
                <Typography variant="body1" sx={{ mb: 1, fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                  {r.text}
                </Typography>
                <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 }, flexWrap: 'wrap', alignItems: 'center' }}>
                  {r.platform && (
                    <Chip 
                      label={`${getPlatformInfo(r.platform).icon} ${getPlatformInfo(r.platform).name}`} 
                      size="small" 
                      variant="filled" 
                      color={getPlatformInfo(r.platform).color}
                      sx={{ fontWeight: 'bold' }}
                    />
                  )}
                  <Chip 
                    label={`Sentiment: ${r.polarity.toFixed(2)}`} 
                    size="small" 
                    variant="outlined"
                  />
                  {r.rating && (
                    <Chip 
                      label={formatRating(r.rating)} 
                      size="small" 
                      variant="outlined" 
                      color="primary"
                    />
                  )}
                  {r.reviewer_name && (
                    <Chip 
                      label={`By: ${r.reviewer_name}`} 
                      size="small" 
                      variant="outlined"
                    />
                  )}
                  {r.review_date && (
                    <Chip 
                      label={`Posted: ${formatDate(r.review_date)}`} 
                      size="small" 
                      variant="outlined" 
                      color="secondary"
                    />
                  )}
                  {r.collected_at && (
                    <Chip 
                      label={`Collected: ${formatDate(r.collected_at)}`} 
                      size="small" 
                      variant="outlined" 
                      sx={{ fontSize: '0.7rem' }}
                    />
                  )}
                </Box>
              </ListItem>
            ))}
          </List>
          <Divider />
        </Box>
      ))}
    </Box>
  );
} 