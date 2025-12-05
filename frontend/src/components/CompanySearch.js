import React, { useState } from "react";
import { TextField, Button, Box, IconButton, Collapse, Alert } from "@mui/material";
import { ExpandMore as ExpandMoreIcon } from "@mui/icons-material";
import { updateCompanyGoogleUrl } from "../api/repa";

export default function CompanySearch({ onSearch }) {
  const [companyId, setCompanyId] = useState("");
  const [googleUrl, setGoogleUrl] = useState("");
  const [showUrlField, setShowUrlField] = useState(false);
  const [urlUpdateMessage, setUrlUpdateMessage] = useState(null);

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
      <Box sx={{ 
        display: 'flex', 
        gap: { xs: 1, sm: 2 }, 
        alignItems: 'center',
        flexDirection: { xs: 'column', sm: 'row' }
      }}>
        <TextField
          label="Company ID"
          value={companyId}
          onChange={e => setCompanyId(e.target.value)}
          size="small"
          helperText="Enter the company ID to analyze reviews"
          fullWidth
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        />
        <Button
          variant="contained"
          onClick={() => onSearch(companyId)}
          disabled={!companyId}
          sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 160 } }}
        >
          Analyze Reviews
        </Button>
        <IconButton
          onClick={() => setShowUrlField(!showUrlField)}
          aria-label="show google url field"
          size="small"
          sx={{ 
            transform: showUrlField ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s'
          }}
        >
          <ExpandMoreIcon />
        </IconButton>
      </Box>

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
    </Box>
  );
} 