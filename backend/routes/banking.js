const express = require('express');
const { Loan, User } = require('../models');
const { authenticate } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

const router = express.Router();

// Get my loans
router.get('/my', authenticate, async (req, res) => {
  try {
    const loans = await Loan.findAll({
      where: {
        [Op.or]: [
          { borrowerId: req.user.id },
          { lenderId: req.user.id }
        ]
      },
      include: [
        { model: User, as: 'lender', attributes: ['username'] },
        { model: User, as: 'borrower', attributes: ['username'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(loans);
  } catch (error) {
    console.error('Error fetching loans:', error);
    res.status(500).json({ error: 'Failed to fetch loans' });
  }
});

// Request a loan from world bank
router.post('/world-bank', authenticate, [
  body('amount').isInt({ min: 100, max: 50000 })
], async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { amount } = req.body;

    // Check existing active loans
    const activeLoans = await Loan.count({
      where: { borrowerId: req.user.id, status: 'active' },
      transaction
    });
    if (activeLoans >= 3) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Maximum 3 active loans allowed' });
    }

    const interestRate = 0.10; // 10% world bank rate
    const amountOwed = Math.ceil(amount * (1 + interestRate));
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const loan = await Loan.create({
      borrowerId: req.user.id,
      lenderId: null,
      amount,
      interestRate,
      amountOwed,
      dueDate,
      status: 'active',
      isWorldBank: true
    }, { transaction });

    // Give credits to borrower
    await req.user.increment('credits', { by: amount, transaction });
    await transaction.commit();

    res.status(201).json(loan);
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating world bank loan:', error);
    res.status(500).json({ error: 'Failed to create loan' });
  }
});

// Offer a loan to another player
router.post('/offer', authenticate, [
  body('borrowerId').isUUID(),
  body('amount').isInt({ min: 100, max: 500000 }),
  body('interestRate').isFloat({ min: 0, max: 1 }),
  body('durationDays').isInt({ min: 1, max: 30 })
], async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { borrowerId, amount, interestRate, durationDays } = req.body;

    if (borrowerId === req.user.id) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Cannot loan to yourself' });
    }

    if (req.user.credits < amount) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Insufficient credits' });
    }

    const loan = await Loan.create({
      lenderId: req.user.id,
      borrowerId,
      amount,
      interestRate,
      amountOwed: Math.ceil(amount * (1 + interestRate)),
      dueDate: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
      status: 'proposed',
      isWorldBank: false
    }, { transaction });

    await transaction.commit();
    res.status(201).json(loan);
  } catch (error) {
    await transaction.rollback();
    console.error('Error offering loan:', error);
    res.status(500).json({ error: 'Failed to offer loan' });
  }
});

// Accept a loan offer
router.post('/:id/accept', authenticate, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const loan = await Loan.findOne({
      where: { id: req.params.id, borrowerId: req.user.id, status: 'proposed' },
      transaction
    });
    if (!loan) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Loan not found' });
    }

    const lender = await User.findByPk(loan.lenderId, { transaction });
    if (lender.credits < loan.amount) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Lender no longer has sufficient credits' });
    }

    await lender.decrement('credits', { by: loan.amount, transaction });
    await req.user.increment('credits', { by: loan.amount, transaction });

    loan.status = 'active';
    await loan.save({ transaction });

    await transaction.commit();
    res.json({ success: true, loan });
  } catch (error) {
    await transaction.rollback();
    console.error('Error accepting loan:', error);
    res.status(500).json({ error: 'Failed to accept loan' });
  }
});

// Repay a loan (partial or full)
router.post('/:id/repay', authenticate, [
  body('amount').isInt({ min: 1 })
], async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { amount } = req.body;
    const loan = await Loan.findOne({
      where: { id: req.params.id, borrowerId: req.user.id, status: 'active' },
      transaction
    });
    if (!loan) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Loan not found' });
    }

    const remaining = loan.amountOwed - loan.amountPaid;
    const payAmount = Math.min(amount, remaining);

    if (req.user.credits < payAmount) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Insufficient credits' });
    }

    await req.user.decrement('credits', { by: payAmount, transaction });

    // Pay to lender (or world bank = disappears)
    if (loan.lenderId) {
      await User.increment('credits', {
        by: payAmount,
        where: { id: loan.lenderId },
        transaction
      });
    }

    loan.amountPaid += payAmount;
    if (loan.amountPaid >= loan.amountOwed) {
      loan.status = 'repaid';
    }
    await loan.save({ transaction });

    await transaction.commit();
    res.json({ success: true, loan });
  } catch (error) {
    await transaction.rollback();
    console.error('Error repaying loan:', error);
    res.status(500).json({ error: 'Failed to repay loan' });
  }
});

module.exports = router;
