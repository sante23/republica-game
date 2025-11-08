# 🖥️ Server Requirements & Hosting Guide

Guida completa per scegliere e configurare il server per Republica Game.

## 📊 Specifiche Server Raccomandate

### 🏠 Per Testing/Sviluppo (50-100 giocatori)
- **CPU**: 2 vCPU
- **RAM**: 4GB
- **Storage**: 50GB SSD
- **Bandwidth**: 1TB/mese
- **Costo**: €10-20/mese

### 🏢 Per Produzione Piccola (500 giocatori)
- **CPU**: 4 vCPU
- **RAM**: 8GB
- **Storage**: 100GB SSD
- **Bandwidth**: 3TB/mese
- **Costo**: €40-80/mese

### 🏭 Per Produzione Media (2000 giocatori)
- **CPU**: 8 vCPU
- **RAM**: 16GB
- **Storage**: 200GB SSD
- **Bandwidth**: 10TB/mese
- **Costo**: €150-300/mese

### 🌐 Per Produzione Large (5000+ giocatori)
- **CPU**: 16+ vCPU
- **RAM**: 32GB+
- **Storage**: 500GB+ SSD
- **Bandwidth**: 20TB+/mese
- **Load Balancer**: Necessario
- **Database**: Cluster separato
- **Costo**: €500-1000+/mese

---

## 🌍 Provider Hosting Raccomandati

### 💙 DigitalOcean (Raccomandato per iniziare)

**Pro:**
- ✅ Semplice da usare
- ✅ Prezzi trasparenti
- ✅ SSD veloce
- ✅ Backup automatici
- ✅ Monitoring incluso

**Pricing:**
- **2GB RAM**: €12/mese (sviluppo)
- **4GB RAM**: €24/mese (piccola produzione)
- **8GB RAM**: €48/mese (media produzione)

**Setup:**
```bash
# 1. Crea account su DigitalOcean
# 2. Lancia Droplet Ubuntu 20.04
# 3. SSH al server
ssh root@your-server-ip

# 4. Esegui quick setup
curl -sSL https://raw.githubusercontent.com/sante23@gmail.com/republica-game/main/scripts/install-server.sh | bash
```

### ☁️ AWS EC2

**Pro:**
- ✅ Scalabilità automatica
- ✅ Servizi integrati
- ✅ CDN (CloudFront)
- ✅ Database gestito (RDS)

**Pricing (approssimativo):**
- **t3.medium**: ~€30/mese
- **t3.large**: ~€60/mese
- **t3.xlarge**: ~€120/mese

**Setup:**
```bash
# 1. Lancia EC2 instance
# 2. Configura Security Groups (22, 80, 443)
# 3. Collega Elastic IP
# 4. SSH e installa
ssh -i your-key.pem ubuntu@your-ec2-ip
sudo su
./scripts/install-server.sh
```

### 🔥 Hetzner (Best Performance/Price)

**Pro:**
- ✅ Prezzi eccellenti
- ✅ Hardware potente
- ✅ Data center europei
- ✅ Support 24/7

**Pricing:**
- **CX21**: €5.60/mese (2 vCPU, 4GB)
- **CX31**: €11.90/mese (2 vCPU, 8GB)
- **CX41**: €21.90/mese (4 vCPU, 16GB)

### 🌊 Linode

**Pro:**
- ✅ Performance costante
- ✅ Prezzi competitivi
- ✅ Support eccellente

**Pricing:**
- **Linode 4GB**: €20/mese
- **Linode 8GB**: €40/mese

### 🚀 Vultr

**Pro:**
- ✅ Deploy rapido
- ✅ Prezzi aggressivi
- ✅ Locations globali

**Pricing:**
- **4GB Regular**: €20/mese
- **8GB Regular**: €40/mese

---

## 🛠️ Metodi di Installazione

### 1. 🎯 Quick Setup (Raccomandato)

```bash
# Download e avvia setup guidato
git clone https://github.com/sante23@gmail.com/republica-game.git
cd republica-game
chmod +x scripts/quick-setup.sh
./scripts/quick-setup.sh
```

### 2. 🐳 Docker Deployment

```bash
# Per chi preferisce Docker
git clone https://github.com/sante23@gmail.com/republica-game.git
cd republica-game
chmod +x scripts/deploy-docker.sh
./scripts/deploy-docker.sh
```

### 3. 🔧 Installazione Manuale

```bash
# Per controllo completo
git clone https://github.com/sante23@gmail.com/republica-game.git
cd republica-game
# Segui DEPLOYMENT.md passo per passo
```

---

## 🔧 Configurazioni Ottimizzate

### 🗄️ Database PostgreSQL

**Per server piccoli (2-4GB RAM):**
```sql
-- postgresql.conf
shared_buffers = 128MB
effective_cache_size = 512MB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
```

**Per server medi (8-16GB RAM):**
```sql
-- postgresql.conf
shared_buffers = 512MB
effective_cache_size = 2GB
maintenance_work_mem = 256MB
checkpoint_completion_target = 0.9
wal_buffers = 64MB
default_statistics_target = 100
random_page_cost = 1.1
```

### 🌐 Nginx Optimization

```nginx
# nginx.conf
worker_processes auto;
worker_connections 1024;
keepalive_timeout 65;

# Gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_comp_level 6;

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=1r/s;
```

### 🔄 PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'republica-backend',
    script: './backend/server.js',
    instances: 'max', // Usa tutti i CPU
    exec_mode: 'cluster',
    max_restarts: 10,
    min_uptime: '10s',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

---

## 📈 Scaling Strategy

### 🚀 Fase 1: Single Server (0-500 utenti)
```
[ Frontend + Backend + Database ] → Single VPS
```

### 🚀 Fase 2: Database Separato (500-2000 utenti)
```
[ Frontend + Backend ] → App Server
[ PostgreSQL ] → Database Server
```

### 🚀 Fase 3: Load Balancer (2000-5000 utenti)
```
[ Load Balancer ] → [ App Server 1 ]
                  → [ App Server 2 ]
                  → [ App Server 3 ]
[ Database Cluster ]
[ Redis Cache ]
```

### 🚀 Fase 4: Microservizi (5000+ utenti)
```
[ CDN ] → [ Load Balancer ] → [ Frontend Servers ]
                            → [ API Gateway ] → [ Game Logic Service ]
                                              → [ Market Service ]
                                              → [ Politics Service ]
[ Database Cluster ]
[ Redis Cluster ]
[ File Storage ]
```

---

## 💰 Stima Costi Mensili

### 🏠 Hosting Base
| Utenti | Server | Costo Hosting | CDN | Backup | Totale |
|--------|--------|---------------|-----|--------|--------|
| 50     | 2GB VPS| €12          | €0  | €3     | €15    |
| 200    | 4GB VPS| €24          | €5  | €5     | €34    |
| 500    | 8GB VPS| €48          | €15 | €10    | €73    |
| 2000   | 16GB VPS| €120        | €50 | €20    | €190   |
| 5000   | Cluster| €500         | €150| €50    | €700   |

### 💎 Servizi Aggiuntivi
- **Domain + SSL**: €10-15/anno
- **Email Service**: €5-10/mese
- **Monitoring**: €20-50/mese
- **Backup Storage**: €5-20/mese
- **Support**: €100-500/mese

---

## 🎯 Raccomandazioni per Budget

### 💸 Budget Basso (<€50/mese)
**Provider**: Hetzner CX21 o DigitalOcean Basic
**Specs**: 2 vCPU, 4GB RAM, 40GB SSD
**Utenti**: Fino a 200
```bash
# Setup rapido
./scripts/quick-setup.sh
# Scegli opzione 1 (Manual Installation)
```

### 💰 Budget Medio (€50-200/mese)
**Provider**: DigitalOcean o AWS t3.large
**Specs**: 4-8 vCPU, 8-16GB RAM, 100GB SSD
**Utenti**: 500-2000
**Extra**: CDN, Backup automatico, Monitoring

### 💎 Budget Alto (€200+/mese)
**Provider**: AWS/GCP con auto-scaling
**Specs**: Multi-server setup
**Utenti**: 2000+
**Extra**: Load balancer, Database cluster, Support premium

---

## 🚨 Checklist Pre-Launch

### ✅ Server Setup
- [ ] Server provisioned con specs adeguate
- [ ] Domain configurato e SSL attivo
- [ ] Firewall e sicurezza configurati
- [ ] Backup automatico attivo
- [ ] Monitoring configurato

### ✅ Application
- [ ] Database ottimizzato e popolato
- [ ] PM2 processi running
- [ ] Nginx configurato correttamente
- [ ] Health checks funzionanti
- [ ] Log rotation configurata

### ✅ Performance
- [ ] Load testing completato
- [ ] CDN configurato (se necessario)
- [ ] Rate limiting attivo
- [ ] Cache configurata
- [ ] Database indexed

### ✅ Security
- [ ] SSL certificate valido
- [ ] Fail2ban attivo
- [ ] Password sicure
- [ ] Access logs monitored
- [ ] Backup criptati

---

## 📞 Support & Assistenza

### 🛠️ Self-Service
- 📖 Leggi `DEPLOYMENT.md` per troubleshooting
- 🔍 Usa `scripts/health-check.sh` per diagnosi
- 📊 Monitora con `pm2 monit` e `htop`

### 💬 Community Support
- 💬 Discord: [Unisciti alla community](https://discord.gg/republica)
- 📧 Email: support@republicagame.com
- 🐛 Issues: [GitHub Issues](https://github.com/sante23@gmail.com/republica-game/issues)

### 🏆 Professional Support
- 📞 Setup assistito: €200 one-time
- 🛡️ Managed hosting: €100-500/mese
- 🚀 Custom scaling: Quote su richiesta

---

**🎮 Ready to launch your Republica empire?**

Scegli il tuo budget, segui la guida, e il tuo browsergame sarà online in 30 minuti! 🚀