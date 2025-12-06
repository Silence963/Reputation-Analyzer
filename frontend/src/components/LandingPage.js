import React from "react";
import { Box, Button, Typography, Container, Paper, Grid } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import CloudIcon from '@mui/icons-material/Cloud';

export default function LandingPage() {
  const navigate = useNavigate();
  const { search } = useLocation();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative',
        overflow: 'hidden',
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
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, pt: 8, pb: 8 }}>
        {/* Hero Section */}
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '2.5rem', md: '4rem' },
              fontWeight: 800,
              color: 'white',
              mb: 2,
              textShadow: '0 0 30px rgba(255,255,255,0.3)',
              letterSpacing: '-0.02em',
            }}
          >
            REPA
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontSize: { xs: '1.2rem', md: '1.8rem' },
              color: 'rgba(255,255,255,0.95)',
              mb: 4,
              fontWeight: 300,
            }}
          >
            Reputation Analytics Platform
          </Typography>
          <Typography
            variant="body1"
            sx={{
              fontSize: { xs: '1rem', md: '1.2rem' },
              color: 'rgba(255,255,255,0.85)',
              mb: 6,
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            Advanced AI-powered review analysis and sentiment tracking for modern businesses
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate(`/register${search || ''}`)}
              sx={{
                px: 4,
                py: 1.5,
                fontSize: '1.1rem',
                background: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(10px)',
                border: '2px solid rgba(255,255,255,0.3)',
                color: 'white',
                fontWeight: 600,
                '&:hover': {
                  background: 'rgba(255,255,255,0.3)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              Register
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate(`/dashboard${search || ''}`)}
              sx={{
                px: 4,
                py: 1.5,
                fontSize: '1.1rem',
                border: '2px solid rgba(255,255,255,0.5)',
                color: 'white',
                fontWeight: 600,
                '&:hover': {
                  border: '2px solid rgba(255,255,255,0.8)',
                  background: 'rgba(255,255,255,0.1)',
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              Launch REPA
            </Button>
          </Box>
        </Box>

        {/* Features Grid */}
        <Grid container spacing={3} sx={{ mb: 6 }}>
          {[
            {
              icon: <TrendingUpIcon sx={{ fontSize: 50 }} />,
              title: 'Real-time Analytics',
              description: 'Track sentiment and reviews in real-time with AI-powered insights',
            },
            {
              icon: <SecurityIcon sx={{ fontSize: 50 }} />,
              title: 'Secure & Private',
              description: 'Enterprise-grade security for your business data',
            },
            {
              icon: <SpeedIcon sx={{ fontSize: 50 }} />,
              title: 'Lightning Fast',
              description: 'Instant analysis and response generation',
            },
            {
              icon: <CloudIcon sx={{ fontSize: 50 }} />,
              title: 'Cloud-Based',
              description: 'Access from anywhere, anytime, on any device',
            },
          ].map((feature, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Paper
                sx={{
                  p: 3,
                  height: '100%',
                  background: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 3,
                  textAlign: 'center',
                  color: 'white',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    background: 'rgba(255,255,255,0.15)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
                  },
                }}
              >
                <Box sx={{ color: 'rgba(255,255,255,0.9)', mb: 2 }}>
                  {feature.icon}
                </Box>
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                  {feature.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                  {feature.description}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Stats Section */}
        <Paper
          sx={{
            p: 4,
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 3,
            textAlign: 'center',
          }}
        >
          <Grid container spacing={4}>
            <Grid item xs={12} md={4}>
              <Typography variant="h3" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
                99.9%
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                Uptime Guarantee
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="h3" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
                10M+
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                Reviews Analyzed
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="h3" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
                500+
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                Businesses Trust Us
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
}
