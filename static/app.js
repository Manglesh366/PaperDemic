// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

const chatForm = document.getElementById("chat-form");
const questionInput = document.getElementById("question");
const chatBox = document.getElementById("chat-box");

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const question = questionInput.value.trim();
  if (!question) return;

  appendMessage("You", question);
  questionInput.value = "";
  questionInput.disabled = true;

  // Placeholder bubble while we wait for the backend to respond.
  const loading = createMessageEl("RAG Assistant", "Searching your documents...");
  chatBox.appendChild(loading);
  scrollToBottom();

  try {
    const formData = new FormData();
    formData.append("question", question);

    const response = await fetch("/chat", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Something went wrong");
    }

    updateMessageEl(loading, "RAG Assistant", data.answer);
  } catch (error) {
    updateMessageEl(loading, "Error", error.message);
  } finally {
    questionInput.disabled = false;
    questionInput.focus();
    scrollToBottom();
  }
});

function appendMessage(author, text) {
  const el = createMessageEl(author, text);
  chatBox.appendChild(el);
  scrollToBottom();
}

function createMessageEl(author, text) {
  const isUser = author === "You";
  const el = document.createElement("div");
  el.className = `message ${isUser ? "user-message" : "assistant-message"}`;
  el.innerHTML = `<strong>${escapeHtml(author)}</strong><p>${escapeHtml(text)}</p>`;
  return el;
}

function updateMessageEl(el, author, text) {
  el.innerHTML = `<strong>${escapeHtml(author)}</strong><p>${escapeHtml(text)}</p>`;
}

function scrollToBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ---------------------------------------------------------------------------
// File upload
// ---------------------------------------------------------------------------

const uploadForm = document.getElementById("upload-form");
const uploadStatus = document.getElementById("upload-status");
const fileInput = document.getElementById("file");
const fileNameLabel = document.getElementById("file-name");

fileInput.addEventListener("change", () => {
  fileNameLabel.textContent = fileInput.files[0] ? fileInput.files[0].name : "Choose a file";
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!fileInput.files || fileInput.files.length === 0) {
    uploadStatus.innerText = "Please select a file.";
    return;
  }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  uploadStatus.innerText = "Uploading and indexing...";

  try {
    const response = await fetch("/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Upload failed");
    }

    uploadStatus.innerText =
      `${data.filename} uploaded successfully. ${data.chunks_added} chunks indexed.`;

    fileInput.value = "";
    fileNameLabel.textContent = "Choose a file";

    // Reload so the new file shows up in the sidebar list.
    setTimeout(() => window.location.reload(), 1000);
  } catch (error) {
    uploadStatus.innerText = "Error: " + error.message;
  }
});

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ---------------------------------------------------------------------------
// Light / dark theme toggle, persisted in localStorage
// ---------------------------------------------------------------------------

const themeToggle = document.getElementById("theme-toggle");

function syncThemeIcon() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  themeToggle.textContent = isDark ? "🌙" : "☀️";
}

themeToggle.addEventListener("click", () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const next = isDark ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  syncThemeIcon();
});

syncThemeIcon();