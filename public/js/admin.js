// =========================================================
// ADMIN.JS - Logique d'administration pour Question pour un champignon 🍄
// =========================================================

let state = {
  questions: [],
  submissions: [],
  activeTab: 'answers',
  submissionsView: 'respondent', // 'respondent' | 'byQuestion'
  searchQuery: ''
};

// Éléments DOM
const loginScreen = document.getElementById('loginScreen');
const adminApp = document.getElementById('adminApp');
const adminLoginForm = document.getElementById('adminLoginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const btnLogout = document.getElementById('btnLogout');

// Stats
const statSubmissions = document.getElementById('statSubmissions');
const statQuestions = document.getElementById('statQuestions');
const statLatest = document.getElementById('statLatest');
const badgeAnswersCount = document.getElementById('badgeAnswersCount');
const badgeQuestionsCount = document.getElementById('badgeQuestionsCount');

// Onglets
const tabBtnAnswers = document.getElementById('tabBtnAnswers');
const tabBtnQuestions = document.getElementById('tabBtnQuestions');
const tabContentAnswers = document.getElementById('tabContentAnswers');
const tabContentQuestions = document.getElementById('tabContentQuestions');

// Réponses
const inputSearchAnswers = document.getElementById('inputSearchAnswers');
const btnViewRespondent = document.getElementById('btnViewRespondent');
const btnViewByQuestion = document.getElementById('btnViewByQuestion');
const btnRefreshAnswers = document.getElementById('btnRefreshAnswers');
const btnClearAllAnswers = document.getElementById('btnClearAllAnswers');
const submissionsListContainer = document.getElementById('submissionsListContainer');
const byQuestionContainer = document.getElementById('byQuestionContainer');

// Questions
const adminQuestionsList = document.getElementById('adminQuestionsList');
const btnOpenAddQuestionModal = document.getElementById('btnOpenAddQuestionModal');
const btnOpenAddQuestionModalBottom = document.getElementById('btnOpenAddQuestionModalBottom');
const inputSearchQuestions = document.getElementById('inputSearchQuestions');

let questionsSearchQuery = '';

// Modale Question
const questionModal = document.getElementById('questionModal');
const questionModalTitle = document.getElementById('questionModalTitle');
const questionForm = document.getElementById('questionForm');
const editQuestionId = document.getElementById('editQuestionId');
const inputQuestionTitle = document.getElementById('inputQuestionTitle');
const inputQuestionPlaceholder = document.getElementById('inputQuestionPlaceholder');
const btnCloseQuestionModal = document.getElementById('btnCloseQuestionModal');

// Toast
const adminToastContainer = document.getElementById('adminToastContainer');

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
    <span>${message}</span>
  `;
  adminToastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// =========================================================
// AUTHENTIFICATION & CYCLE DE VIE
// =========================================================

async function checkAuthStatus() {
  try {
    const res = await fetch('/api/admin/status');
    const data = await res.json();
    if (data.authenticated) {
      showAdminDashboard();
    } else {
      showLoginScreen();
    }
  } catch (err) {
    console.error(err);
    showLoginScreen();
  }
}

function showLoginScreen() {
  loginUsername.value = '';
  loginPassword.value = '';
  adminLoginForm.reset();
  loginScreen.style.display = 'block';
  adminApp.style.display = 'none';
}

function showAdminDashboard() {
  loginScreen.style.display = 'none';
  adminApp.style.display = 'block';
  loadDashboardData();
}

// Connexion
adminLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = loginUsername.value.trim();
  const password = loginPassword.value.trim();

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Identifiants invalides');

    showToast('Connexion réussie en tant qu\'administrateur !', 'success');
    showAdminDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Déconnexion
btnLogout.addEventListener('click', async () => {
  try {
    await fetch('/api/admin/logout', { method: 'POST' });
    showToast('Déconnexion réussie.', 'info');
    showLoginScreen();
  } catch (err) {
    console.error(err);
  }
});

// =========================================================
// CHARGEMENT DES DONNÉES
// =========================================================

async function loadDashboardData() {
  await Promise.all([loadQuestions(), loadSubmissions()]);
  updateStats();
}

async function loadQuestions() {
  try {
    const res = await fetch('/api/admin/questions');
    if (res.status === 401) return showLoginScreen();
    state.questions = await res.json();
    renderQuestionsList();
    updateStats();
  } catch (err) {
    console.error(err);
    showToast('Erreur lors du chargement des questions', 'error');
  }
}

async function loadSubmissions() {
  try {
    const res = await fetch('/api/admin/answers');
    if (res.status === 401) return showLoginScreen();
    const data = await res.json();
    state.submissions = data.submissions || [];
    renderSubmissions();
    updateStats();
  } catch (err) {
    console.error(err);
    showToast('Erreur lors du chargement des réponses', 'error');
  }
}

function updateStats() {
  statSubmissions.textContent = state.submissions.length;
  statQuestions.textContent = state.questions.length;
  badgeAnswersCount.textContent = state.submissions.length;
  badgeQuestionsCount.textContent = state.questions.length;

  if (state.submissions.length > 0) {
    const latest = state.submissions[0];
    statLatest.textContent = latest.formattedDate || 'Récent';
  } else {
    statLatest.textContent = 'Aucune';
  }
}

// =========================================================
// GESTION DES ONGLETS
// =========================================================

tabBtnAnswers.addEventListener('click', () => {
  state.activeTab = 'answers';
  tabBtnAnswers.classList.add('active');
  tabBtnQuestions.classList.remove('active');
  tabContentAnswers.style.display = 'block';
  tabContentQuestions.style.display = 'none';
});

tabBtnQuestions.addEventListener('click', () => {
  state.activeTab = 'questions';
  tabBtnQuestions.classList.add('active');
  tabBtnAnswers.classList.remove('active');
  tabContentQuestions.style.display = 'block';
  tabContentAnswers.style.display = 'none';
});

// =========================================================
// GESTION DES RÉPONSES
// =========================================================

btnViewRespondent.addEventListener('click', () => {
  state.submissionsView = 'respondent';
  btnViewRespondent.classList.add('active');
  btnViewByQuestion.classList.remove('active');
  submissionsListContainer.style.display = 'flex';
  byQuestionContainer.style.display = 'none';
  renderSubmissions();
});

btnViewByQuestion.addEventListener('click', () => {
  state.submissionsView = 'byQuestion';
  btnViewByQuestion.classList.add('active');
  btnViewRespondent.classList.remove('active');
  submissionsListContainer.style.display = 'none';
  byQuestionContainer.style.display = 'block';
  renderByQuestionView();
});

inputSearchAnswers.addEventListener('input', (e) => {
  state.searchQuery = e.target.value.toLowerCase().trim();
  if (state.submissionsView === 'respondent') {
    renderSubmissions();
  } else {
    renderByQuestionView();
  }
});

btnRefreshAnswers.addEventListener('click', () => {
  loadSubmissions();
  showToast('Données rafraîchies.', 'info');
});

// Vider toutes les réponses
btnClearAllAnswers.addEventListener('click', async () => {
  if (!confirm('⚠️ Attention : Voulez-vous vraiment supprimer TOUTES les réponses reçues ? Cette action est irréversible.')) {
    return;
  }

  try {
    const res = await fetch('/api/admin/answers-clear-all', { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    state.submissions = [];
    renderSubmissions();
    renderByQuestionView();
    updateStats();
    showToast('Toutes les réponses ont été supprimées avec succès.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Supprimer une soumission individuelle
async function deleteSubmission(id) {
  if (!confirm('Supprimer définitivement cette soumission anonyme ?')) return;

  try {
    const res = await fetch(`/api/admin/answers/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    state.submissions = state.submissions.filter(s => s.id !== id);
    renderSubmissions();
    renderByQuestionView();
    updateStats();
    showToast('Soumission supprimée.', 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Rendu : Vue par répondant
function renderSubmissions() {
  const query = state.searchQuery;
  const filtered = state.submissions.filter(sub => {
    if (!query) return true;
    const numMatch = String(sub.submissionNumber).includes(query);
    const dateMatch = (sub.formattedDate || '').toLowerCase().includes(query);
    const answersMatch = Object.values(sub.answers || {}).some(val =>
      String(val).toLowerCase().includes(query)
    );
    return numMatch || dateMatch || answersMatch;
  });

  if (filtered.length === 0) {
    submissionsListContainer.innerHTML = `
      <div style="text-align: center; padding: 50px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
        <div style="font-size: 2.5rem; margin-bottom: 12px;">📭</div>
        <h3 style="margin-bottom: 8px;">Aucune réponse trouvée</h3>
        <p style="color: var(--text-muted); font-size: 14px;">
          ${state.submissions.length === 0 ? "Le questionnaire n'a pas encore reçu de réponses." : "Aucune réponse ne correspond à votre recherche."}
        </p>
      </div>
    `;
    return;
  }

  // Créer un map des questions pour un accès rapide
  const questionMap = new Map(state.questions.map(q => [q.id, q]));

  submissionsListContainer.innerHTML = filtered
    .map(sub => {
      const answersEntries = Object.entries(sub.answers || {});
      const count = answersEntries.length;

      const answersRows = answersEntries
        .map(([qId, val]) => {
          const qObj = questionMap.get(qId);
          const qTitle = qObj ? qObj.title : `Question (${qId})`;
          return `
            <div class="answer-row">
              <div class="answer-q">${escapeHTML(qTitle)}</div>
              <div class="answer-val">${escapeHTML(val)}</div>
            </div>
          `;
        })
        .join('');

      return `
        <article class="submission-card" id="sub-card-${sub.id}">
          <div class="submission-header" onclick="toggleSubmissionCard('${sub.id}')">
            <div class="submission-title">
              <span class="sub-tag">#${sub.submissionNumber || '1'}</span>
              <span style="font-weight: 600; font-size: 15px;">Participation Anonyme</span>
              <span style="background: rgba(255, 255, 255, 0.08); padding: 2px 8px; border-radius: 999px; font-size: 12px; color: var(--text-muted);">
                ${count} question${count > 1 ? 's' : ''} répondue${count > 1 ? 's' : ''}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 14px;">
              <span class="submission-date">📅 ${escapeHTML(sub.formattedDate || '')}</span>
              <button type="button" class="btn-icon" style="color: var(--danger);" title="Supprimer cette réponse" onclick="event.stopPropagation(); deleteSubmission('${sub.id}')">
                🗑️
              </button>
              <span style="font-size: 12px; color: var(--text-dim);">▼</span>
            </div>
          </div>
          <div class="submission-body">
            ${answersRows || '<p style="color: var(--text-dim);">Aucune réponse détaillée.</p>'}
          </div>
        </article>
      `;
    })
    .join('');
}

window.toggleSubmissionCard = function(id) {
  const card = document.getElementById(`sub-card-${id}`);
  if (card) {
    card.classList.toggle('expanded');
  }
};

// Rendu : Vue par question
function renderByQuestionView() {
  const query = state.searchQuery;

  if (state.questions.length === 0) {
    byQuestionContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 40px;">Aucune question disponible.</p>`;
    return;
  }

  byQuestionContainer.innerHTML = state.questions
    .map(q => {
      // Rassembler toutes les réponses pour cette question
      const collectedAnswers = [];
      state.submissions.forEach(sub => {
        if (sub.answers && sub.answers[q.id] && sub.answers[q.id].trim().length > 0) {
          collectedAnswers.push({
            subNumber: sub.submissionNumber,
            date: sub.formattedDate,
            text: sub.answers[q.id]
          });
        }
      });

      // Filtre de recherche
      const filteredAnswers = collectedAnswers.filter(a => {
        if (!query) return true;
        return a.text.toLowerCase().includes(query) || q.title.toLowerCase().includes(query);
      });

      const answersHTML = filteredAnswers
        .map(a => `
          <div class="answer-item">
            <span class="answer-author-tag">Répondant anonyme #${a.subNumber || '?'} • ${a.date || ''}</span>
            <div>${escapeHTML(a.text)}</div>
          </div>
        `)
        .join('');

      return `
        <div class="q-by-q-card ${filteredAnswers.length > 0 ? '' : 'empty'}" id="q-view-${q.id}">
          <div class="q-by-q-header" onclick="this.parentElement.classList.toggle('expanded')">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span class="q-badge">#${q.order || 1}</span>
              <strong style="font-size: 15px; color: #fff;">${escapeHTML(q.title)}</strong>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="background: rgba(255, 42, 133, 0.15); color: var(--accent-pink); padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;">
                ${collectedAnswers.length} réponse${collectedAnswers.length > 1 ? 's' : ''}
              </span>
              <span style="font-size: 12px; color: var(--text-dim);">▼</span>
            </div>
          </div>
          <div class="q-by-q-body">
            ${answersHTML || '<p style="color: var(--text-dim); font-size: 13px;">Aucune réponse enregistrée pour cette question pour l\'instant.</p>'}
          </div>
        </div>
      `;
    })
    .join('');
}

// =========================================================
// GESTION DES QUESTIONS (ORDRE, AJOUT, MODIF, SUPPRESSION)
// =========================================================

function renderQuestionsList() {
  if (state.questions.length === 0) {
    adminQuestionsList.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
        <p>Aucune question n'existe. Cliquez sur <strong>Ajouter une question</strong> pour commencer.</p>
      </div>
    `;
    return;
  }

  const query = (questionsSearchQuery || '').toLowerCase().trim();
  const filtered = state.questions.filter((q, idx) => {
    if (!query) return true;
    return q.title.toLowerCase().includes(query) ||
           String(idx + 1).includes(query) ||
           (q.placeholder || '').toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    adminQuestionsList.innerHTML = `
      <div style="text-align: center; padding: 30px; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg);">
        <p>Aucune question ne correspond à votre recherche "${escapeHTML(query)}".</p>
      </div>
    `;
    return;
  }

  adminQuestionsList.innerHTML = filtered
    .map(q => {
      const realIndex = state.questions.findIndex(item => item.id === q.id);
      const isFirst = realIndex === 0;
      const isLast = realIndex === state.questions.length - 1;

      return `
        <div class="admin-q-item" id="q-item-${q.id}" data-id="${q.id}" draggable="${!query}">
          <div class="admin-q-handle" title="Glisser-déposer pour changer l'ordre">
            ⠿
          </div>
          <div class="admin-q-order">#${realIndex + 1}</div>
          <div class="admin-q-content">
            <div class="admin-q-title">${escapeHTML(q.title)}</div>
            <div class="admin-q-meta">Texte d'aide : "${escapeHTML(q.placeholder || 'Votre réponse...')}"</div>
          </div>
          <div class="admin-q-actions">
            <button type="button" class="btn-icon" title="Monter d'une place" onclick="moveQuestion('${q.id}', -1)" ${isFirst ? 'disabled style="opacity:0.25;cursor:not-allowed;"' : ''}>
              ⬆️
            </button>
            <button type="button" class="btn-icon" title="Descendre d'une place" onclick="moveQuestion('${q.id}', 1)" ${isLast ? 'disabled style="opacity:0.25;cursor:not-allowed;"' : ''}>
              ⬇️
            </button>
            <button type="button" class="btn btn-secondary btn-sm" title="Déplacer à un numéro spécifique (ex: mettre en position 1)" onclick="repositionQuestion('${q.id}')" style="padding: 4px 8px; font-size: 11px;">
              📍 Position
            </button>
            <button type="button" class="btn btn-secondary btn-sm" title="Modifier l'intitulé" onclick="openEditQuestionModal('${q.id}')" style="padding: 4px 8px; font-size: 11px;">
              ✏️ Modifier
            </button>
            <button type="button" class="btn btn-danger btn-sm" title="Supprimer définitivement la question" onclick="deleteQuestion('${q.id}')" style="padding: 4px 8px; font-size: 11px;">
              🗑️ Supprimer
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  if (!query) {
    setupDragAndDrop();
  }
}

// Recherche dans les questions
if (inputSearchQuestions) {
  inputSearchQuestions.addEventListener('input', (e) => {
    questionsSearchQuery = e.target.value;
    renderQuestionsList();
  });
}

// Déplacement Monter / Descendre
window.moveQuestion = async function(id, direction) {
  const index = state.questions.findIndex(q => q.id === id);
  if (index === -1) return;

  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= state.questions.length) return;

  // Swap dans le tableau local
  const temp = state.questions[index];
  state.questions[index] = state.questions[targetIndex];
  state.questions[targetIndex] = temp;

  // Re-indexer l'ordre
  state.questions.forEach((q, idx) => {
    q.order = idx + 1;
  });

  renderQuestionsList();
  await syncQuestionsOrder();
};

// Déplacer une question vers une position précise (ex: mettre #40 en position #1)
window.repositionQuestion = async function(id) {
  const currentIndex = state.questions.findIndex(q => q.id === id);
  if (currentIndex === -1) return;

  const currentRank = currentIndex + 1;
  const total = state.questions.length;
  const q = state.questions[currentIndex];

  const answer = prompt(
    `Déplacer la question "${q.title}"\nPosition actuelle : #${currentRank}\nEntrez la nouvelle position souhaitée (1 à ${total}) :`,
    currentRank
  );

  if (!answer) return;
  const targetRank = parseInt(answer.trim(), 10);
  if (isNaN(targetRank) || targetRank < 1 || targetRank > total) {
    showToast(`Numéro invalide. Veuillez entrer un nombre entre 1 et ${total}.`, 'error');
    return;
  }

  const targetIndex = targetRank - 1;
  if (targetIndex === currentIndex) return;

  // Déplacer l'élément dans le tableau
  const [moved] = state.questions.splice(currentIndex, 1);
  state.questions.splice(targetIndex, 0, moved);

  // Re-indexer l'ordre
  state.questions.forEach((item, idx) => {
    item.order = idx + 1;
  });

  renderQuestionsList();
  await syncQuestionsOrder();
  showToast(`Question déplacée en position #${targetRank} !`, 'success');
};

// Configuration du Drag & Drop HTML5
function setupDragAndDrop() {
  const items = adminQuestionsList.querySelectorAll('.admin-q-item');
  let draggedItem = null;

  items.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset.id);
    });

    item.addEventListener('dragend', async () => {
      if (draggedItem) {
        draggedItem.classList.remove('dragging');
        draggedItem = null;
      }
      
      // Mettre à jour state.questions selon le nouvel ordre DOM
      const newOrderedIds = Array.from(adminQuestionsList.querySelectorAll('.admin-q-item')).map(
        el => el.dataset.id
      );

      const qMap = new Map(state.questions.map(q => [q.id, q]));
      state.questions = newOrderedIds.map((id, idx) => {
        const q = qMap.get(id);
        q.order = idx + 1;
        return q;
      });

      renderQuestionsList();
      await syncQuestionsOrder();
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const bounding = item.getBoundingClientRect();
      const offset = e.clientY - bounding.top;
      if (offset > bounding.height / 2) {
        item.parentNode.insertBefore(draggedItem, item.nextSibling);
      } else {
        item.parentNode.insertBefore(draggedItem, item);
      }
    });
  });
}

// Synchroniser le nouvel ordre avec le serveur
async function syncQuestionsOrder() {
  try {
    const orderedIds = state.questions.map(q => q.id);
    const res = await fetch('/api/admin/questions-reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds })
    });
    if (!res.ok) throw new Error('Erreur lors de la sauvegarde de l\'ordre');
    showToast('Ordre des questions synchronisé avec succès !', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Ouvrir la modale pour ajouter une question
btnOpenAddQuestionModal.addEventListener('click', () => {
  editQuestionId.value = '';
  questionModalTitle.textContent = 'Ajouter une nouvelle question';
  inputQuestionTitle.value = '';
  inputQuestionPlaceholder.value = '';
  questionModal.classList.add('active');
  inputQuestionTitle.focus();
});

if (btnOpenAddQuestionModalBottom) {
  btnOpenAddQuestionModalBottom.addEventListener('click', () => {
    btnOpenAddQuestionModal.click();
  });
}

// Ouvrir la modale pour modifier une question
window.openEditQuestionModal = function(id) {
  const q = state.questions.find(item => item.id === id);
  if (!q) return;

  editQuestionId.value = q.id;
  questionModalTitle.textContent = 'Modifier la question';
  inputQuestionTitle.value = q.title;
  inputQuestionPlaceholder.value = q.placeholder || '';
  questionModal.classList.add('active');
  inputQuestionTitle.focus();
};

// Fermer la modale
btnCloseQuestionModal.addEventListener('click', () => {
  questionModal.classList.remove('active');
});

// Soumettre le formulaire d'ajout/modification de question
questionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = editQuestionId.value;
  const title = inputQuestionTitle.value.trim();
  const placeholder = inputQuestionPlaceholder.value.trim();

  if (!title) {
    showToast('Le titre de la question est obligatoire', 'error');
    return;
  }

  try {
    if (id) {
      // Modification
      const res = await fetch(`/api/admin/questions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, placeholder })
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error);

      const idx = state.questions.findIndex(q => q.id === id);
      if (idx !== -1) state.questions[idx] = updated;
      showToast('Question modifiée avec succès !', 'success');
    } else {
      // Création
      const res = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, placeholder })
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error);

      state.questions.push(created);
      showToast('Nouvelle question ajoutée avec succès !', 'success');
    }

    questionModal.classList.remove('active');
    renderQuestionsList();
    updateStats();

    // Si ajout, scroller vers la question créée
    if (!id) {
      setTimeout(() => {
        const lastItem = adminQuestionsList.lastElementChild;
        if (lastItem) lastItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Supprimer une question
window.deleteQuestion = async function(id) {
  const q = state.questions.find(item => item.id === id);
  const qName = q ? `"${q.title}"` : 'cette question';

  if (!confirm(`Supprimer définitivement ${qName} ?`)) return;

  try {
    const res = await fetch(`/api/admin/questions/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    state.questions = state.questions.filter(item => item.id !== id);
    state.questions.forEach((item, idx) => {
      item.order = idx + 1;
    });

    renderQuestionsList();
    updateStats();
    showToast('Question supprimée avec succès.', 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// =========================================================
// UTILITAIRES
// =========================================================

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus();
});
