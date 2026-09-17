// =========================================================
// APP.JS - Logique Client pour Question pour un champignon 🍄
// =========================================================

let questionsData = [];
const answersState = {};

const questionsContainer = document.getElementById('questionsContainer');
const quizForm = document.getElementById('quizForm');
const progressText = document.getElementById('progressText');
const progressBar = document.getElementById('progressBar');
const btnScrollToUnanswered = document.getElementById('btnScrollToUnanswered');
const submitBtn = document.getElementById('submitBtn');
const successModal = document.getElementById('successModal');
const btnRestartQuiz = document.getElementById('btnRestartQuiz');
const toastContainer = document.getElementById('toastContainer');

// Afficher une notification toast
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
    <span>${message}</span>
  `;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Charger les questions depuis le serveur
async function loadQuestions() {
  try {
    const res = await fetch('/api/questions');
    if (!res.ok) throw new Error('Impossible de charger les questions');
    questionsData = await res.json();
    renderQuestions();
    updateProgress();
  } catch (err) {
    console.error(err);
    questionsContainer.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--danger);">
        <p>⚠️ Erreur lors de la récupération des questions. Vérifiez que le serveur est bien démarré.</p>
        <button class="btn btn-secondary" style="margin-top: 14px;" onclick="loadQuestions()">Réessayer</button>
      </div>
    `;
  }
}

// Rendu HTML des questions
function renderQuestions() {
  if (questionsData.length === 0) {
    questionsContainer.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted);">
        <p>Aucune question n'est configurée pour le moment.</p>
      </div>
    `;
    return;
  }

  questionsContainer.innerHTML = questionsData
    .map((q, idx) => {
      const qNum = idx + 1;
      const currentVal = answersState[q.id] || '';
      const isFilled = currentVal.trim().length > 0;

      return `
        <article class="question-card ${isFilled ? 'answered' : ''}" id="card-${q.id}" data-id="${q.id}">
          <div class="question-top">
            <span class="q-badge">#${qNum}</span>
            <label for="input-${q.id}" class="q-title">${escapeHTML(q.title)}</label>
          </div>
          <div class="q-input-wrap">
            <textarea
              id="input-${q.id}"
              class="q-textarea"
              placeholder="${escapeHTML(q.placeholder || 'Ta réponse sans filtre...')}"
              rows="2"
              data-id="${q.id}"
            >${escapeHTML(currentVal)}</textarea>
          </div>
        </article>
      `;
    })
    .join('');

  // Attacher les écouteurs d'événements pour la saisie
  const textareas = questionsContainer.querySelectorAll('.q-textarea');
  textareas.forEach(textarea => {
    // Ajustement automatique de la hauteur
    autoResizeTextarea(textarea);

    textarea.addEventListener('input', (e) => {
      const qId = e.target.getAttribute('data-id');
      const val = e.target.value;
      answersState[qId] = val;

      const card = document.getElementById(`card-${qId}`);
      if (val.trim().length > 0) {
        card.classList.add('answered');
      } else {
        card.classList.remove('answered');
      }

      autoResizeTextarea(e.target);
      updateProgress();
    });
  });
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = (el.scrollHeight) + 'px';
}

// Mettre à jour la barre de progression
function updateProgress() {
  const total = questionsData.length;
  if (total === 0) {
    progressText.innerHTML = 'Aucune question';
    progressBar.style.width = '0%';
    return;
  }

  const answered = Object.values(answersState).filter(val => val && val.trim().length > 0).length;
  const pct = Math.round((answered / total) * 100);

  progressBar.style.width = `${pct}%`;
  progressText.innerHTML = `<strong>${answered}</strong> sur <strong>${total}</strong> questions répondues (${pct}%)`;

  // Mettre à jour le texte du bouton de soumission
  if (answered > 0) {
    submitBtn.innerHTML = `<span>🚀 Envoyer mes ${answered} réponse${answered > 1 ? 's' : ''}</span>`;
  } else {
    submitBtn.innerHTML = `<span>🚀 Envoyer mes réponses anonymement</span>`;
  }
}

// Bouton pour aller à la prochaine question non répondue
btnScrollToUnanswered.addEventListener('click', () => {
  for (const q of questionsData) {
    const val = answersState[q.id];
    if (!val || val.trim().length === 0) {
      const card = document.getElementById(`card-${q.id}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = card.querySelector('.q-textarea');
        if (input) input.focus();
        return;
      }
    }
  }
  showToast('Félicitations, tu as répondu à toutes les questions !', 'success');
});

// Gestion de la soumission du formulaire
quizForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const answeredCount = Object.values(answersState).filter(val => val && val.trim().length > 0).length;
  if (answeredCount === 0) {
    showToast('Réponds à au moins une question avant d\'envoyer !', 'error');
    const firstCard = questionsContainer.querySelector('.question-card');
    if (firstCard) {
      firstCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const firstInput = firstCard.querySelector('.q-textarea');
      if (firstInput) firstInput.focus();
    }
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span>⏳ Envoi confidentiel en cours...</span>';

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: answersState })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Erreur lors de l\'envoi');
    }

    // Afficher la modale de succès
    successModal.classList.add('active');
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Erreur réseau', 'error');
    submitBtn.disabled = false;
    updateProgress();
  }
});

// Recommencer un questionnaire
btnRestartQuiz.addEventListener('click', () => {
  // Réinitialiser l'état
  for (const key of Object.keys(answersState)) {
    delete answersState[key];
  }
  successModal.classList.remove('active');
  submitBtn.disabled = false;
  renderQuestions();
  updateProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast('Questionnaire réinitialisé pour une nouvelle participation.', 'info');
});

// Helper pour échapper le HTML
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  loadQuestions();
});
