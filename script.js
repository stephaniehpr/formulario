/* =========================================================
   MÉTODO AUTORA — Candidatura
   ▼▼▼ EDITE APENAS ESTA PARTE ▼▼▼
   ========================================================= */
const CONFIG = {
  // URL do app do Google Apps Script (termina em /exec).
  // Passo a passo no README.md.
  endpoint: "https://script.google.com/macros/s/AKfycbzVOuM1Cp_ZEX6FZsr9pbhyxb38503jW06DtOaVUQFTBZa0GSDUvlCMbgEx2CESi4jW/exec",
};
/* ▲▲▲ EDITE APENAS ESTA PARTE ▲▲▲ */


const form = document.getElementById("form");
const steps = Array.from(document.querySelectorAll(".step"));
const progressBar = document.getElementById("progressBar");
const stepCount = document.getElementById("stepCount");

// Passos que contam como "pergunta" (fora a intro e a tela final).
const questionSteps = steps.filter(
  (s) => !["intro", "done"].includes(s.dataset.step)
);

let current = 0;
let enviando = false;
const answers = {};
const startedAt = Date.now(); // para medir o tempo de preenchimento

function showStep(index) {
  current = Math.max(0, Math.min(index, steps.length - 1));
  steps.forEach((s, i) => s.classList.toggle("is-active", i === current));

  const step = steps[current];
  const qIndex = questionSteps.indexOf(step);

  // Barra de progresso
  let pct = 0;
  if (step.dataset.step === "done") pct = 100;
  else if (qIndex >= 0) pct = ((qIndex + 1) / (questionSteps.length + 1)) * 100;
  progressBar.style.width = pct + "%";

  // Contador de perguntas
  stepCount.textContent =
    qIndex >= 0 ? `Pergunta ${qIndex + 1} de ${questionSteps.length}` : "";

  // Foco no primeiro campo
  const input = step.querySelector(".input");
  if (input) setTimeout(() => input.focus(), 80);
}

function showError(step, show, selector) {
  const err = step.querySelector(selector || "[data-error]");
  if (err) err.classList.toggle("is-visible", show);
}

function validate(step) {
  const type = step.dataset.step;

  // E-mail é opcional, mas se preenchido precisa ser válido.
  if (type === "field") {
    const input = step.querySelector(".input");
    if (input.id === "email") {
      const val = (input.value || "").trim();
      if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return false;
      return true;
    }
  }

  if (!step.hasAttribute("data-required")) return true;

  if (type === "field") {
    const input = step.querySelector(".input");
    const val = (input.value || "").trim();
    if (input.id === "whatsapp") {
      return val.replace(/\D/g, "").length >= 10;
    }
    return val.length >= 2;
  }
  if (type === "choice") {
    const group = step.querySelector(".choices");
    return !!answers[group.dataset.name];
  }
  if (type === "consent") {
    return step.querySelector("#consent").checked;
  }
  return true;
}

function next() {
  const step = steps[current];
  if (!validate(step)) return showError(step, true);
  showError(step, false);
  showStep(current + 1);
}

function back() {
  showStep(current - 1);
}

// ----- Botões avançar / voltar -----
document.querySelectorAll("[data-next]").forEach((b) =>
  b.addEventListener("click", next)
);
document.querySelectorAll("[data-back]").forEach((b) =>
  b.addEventListener("click", back)
);

// ----- Escolhas (seleção + avanço automático) -----
document.querySelectorAll(".choices").forEach((group) => {
  group.querySelectorAll(".choice").forEach((choice) => {
    choice.addEventListener("click", () => {
      group.querySelectorAll(".choice").forEach((c) => c.classList.remove("is-selected"));
      choice.classList.add("is-selected");
      answers[group.dataset.name] = choice.dataset.value;
      showError(choice.closest(".step"), false);
      setTimeout(next, 280);
    });
  });
});

// ----- Máscara simples de telefone (Brasil) -----
const whatsappInput = document.getElementById("whatsapp");
whatsappInput.addEventListener("input", () => {
  let d = whatsappInput.value.replace(/\D/g, "").slice(0, 11);
  let out = d;
  if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length > 7) {
    const corte = d.length > 10 ? 7 : 6;
    out = `(${d.slice(0, 2)}) ${d.slice(2, corte)}-${d.slice(corte)}`;
  }
  whatsappInput.value = out;
});

// ----- Enter avança nos campos de texto (menos textarea) -----
form.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"]').forEach((inp) => {
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      next();
    }
  });
});

// ----- Métricas de marketing -----
function coletarMetricas() {
  const params = new URLSearchParams(location.search);
  let origem = params.get("utm_source");
  if (!origem) {
    if (document.referrer) {
      try { origem = new URL(document.referrer).hostname; } catch (e) { origem = "outro"; }
    } else {
      origem = "direto";
    }
  }
  const campanha = [params.get("utm_medium"), params.get("utm_campaign")]
    .filter(Boolean)
    .join(" / ");
  return {
    origem: origem,
    campanha: campanha,
    dispositivo: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "Celular" : "Computador",
    tempo_seg: Math.round((Date.now() - startedAt) / 1000),
    pagina: location.href,
  };
}

function coletarRespostas() {
  const v = (id) => (document.getElementById(id).value || "").trim();
  return Object.assign(
    {
      nome: v("nome"),
      whatsapp: v("whatsapp"),
      email: v("email"),
      momento: answers.momento || "",
      trava: answers.trava || "",
      motivo: v("motivo"),
    },
    coletarMetricas()
  );
}

// ----- Envio para o Google Sheets -----
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (enviando) return;

  const step = steps[current];
  if (!validate(step)) return showError(step, true);

  // Anti-spam: se o campo-isca foi preenchido, é robô. Finge sucesso.
  if (form.querySelector('[name="website"]').value) {
    return showStep(steps.findIndex((s) => s.dataset.step === "done"));
  }

  // Garante que a URL do Google Sheets foi configurada.
  if (!/^https?:\/\//.test(CONFIG.endpoint)) {
    console.warn("Configure CONFIG.endpoint no script.js (URL do Google Apps Script).");
    return showError(step, true, "#sendError");
  }

  const btn = document.getElementById("submitBtn");
  enviando = true;
  btn.disabled = true;
  btn.textContent = "Enviando...";
  showError(step, false, "#sendError");

  fetch(CONFIG.endpoint, {
    method: "POST",
    mode: "no-cors",
    body: new URLSearchParams(coletarRespostas()),
  })
    .then(() => {
      showStep(steps.findIndex((s) => s.dataset.step === "done"));
    })
    .catch(() => {
      showError(step, true, "#sendError");
    })
    .finally(() => {
      enviando = false;
      btn.disabled = false;
      btn.textContent = "Enviar minha candidatura";
    });
});

// Início
showStep(0);
