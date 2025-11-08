#!/bin/bash

# 🚀 Republica Game - Quick Setup Menu
# Choose your deployment method

set -e

echo "🏛️ REPUBLICA GAME - QUICK SETUP"
echo "==============================="
echo ""
echo "Choose your deployment method:"
echo ""
echo "1) 🖥️  Manual Installation (Ubuntu/Debian)"
echo "   - Full control over configuration"
echo "   - Installs directly on server"
echo "   - Recommended for production"
echo ""
echo "2) 🐳 Docker Deployment"
echo "   - Quick and isolated setup"
echo "   - Easy to manage and update"
echo "   - Recommended for development/testing"
echo ""
echo "3) ☁️  Cloud Platform Setup"
echo "   - Deploy to AWS/DigitalOcean/etc"
echo "   - Guided cloud deployment"
echo ""
echo "4) 💻 Local Development Setup"
echo "   - Setup for local development"
echo "   - Uses local PostgreSQL"
echo ""

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo ""
        echo "🖥️ Starting Manual Installation..."
        echo "=================================="
        echo ""
        echo "This will install Republica directly on your Ubuntu/Debian server."
        echo "Make sure you have:"
        echo "- Ubuntu 20.04+ or Debian 10+"
        echo "- Root/sudo access"
        echo "- Domain name pointed to this server"
        echo ""
        read -p "Continue? (y/N): " confirm
        if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
            ./scripts/install-server.sh
        else
            echo "Installation cancelled."
            exit 0
        fi
        ;;
    2)
        echo ""
        echo "🐳 Starting Docker Deployment..."
        echo "==============================="
        echo ""
        echo "This will deploy Republica using Docker containers."
        echo "Make sure you have:"
        echo "- Docker and Docker Compose installed"
        echo "- Ports 80 and 443 available"
        echo ""
        read -p "Continue? (y/N): " confirm
        if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
            ./scripts/deploy-docker.sh
        else
            echo "Deployment cancelled."
            exit 0
        fi
        ;;
    3)
        echo ""
        echo "☁️ Cloud Platform Setup"
        echo "======================"
        echo ""
        echo "Cloud deployment options:"
        echo ""
        echo "🔸 AWS EC2:"
        echo "   1. Launch EC2 instance (t3.medium or larger)"
        echo "   2. Configure Security Groups (ports 22, 80, 443)"
        echo "   3. SSH to instance and run manual installation"
        echo ""
        echo "🔸 DigitalOcean Droplet:"
        echo "   1. Create Droplet (2GB RAM minimum)"
        echo "   2. Enable monitoring and backups"
        echo "   3. SSH to droplet and run manual installation"
        echo ""
        echo "🔸 Google Cloud VM:"
        echo "   1. Create VM instance (e2-medium or larger)"
        echo "   2. Configure firewall rules"
        echo "   3. SSH to instance and run manual installation"
        echo ""
        echo "For detailed cloud setup instructions, see DEPLOYMENT.md"
        echo ""
        read -p "Do you want to proceed with manual installation on this cloud server? (y/N): " confirm
        if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
            ./scripts/install-server.sh
        else
            echo "Please follow the cloud provider specific instructions in DEPLOYMENT.md"
            exit 0
        fi
        ;;
    4)
        echo ""
        echo "💻 Local Development Setup"
        echo "=========================="
        echo ""
        echo "Setting up Republica for local development..."
        echo ""
        
        # Check prerequisites
        echo "🔍 Checking prerequisites..."
        
        if ! command -v node &> /dev/null; then
            echo "❌ Node.js is not installed. Please install Node.js 18+"
            exit 1
        fi
        
        if ! command -v psql &> /dev/null; then
            echo "❌ PostgreSQL is not installed. Please install PostgreSQL 12+"
            exit 1
        fi
        
        echo "✅ Prerequisites check passed"
        echo ""
        
        # Install dependencies
        echo "📦 Installing dependencies..."
        npm run install:all
        
        # Setup database
        echo "🗄️ Setting up local database..."
        read -p "Enter PostgreSQL username (default: postgres): " db_user
        db_user=${db_user:-postgres}
        
        read -s -p "Enter PostgreSQL password: " db_password
        echo
        
        # Create local environment files
        echo "⚙️ Creating local environment..."
        
        cat > backend/.env << EOF
NODE_ENV=development
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=republica_dev
DB_USER=$db_user
DB_PASSWORD=$db_password

JWT_SECRET=development_jwt_secret_for_local_use_only_min_32_chars
JWT_EXPIRE=7d

CLIENT_URL=http://localhost:3000
EOF

        cat > frontend/.env.development.local << 'EOF'
REACT_APP_API_URL=http://localhost:5000/api
EOF
        
        # Create database
        echo "📊 Creating development database..."
        PGPASSWORD=$db_password createdb -h localhost -U $db_user republica_dev 2>/dev/null || true
        
        echo ""
        echo "🎉 LOCAL DEVELOPMENT SETUP COMPLETED!"
        echo "===================================="
        echo ""
        echo "✅ Republica is ready for local development!"
        echo ""
        echo "🚀 To start development servers:"
        echo "   npm run dev          # Start both backend and frontend"
        echo "   npm run server:dev   # Start only backend"
        echo "   npm run client:dev   # Start only frontend"
        echo ""
        echo "🌐 Access points:"
        echo "   Frontend: http://localhost:3000"
        echo "   Backend:  http://localhost:5000"
        echo "   API:      http://localhost:5000/api"
        echo ""
        echo "📁 Important files:"
        echo "   backend/.env                    # Backend configuration"
        echo "   frontend/.env.development.local # Frontend configuration"
        echo ""
        echo "Happy coding! 🎮"
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again and choose 1-4."
        exit 1
        ;;
esac