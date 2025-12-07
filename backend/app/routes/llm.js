const express = require('express');
const { LLM_DETAILS, sequelize } = require('../models');
const logger = require('../utils/logger');

const router = express.Router();

// GET /categories - List categories
router.get('/categories', async (req, res) => {
  try {
    const [results] = await sequelize.query(
      "SELECT CONFIG_ID, CFG_PRNT_CD FROM kf_doc_config WHERE DOC_CATEGRY_ID=122"
    );
    res.json(results);
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /add-llm-provider - Add or update LLM provider
router.post('/add-llm-provider', async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { USERID, FIRMID, LLM_PROVIDER_TYPE, LLM_PROVIDER, API_KEY } = req.body;
    
    // Check if record exists
    const existing = await LLM_DETAILS.findOne({
      where: {
        USERID: parseInt(USERID),
        FIRMID: parseInt(FIRMID),
        LLM_PROVIDER_TYPE,
        LLM_PROVIDER
      },
      transaction
    });
    
    if (existing) {
      // Update existing record
      await existing.update({
        API_KEY,
        UPD_DTM: new Date(),
        STATUS: 'ACTIVE'
      }, { transaction });
      
      // Deactivate other providers of the same type for this user/firm
      await LLM_DETAILS.update(
        { STATUS: 'INACTIVE' },
        {
          where: {
            USERID: parseInt(USERID),
            FIRMID: parseInt(FIRMID),
            LLM_PROVIDER_TYPE,
            ID: { [sequelize.Sequelize.Op.ne]: existing.ID }
          },
          transaction
        }
      );
    } else {
      // Create new record
      await LLM_DETAILS.create({
        USERID: parseInt(USERID),
        FIRMID: parseInt(FIRMID),
        LLM_PROVIDER_TYPE,
        LLM_PROVIDER,
        API_KEY,
        STATUS: 'ACTIVE',
        INSRT_DTM: new Date(),
        UPD_DTM: new Date()
      }, { transaction });
      
      // Deactivate other providers of the same type for this user/firm
      await LLM_DETAILS.update(
        { STATUS: 'INACTIVE' },
        {
          where: {
            USERID: parseInt(USERID),
            FIRMID: parseInt(FIRMID),
            LLM_PROVIDER_TYPE,
            LLM_PROVIDER: { [sequelize.Sequelize.Op.ne]: LLM_PROVIDER }
          },
          transaction
        }
      );
    }
    
    await transaction.commit();
    res.json({ success: true, message: 'LLM provider added/updated successfully' });
    
  } catch (error) {
    await transaction.rollback();
    logger.error('Error adding LLM provider:', error);
    let errorMsg = 'Failed to save AI provider configuration. ';
    if (error.message.includes('UNIQUE constraint failed')) {
      errorMsg += 'This provider already exists for your account.';
    } else if (error.message.includes('Connection')) {
      errorMsg += 'Database connection error. Please try again.';
    } else {
      errorMsg += 'Please try again.';
    }
    res.status(500).json({ error: errorMsg });
  }
});

// GET /llm-details - Get LLM provider configurations
router.get('/llm-details', async (req, res) => {
  try {
    const { userid, firmid } = req.query;
    
    if (!userid || !firmid) {
      return res.status(400).json({ error: 'userid and firmid are required' });
    }
    
    const records = await LLM_DETAILS.findAll({
      where: {
        USERID: parseInt(userid),
        FIRMID: parseInt(firmid)
      },
      order: [['UPD_DTM', 'DESC']]
    });
    
    const formattedRecords = records.map(record => ({
      ID: record.ID,
      USERID: record.USERID,
      FIRMID: record.FIRMID,
      LLM_PROVIDER_TYPE: record.LLM_PROVIDER_TYPE,
      LLM_PROVIDER: record.LLM_PROVIDER,
      API_KEY: record.API_KEY,
      STATUS: record.STATUS,
      INSRT_DTM: record.INSRT_DTM ? record.INSRT_DTM.toISOString() : null,
      UPD_DTM: record.UPD_DTM ? record.UPD_DTM.toISOString() : null
    }));
    
    res.json(formattedRecords);
    
  } catch (error) {
    logger.error('Error fetching LLM details:', error);
    let errorMsg = 'Failed to fetch AI provider details. ';
    if (error.message.includes('Connection')) {
      errorMsg += 'Database connection error. Please try again.';
    } else {
      errorMsg += 'Please try again.';
    }
    res.status(500).json({ error: errorMsg });
  }
});

// POST /add-api-key - Add or update API key (alias for add-llm-provider)
router.post('/add-api-key', async (req, res) => {
  // Redirect to add-llm-provider endpoint
  req.url = '/add-llm-provider';
  router.handle(req, res);
});

// POST /toggle-llm-status - Toggle LLM provider status
router.post('/toggle-llm-status', async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id, userid, firmid, provider_type, action } = req.body;
    
    const newStatus = action === 'ACTIVATE' ? 'ACTIVE' : 'INACTIVE';
    
    // Update the target record
    await LLM_DETAILS.update(
      { 
        STATUS: newStatus, 
        UPD_DTM: new Date() 
      },
      { 
        where: { ID: id },
        transaction 
      }
    );
    
    // If activating, deactivate other providers of the same type
    if (action === 'ACTIVATE') {
      await LLM_DETAILS.update(
        { STATUS: 'INACTIVE' },
        {
          where: {
            USERID: userid,
            FIRMID: firmid,
            LLM_PROVIDER_TYPE: provider_type,
            ID: { [sequelize.Sequelize.Op.ne]: id }
          },
          transaction
        }
      );
    }
    
    await transaction.commit();
    res.json({ success: true, newStatus });
    
  } catch (error) {
    await transaction.rollback();
    logger.error('Error toggling LLM status:', error);
    let errorMsg = 'Failed to update AI provider status. ';
    if (error.message.includes('Connection')) {
      errorMsg += 'Database connection error. Please try again.';
    } else {
      errorMsg += 'Please try again.';
    }
    res.status(500).json({ error: errorMsg });
  }
});

module.exports = router;