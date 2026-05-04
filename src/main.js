// --- Utilitaire : Validation du schéma JSON retourné par Gemini ---
function validateQuizData(data) {
    if (!data || typeof data !== 'object') throw new Error('Réponse invalide reçue de l\'IA.');
    if (typeof data.title !== 'string' || !data.title.trim()) throw new Error('Le quiz ne contient pas de titre.');
    if (!Array.isArray(data.questions) || data.questions.length === 0) throw new Error('Le quiz ne contient aucune question.');
    const validTypes = ['qcm', 'boolean', 'direct'];
    data.questions.forEach((q, i) => {
        if (!validTypes.includes(q.type)) throw new Error(`Question ${i + 1} : type invalide "${q.type}".`);
        if (typeof q.question !== 'string' || !q.question.trim()) throw new Error(`Question ${i + 1} : texte manquant.`);
        if (q.type === 'qcm' && (!Array.isArray(q.options) || q.options.length !== 4)) throw new Error(`Question ${i + 1} (QCM) : 4 options requises.`);
        if (q.type === 'direct' && (typeof q.direct_answer !== 'string' || !q.direct_answer.trim())) throw new Error(`Question ${i + 1} (directe) : réponse attendue manquante.`);
    });
    return data;
}

// --- Utilitaire : Distance de Levenshtein (tolérance aux fautes de frappe) ---
function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({length: m + 1}, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i-1] === b[j-1]
                ? dp[i-1][j-1]
                : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
        }
    }
    return dp[m][n];
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements DOM ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    const uploadInitial = document.getElementById('upload-initial');
    const uploadLoading = document.getElementById('upload-loading');
    
    const uploadSection = document.getElementById('upload-section');
    const quizSection = document.getElementById('quiz-section');
    const footerProgress = document.getElementById('footer-progress');
    
    const btnHome = document.getElementById('btn-home');

    // Clé API injectée au build via GitHub Secret VITE_GEMINI_API_KEY
    const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

    // Sliders de Paramétrage Adulte
    const numQcmInput = document.getElementById('num-qcm-input');
    const numQcmLabel = document.getElementById('num-qcm-label');
    const numBooleanInput = document.getElementById('num-boolean-input');
    const numBooleanLabel = document.getElementById('num-boolean-label');
    const numDirectInput = document.getElementById('num-direct-input');
    const numDirectLabel = document.getElementById('num-direct-label');
    const numTotalLabel = document.getElementById('num-total-label');

    function updateTotal() {
        const qcm = parseInt(numQcmInput.value) || 0;
        const bool = parseInt(numBooleanInput.value) || 0;
        const direct = parseInt(numDirectInput.value) || 0;
        numQcmLabel.textContent = qcm;
        numBooleanLabel.textContent = bool;
        numDirectLabel.textContent = direct;
        numTotalLabel.textContent = qcm + bool + direct;
    }

    const archivesList = document.getElementById('archives-list');
    const mainTitle = document.getElementById('main-title');
    const mainSubtitle = document.getElementById('main-subtitle');
    const introSection = document.getElementById('intro-section');
    const summaryList = document.getElementById('summary-list');
    const startQuizBtn = document.getElementById('start-quiz-btn');
    startQuizBtn.addEventListener('click', () => {
        introSection.classList.add('hidden');
        quizSection.classList.remove('hidden');
        footerProgress.classList.remove('hidden');
        renderQuestion();
    });

    // Modale HTML
    const confirmModal = document.getElementById('confirm-modal');
    const confirmModalCard = document.getElementById('confirm-modal-card');
    const modalNumQ = document.getElementById('modal-num-q');
    const modalCancel = document.getElementById('modal-cancel');
    const modalConfirm = document.getElementById('modal-confirm');
    let pendingFiles = [];

    // --- Variables d'Etat du Quiz ---
    let currentQuiz = null;
    let currentQuestionIndex = 0;
    let score = 0;
    let questionResults = []; // [{type, question, isCorrect}]

    // --- Initiation : Charger les archives ---
    loadArchives();

    // --- Tiroir sidebar mobile ---
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    function openSidebar() {
        sidebar.classList.remove('-translate-x-full');
        sidebarOverlay.classList.remove('hidden');
    }
    function closeSidebar() {
        sidebar.classList.add('-translate-x-full');
        sidebarOverlay.classList.add('hidden');
    }
    sidebarToggle?.addEventListener('click', openSidebar);
    sidebarOverlay?.addEventListener('click', closeSidebar);

    // UI Listeners
    document.querySelectorAll('.slider-config').forEach(sl => sl.addEventListener('input', updateTotal));
    btnHome.addEventListener('click', resetToUpload);
    
    browseBtn.addEventListener('click', () => fileInput.click());


    // Modal UI listeners
    function closeConfirmModal() {
        confirmModal.classList.add('opacity-0', 'pointer-events-none');
        confirmModalCard.classList.replace('scale-100', 'scale-95');
        pendingFiles = [];
        fileInput.value = "";
    }

    modalCancel.addEventListener('click', closeConfirmModal);
    
    modalConfirm.addEventListener('click', () => {
        if (!pendingFiles.length) return;
        const files = pendingFiles;
        const qcm = numQcmInput.value;
        const bool = numBooleanInput.value;
        const dir = numDirectInput.value;
        closeConfirmModal();
        submitFilesToAPI(files, qcm, bool, dir);
    });

    // --- Drag and Drop Logic ---
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-primary', 'bg-secondary-container/10');
    });
    
    ['dragleave', 'dragend'].forEach(type => {
        dropZone.addEventListener(type, (e) => {
            dropZone.classList.remove('border-primary', 'bg-secondary-container/10');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-primary', 'bg-secondary-container/10');
        if (e.dataTransfer.files.length > 0) {
            // On assigne les fichiers dropés à l'input file pour conserver leurs handles actifs
            // dans la mémoire du navigateur, sinon Chromium détruit la référence une fois l'événement terminé
            // ce qui cause l'erreur "Failed to fetch" lors du clic sur Confirmer.
            fileInput.files = e.dataTransfer.files;
            processFiles(Array.from(fileInput.files));
        }
    });

    // --- Fichiers via bouton browse ---
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) processFiles(Array.from(e.target.files));
    });

    // --- API & Logique Principale ---
    async function processFiles(files) {
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
        const valid = files.filter(f => validTypes.includes(f.type) && f.size <= MAX_FILE_SIZE);
        const tooLarge = files.filter(f => validTypes.includes(f.type) && f.size > MAX_FILE_SIZE);
        const invalid = files.filter(f => !validTypes.includes(f.type));

        const errorBox = document.getElementById('upload-format-error');
        const errorMsg = document.getElementById('upload-format-error-msg');

        // Toujours effacer l'erreur précédente
        errorBox.classList.add('hidden');

        if (tooLarge.length > 0) {
            errorMsg.textContent = `❌ Fichier trop volumineux (max 10 Mo) : ${tooLarge.map(f => `"${f.name}"`).join(', ')}.`;
            errorBox.classList.remove('hidden');
            errorBox.classList.add('fade-in');
        }

        if (invalid.length > 0) {
            const names = invalid.map(f => `"${f.name}"`).join(', ');
            const ext = invalid.map(f => {
                const parts = f.name.split('.');
                return parts.length > 1 ? `.${parts.pop().toUpperCase()}` : 'inconnu';
            }).join(', ');
            errorMsg.textContent = `❌ Format non supporté (${ext}) : ${names}. Merci d'utiliser un fichier PDF, PNG, JPEG ou JPG.`;
            errorBox.classList.remove('hidden');
            errorBox.classList.add('fade-in');
        }

        if (valid.length === 0) {
            return;
        }

        const total = (parseInt(numQcmInput.value) || 0) + (parseInt(numBooleanInput.value) || 0) + (parseInt(numDirectInput.value) || 0);
        if (total === 0) {
            alert('Veuillez sélectionner au moins 1 question dans les réglages.');
            return;
        }

        pendingFiles = valid;
        modalNumQ.textContent = `${total} question${total > 1 ? 's' : ''}`;

        // Afficher la liste des fichiers dans la modal
        const modalNumFiles = document.getElementById('modal-num-files');
        const modalFilesList = document.getElementById('modal-files-list');
        modalNumFiles.textContent = `${valid.length} photo${valid.length > 1 ? 's' : ''}`;
        modalFilesList.innerHTML = '';
        valid.forEach((f, i) => {
            const item = document.createElement('div');
            item.className = 'flex items-center gap-2 text-xs font-semibold text-indigo-700';
            const numSpan = document.createElement('span');
            numSpan.className = 'w-5 h-5 rounded-full bg-secondary/10 flex items-center justify-center text-secondary shrink-0 font-black';
            numSpan.textContent = i + 1;
            const nameSpan = document.createElement('span');
            nameSpan.className = 'truncate';
            nameSpan.textContent = f.name;
            const sizeSpan = document.createElement('span');
            sizeSpan.className = 'ml-auto text-indigo-300 shrink-0';
            sizeSpan.textContent = `${(f.size / 1024).toFixed(0)} Ko`;
            item.append(numSpan, nameSpan, sizeSpan);
            modalFilesList.appendChild(item);
        });

        // Afficher la modal (et effacer toute erreur précédente)
        errorBox.classList.add('hidden');
        confirmModal.classList.remove('opacity-0', 'pointer-events-none');
        confirmModalCard.classList.replace('scale-95', 'scale-100');
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    async function submitFilesToAPI(files, qcm, bool, dir) {
        const apiKey = GEMINI_API_KEY;
        if (!apiKey) {
            alert("Erreur de configuration : la clé API Gemini est manquante. Contacte l'administrateur de l'application.");
            resetToUpload();
            return;
        }

        // UI Loading
        uploadInitial.classList.add('hidden');
        uploadLoading.classList.remove('hidden');

        try {
            const total_questions = parseInt(qcm) + parseInt(bool) + parseInt(dir);
            const nb_images = files.length;
            const multi_note = nb_images > 1 ? `IMPORTANT : Tu analyses ${nb_images} image(s) de cours simultanément. Tu DOIS couvrir l'ensemble des contenus présents dans TOUTES les images.\n` : "";

            const prompt = `Tu es un concepteur pédagogique expert.
Ta mission est de LIRE, COMPRENDRE et ANALYSER le contenu du cours présent sur ${nb_images > 1 ? 'les images' : "l'image"}, puis de créer un quiz interactif original.
${multi_note}
RÈGLES ABSOLUES À RESPECTER :
1. NOMBRES ET TYPES DE QUESTIONS : Tu dois générer EXACTEMENT ${total_questions} questions au total. Si le cours est court, invente tes propres problèmes d'approfondissement. Tu DOIS IMPERATIVEMENT respecter les quantités et formats suivants :
    - ${qcm} questions de type "qcm". 4 propositions distinctes dans \`options\` (index correct: 0-3 dans \`correct_answer\`).
    - ${bool} questions de type "boolean". Une affirmation testée en Vrai/Faux. \`options\` DOIT être exactement \`["Vrai", "Faux"]\`. \`correct_answer\` sera 0 (Vrai) ou 1 (Faux).
    - ${dir} questions de type "direct". L'enfant devra écrire sa réponse. \`options\` doit être \`null\`, \`correct_answer\` = null. La réponse brute attendue sera dans \`direct_answer\` (écrite en minuscules, maximum 1 ou 2 mots, ex: "mathématiques", "12").
2. FOND, PAS LA FORME : Il est STRICTEMENT INTERDIT de poser des questions descriptives sur l'image elle-même.
3. GÉNÉRALISATION OBLIGATOIRE (CRITIQUE) : NE RÉUTILISE PAS les exemples précis montrés dans le cours (l'enfant n'aura pas le cours sous les yeux !). Tes questions DOIVENT être de nouveaux exercices abstraits parfaits créés par toi-même sur le même concept.
4. EXPLICATION : Fournis toujours une \`explanation\` douce et encourageante.

FORMAT DE SORTIE OBLIGATOIRE (JSON STRICT) :
Renvoie EXCLUSIVEMENT un JSON valide respectant ce format précis :
{
  "title": "Titre captivant",
  "topic": "Sujet exact (1/2 mots)",
  "summary": ["Point clé 1 du cours (phrase courte)", "Point clé 2 du cours", "Point clé 3 du cours"],
  "questions": [
    {
      "type": "qcm", 
      "question": "Texte de la question 1",
      "options": ["Choix A", "Choix B", "Choix C", "Choix D"], 
      "correct_answer": 0, 
      "direct_answer": null, 
      "explanation": "L'explication..."
    }
  ]
}`;

            const geminiParts = [];
            for (const file of files) {
                const base64String = await fileToBase64(file);
                const base64Data = base64String.split(',')[1];
                const mimeType = file.type || "image/jpeg";
                geminiParts.push({
                    inline_data: {
                        mime_type: mimeType,
                        data: base64Data
                    }
                });
            }
            geminiParts.push({ text: prompt });

            const requestBody = {
                contents: [{ parts: geminiParts }],
                generationConfig: {
                    temperature: 0.4,
                    responseMimeType: "application/json"
                }
            };

            const models = [
                'gemini-2.5-flash',
                'gemini-2.0-flash',
                'gemini-2.0-flash-lite',
                'gemini-1.5-flash',
                'gemini-1.5-flash-8b'
            ];

            let response, dataResponse;
            for (const model of models) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000);
                try {
                    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(requestBody),
                        signal: controller.signal
                    });
                    dataResponse = await response.json();
                } finally {
                    clearTimeout(timeoutId);
                }
                if (response.ok || (response.status !== 429 && response.status !== 503)) break;
            }

            if (!response.ok) {
                const status = response.status;
                const msg = dataResponse?.error?.message || '';
                if (status === 429) throw new Error('Quota API dépassé sur tous les modèles. Réessaie dans quelques minutes.');
                if (status === 400) throw new Error('Clé API invalide. Vérifie ta clé dans les réglages.');
                throw new Error(msg || `Erreur API Gemini (${status})`);
            }

            let rawText = dataResponse.candidates[0].content.parts[0].text.trim();
            if (rawText.startsWith("```json")) rawText = rawText.substring(7);
            else if (rawText.startsWith("```")) rawText = rawText.substring(3);
            if (rawText.endsWith("```")) rawText = rawText.substring(0, rawText.length - 3);
            rawText = rawText.trim();
            
            const data = validateQuizData(JSON.parse(rawText));
            data.id = crypto.randomUUID();
            data.created_at = new Date().toISOString();
            
            saveToLocalStorage(data);
            startQuiz(data);
            loadArchives();

        } catch (error) {
            const msg = error.name === 'AbortError'
                ? 'La requête a pris trop de temps (> 60s). Vérifie ta connexion et réessaie.'
                : error.message;
            alert("Erreur lors de la génération : " + msg);
            resetToUpload();
        }
    }

    // --- Gestion des archives via LocalStorage (Cloud-ready) ---
    function saveToLocalStorage(missionData) {
        const archives = JSON.parse(localStorage.getItem('quiz_archives') || '[]');
        // On évite les doublons par ID
        const index = archives.findIndex(a => a.id === missionData.id);
        if (index !== -1) {
            archives[index] = missionData;
        } else {
            archives.unshift(missionData);
        }
        localStorage.setItem('quiz_archives', JSON.stringify(archives));
    }

    function loadArchives() {
        try {
            const archives = JSON.parse(localStorage.getItem('quiz_archives') || '[]');
            archivesList.innerHTML = '';
            
            archives.forEach(mission => {
                const div = document.createElement('div');
                div.className = "flex items-center gap-3 p-3 bg-surface-container-lowest hover:bg-surface-container-low rounded-full shadow-sm border border-outline-variant/10 transition-colors group cursor-pointer fade-in";
                
                // Icone
                const iconDiv = document.createElement('div');
                iconDiv.className = "w-8 h-8 rounded-full bg-secondary-container/30 flex items-center justify-center text-secondary shrink-0";
                iconDiv.innerHTML = `<span class="material-symbols-outlined text-lg">description</span>`;
                
                const textDiv = document.createElement('div');
                textDiv.className = "flex-1 min-w-0 pointer-events-none";
                const date = mission.created_at ? new Date(mission.created_at).toLocaleDateString('fr-FR') : 'Date inconnue';
                const titleP = document.createElement('p');
                titleP.className = 'text-[11px] font-bold text-indigo-900 truncate';
                titleP.textContent = mission.title;
                const metaP = document.createElement('p');
                metaP.className = 'text-[9px] text-indigo-400 font-medium';
                metaP.textContent = `${mission.topic} • ${date}`;
                textDiv.append(titleP, metaP);

                // Bouton supprimer
                const delBtn = document.createElement('button');
                delBtn.className = "w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-indigo-300 hover:text-error hover:bg-error-container/20 transition-all opacity-0 group-hover:opacity-100";
                delBtn.innerHTML = `<span class="material-symbols-outlined text-lg pointer-events-none">delete</span>`;
                
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if(confirm("Supprimer cette archive de votre navigateur ?")) {
                        removeFromLocalStorage(mission.id);
                        loadArchives();
                        if (currentQuiz && currentQuiz.id === mission.id) resetToUpload();
                    }
                });

                div.appendChild(iconDiv);
                div.appendChild(textDiv);
                div.appendChild(delBtn);

                div.addEventListener('click', () => loadMission(mission.id));
                archivesList.appendChild(div);
            });
        } catch(e) {
            console.error("Erreur chargement archives", e);
        }
    }

    function removeFromLocalStorage(id) {
        let archives = JSON.parse(localStorage.getItem('quiz_archives') || '[]');
        archives = archives.filter(a => a.id !== id);
        localStorage.setItem('quiz_archives', JSON.stringify(archives));
    }

    function loadMission(id) {
        try {
            const archives = JSON.parse(localStorage.getItem('quiz_archives') || '[]');
            const mission = archives.find(a => a.id === id);
            if (mission) {
                startQuiz(mission);
            } else {
                alert("Mission non trouvée dans votre navigateur.");
            }
        } catch(e) {
            console.error("Impossible de charger la mission", e);
        }
    }

    // --- Logique du Moteur de Quiz ---
    function startQuiz(quizData) {
        currentQuiz = quizData;
        currentQuestionIndex = 0;
        score = 0;
        questionResults = [];
        
        mainTitle.textContent = currentQuiz.title;
        mainSubtitle.textContent = `Thème : ${currentQuiz.topic}`;
        
        uploadSection.classList.add('hidden');
        quizSection.classList.add('hidden');
        footerProgress.classList.add('hidden');
        document.getElementById('quiz-end-screen').style.display = 'none';
        document.getElementById('quiz-question-container').style.display = 'block';

        // Afficher l'écran de résumé si l'IA a fourni un summary
        const summaryData = currentQuiz.summary;
        summaryList.innerHTML = '';
        if (summaryData && Array.isArray(summaryData) && summaryData.length > 0) {
            summaryData.forEach(point => {
                const li = document.createElement('li');
                li.className = 'flex items-start gap-3 text-indigo-800 font-semibold text-sm';
                const iconWrap = document.createElement('span');
                iconWrap.className = 'mt-0.5 w-6 h-6 rounded-full bg-secondary/10 text-secondary flex items-center justify-center shrink-0';
                const icon = document.createElement('span');
                icon.className = 'material-symbols-outlined text-base';
                icon.style.fontVariationSettings = "'FILL' 1";
                icon.textContent = 'check_circle';
                iconWrap.appendChild(icon);
                const text = document.createElement('span');
                text.textContent = point;
                li.append(iconWrap, text);
                summaryList.appendChild(li);
            });
            introSection.classList.remove('hidden');
        } else {
            // Pas de summary -> on passe directement au quiz
            introSection.classList.add('hidden');
            quizSection.classList.remove('hidden');
            footerProgress.classList.remove('hidden');
            renderQuestion();
        }
    }

    function renderQuestion() {
        const qData = currentQuiz.questions[currentQuestionIndex];
        const total = currentQuiz.questions.length;
        const type = qData.type || 'qcm';
        
        document.getElementById('q-counter').textContent = `QUESTION ${currentQuestionIndex + 1} SUR ${total}`;
        const typeBadge = type === 'qcm' ? 'QCM' : (type === 'boolean' ? 'Vrai/Faux' : 'Saisie Directe');
        document.getElementById('q-counter').textContent += ` - ${typeBadge}`;
        
        document.getElementById('q-text').textContent = qData.question;
        
        const optionsContainer = document.getElementById('q-options');
        optionsContainer.innerHTML = '';
        
        const explanationBox = document.getElementById('q-explanation-box');
        explanationBox.classList.add('hidden');
        
        // --- Rendu selon le type ---
        if (type === 'qcm') {
            optionsContainer.className = "grid gap-4"; // reset
            const letters = ['A', 'B', 'C', 'D'];
            
            // Shuffle
            if (!qData.shuffled && qData.options) {
                const correctText = qData.options[qData.correct_answer];
                let shuffledOptions = [...qData.options];
                for (let i = shuffledOptions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
                }
                qData.options = shuffledOptions;
                qData.correct_answer = shuffledOptions.indexOf(correctText);
                qData.shuffled = true;
            }

            qData.options.forEach((optText, index) => {
                const btn = document.createElement('button');
                btn.className = "group option-btn flex items-center gap-4 p-5 bg-white rounded-full border-4 border-transparent hover:border-secondary hover:shadow-xl transition-all text-left w-full";
                const letterDiv = document.createElement('div');
                letterDiv.className = 'w-12 h-12 rounded-full bg-indigo-50 flex shrink-0 items-center justify-center text-xl font-black text-secondary group-hover:bg-secondary group-hover:text-white transition-colors letter-circle';
                letterDiv.textContent = letters[index];
                const optSpan = document.createElement('span');
                optSpan.className = 'text-lg font-bold text-indigo-800 flex-1';
                optSpan.textContent = optText;
                const iconSpan = document.createElement('span');
                iconSpan.className = 'material-symbols-outlined ml-auto result-icon hidden';
                btn.append(letterDiv, optSpan, iconSpan);
                btn.addEventListener('click', () => handleOptionAnswer(index, btn, qData, 'qcm'));
                optionsContainer.appendChild(btn);
            });
        } 
        else if (type === 'boolean') {
            optionsContainer.className = "grid grid-cols-2 gap-4";
            ['Vrai', 'Faux'].forEach((optText, index) => {
                const btn = document.createElement('button');
                const color = index === 0 ? 'green' : 'tertiary'; // green or red
                const iconStr = index === 0 ? 'check_circle' : 'cancel';
                btn.className = `group option-btn flex flex-col items-center justify-center p-8 bg-white rounded-[2rem] border-4 border-transparent hover:border-${color} hover:shadow-xl transition-all`;
                btn.innerHTML = `
                    <span class="material-symbols-outlined text-5xl mb-2 text-indigo-200 group-hover:text-${color} transition-colors result-icon">${iconStr}</span>
                    <span class="text-2xl font-black text-indigo-900">${optText}</span>
                `;
                btn.addEventListener('click', () => handleOptionAnswer(index, btn, qData, 'boolean'));
                optionsContainer.appendChild(btn);
            });
        } 
        else if (type === 'direct') {
            optionsContainer.className = "flex flex-col gap-4";
            optionsContainer.innerHTML = `
                <div class="relative w-full">
                    <input type="text" id="direct-input" class="w-full bg-white border-4 border-indigo-50 rounded-[2rem] p-6 text-xl font-bold text-indigo-900 focus:outline-none focus:border-secondary shadow-sm" placeholder="Écris ta réponse ici..." autocomplete="off">
                    <span class="material-symbols-outlined absolute right-6 top-1/2 -translate-y-1/2 text-3xl hidden" id="direct-icon"></span>
                </div>
                <button id="direct-submit" class="mt-2 w-full py-5 bg-secondary text-white text-xl font-black rounded-full hover:scale-[1.02] shadow-xl hover:bg-secondary/90 transition-all">Valider la réponse</button>
            `;
            const submitBtn = document.getElementById('direct-submit');
            const directInput = document.getElementById('direct-input');
            submitBtn.addEventListener('click', () => handleDirectAnswer(directInput.value, qData));
            directInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleDirectAnswer(directInput.value, qData);
            });
            setTimeout(() => directInput.focus(), 100);
        }

        updateProgress();
    }

    function handleOptionAnswer(selectedIndex, btnElem, qData, type) {
        const allBtns = document.querySelectorAll('.option-btn');
        allBtns.forEach(b => {
             b.disabled = true;
             b.classList.remove('hover:border-secondary', 'hover:border-green', 'hover:border-tertiary', 'hover:shadow-xl');
             b.classList.add('opacity-50');
             b.style.pointerEvents = 'none';
        });
        btnElem.classList.remove('opacity-50');

        const isCorrect = selectedIndex === qData.correct_answer;
        const icon = btnElem.querySelector('.result-icon');
        
        if (type === 'qcm') {
            const letterCircle = btnElem.querySelector('.letter-circle');
            icon.classList.remove('hidden');
            if (isCorrect) {
                score++;
                btnElem.classList.add('bg-green-50', 'border-green-500', 'shadow-lg');
                letterCircle.classList.replace('bg-indigo-50', 'bg-green-500');
                letterCircle.classList.replace('text-secondary', 'text-white');
                icon.classList.add('text-green-500');
                icon.textContent = 'check_circle';
            } else {
                btnElem.classList.add('border-red-500', 'shake', 'bg-red-50');
                letterCircle.classList.replace('bg-indigo-50', 'bg-red-500');
                letterCircle.classList.replace('text-secondary', 'text-white');
                icon.classList.add('text-red-500');
                icon.textContent = 'cancel';
                allBtns[qData.correct_answer].classList.remove('opacity-50');
                allBtns[qData.correct_answer].classList.add('border-green-500', 'opacity-80');
            }
        } else if (type === 'boolean') {
            if (isCorrect) {
                score++;
                btnElem.classList.add('border-green-500', 'bg-green-50');
                icon.classList.add('text-green-500');
            } else {
                btnElem.classList.add('border-red-500', 'shake', 'bg-red-50');
                icon.classList.add('text-red-500');
                allBtns[qData.correct_answer].classList.remove('opacity-50');
                allBtns[qData.correct_answer].classList.add('border-green-500', 'opacity-80', 'bg-green-50');
            }
        }

        questionResults.push({ type: qData.type, question: qData.question, isCorrect });
        showExplanationAndNext(qData, isCorrect);
    }
    
    function handleDirectAnswer(userText, qData) {
        const inputElem = document.getElementById('direct-input');
        const submitBtn = document.getElementById('direct-submit');
        const icon = document.getElementById('direct-icon');
        
        if (!userText.trim()) return; // require some input
        
        inputElem.disabled = true;
        submitBtn.style.display = 'none';
        icon.classList.remove('hidden');
        
        const expected = (qData.direct_answer || "").trim();
        const user = userText.trim();
        
        // Normalisation intelligente : accents, casse, articles français
        function normalize(str) {
            return str
                .toLowerCase()
                // Supprimer les accents
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                // Supprimer les articles français en début de chaîne
                .replace(/^(l'|le |la |les |un |une |des |du |de la |de l')/i, '')
                .trim();
        }

        let isCorrect = false;
        if (expected && user) {
            const normExpected = normalize(expected);
            const normUser = normalize(user);

            // Correspondance exacte après normalisation
            if (normUser === normExpected) {
                isCorrect = true;
            // L'un contient l'autre (ex: "l'échelle" vs "échelle des cartes")
            } else if (normUser.includes(normExpected) || normExpected.includes(normUser)) {
                isCorrect = true;
            // Distance de Levenshtein ≤ 1 (tolérance d'1 faute de frappe)
            } else {
                const dist = levenshtein(normUser, normExpected);
                if (dist <= 1) isCorrect = true;
            }
        }

        if (isCorrect) {
            score++;
            inputElem.classList.replace('border-indigo-50', 'border-green-500');
            inputElem.classList.add('bg-green-50', 'text-green-600');
            icon.classList.add('text-green-600');
            icon.textContent = 'check_circle';
        } else {
            inputElem.classList.replace('border-indigo-50', 'border-red-500');
            inputElem.classList.add('bg-red-50', 'text-red-600', 'shake');
            icon.classList.add('text-red-600');
            icon.textContent = 'cancel';
            
            // Montrer la réponse attendue à l'enfant sous le champ
            const correction = document.createElement('p');
            correction.className = "text-error font-bold mt-2 ml-4 fade-in";
            correction.textContent = `La réponse attendue était : ${qData.direct_answer}`;
            inputElem.parentNode.appendChild(correction);
        }
        questionResults.push({ type: qData.type, question: qData.question, isCorrect });
        showExplanationAndNext(qData, isCorrect);
    }

    function showExplanationAndNext(qData, isCorrect) {
        updateProgress();

        // Header dynamique selon le résultat
        const explanationBox = document.getElementById('q-explanation-box');
        const explanationHeader = explanationBox.querySelector('.explanation-header');
        if (isCorrect) {
            explanationHeader.textContent = '✅ Bravo ! Voici pourquoi :';
            explanationBox.classList.remove('bg-red-50', 'border-red-200');
            explanationBox.classList.add('bg-tertiary-container/30', 'border-tertiary-container/50');
            explanationHeader.className = 'explanation-header font-black text-green-700 mb-2 text-sm';
        } else {
            explanationHeader.textContent = '❌ Dommage ! Voici la bonne réponse :';
            explanationBox.classList.remove('bg-tertiary-container/30', 'border-tertiary-container/50');
            explanationBox.classList.add('bg-red-50', 'border-red-200');
            explanationHeader.className = 'explanation-header font-black text-red-600 mb-2 text-sm';
        }

        // Explication générée par l'IA (en supprimant tout "Bravo" pré-existant)
        const rawExplanation = qData.explanation || '';
        const cleanedExplanation = rawExplanation.replace(/^(bravo\s*[!.]*\s*)/i, '');
        document.getElementById('q-explanation-text').textContent = cleanedExplanation;
        explanationBox.classList.remove('hidden');
        explanationBox.classList.add('fade-in');
        
        const nextBtn = document.getElementById('next-q-btn');
        nextBtn.onclick = () => {
            if (currentQuestionIndex < currentQuiz.questions.length - 1) {
                currentQuestionIndex++;
                renderQuestion();
            } else {
                showEndScreen();
            }
        };
    }

    function updateProgress() {
        if (!currentQuiz) return;
        const total = currentQuiz.questions.length;
        const percent = Math.round((currentQuestionIndex / total) * 100);
        
        document.getElementById('progress-text').textContent = `${percent}%`;
        document.getElementById('progress-bar-fill').style.width = `${percent}%`;
        document.getElementById('score-text').textContent = `Score: ${score}/${total}`;
    }

    function showEndScreen() {
        document.getElementById('quiz-question-container').style.display = 'none';
        
        const endScreen = document.getElementById('quiz-end-screen');
        endScreen.style.display = 'block';
        endScreen.classList.add('fade-in');
        
        const total = currentQuiz.questions.length;
        document.getElementById('final-score-text').textContent = `Score final : ${score} / ${total}`;
        document.getElementById('progress-bar-fill').style.width = `100%`;
        document.getElementById('progress-text').textContent = `100% ✅`;

        // -- Bouton Stats : toggle affichage --
        const statsBtn = document.getElementById('stats-btn');
        const statsPanel = document.getElementById('stats-panel');
        statsPanel.classList.add('hidden');

        statsBtn.onclick = () => {
            const isHidden = statsPanel.classList.contains('hidden');
            if (isHidden) {
                renderStats();
                statsPanel.classList.remove('hidden');
                statsPanel.classList.add('fade-in');
                statsBtn.innerHTML = `<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">close</span><span>Masquer les stats</span>`;
            } else {
                statsPanel.classList.add('hidden');
                statsBtn.innerHTML = `<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">analytics</span><span>Statistiques de ta performance</span>`;
            }
        };
    }

    function renderStats() {
        const total = questionResults.length;
        const pct = total > 0 ? Math.round((score / total) * 100) : 0;

        // --- Cercle score ---
        const circle = document.getElementById('score-circle');
        circle.textContent = `${pct}%`;
        circle.className = `w-16 h-16 rounded-full flex items-center justify-center font-black text-xl text-white shrink-0 ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`;
        document.getElementById('score-summary-line').textContent = `${score} bonne${score > 1 ? 's' : ''} réponse${score > 1 ? 's' : ''} sur ${total}`;
        const msgs = pct >= 80 ? '🌟 Super boulot ! Continue comme ça !' : pct >= 50 ? '💪 Bon début, encore un peu d’effort !' : '📚 Pas de souci, révise le cours et réessaie !';
        document.getElementById('score-message').textContent = msgs;

        // --- Stats par type ---
        const types = { qcm: { label: 'QCM', icon: '📝', ok: 0, total: 0 }, boolean: { label: 'Vrai / Faux', icon: '⚖️', ok: 0, total: 0 }, direct: { label: 'Saisie Libre', icon: '✏️', ok: 0, total: 0 } };
        questionResults.forEach(r => {
            if (types[r.type]) {
                types[r.type].total++;
                if (r.isCorrect) types[r.type].ok++;
            }
        });
        const byType = document.getElementById('stats-by-type');
        byType.innerHTML = '';
        Object.values(types).forEach(t => {
            if (t.total === 0) return;
            const tPct = Math.round((t.ok / t.total) * 100);
            const barColor = tPct >= 80 ? 'bg-green-500' : tPct >= 50 ? 'bg-yellow-400' : 'bg-red-400';
            const row = document.createElement('div');
            row.innerHTML = `
                <div class="flex items-center justify-between mb-1">
                    <span class="text-xs font-bold text-indigo-700">${t.icon} ${t.label}</span>
                    <span class="text-xs font-black text-indigo-900">${t.ok}/${t.total}</span>
                </div>
                <div class="h-2 bg-indigo-100 rounded-full overflow-hidden">
                    <div class="h-full ${barColor} rounded-full transition-all duration-700" style="width:${tPct}%"></div>
                </div>`;
            byType.appendChild(row);
        });

        // --- Questions ratées ---
        const missed = questionResults.filter(r => !r.isCorrect);
        const missedSection = document.getElementById('missed-section');
        const missedList = document.getElementById('missed-list');
        missedList.innerHTML = '';
        if (missed.length === 0) {
            missedSection.classList.add('hidden');
        } else {
            missedSection.classList.remove('hidden');
            missed.forEach(r => {
                const li = document.createElement('li');
                li.className = 'flex items-start gap-2 text-xs font-semibold text-red-700';
                const emoji = document.createElement('span');
                emoji.className = 'shrink-0 mt-0.5';
                emoji.textContent = '❌';
                const questionSpan = document.createElement('span');
                questionSpan.textContent = r.question;
                li.append(emoji, questionSpan);
                missedList.appendChild(li);
            });
        }
    }

    function resetToUpload() {
        currentQuiz = null;
        questionResults = [];
        uploadInitial.classList.remove('hidden');
        uploadLoading.classList.add('hidden');
        fileInput.value = "";

        // Réinitialiser le titre d'accueil
        mainTitle.textContent = 'Salut Timéo, Lise ou Léonie ! 👋';
        mainSubtitle.textContent = 'Ta prochaine aventure commence ici.';

        uploadSection.classList.remove('hidden');
        introSection.classList.add('hidden');
        quizSection.classList.add('hidden');
        footerProgress.classList.add('hidden');
    }
});
