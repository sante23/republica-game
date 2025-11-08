const sequelize = require('../config/database');
const User = require('./User');
const City = require('./City');
const Election = require('./Election');
const Market = require('./Market');

User.hasMany(City, { foreignKey: 'userId', as: 'cities' });
City.belongsTo(User, { foreignKey: 'userId', as: 'owner' });

User.hasMany(Market, { foreignKey: 'sellerId', as: 'listings' });
Market.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });
Market.belongsTo(User, { foreignKey: 'buyerId', as: 'buyer' });

City.hasMany(Market, { foreignKey: 'cityId', as: 'marketListings' });
Market.belongsTo(City, { foreignKey: 'cityId', as: 'city' });

module.exports = {
  sequelize,
  User,
  City,
  Election,
  Market
};