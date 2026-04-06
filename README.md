# 🚀 Déploiement du Quiz Generator

Cette application est prête à être déployée sur le Cloud pour être utilisée sur vos téléphones et tablettes.

## 📱 Utilisation Mobile
Grâce aux dernières modifications, vos quiz sont sauvegardés directement dans votre navigateur (**LocalStorage**). Chaque appareil (téléphone, tablette, PC) conserve ses propres archives.

## 🛠️ Étapes de Déploiement

### 1. GitHub
1.  Créez un nouveau dépôt sur [GitHub](https://github.com/new).
2.  Initialisez git dans ce dossier (si ce n'est pas déjà fait) :
    ```bash
    git init
    git add .
    git commit -m "Prêt pour le déploiement cloud"
    ```
3.  Liez votre dossier local au dépôt GitHub et envoyez le code.

### 2. Hébergement (Vercel recommandé)
1.  Connectez-vous sur [Vercel](https://vercel.com) avec votre compte GitHub.
2.  Cliquez sur **"Add New"** > **"Project"**.
3.  Importez votre dépôt `quiz_generator`.
4.  **IMPORTANT :** Avant de cliquer sur "Deploy", allez dans **"Environment Variables"**.
5.  Ajoutez la variable suivante :
    -   **Key** : `GEMINI_API_KEY`
    -   **Value** : (Votre clé API Google AI Studio)
6.  Cliquez sur **Deploy**.

### 3. Utilisation
Une fois le déploiement terminé, Vercel vous donnera une URL (ex: `quiz-generator.vercel.app`).
-   Ouvrez cette URL sur votre **téléphone** ou **tablette**.
-   Ajoutez l'application à votre **écran d'accueil** pour une expérience optimale !

---

## 🔒 Sécurité
-   Le fichier `.env` est ignoré par Git (via `.gitignore`). Ne le publiez jamais.
-   Votre clé API est stockée de manière sécurisée dans les paramètres de Vercel.

## 💡 Note Technique
Le backend Flask ne sert désormais que de passerelle vers l'IA de Google. Toutes les données de quiz sont stockées par votre navigateur, ce qui rend l'application extrêmement rapide et légère sur le Cloud.
