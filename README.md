# 🏛️ REPUBLICA - Political-Economic Browser Game

A multiplayer browser game that combines political strategy, economic simulation, and city building in a persistent world where players vote, trade, and compete for power.

![Game Status](https://img.shields.io/badge/Status-MVP%20Complete-green)
![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node.js%20%7C%20PostgreSQL-blue)

## 🎮 Game Features

### 🏛️ Political System
- **Democratic Elections**: Vote for mayors, governors, and presidents
- **Real Campaigns**: Candidates make binding promises
- **Term Limits**: Leadership changes every 30-60 days
- **Corruption & Justice**: Investigation system and impeachment

### 💰 Economic System
- **Resource Management**: Food, wood, stone, iron, gold, energy
- **Production Chains**: From raw materials to complex goods
- **Dynamic Markets**: Player-driven supply and demand
- **Global Trade**: Cross-regional commerce with tariffs

### 🏙️ City Building
- **Multiple Cities**: Expand your empire as you level up
- **Building System**: Houses, farms, mines, markets
- **Population Growth**: Happy citizens = growth
- **Resource Production**: Each building produces specific resources

### 🌐 Multiplayer Features
- **Real-time Updates**: Live market prices and notifications
- **5000 Players**: Per world capacity
- **Persistent World**: Actions have lasting consequences
- **Social Systems**: Corporations, alliances, parties

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- PostgreSQL 12+
- npm or yarn

### 1. Clone & Setup
```bash
cd republica-game
npm run install:all
```

### 2. Database Setup
```bash
# Create PostgreSQL database
createdb republica_db

# Update backend/.env with your database credentials
```

### 3. Environment Configuration

**Backend (.env)**:
```env
NODE_ENV=development
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=republica_db
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=your_secret_key_here
JWT_EXPIRE=7d

CLIENT_URL=http://localhost:3000
```

**Frontend (.env)**:
```env
REACT_APP_API_URL=http://localhost:5000/api
```

### 4. Run Development Servers
```bash
# Start both backend and frontend
npm run dev

# Or start individually:
npm run server:dev  # Backend only
npm run client:dev  # Frontend only
```

### 5. Access the Game
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/api/health

## 📁 Project Structure

```
republica-game/
├── backend/                 # Node.js + Express API
│   ├── config/             # Database configuration
│   ├── models/             # Sequelize models
│   ├── routes/             # API endpoints
│   ├── middleware/         # Auth & validation
│   └── server.js           # Main server file
├── frontend/               # React TypeScript app
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── contexts/       # React contexts
│   │   ├── pages/          # Main game pages
│   │   └── config/         # API configuration
└── database/               # Database migrations & seeds
```

## 🛠️ API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Cities
- `GET /api/cities/my` - Get user's cities
- `POST /api/cities/create` - Found new city
- `PUT /api/cities/:id/build` - Construct buildings
- `POST /api/cities/:id/update-production` - Update resources

### Market
- `GET /api/market/listings` - Browse marketplace
- `POST /api/market/sell` - Create listing
- `POST /api/market/buy/:id` - Purchase item

### Politics
- `GET /api/politics/elections` - Active elections
- `POST /api/politics/elections/:id/register` - Register as candidate
- `POST /api/politics/elections/:id/vote` - Cast vote

## 🎯 Game Mechanics

### Experience & Levels
- Level 1-10: **Citizen** (Tutorial phase)
- Level 11-25: **Entrepreneur** (Commerce focus)
- Level 26-40: **Magnate** (Politics unlock)
- Level 41-55: **Elite** (Regional influence)
- Level 56-70: **Titan** (National power)

### Resource Types
| Resource | Icon | Use Case |
|----------|------|----------|
| Food 🌾 | Basic survival | Population growth |
| Wood 🪵 | Construction | Building material |
| Stone 🪨 | Advanced building | Durable structures |
| Iron ⚙️ | Tools & weapons | Industrial production |
| Gold 🪙 | Currency | Trading & politics |
| Energy ⚡ | Power | Modern buildings |

### Political Positions
| Position | Term | Requirements | Powers |
|----------|------|--------------|--------|
| Mayor 🏛️ | 30 days | Level 10+ | Local taxes, zoning |
| Governor 🏛️ | 45 days | Level 25+ | Regional trade, infrastructure |
| President 🏛️ | 60 days | Level 40+ | Foreign policy, national defense |

## 🔧 Development

### Database Migrations
```bash
cd backend
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

### Testing
```bash
# Backend tests
cd backend && npm test

# Frontend tests  
cd frontend && npm test
```

### Build for Production
```bash
npm run build
```

## 🎮 Gameplay Guide

### Getting Started
1. **Register**: Create your account and enter the world
2. **Found City**: Establish your first settlement
3. **Build Economy**: Construct farms, mines, and markets
4. **Trade Resources**: Use the marketplace to grow wealth
5. **Enter Politics**: Vote in elections or run for office

### Pro Tips
- 🌾 Always maintain food production for population growth
- 🪙 Save gold for political campaigns and premium buildings
- 🤝 Form alliances early - cooperation is key
- 📈 Watch market trends before making large trades
- 🗳️ Vote strategically - politicians affect your city's future

## 🏗️ Future Features

### Phase 2 (Next 3 months)
- [ ] Mobile-responsive design
- [ ] Party system with ideologies
- [ ] Advanced production chains
- [ ] Military units and conflicts
- [ ] Achievements system

### Phase 3 (6 months)
- [ ] Multiple worlds/servers
- [ ] Seasonal events
- [ ] Premium features
- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup
1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push branch: `git push origin feature/new-feature`
5. Submit pull request

## 📄 License

This project is licensed under the MIT License - see [LICENSE.md](LICENSE.md) for details.

## 🆘 Support

- **Discord**: [Join our community](https://discord.gg/republica)
- **Email**: support@republicagame.com
- **Issues**: [GitHub Issues](https://github.com/your-org/republica-game/issues)
- **Documentation**: [Full docs](https://docs.republicagame.com)

## 👥 Team

- **Game Design**: Political-economic simulation experts
- **Backend**: Node.js + PostgreSQL architecture
- **Frontend**: React + TypeScript with modern UI/UX
- **DevOps**: AWS deployment with auto-scaling

---

**Made with ❤️ by the Republica team**

*Build your empire. Shape democracy. Rule the world.*