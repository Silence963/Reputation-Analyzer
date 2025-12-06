import React, { useState, useEffect } from "react";
import { TextField, Button, Box, Collapse, Alert, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Slider, FormControlLabel, Checkbox } from "@mui/material";
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import { updateCompanyGoogleUrl } from "../api/repa";
import axios from "axios";

export default function CompanySearch({ onSearch, userId, firmId, onCompanyLoaded }) {
  const [companyId, setCompanyId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [googleUrl, setGoogleUrl] = useState("");
  const [showUrlField, setShowUrlField] = useState(false);
  const [urlUpdateMessage, setUrlUpdateMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewCount, setReviewCount] = useState(20);
  const [totalReviews, setTotalReviews] = useState(0);
  const [useAllReviews, setUseAllReviews] = useState(false);

  // Fetch user's company on component mount
  useEffect(() => {
    const fetchUserCompany = async () => {
      if (!userId || !firmId) {
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`http://localhost:8000/companies/user/${userId}/${firmId}`);
        if (response.data && response.data.length > 0) {
          const company = response.data[0];
          setCompanyId(company.VEND_ID);
          const name = company.VEND_TITL || company.COMPANY_NAME;
          setCompanyName(name);
          setGoogleUrl(company.GOOGLE_RVW_LINK || '');
          
          // Notify parent component about loaded company
          if (onCompanyLoaded) {
            onCompanyLoaded(name);
          }
        }
      } catch (error) {
        console.error('Error fetching user company:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserCompany();
  }, [userId, firmId]);

  const handleUpdateUrl = async () => {
    if (!companyId || !googleUrl) {
      setUrlUpdateMessage({ type: 'error', text: 'Both Company ID and Google URL are required' });
      return;
    }

    try {
      const response = await updateCompanyGoogleUrl(companyId, googleUrl);
      
      if (response.success) {
        setUrlUpdateMessage({ type: 'success', text: 'Google URL updated successfully!' });
        setTimeout(() => setUrlUpdateMessage(null), 3000);
      }
    } catch (error) {
      setUrlUpdateMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to update URL' 
      });
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      {loading ? (
        <Typography>Loading your company...</Typography>
      ) : companyId ? (
        <>
          <Box sx={{ 
            p: 2, 
            mb: 2,
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
            borderRadius: 2,
            border: '1px solid rgba(102, 126, 234, 0.3)'
          }}>
            <Typography variant="body1" sx={{ 
              fontWeight: 600, 
              color: '#667eea'
            }}>
              {companyName}
            </Typography>
          </Box>
          
          <Button
            variant="contained"
            onClick={() => setShowReviewDialog(true)}
            fullWidth
            sx={{ 
              mb: 2,
              py: 1.5,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #653a8b 100%)',
              }
            }}
          >
            Analyze Reviews
          </Button>
          
          <Button
            variant="outlined"
            onClick={() => setShowUrlField(!showUrlField)}
            fullWidth
            size="small"
            endIcon={<ExpandMoreIcon sx={{ 
              transform: showUrlField ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s'
            }} />}
            sx={{ 
              borderColor: '#667eea',
              color: '#667eea',
              '&:hover': {
                borderColor: '#5568d3',
                background: 'rgba(102, 126, 234, 0.05)'
              }
            }}
          >
            Update Google Review URL
          </Button>
        </>
      ) : (
        <Alert severity="warning">
          No company found for this user. Please contact support.
        </Alert>
      )}

      <Collapse in={showUrlField}>
        <Box sx={{ 
          mt: 2, 
          p: 2, 
          border: '1px solid #e0e0e0', 
          borderRadius: 1,
          backgroundColor: '#f9f9f9'
        }}>
          <Box sx={{ 
            display: 'flex', 
            gap: 2, 
            alignItems: 'flex-start',
            flexDirection: { xs: 'column', sm: 'row' }
          }}>
            <TextField
              label="Google Review URL"
              value={googleUrl}
              onChange={e => setGoogleUrl(e.target.value)}
              size="small"
              placeholder="https://www.google.com/maps/place/..."
              helperText={!companyId ? "Enter Company ID first" : "Enter the Google Maps review URL for this company"}
              fullWidth
              disabled={!companyId}
            />
            <Button
              variant="outlined"
              onClick={handleUpdateUrl}
              disabled={!companyId || !googleUrl}
              sx={{ minWidth: { sm: 120 }, whiteSpace: 'nowrap' }}
            >
              Update URL
            </Button>
          </Box>
          
          {urlUpdateMessage && (
            <Alert 
              severity={urlUpdateMessage.type} 
              sx={{ mt: 2 }}
              onClose={() => setUrlUpdateMessage(null)}
            >
              {urlUpdateMessage.text}
            </Alert>
          )}
        </Box>
      </Collapse>

      {/* Review Count Selection Dialog */}
      <Dialog 
        open={showReviewDialog} 
        onClose={() => setShowReviewDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontWeight: 600
        }}>
          Select Reviews for Summary
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            How many reviews should we use to generate the summary?
          </Typography>
          
          <Box sx={{ px: 1, mb: 2 }}>
            <Slider
              value={reviewCount}
              onChange={(e, newValue) => setReviewCount(newValue)}
              min={5}
              max={Math.max(50, totalReviews)}
              step={5}
              marks={[
                { value: 5, label: '5' },
                { value: 25, label: '25' },
                { value: 50, label: '50' }
              ]}
              valueLabelDisplay="auto"
              disabled={useAllReviews}
              sx={{
                '& .MuiSlider-markLabel': {
                  fontSize: '0.8rem'
                }
              }}
            />
          </Box>

          <FormControlLabel
            control={
              <Checkbox
                checked={useAllReviews}
                onChange={(e) => setUseAllReviews(e.target.checked)}
                color="primary"
              />
            }
            label="Use all reviews"
            sx={{ mb: 2 }}
          />

          {!useAllReviews && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              Selected: <strong>{reviewCount} reviews</strong>
            </Typography>
          )}
          {useAllReviews && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              Using <strong>all available reviews</strong>
            </Typography>
          )}

          <Alert severity="info" sx={{ mb: 2 }}>
            ⏱️ <strong>Note:</strong> More reviews will take longer to process. Typically:
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
              <li>5-10 reviews: ~30 seconds</li>
              <li>20-30 reviews: ~1-2 minutes</li>
              <li>40-50 reviews: ~3-5 minutes</li>
              <li>All reviews: longest; we will notify you when the report is ready.</li>
            </ul>
            <span>We will notify you when the report is ready.</span>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setShowReviewDialog(false)}
            sx={{ color: '#667eea' }}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => {
              setShowReviewDialog(false);
              const countParam = useAllReviews ? 'all' : reviewCount;
              onSearch(companyId, countParam);
            }}
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #653a8b 100%)',
              }
            }}
          >
            {useAllReviews ? 'Analyze All Reviews' : `Analyze ${reviewCount} Reviews`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 