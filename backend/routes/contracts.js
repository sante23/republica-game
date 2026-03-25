const express = require('express');
const { Contract, User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

const router = express.Router();

// Get my contracts
router.get('/my', authenticate, async (req, res) => {
  try {
    const contracts = await Contract.findAll({
      where: {
        [Op.or]: [
          { sellerId: req.user.id },
          { buyerId: req.user.id }
        ]
      },
      include: [
        { model: User, as: 'seller', attributes: ['username'] },
        { model: User, as: 'buyer', attributes: ['username'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(contracts);
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

// Propose a contract
router.post('/propose', authenticate, [
  body('buyerId').isUUID(),
  body('resource').isIn(['food', 'wood', 'stone', 'iron', 'gold', 'energy']),
  body('quantityPerDelivery').isInt({ min: 1, max: 100000 }),
  body('pricePerUnit').isFloat({ min: 0.01 }),
  body('deliveriesTotal').isInt({ min: 1, max: 365 }),
  body('intervalHours').isInt({ min: 1, max: 168 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { buyerId, resource, quantityPerDelivery, pricePerUnit, deliveriesTotal, intervalHours } = req.body;

    if (buyerId === req.user.id) {
      return res.status(400).json({ error: 'Cannot create contract with yourself' });
    }

    const contract = await Contract.create({
      sellerId: req.user.id,
      buyerId,
      resource,
      quantityPerDelivery,
      pricePerUnit,
      deliveriesTotal,
      intervalHours,
      status: 'proposed'
    });

    res.status(201).json(contract);
  } catch (error) {
    console.error('Error proposing contract:', error);
    res.status(500).json({ error: 'Failed to propose contract' });
  }
});

// Accept/reject a contract
router.post('/:id/respond', authenticate, async (req, res) => {
  try {
    const { accept } = req.body;
    const contract = await Contract.findOne({
      where: { id: req.params.id, buyerId: req.user.id, status: 'proposed' }
    });

    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    if (accept) {
      contract.status = 'active';
      contract.nextDeliveryAt = new Date(Date.now() + contract.intervalHours * 60 * 60 * 1000);
    } else {
      contract.status = 'cancelled';
    }
    await contract.save();

    res.json({ success: true, contract });
  } catch (error) {
    console.error('Error responding to contract:', error);
    res.status(500).json({ error: 'Failed to respond' });
  }
});

// Cancel a contract (by either party)
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    const contract = await Contract.findOne({
      where: {
        id: req.params.id,
        [Op.or]: [{ sellerId: req.user.id }, { buyerId: req.user.id }],
        status: { [Op.in]: ['proposed', 'active'] }
      }
    });

    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    contract.status = 'cancelled';
    await contract.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Error cancelling contract:', error);
    res.status(500).json({ error: 'Failed to cancel' });
  }
});

module.exports = router;
