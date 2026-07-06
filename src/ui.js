import { escapeHtml } from "./utils.js";

let toastTimer;

export function setLoading(active, text = "처리 중입니다") {
  const root = document.querySelector("#globalLoading");
  if (!root) return;
  root.querySelector("b").textContent = text;
  root.classList.toggle("hidden", !active);
}

export function toast(message, tone = "success") {
  const element = document.querySelector("#toast");
  if (!element) return;
  clearTimeout(toastTimer);
  element.textContent = message;
  element.dataset.tone = tone;
  element.classList.add("show");
  toastTimer = setTimeout(() => element.classList.remove("show"), 2800);
}

export function pageHead(title, description, action = "") {
  return `<div class="page-head"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${action}</div>`;
}

export function loadingState(label = "데이터를 불러오는 중입니다") {
  return `<div class="loading-card"><span class="spinner"></span><b>${escapeHtml(label)}</b></div>`;
}

export function emptyState(title, description, icon = "◇") {
  return `<div class="empty-state"><i>${icon}</i><b>${escapeHtml(title)}</b><p>${escapeHtml(description)}</p></div>`;
}

export function errorState(message) {
  return `<div class="error-state"><i>!</i><b>불러오지 못했습니다</b><p>${escapeHtml(message)}</p><button class="secondary" data-action="retry">다시 시도</button></div>`;
}

export function showConfirm({ title, message, confirmText = "확인", danger = false, onConfirm }) {
  const root = document.querySelector("#modalRoot");
  root.innerHTML = `<div class="modal-backdrop" data-action="close-modal">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <h3 id="modalTitle">${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      <div class="modal-actions">
        <button class="secondary" type="button" data-action="close-modal">닫기</button>
        <button id="modalConfirm" class="${danger ? "button-danger" : "primary"}" type="button">${escapeHtml(confirmText)}</button>
      </div>
    </div>
  </div>`;
  root.querySelector("#modalConfirm").addEventListener("click", async () => {
    closeModal();
    await onConfirm?.();
  });
  bindModalClose();
}

export function showModal(html, wide = false) {
  const root = document.querySelector("#modalRoot");
  root.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true">${html}</div></div>`;
  bindModalClose();
  return root.querySelector(".modal");
}

function bindModalClose() {
  const root = document.querySelector("#modalRoot");
  root.querySelectorAll('[data-action="close-modal"]').forEach(element => {
    element.addEventListener("click", event => {
      if (event.currentTarget === event.target || event.currentTarget.matches("button")) closeModal();
    });
  });
}

export function closeModal() {
  const root = document.querySelector("#modalRoot");
  if (root) root.innerHTML = "";
}

export function setButtonBusy(button, busy, label = "처리 중") {
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = label;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalLabel ?? button.textContent;
    button.disabled = false;
  }
}

