# Architecture et Contexte - Générateur de Quiz Interactif

## Objectif de l'application
L'application "L'Aventure du Savoir" est un générateur de quiz interactif destiné aux enfants. L'objectif est de prendre en entrée une ou plusieurs photos de cours, de les envoyer à une Intelligence Artificielle, et de générer un quiz interactif (QCM, Vrai/Faux, Questions ouvertes) avec lequel l'enfant peut jouer et obtenir un score avec des explications.

## Stack Technique
- **Frontend** : Vanilla JavaScript (sans framework lourd type React/Vue).
- **Style** : TailwindCSS (via CDN ou classes utilitaires pré-compilées) et CSS pur pour les animations.
- **Build & Serve** : Vite.js.
- **PWA** : Support PWA (Progressive Web App) configuré via `vite-plugin-pwa` dans `vite.config.js`.
- **Hébergement** : GitHub Pages (déploiement automatisé via GitHub Actions `.github/workflows/deploy.yml`).

## Fonctionnement du code (`src/main.js`)
L'ensemble de la logique est centralisé dans `src/main.js` :
1. **Gestion de l'UI** : Écouteurs d'événements pour le drag & drop, la configuration du nombre de questions, et la navigation entre les écrans (upload -> quiz -> stats).
2. **Stockage Local** : Utilisation du `localStorage` (`quiz_archives`) pour sauvegarder l'historique des quiz générés et permettre à l'utilisateur de les refaire plus tard sans rappeler l'API.
3. **Appel API** : La fonction `submitFilesToAPI` prépare le prompt avec le contexte et les images encodées en base64, puis effectue une requête HTTP à l'API IA.
4. **Moteur de Quiz** : Les fonctions `renderQuestion`, `handleOptionAnswer` et `handleDirectAnswer` gèrent la validation des réponses. La validation des questions ouvertes inclut une tolérance aux fautes de frappe via la **distance de Levenshtein** et une normalisation des chaînes (suppression d'accents/articles).

## Configuration API et Sécurité
- L'application utilise **l'API Gemini** (`https://generativelanguage.googleapis.com/v1beta/models`) avec des modèles comme `gemini-2.5-flash` ou `gemini-2.0-flash`. L'avantage de Gemini est son excellent support natif de la vision (analyse d'images de cours).
- **Sécurité (Alerte technique)** : L'application étant un pur frontend déployé sur GitHub Pages, la clé API (`VITE_GEMINI_API_KEY`) est injectée à la compilation. **Cette clé est donc visible publiquement dans le code JavaScript.** Pour la sécuriser, il faudrait un backend ou une fonction serverless.

## Arborescence
- `index.html` : Structure de la page et templates de l'interface.
- `src/main.js` : Toute la logique applicative.
- `src/styles.css` : Quelques styles personnalisés et animations.
- `vite.config.js` : Configuration du build et du plugin PWA.
- `.env` (non versionné) : Sert à stocker `VITE_API_KEY` en local.
