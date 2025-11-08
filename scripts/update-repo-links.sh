#!/bin/bash

# 🔗 Script per aggiornare i link della repository
# Esegui dopo aver creato la repository GitHub

echo "🔗 AGGIORNAMENTO LINK REPOSITORY"
echo "================================"

# Richiedi username GitHub
read -p "Inserisci il tuo username GitHub: " GITHUB_USER

if [[ -z "$GITHUB_USER" ]]; then
    echo "❌ Username richiesto!"
    exit 1
fi

echo "🔄 Aggiornando i link per: https://github.com/$GITHUB_USER/republica-game"

# Lista file da aggiornare
FILES=(
    "scripts/install-server.sh"
    "scripts/deploy-docker.sh" 
    "README.md"
    "DEPLOYMENT.md"
    "SERVER_REQUIREMENTS.md"
    "SETUP_REPOSITORY.md"
)

# Backup originali
echo "💾 Creando backup..."
for file in "${FILES[@]}"; do
    if [[ -f "$file" ]]; then
        cp "$file" "$file.backup"
    fi
done

# Sostituzioni
echo "🔄 Aggiornando link..."

# Sostituisci placeholder generici
for file in "${FILES[@]}"; do
    if [[ -f "$file" ]]; then
        # Sostituisci vari placeholder
        sed -i.tmp "s|your-repo|$GITHUB_USER|g" "$file"
        sed -i.tmp "s|YOUR_USERNAME|$GITHUB_USER|g" "$file" 
        sed -i.tmp "s|your-username|$GITHUB_USER|g" "$file"
        sed -i.tmp "s|TUO_USERNAME|$GITHUB_USER|g" "$file"
        sed -i.tmp "s|SANTE_GITHUB|$GITHUB_USER|g" "$file"
        
        # Pulisci file temporanei
        rm -f "$file.tmp"
        
        echo "✅ Aggiornato: $file"
    fi
done

# Verifica se git remote esiste già
if git remote get-url origin &>/dev/null; then
    echo "🔄 Aggiornando remote origin..."
    git remote set-url origin "https://github.com/$GITHUB_USER/republica-game.git"
else
    echo "➕ Aggiungendo remote origin..."
    git remote add origin "https://github.com/$GITHUB_USER/republica-game.git"
fi

echo ""
echo "🎉 AGGIORNAMENTO COMPLETATO!"
echo "=========================="
echo ""
echo "📋 File aggiornati:"
for file in "${FILES[@]}"; do
    if [[ -f "$file" ]]; then
        echo "  ✅ $file"
    fi
done
echo ""
echo "🔗 Repository URL: https://github.com/$GITHUB_USER/republica-game"
echo ""
echo "📤 Prossimi passi:"
echo "1. Verifica che la repository GitHub sia stata creata"
echo "2. Fai commit delle modifiche:"
echo "   git add ."
echo "   git commit -m 'Update repository links'"
echo "3. Push del codice:"
echo "   git push -u origin main"
echo ""
echo "🚀 URL installazione finale:"
echo "   https://raw.githubusercontent.com/$GITHUB_USER/republica-game/main/scripts/install-server.sh"
echo ""

# Mostra comando git
echo "💡 Comandi pronti da eseguire:"
echo ""
echo "git add ."
echo "git commit -m 'Update repository links to $GITHUB_USER'"
echo "git push -u origin main"
echo ""
echo "🧪 Test installazione:"
echo "curl -sSL https://raw.githubusercontent.com/$GITHUB_USER/republica-game/main/scripts/install-server.sh | bash"