const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { KF_VENDOR } = require('../models');

// Register a new company
router.post('/register', async (req, res) => {
  try {
    const { companyName, googleReviewUrl } = req.body;
    const { userid, firmid } = req.query;

    console.log('📝 Registration request received:', { companyName, googleReviewUrl, userid, firmid });

    // Validate required fields
    if (!companyName) {
      console.warn('❌ Validation failed: Company name is required');
      return res.status(400).json({ error: 'Company name is required' });
    }

    // Get userid and firmid from query params or generate defaults
    const userId = userid ? parseInt(userid) : Math.floor(1000 + Math.random() * 9000);
    const firmId = firmid ? parseInt(firmid) : 1;

    console.log('🔑 Using credentials:', { userId, firmId });

    // Create company in KF_VENDOR
    const newCompany = await KF_VENDOR.create({
      VEND_TITL: companyName,
      COMPANY_NAME: companyName,
      GOOGLE_RVW_LINK: googleReviewUrl || 'Not Available',
      MEMBERID: userId,            // Store user ID in MEMBERID
      PORTAL_ID: firmId,           // Store firm ID in PORTAL_ID
      VEND_SDATE: new Date(),      // Required: start date
      INSRT_DTM: new Date(),       // Required: insertion datetime
      VEND_CATEGRY: 'General',     // Required: category
      CATEGORY_ID: 0               // Use default category
    });

    console.log('✅ Company registered successfully:', {
      companyId: newCompany.VEND_ID,
      companyName: newCompany.VEND_TITL,
      userId: newCompany.MEMBERID,
      firmId: newCompany.PORTAL_ID
    });

    // Return success with user and company info
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      userId: newCompany.MEMBERID,
      firmId: newCompany.PORTAL_ID,
      companyId: newCompany.VEND_ID,
      companyName: newCompany.VEND_TITL
    });
  } catch (error) {
    console.error('❌ Registration error:', error.message);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Registration failed. Please try again.',
      details: error.message
    });
  }
});

// Login endpoint (optional - for future use)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const company = await KF_VENDOR.findOne({
      where: { email: email }
    });

    if (!company) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Return user info (no password verification for now since we're using existing columns)
    res.json({
      success: true,
      userId: company.MEMBERID,
      firmId: company.PORTAL_ID,
      companyId: company.VEND_ID,
      companyName: company.COMPANY_NAME
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Get user's company
router.get('/user/:userId/company', async (req, res) => {
  try {
    const { userId } = req.params;

    const company = await KF_VENDOR.findOne({
      where: { MEMBERID: userId }
    });

    if (!company) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      companyId: company.VEND_ID,
      companyName: company.VEND_TITL,
      companyAddress: company.VEND_CON_ADDR,
      googleReviewUrl: company.GOOGLE_RVW_LINK
    });
  } catch (error) {
    console.error('Error fetching user company:', error);
    res.status(500).json({ error: 'Failed to fetch company information' });
  }
});

module.exports = router;
