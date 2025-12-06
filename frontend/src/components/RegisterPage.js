import React, { useState, useEffect } from "react";
import { Box, Button, TextField, Typography, Container, Paper, Alert } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import { registerUser } from "../api/repa";
import BusinessIcon from '@mui/icons-material/Business';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [existingUserId, setExistingUserId] = useState(null);
  const [existingFirmId, setExistingFirmId] = useState(null);
  const [formData, setFormData] = useState({
    companyName: '',
    googleReviewUrl: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Extract userid and firmid from URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(search);
    const userIdParam = urlParams.get('userid');
    const firmIdParam = urlParams.get('firmid');
    
    if (userIdParam) {
      setExistingUserId(parseInt(userIdParam));
    }
    if (firmIdParam) {
      setExistingFirmId(parseInt(firmIdParam));
    }
  }, [search]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.companyName) {
      setError('Company name is required');
      return;
    }
    
    setLoading(true);

    try {
      const response = await registerUser(formData, existingUserId, existingFirmId);
      setSuccess(true);
      
      // Use registered userId/firmId, or fall back to existing ones
      const finalUserId = response.userId || existingUserId;
      const finalFirmId = response.firmId || existingFirmId;
      
      // Redirect to dashboard with userid and firmid
      setTimeout(() => {
        navigate(`/dashboard?userid=${finalUserId}&firmid=${finalFirmId}`);
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3), transparent 50%), radial-gradient(circle at 80% 80%, rgba(138, 43, 226, 0.3), transparent 50%)',
          animation: 'pulse 8s ease-in-out infinite',
        },
        '@keyframes pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.8 },
        },
      }}
    >
      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1, py: 4 }}>
        <Paper
          elevation={24}
          sx={{
            p: 4,
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.3)',
          }}
        >
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1,
              }}
            >
              REPA
            </Typography>
            <Typography variant="h6" color="textSecondary" sx={{ fontWeight: 500 }}>
              Register Your Company
            </Typography>
          </Box>

          {success && (
            <Alert severity="success" sx={{ mb: 3 }}>
              Registration successful! Redirecting to dashboard...
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            {/* Company Information */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <BusinessIcon sx={{ color: '#667eea', mr: 1 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#667eea' }}>
                  Register Your Company
                </Typography>
              </Box>
              
              <TextField
                fullWidth
                label="Company Name"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                required
                margin="normal"
                variant="outlined"
                placeholder="Enter your company name"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                      borderColor: '#667eea',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667eea',
                    },
                  },
                }}
              />
              
              <TextField
                fullWidth
                label="Google Review URL"
                name="googleReviewUrl"
                value={formData.googleReviewUrl}
                onChange={handleChange}
                margin="normal"
                variant="outlined"
                placeholder="https://www.google.com/maps/place/..."
                helperText="Paste the Google Maps URL of your business"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                      borderColor: '#667eea',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#667eea',
                    },
                  },
                }}
              />
            </Box>

            {/* Submit Button */}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                py: 1.5,
                mt: 2,
                fontSize: '1.1rem',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #653a8b 100%)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 25px rgba(102, 126, 234, 0.4)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>

            {/* Sign In Link */}
            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Typography variant="body2" color="textSecondary">
                Already have an account?{' '}
                <Button
                  onClick={() => navigate('/dashboard')}
                  sx={{
                    color: '#667eea',
                    fontWeight: 600,
                    textTransform: 'none',
                    p: 0,
                    minWidth: 'auto',
                    '&:hover': {
                      background: 'transparent',
                      textDecoration: 'underline',
                    },
                  }}
                >
                  Sign In
                </Button>
              </Typography>
            </Box>
          </form>
        </Paper>
      </Container>
    </Box>
  );
}
