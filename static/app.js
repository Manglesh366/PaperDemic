// ============================================================================
// THEME TOGGLE
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
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
  `;

  function syncThemeIcon() {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";

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

(function setupPasswordToggle() {
  const passwordInput = document.getElementById("password");
  const togglePassword = document.getElementById("toggle-password");
  const eyeIcon = document.getElementById("eye-icon");
  const eyeSlashIcon = document.getElementById("eye-slash-icon");

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
// MARKDOWN RENDERER
// ============================================================================
//
// Converts LLM Markdown into safe HTML.
//
// Supported:
// - Headings
// - Bold
// - Italic
// - Bullet lists
// - Numbered lists
// - Inline code
// - Code blocks
// - Links
// - Tables
// - Horizontal rules
// - LaTeX equations
// - Paragraphs
//
// IMPORTANT:
// HTML is escaped before Markdown formatting is applied.
// ============================================================================

function renderMarkdown(markdown) {
  if (
    markdown === null ||
    markdown === undefined
  ) {
    return "";
  }

  let text = String(markdown)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!text) {
    return "";
  }

  // Normalize excessive blank lines.
  text = text.replace(/\n{3,}/g, "\n\n");

  // Escape HTML before processing Markdown.
  text = escapeHtml(text);

  // --------------------------------------------------------------------------
  // Extract LaTeX blocks
  // --------------------------------------------------------------------------

  const mathBlocks = [];

  text = text.replace(
    /\$\$([\s\S]*?)\$\$/g,
    function (match, formula) {
      const index = mathBlocks.length;

      mathBlocks.push(`
        <div class="math-block">
          \\[${formula.trim()}\\]
        </div>
      `);

      return `@@MATHBLOCK${index}@@`;
    }
  );

  // --------------------------------------------------------------------------
  // Extract inline LaTeX
  // --------------------------------------------------------------------------

  const inlineMath = [];

  text = text.replace(
    /\\\(([\s\S]*?)\\\)/g,
    function (match, formula) {
      const index = inlineMath.length;

      inlineMath.push(
        `\\(${formula}\\)`
      );

      return `@@INLINEMATH${index}@@`;
    }
  );

  // Also support simple $...$ inline math.
  text = text.replace(
    /\$([^$\n]+)\$/g,
    function (match, formula) {
      const index = inlineMath.length;

      inlineMath.push(
        `\\(${formula}\\)`
      );

      return `@@INLINEMATH${index}@@`;
    }
  );

  // --------------------------------------------------------------------------
  // Extract fenced code blocks
  // --------------------------------------------------------------------------

  const codeBlocks = [];

  text = text.replace(
    /```([a-zA-Z0-9_+\-]*)\n?([\s\S]*?)```/g,
    function (match, language, code) {
      const index = codeBlocks.length;

      const languageClass = language
        ? ` class="language-${escapeHtml(language)}"`
        : "";

      const codeHtml = `
        <pre class="markdown-code-block"><code${languageClass}>${code.trim()}</code></pre>
      `;

      codeBlocks.push(codeHtml);

      return `@@CODEBLOCK${index}@@`;
    }
  );

  // --------------------------------------------------------------------------
  // Split into lines
  // --------------------------------------------------------------------------

  const lines = text.split("\n");

  const output = [];

  let inUnorderedList = false;
  let inOrderedList = false;

  function closeLists() {
    if (inUnorderedList) {
      output.push("</ul>");
      inUnorderedList = false;
    }

    if (inOrderedList) {
      output.push("</ol>");
      inOrderedList = false;
    }
  }

  // --------------------------------------------------------------------------
  // Process lines
  // --------------------------------------------------------------------------

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];

    const line = rawLine.trim();

    // Empty line.
    if (!line) {
      closeLists();
      continue;
    }

    // ------------------------------------------------------------------------
    // Math block
    // ------------------------------------------------------------------------

    const mathBlockMatch =
      line.match(/^@@MATHBLOCK(\d+)@@$/);

    if (mathBlockMatch) {
      closeLists();

      const index = Number(
        mathBlockMatch[1]
      );

      output.push(
        mathBlocks[index]
      );

      continue;
    }

    // ------------------------------------------------------------------------
    // Code block
    // ------------------------------------------------------------------------

    const codeBlockMatch =
      line.match(/^@@CODEBLOCK(\d+)@@$/);

    if (codeBlockMatch) {
      closeLists();

      const index = Number(
        codeBlockMatch[1]
      );

      output.push(
        codeBlocks[index]
      );

      continue;
    }

    // ------------------------------------------------------------------------
    // Horizontal rule
    // ------------------------------------------------------------------------

    if (
      /^([-*_])\s*(?:\1\s*){2,}$/.test(line)
    ) {
      closeLists();

      output.push("<hr>");

      continue;
    }

    // ------------------------------------------------------------------------
    // Headings
    // ------------------------------------------------------------------------

    const headingMatch =
      line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      closeLists();

      const level =
        headingMatch[1].length;

      const content =
        formatInlineMarkdown(
          headingMatch[2]
        );

      output.push(
        `<h${level}>${content}</h${level}>`
      );

      continue;
    }

    // ------------------------------------------------------------------------
    // Unordered list
    // ------------------------------------------------------------------------

    const unorderedMatch =
      line.match(/^[-*+]\s+(.+)$/);

    if (unorderedMatch) {
      if (inOrderedList) {
        output.push("</ol>");
        inOrderedList = false;
      }

      if (!inUnorderedList) {
        output.push("<ul>");
        inUnorderedList = true;
      }

      output.push(
        `<li>${formatInlineMarkdown(
          unorderedMatch[1]
        )}</li>`
      );

      continue;
    }

    // ------------------------------------------------------------------------
    // Ordered list
    // ------------------------------------------------------------------------

    const orderedMatch =
      line.match(/^\d+\.\s+(.+)$/);

    if (orderedMatch) {
      if (inUnorderedList) {
        output.push("</ul>");
        inUnorderedList = false;
      }

      if (!inOrderedList) {
        output.push("<ol>");
        inOrderedList = true;
      }

      output.push(
        `<li>${formatInlineMarkdown(
          orderedMatch[1]
        )}</li>`
      );

      continue;
    }

    // ------------------------------------------------------------------------
    // Markdown table
    // ------------------------------------------------------------------------

    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(
        lines[i + 1]
      )
    ) {
      closeLists();

      const tableLines = [];

      tableLines.push(line);
      tableLines.push(lines[i + 1]);

      i += 2;

      while (
        i < lines.length &&
        lines[i].trim() &&
        lines[i].includes("|")
      ) {
        tableLines.push(lines[i]);
        i++;
      }

      i--;

      output.push(
        renderMarkdownTable(tableLines)
      );

      continue;
    }

    // ------------------------------------------------------------------------
    // Normal paragraph
    // ------------------------------------------------------------------------

    closeLists();

    output.push(
      `<p>${formatInlineMarkdown(line)}</p>`
    );
  }

  closeLists();

  // --------------------------------------------------------------------------
  // Combine output
  // --------------------------------------------------------------------------

  let html = output.join("");

  // --------------------------------------------------------------------------
  // Restore code blocks
  // --------------------------------------------------------------------------

  codeBlocks.forEach(
    function (codeHtml, index) {
      html = html.replace(
        `@@CODEBLOCK${index}@@`,
        codeHtml
      );
    }
  );

  // --------------------------------------------------------------------------
  // Restore math blocks
  // --------------------------------------------------------------------------

  mathBlocks.forEach(
    function (mathHtml, index) {
      html = html.replace(
        `@@MATHBLOCK${index}@@`,
        mathHtml
      );
    }
  );

  // --------------------------------------------------------------------------
  // Restore inline math
  // --------------------------------------------------------------------------

  inlineMath.forEach(
    function (mathHtml, index) {
      html = html.replace(
        `@@INLINEMATH${index}@@`,
        mathHtml
      );
    }
  );

  return html;
}


// ============================================================================
// INLINE MARKDOWN
// ============================================================================

function formatInlineMarkdown(text) {
  let result = text;

  // --------------------------------------------------------------------------
  // Inline code
  // --------------------------------------------------------------------------

  const inlineCode = [];

  result = result.replace(
    /`([^`]+)`/g,
    function (match, code) {
      const index = inlineCode.length;

      inlineCode.push(
        `<code class="inline-code">${code}</code>`
      );

      return `@@INLINECODE${index}@@`;
    }
  );

  // --------------------------------------------------------------------------
  // Markdown links
  // --------------------------------------------------------------------------

  result = result.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    function (match, label, url) {
      return (
        `<a href="${url}" ` +
        `target="_blank" ` +
        `rel="noopener noreferrer">` +
        `${label}` +
        `</a>`
      );
    }
  );

  // --------------------------------------------------------------------------
  // Bold
  // --------------------------------------------------------------------------

  result = result.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );

  // --------------------------------------------------------------------------
  // Italic
  // --------------------------------------------------------------------------

  result = result.replace(
    /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
    "<em>$1</em>"
  );

  // --------------------------------------------------------------------------
  // Restore inline code
  // --------------------------------------------------------------------------

  inlineCode.forEach(
    function (codeHtml, index) {
      result = result.replace(
        `@@INLINECODE${index}@@`,
        codeHtml
      );
    }
  );

  return result;
}


// ============================================================================
// MARKDOWN TABLE
// ============================================================================

function renderMarkdownTable(lines) {
  if (lines.length < 2) {
    return "";
  }

  function splitRow(row) {
    return row
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map(cell => cell.trim());
  }

  const headers = splitRow(lines[0]);

  let html = `
    <div class="markdown-table-wrapper">
      <table class="markdown-table">
        <thead>
          <tr>
  `;

  headers.forEach(header => {
    html += `
      <th>
        ${formatInlineMarkdown(header)}
      </th>
    `;
  });

  html += `
          </tr>
        </thead>
        <tbody>
  `;

  for (let i = 2; i < lines.length; i++) {
    const cells = splitRow(lines[i]);

    html += "<tr>";

    cells.forEach(cell => {
      html += `
        <td>
          ${formatInlineMarkdown(cell)}
        </td>
      `;
    });

    html += "</tr>";
  }

  html += `
        </tbody>
      </table>
    </div>
  `;

  return html;
}


// ============================================================================
// RENDER STORED DATABASE ANSWERS
// ============================================================================
//
// home.html places previously saved answers inside:
//
// <div class="message-content server-answer">
//     {{ chat.answer }}
// </div>
//
// We convert those answers from Markdown to HTML when the page loads.
// ============================================================================

(function renderStoredAssistantMessages() {
  document
    .querySelectorAll(".server-answer")
    .forEach((element) => {
      const markdown =
        element.textContent || "";

      element.innerHTML =
        renderMarkdown(markdown);
    });

  renderMath();
})();


// ============================================================================
// MATH RENDERING
// ============================================================================
//
// Uses MathJax for equations such as:
//
// $$
// Attention(Q,K,V) = softmax(QK^T / sqrt(d_k))V
// $$
// ============================================================================

function loadMathJax() {
  if (window.MathJax) {
    renderMath();
    return;
  }

  window.MathJax = {
    tex: {
      inlineMath: [
        ["\\(", "\\)"],
        ["$", "$"]
      ],
      displayMath: [
        ["\\[", "\\]"],
        ["$$", "$$"]
      ]
    },

    svg: {
      fontCache: "global"
    }
  };

  const script =
    document.createElement("script");

  script.src =
    "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js";

  script.async = true;

  script.onload = () => {
    renderMath();
  };

  document.head.appendChild(script);
}


function renderMath() {
  if (
    window.MathJax &&
    window.MathJax.typesetPromise
  ) {
    window.MathJax.typesetPromise();
  }
}


// Load MathJax after page content is available.
loadMathJax();


// ============================================================================
// CHAT
// ============================================================================

(function setupChat() {
  const chatForm =
    document.getElementById("chat-form");

  const questionInput =
    document.getElementById("question");

  const chatBox =
    document.getElementById("chat-box");

  if (
    !chatForm ||
    !questionInput ||
    !chatBox
  ) {
    return;
  }

  chatForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const question =
        questionInput.value.trim();

      if (!question) {
        return;
      }

      // Show user question.
      appendMessage(
        "You",
        question
      );

      questionInput.value = "";
      questionInput.disabled = true;

      // Loading message.
      const loading =
        createMessageEl(
          "RAG Assistant",
          "Searching your documents..."
        );

      chatBox.appendChild(
        loading
      );

      scrollToBottom();

      try {
        const formData =
          new FormData();

        formData.append(
          "question",
          question
        );

        const response =
          await fetch(
            "/chat",
            {
              method: "POST",
              body: formData
            }
          );

        let data;

        try {
          data = await response.json();
        } catch {
          throw new Error(
            "The server returned an invalid response."
          );
        }

        if (!response.ok) {
          throw new Error(
            data.detail ||
            "Something went wrong."
          );
        }

        updateMessageEl(
          loading,
          "RAG Assistant",
          data.answer
        );

        // Render any equations returned in this answer.
        renderMath();

      } catch (error) {

        updateMessageEl(
          loading,
          "Error",
          error.message
        );

      } finally {

        questionInput.disabled =
          false;

        questionInput.focus();

        scrollToBottom();
      }
    }
  );


  // ========================================================================
  // APPEND MESSAGE
  // ========================================================================

  function appendMessage(
    author,
    text
  ) {
    const element =
      createMessageEl(
        author,
        text
      );

    chatBox.appendChild(
      element
    );

    scrollToBottom();
  }


  // ========================================================================
  // CREATE MESSAGE
  // ========================================================================

  function createMessageEl(
    author,
    text
  ) {
    const isUser =
      author === "You";

    const element =
      document.createElement(
        "div"
      );

    element.className =
      `message ${
        isUser
          ? "user-message"
          : "assistant-message"
      }`;

    const authorElement =
      document.createElement(
        "strong"
      );

    authorElement.textContent =
      author;

    const contentElement =
      document.createElement(
        "div"
      );

    contentElement.className =
      "message-content";

    if (isUser) {

      contentElement.textContent =
        text;

    } else {

      contentElement.innerHTML =
        renderMarkdown(text);

    }

    element.appendChild(
      authorElement
    );

    element.appendChild(
      contentElement
    );

    return element;
  }


  // ========================================================================
  // UPDATE MESSAGE
  // ========================================================================

  function updateMessageEl(
    element,
    author,
    text
  ) {
    const isUser =
      author === "You";

    element.innerHTML = "";

    const authorElement =
      document.createElement(
        "strong"
      );

    authorElement.textContent =
      author;

    const contentElement =
      document.createElement(
        "div"
      );

    contentElement.className =
      "message-content";

    if (isUser) {

      contentElement.textContent =
        text;

    } else {

      contentElement.innerHTML =
        renderMarkdown(text);

    }

    element.appendChild(
      authorElement
    );

    element.appendChild(
      contentElement
    );
  }


  // ========================================================================
  // SCROLL
  // ========================================================================

  function scrollToBottom() {
    chatBox.scrollTop =
      chatBox.scrollHeight;
  }

})();


// ============================================================================
// FILE UPLOAD
// ============================================================================

(function setupFileUpload() {

  const uploadForm =
    document.getElementById(
      "upload-form"
    );

  const uploadStatus =
    document.getElementById(
      "upload-status"
    );

  const fileInput =
    document.getElementById(
      "file"
    );

  const fileNameLabel =
    document.getElementById(
      "file-name"
    );

  if (
    !uploadForm ||
    !uploadStatus ||
    !fileInput ||
    !fileNameLabel
  ) {
    return;
  }

  // Show selected filename.
  fileInput.addEventListener(
    "change",
    () => {

      if (
        fileInput.files.length > 0
      ) {

        fileNameLabel.textContent =
          fileInput.files[0].name;

      } else {

        fileNameLabel.textContent =
          "Choose a file";

      }
    }
  );


  // Upload file.
  uploadForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      if (
        !fileInput.files ||
        fileInput.files.length === 0
      ) {

        uploadStatus.textContent =
          "Please select a file.";

        return;
      }

      const formData =
        new FormData();

      formData.append(
        "file",
        fileInput.files[0]
      );

      uploadStatus.textContent =
        "Uploading and indexing...";

      try {

        const response =
          await fetch(
            "/upload",
            {
              method: "POST",
              body: formData
            }
          );

        let data;

        try {
          data = await response.json();
        } catch {
          throw new Error(
            "The server returned an invalid response."
          );
        }

        if (!response.ok) {

          throw new Error(
            data.detail ||
            "Upload failed."
          );

        }

        uploadStatus.textContent =
          `${data.filename} uploaded successfully. ` +
          `${data.chunks_added} chunks indexed.`;

        fileInput.value = "";

        fileNameLabel.textContent =
          "Choose a file";

        setTimeout(
          () => {
            window.location.reload();
          },
          1000
        );

      } catch (error) {

        uploadStatus.textContent =
          "Error: " +
          error.message;

      }

    }
  );

})();


// ============================================================================
// ESCAPE HTML
// ============================================================================

function escapeHtml(text) {

  const div =
    document.createElement(
      "div"
    );

  div.textContent =
    text;

  return div.innerHTML;
}


// ============================================================================
// DELETE ACCOUNT CONFIRMATION
// ============================================================================

function confirmDeleteAccount() {

  return confirm(
    "Are you sure you want to delete your account?\n\n" +
    "This will permanently delete:\n" +
    "- Your account\n" +
    "- Your chat history\n" +
    "- Your uploaded documents\n" +
    "- Your document embeddings\n\n" +
    "This action cannot be undone."
  );
}