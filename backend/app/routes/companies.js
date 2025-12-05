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

module.exports = router;