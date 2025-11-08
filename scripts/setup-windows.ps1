# PowerShell script for Windows setup
Write-Host "🏛️ REPUBLICA GAME - Windows Docker Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Create .env.production file
$envContent = @"
DB_PASSWORD=testpass123
JWT_SECRET=local_test_secret_key_minimum_32_characters_here
REDIS_PASSWORD=redis123
CLIENT_URL=http://localhost
DOMAIN=localhost
"@

Set-Content -Path ".env.production" -Value $envContent
Write-Host "✅ Created .env.production file" -ForegroundColor Green

# Pull latest changes
Write-Host "📥 Pulling latest changes from GitHub..." -ForegroundColor Yellow
git pull

# Stop any running containers
Write-Host "🛑 Stopping any existing containers..." -ForegroundColor Yellow
docker compose -f docker-compose.production.yml down 2>$null

# Build and start containers
Write-Host "🐳 Building and starting Docker containers..." -ForegroundColor Yellow
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build

# Wait a bit for services to start
Write-Host "⏳ Waiting for services to start (30 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Check status
Write-Host "`n📊 Container Status:" -ForegroundColor Cyan
docker compose -f docker-compose.production.yml ps

Write-Host "`n🎉 SETUP COMPLETED!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host "🌐 Access the game at: http://localhost" -ForegroundColor White
Write-Host "📋 View logs: docker compose -f docker-compose.production.yml logs" -ForegroundColor White
Write-Host "🛑 Stop game: docker compose -f docker-compose.production.yml down" -ForegroundColor White