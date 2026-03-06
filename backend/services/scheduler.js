const { City, User } = require('../models');

class GameScheduler {
  constructor(io) {
    this.io = io;
    this.productionInterval = null;
  }

  start() {
    console.log('🚀 Game scheduler started');

    // Update resources every 60 seconds
    this.productionInterval = setInterval(() => {
      this.updateAllCityProduction();
    }, 60000); // 1 minute

    // Initial update
    this.updateAllCityProduction();
  }

  stop() {
    if (this.productionInterval) {
      clearInterval(this.productionInterval);
      this.productionInterval = null;
      console.log('⏸️  Game scheduler stopped');
    }
  }

  async updateAllCityProduction() {
    try {
      const cities = await City.findAll({
        include: [{
          model: User,
          as: 'owner',
          attributes: ['id', 'username']
        }]
      });

      console.log(`⚙️  Updating production for ${cities.length} cities...`);

      for (const city of cities) {
        await this.updateCityProduction(city);
      }

      console.log(`✅ Production updated for ${cities.length} cities`);
    } catch (error) {
      console.error('Error updating city production:', error);
    }
  }

  async updateCityProduction(city) {
    try {
      const production = city.calculateProduction();
      const consumption = city.consumption;

      // Update resources
      for (const resource in production) {
        city.resources[resource] = (city.resources[resource] || 0) + production[resource];
      }

      // Apply consumption
      for (const resource in consumption) {
        city.resources[resource] = Math.max(0, (city.resources[resource] || 0) - consumption[resource]);
      }

      // Update population based on happiness
      const happinessFactor = (city.happiness - 50) / 1000;
      city.population = Math.floor(city.population * (1 + happinessFactor));

      // Update happiness based on resource availability
      if (city.resources.food < 10) {
        city.happiness = Math.max(0, city.happiness - 5);
      } else if (city.resources.food > 100) {
        city.happiness = Math.min(100, city.happiness + 1);
      }

      city.changed('resources', true);
      city.changed('population', true);
      city.changed('happiness', true);
      await city.save();

      // Emit WebSocket event to notify clients
      if (this.io) {
        this.io.to(`city-${city.id}`).emit('production-update', {
          cityId: city.id,
          resources: city.resources,
          production: production,
          population: city.population,
          happiness: city.happiness
        });

        // Notify city owner
        if (city.owner) {
          this.io.to(`user-${city.owner.id}`).emit('city-production-update', {
            cityId: city.id,
            cityName: city.name,
            resources: city.resources
          });
        }
      }
    } catch (error) {
      console.error(`Error updating production for city ${city.id}:`, error);
    }
  }
}

module.exports = GameScheduler;
