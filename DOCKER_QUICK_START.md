# 🐳 Docker Quick Start - Windows

Guida rapida per testare REPUBLICA su Windows con Docker.

## 📋 Prerequisiti

1. **Docker Desktop** per Windows
   - Scarica da [docker.com](https://www.docker.com/products/docker-desktop/)
   - Installa e riavvia il computer
   - Assicurati che WSL 2 sia abilitato

2. **Git** per Windows
   - Scarica da [git-scm.com](https://git-scm.com/)

## 🚀 Installazione Rapida

### 1. Clona il Progetto
```bash
# PowerShell o Command Prompt
git clone https://github.com/sante23/republica-game.git
cd republica-game
```

### 2. Configura Environment
```bash
# Copia il file di esempio
copy .env.production.example .env.production

# Modifica .env.production con i tuoi valori:
# DB_PASSWORD=testpass123
# JWT_SECRET=local_test_secret_key_minimum_32_characters_here  
# REDIS_PASSWORD=redis123
# CLIENT_URL=http://localhost
# DOMAIN=localhost
```

### 3. Avvia con Docker
```bash
docker compose -f docker-compose.production.yml --env-file .env.production up -d
```

### 4. Accedi al Gioco
- Apri browser: **http://localhost**
- Registra nuovo account
- Inizia a giocare!

## 🔍 Comandi Utili

```bash
# Verifica status container
docker compose -f docker-compose.production.yml ps

# Visualizza logs
docker compose -f docker-compose.production.yml logs

# Ferma tutto
docker compose -f docker-compose.production.yml down

# Ricostruisci se modifichi il codice
docker compose -f docker-compose.production.yml up -d --build
```

## 🛠️ Troubleshooting

### Container non si avvia:
```bash
# Verifica Docker Desktop sia running
# Controlla logs specifici:
docker compose -f docker-compose.production.yml logs backend
docker compose -f docker-compose.production.yml logs frontend
docker compose -f docker-compose.production.yml logs postgres
```

### Porta 80 occupata:
```bash
# Modifica docker-compose.production.yml
# Cambia "80:80" in "8080:80"
# Poi accedi su http://localhost:8080
```

### Reset completo:
```bash
# Ferma e rimuovi tutto
docker compose -f docker-compose.production.yml down -v
docker system prune -f

# Riavvia
docker compose -f docker-compose.production.yml up -d --build
```

## 🎮 Test del Gioco

1. **Registrazione**: Crea account con username/email/password
2. **Dashboard**: Visualizza statistiche impero
3. **Città**: Clicca "Found New City" per creare prima città
4. **Economia**: Costruisci edifici e produci risorse
5. **Marketplace**: Vai al marketplace per commerciare
6. **Politica**: Visualizza elezioni disponibili

## 📊 Database Access

```bash
# Accesso al database PostgreSQL
docker compose -f docker-compose.production.yml exec postgres psql -U republica_user -d republica_db

# Comandi SQL utili:
\dt                    # Lista tabelle
SELECT * FROM "Users"; # Visualizza utenti
SELECT * FROM "Cities"; # Visualizza città
```

## 🔥 Performance

Per migliorare performance su Windows:
- Assicurati di avere almeno 8GB RAM
- Abilita Hardware Acceleration in Docker Desktop
- Chiudi altre applicazioni pesanti

**🎉 Il tuo browsergame è pronto per il test!**