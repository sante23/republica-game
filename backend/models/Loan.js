const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Loan = sequelize.define('Loan', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  lenderId: {
    type: DataTypes.UUID,
    allowNull: true // null = world bank
  },
  borrowerId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  interestRate: {
    type: DataTypes.FLOAT,
    defaultValue: 0.05 // 5%
  },
  amountOwed: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  amountPaid: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('proposed', 'active', 'repaid', 'defaulted'),
    defaultValue: 'proposed'
  },
  isWorldBank: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  indexes: [
    { fields: ['borrowerId', 'status'] },
    { fields: ['lenderId', 'status'] },
    { fields: ['dueDate'] }
  ]
});

module.exports = Loan;
