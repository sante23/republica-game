# 🚀 Setup Repository Git - Guida Completa

## 📋 Passaggi per creare la repository

### 1. 🌐 Crea Repository su GitHub

1. **Vai su GitHub**: [github.com](https://github.com)
2. **Login** con il tuo account
3. **Clicca "+" in alto a destra** → "New repository"
4. **Compila i campi**:
   ```
   Repository name: republica-game
   Description: 🏛️ Political-economic browser game with elections and trading
   Visibility: ☑️ Public (o Private se preferisci)
   ☐ Add a README file (lascia vuoto - abbiamo già il nostro)
   Add .gitignore: None (abbiamo già il nostro)
   Choose a license: None (aggiungiamo dopo)
   ```
5. **Clicca "Create repository"**

### 2. 📡 Carica il Codice

Dopo aver creato la repository, GitHub ti mostrerà una pagina con i comandi. 
**Copia l'URL della tua repository** (sarà tipo `https://github.com/sante23@gmail.com/republica-game.git`)

Poi esegui questi comandi **nella cartella del progetto**:

```bash
# Sei già nella directory giusta
cd /Users/sante/Downloads/Bro_game/republica-game

# Aggiungi il remote origin (sostituisci con la TUA repository URL)
git remote add origin https://github.com/sante23@gmail.com/republica-game.git

# Push del codice
git push -u origin main
```

### 3. ✅ Verifica Upload

Vai sulla tua repository GitHub e dovresti vedere:
- ✅ Tutti i file del progetto
- ✅ README.md con la descrizione del gioco
- ✅ Scripts di installazione
- ✅ Frontend e Backend completi

---

## 🔧 Alternative per Repository

### Opzione A: GitHub (Raccomandato)
- ✅ Gratuito per progetti pubblici
- ✅ CI/CD integrato (GitHub Actions)
- ✅ Issues e Wiki
- ✅ Community ampia

### Opzione B: GitLab
- ✅ Gratuito per progetti privati
- ✅ CI/CD avanzato
- ✅ Hosting integrato

### Opzione C: Bitbucket
- ✅ Integrato con Atlassian
- ✅ Gratuito per team piccoli

---

## 🛠️ Comandi Git Utili

```bash
# Stato repository
git status

# Vedere i commit
git log --oneline

# Aggiungere modifiche
git add .
git commit -m "Descrizione modifiche"
git push

# Creare una nuova versione
git tag v1.0.0
git push origin v1.0.0

# Clonare in un nuovo server
git clone https://github.com/sante23@gmail.com/republica-game.git
```

---

## 📦 Aggiornamento Scripts di Installazione

Dopo aver creato la repository, aggiorna i link nei file di installazione:

### File da aggiornare:
1. `scripts/install-server.sh` - riga con `git clone`
2. `scripts/deploy-docker.sh` - riga con repository URL  
3. `README.md` - link della repository
4. `DEPLOYMENT.md` - comandi di installazione

### Sostituzione automatica:
```bash
# Sostituisci sante23@gmail.com con il tuo username GitHub
find . -name "*.sh" -o -name "*.md" | xargs sed -i 's/sante23@gmail.com/sante23@gmail.com/g'
find . -name "*.sh" -o -name "*.md" | xargs sed -i 's/sante23@gmail.com/sante23@gmail.com/g'
```

---

## 🚀 Test Installazione

Dopo aver caricato la repository, testa l'installazione:

```bash
# Su un server pulito
curl -sSL https://raw.githubusercontent.com/sante23@gmail.com/republica-game/main/scripts/install-server.sh | bash

# O clonando
git clone https://github.com/sante23@gmail.com/republica-game.git
cd republica-game
chmod +x scripts/quick-setup.sh
./scripts/quick-setup.sh
```

---

## ⚡ Esempio Comandi Completi

Sostituisci `sante23@gmail.com` con il tuo username GitHub:

```bash
# 1. Aggiungi repository remota
git remote add origin https://github.com/sante23@gmail.com/republica-game.git

# 2. Push iniziale
git push -u origin main

# 3. Test clone (su altro computer/server)
git clone https://github.com/sante23@gmail.com/republica-game.git

# 4. Installazione automatica
cd republica-game
./scripts/quick-setup.sh
```

---

## 🔐 Setup Chiavi SSH (Opzionale)

Per non inserire sempre username/password:

```bash
# Genera chiave SSH
ssh-keygen -t ed25519 -C "tua-email@example.com"

# Copia chiave pubblica
cat ~/.ssh/id_ed25519.pub

# Vai su GitHub → Settings → SSH Keys → Add SSH Key
# Incolla la chiave pubblica

# Cambia URL repository in SSH
git remote set-url origin git@github.com:sante23@gmail.com/republica-game.git
```

---

**🎯 Una volta completato, la tua repository sarà pubblica e chiunque potrà installare Republica con un singolo comando!**

```bash
curl -sSL https://raw.githubusercontent.com/sante23@gmail.com/republica-game/main/scripts/install-server.sh | bash
```