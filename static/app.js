// ============================================================================
// THEME TOGGLE
// ============================================================================
// Handles light/dark mode and saves the user's preference in localStorage.
// ============================================================================

(function setupThemeToggle() {
  const themeToggle = document.getElementById("theme-toggle");

  if (!themeToggle) return;

  const sunIcon = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4"></circle>
      <path d="M12 2v2"></path>
      <path d="M12 20v2"></path>
      <path d="m4.93 4.93 1.41 1.41"></path>
      <path d="m17.66 17.66 1.41 1.41"></path>
      <path d="M2 12h2"></path>
      <path d="M20 12h2"></path>
      <path d="m6.34 17.66-1.41 1.41"></path>
      <path d="m19.07 4.93-1.41 1.41"></path>
    </svg>
  `;

  const moonIcon = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3
        7 7 0 0 0 21 12.79z">
      </path>
    </svg>
  `;

  function syncThemeIcon() {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";

    // In dark mode show the sun because clicking it switches to light mode.
    // In light mode show the moon because clicking it switches to dark mode.
    themeToggle.innerHTML = isDark ? sunIcon : moonIcon;

    themeToggle.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode"
    );

    themeToggle.setAttribute(
      "title",
      isDark ? "Switch to light mode" : "Switch to dark mode"
    );
  }

  themeToggle.addEventListener("click", () => {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";

    const nextTheme = isDark ? "light" : "dark";

    document.documentElement.setAttribute(
      "data-theme",
      nextTheme
    );

    localStorage.setItem("theme", nextTheme);

    syncThemeIcon();
  });

  syncThemeIcon();
})();


// ============================================================================
// PASSWORD VISIBILITY
// ============================================================================
// Shows or hides the password when the eye button is clicked.
// ============================================================================

(function setupPasswordToggle() {
  const passwordInput = document.getElementById("password");
  const togglePassword = document.getElementById("toggle-password");
  const eyeIcon = document.getElementById("eye-icon");
  const eyeSlashIcon = document.getElementById("eye-slash-icon");

  // These elements only exist on the login page.
  if (
    !passwordInput ||
    !togglePassword ||
    !eyeIcon ||
    !eyeSlashIcon
  ) {
    return;
  }

  togglePassword.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";

    if (isHidden) {
      // Show password
      passwordInput.type = "text";

      eyeIcon.style.display = "none";
      eyeSlashIcon.style.display = "block";

      togglePassword.setAttribute(
        "aria-label",
        "Hide password"
      );

      togglePassword.setAttribute(
        "title",
        "Hide password"
      );
    } else {
      // Hide password
      passwordInput.type = "password";

      eyeIcon.style.display = "block";
      eyeSlashIcon.style.display = "none";

      togglePassword.setAttribute(
        "aria-label",
        "Show password"
      );

      togglePassword.setAttribute(
        "title",
        "Show password"
      );
    }
  });
})();


// ============================================================================
// CHAT
// ============================================================================
// Sends the user's question to the FastAPI backend and displays the answer.
// ============================================================================

(function setupChat() {
  const chatForm = document.getElementById("chat-form");
  const questionInput = document.getElementById("question");
  const chatBox = document.getElementById("chat-box");

  // These elements only exist on the home/chat page.
  if (!chatForm || !questionInput || !chatBox) {
    return;
  }

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const question = questionInput.value.trim();

    if (!question) {
      return;
    }

    // Show user's question immediately.
    appendMessage("You", question);

    questionInput.value = "";
    questionInput.disabled = true;

    // Temporary loading message.
    const loading = createMessageEl(
      "RAG Assistant",
      "Searching your documents..."
    );

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
        throw new Error(
          data.detail || "Something went wrong"
        );
      }

      updateMessageEl(
        loading,
        "RAG Assistant",
        data.answer
      );

    } catch (error) {
      updateMessageEl(
        loading,
        "Error",
        error.message
      );

    } finally {
      questionInput.disabled = false;
      questionInput.focus();

      scrollToBottom();
    }
  });

  function appendMessage(author, text) {
    const element = createMessageEl(author, text);

    chatBox.appendChild(element);

    scrollToBottom();
  }

  function createMessageEl(author, text) {
    const isUser = author === "You";

    const element = document.createElement("div");

    element.className = `
      message
      ${isUser ? "user-message" : "assistant-message"}
    `;

    element.innerHTML = `
      <strong>${escapeHtml(author)}</strong>
      <p>${escapeHtml(text)}</p>
    `;

    return element;
  }

  function updateMessageEl(element, author, text) {
    element.innerHTML = `
      <strong>${escapeHtml(author)}</strong>
      <p>${escapeHtml(text)}</p>
    `;
  }

  function scrollToBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
  }
})();


// ============================================================================
// FILE UPLOAD
// ============================================================================
// Uploads the selected document to FastAPI.
// The backend then loads, splits, embeds and stores the document.
// ============================================================================

(function setupFileUpload() {
  const uploadForm = document.getElementById("upload-form");
  const uploadStatus = document.getElementById("upload-status");
  const fileInput = document.getElementById("file");
  const fileNameLabel = document.getElementById("file-name");

  // These elements only exist on the home/chat page.
  if (
    !uploadForm ||
    !uploadStatus ||
    !fileInput ||
    !fileNameLabel
  ) {
    return;
  }

  // Show selected filename.
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
      fileNameLabel.textContent =
        fileInput.files[0].name;
    } else {
      fileNameLabel.textContent = "Choose a file";
    }
  });

  // Handle upload.
  uploadForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (
      !fileInput.files ||
      fileInput.files.length === 0
    ) {
      uploadStatus.textContent =
        "Please select a file.";

      return;
    }

    const formData = new FormData();

    formData.append(
      "file",
      fileInput.files[0]
    );

    uploadStatus.textContent =
      "Uploading and indexing...";

    try {
      const response = await fetch("/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Upload failed"
        );
      }

      uploadStatus.textContent =
        `${data.filename} uploaded successfully. ` +
        `${data.chunks_added} chunks indexed.`;

      // Reset file input.
      fileInput.value = "";

      fileNameLabel.textContent =
        "Choose a file";

      // Reload so the uploaded file appears in
      // the sidebar/document list.
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      uploadStatus.textContent =
        "Error: " + error.message;
    }
  });
})();


// ============================================================================
// UTILITIES
// ============================================================================
// Prevents HTML injection when displaying user/backend text.
// ============================================================================

function escapeHtml(text) {
  const div = document.createElement("div");

  div.textContent = text;

  return div.innerHTML;
}