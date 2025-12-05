const express = require('express');
const { Op } = require('sequelize');
const { KF_VENDOR, sequelize } = require('../models');
const logger = require('../utils/logger');

const router = express.Router();

// GET /companies - List companies with optional filters
router.get('/', async (req, res) => {
  try {
    const { city, category, search } = req.query;
    
    let whereClause = {};
    
    if (city) {
      whereClause.CITY = { [Op.iLike]: `%${city}%` };
    }
    
    if (category) {
      whereClause.CATEGORY_ID = category;
    }
    
    if (search) {
      whereClause.COMPANY_NAME = { [Op.iLike]: `%${search}%` };
    }
    
    const companies = await KF_VENDOR.findAll({
      where: whereClause,
      limit: 100 // Prevent overwhelming responses
    });
    
    res.json(companies);
  } catch (error) {
    logger.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /companies/:id - Get specific company details
router.get('/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    
    const company = await KF_VENDOR.findByPk(companyId);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    // Get all attributes of the company object
    const companyData = company.toJSON();
    
    res.json({
      company_id: parseInt(companyId),
      data: companyData,
      available_fields: Object.keys(companyData),
      company_name_status: {
        COMPANY_NAME: companyData.COMPANY_NAME,
        is_null: companyData.COMPANY_NAME === null,
        is_empty: companyData.COMPANY_NAME === ''
      }
    });
  } catch (error) {
    logger.error('Error fetching company details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /companies/:id/google-url - Update company's Google review URL
router.patch('/:companyId/google-url', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { google_url } = req.body;
    
    if (!google_url || typeof google_url !== 'string') {
      return res.status(400).json({ error: 'google_url is required and must be a string' });
    }
    
    const company = await KF_VENDOR.findByPk(companyId);
    
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    // Update the Google review link
    await company.update({ GOOGLE_RVW_LINK: google_url });
    
    logger.info(`Updated Google URL for company ${companyId}: ${google_url}`);
    
    res.json({
      success: true,
      message: 'Google review URL updated successfully',
      company_id: parseInt(companyId),
      google_url: google_url
    });
  } catch (error) {
    logger.error('Error updating Google URL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;