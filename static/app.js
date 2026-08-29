
// ============================================================
// CHAT
// ============================================================

const chatForm =
    document.getElementById("chat-form");

const questionInput =
    document.getElementById("question");

const chatBox =
    document.getElementById("chat-box");


// ============================================================
// CHAT SUBMIT
// ============================================================

chatForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        const question =
            questionInput.value.trim();

        if (!question) {
            return;
        }


        // ----------------------------------------------------
        // Add user message
        // ----------------------------------------------------

        addUserMessage(question);

        questionInput.value = "";


        // ----------------------------------------------------
        // Loading message
        // ----------------------------------------------------

        const loading =
            document.createElement("div");

        loading.className =
            "message assistant-message";

        loading.innerHTML = `
            <div class="message-header">
                <span class="message-avatar">🤖</span>
                <strong>RAG Assistant</strong>
            </div>

            <div class="message-content">
                <div class="typing">
                    Searching your documents...
                </div>
            </div>
        `;

        chatBox.appendChild(loading);

        scrollChat();


        try {

            // ------------------------------------------------
            // Send question
            // ------------------------------------------------

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


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.detail ||
                    "Something went wrong."
                );

            }


            // ------------------------------------------------
            // Render Markdown answer
            // ------------------------------------------------

            loading.innerHTML = `
                <div class="message-header">
                    <span class="message-avatar">🤖</span>
                    <strong>RAG Assistant</strong>
                </div>

                <div class="message-content markdown-body">
                    ${renderMarkdown(data.answer)}
                </div>
            `;


        } catch (error) {

            loading.innerHTML = `
                <div class="message-header">
                    <span class="message-avatar">⚠️</span>
                    <strong>Error</strong>
                </div>

                <div class="message-content error-content">
                    ${escapeHtml(error.message)}
                </div>
            `;

        }


        scrollChat();

    }
);


// ============================================================
// ADD USER MESSAGE
// ============================================================

function addUserMessage(message) {

    const messageElement =
        document.createElement("div");

    messageElement.className =
        "message user-message";

    messageElement.innerHTML = `

        <div class="message-header">

            <span class="message-avatar">
                👤
            </span>

            <strong>
                You
            </strong>

        </div>

        <div class="message-content">

            ${escapeHtml(message)}

        </div>

    `;

    chatBox.appendChild(
        messageElement
    );
}


// ============================================================
// MARKDOWN RENDERER
// ============================================================

function renderMarkdown(markdown) {

    if (!markdown) {

        return "";

    }


    // --------------------------------------------------------
    // If marked.js is loaded, use it
    // --------------------------------------------------------

    if (
        typeof marked !== "undefined"
    ) {

        return marked.parse(
            markdown
        );

    }


    // --------------------------------------------------------
    // Fallback Markdown renderer
    // --------------------------------------------------------

    let html =
        escapeHtml(markdown);


    // Code blocks
    html = html.replace(
        /```([\s\S]*?)```/g,
        function (_, code) {

            return `
                <pre>
                    <code>${code.trim()}</code>
                </pre>
            `;

        }
    );


    // Inline code
    html = html.replace(
        /`([^`]+)`/g,
        "<code>$1</code>"
    );


    // Bold
    html = html.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
    );


    // Italic
    html = html.replace(
        /\*(.*?)\*/g,
        "<em>$1</em>"
    );


    // H3
    html = html.replace(
        /^### (.*)$/gm,
        "<h3>$1</h3>"
    );


    // H2
    html = html.replace(
        /^## (.*)$/gm,
        "<h2>$1</h2>"
    );


    // H1
    html = html.replace(
        /^# (.*)$/gm,
        "<h1>$1</h1>"
    );


    // Unordered lists
    html = html.replace(
        /^\s*[-*] (.*)$/gm,
        "<li>$1</li>"
    );


    // Wrap consecutive list items
    html = html.replace(
        /(<li>.*<\/li>)/gs,
        "<ul>$1</ul>"
    );


    // Numbered lists
    html = html.replace(
        /^\s*\d+\.\s+(.*)$/gm,
        "<li>$1</li>"
    );


    // New lines
    html = html.replace(
        /\n\n/g,
        "</p><p>"
    );


    html =
        "<p>" +
        html +
        "</p>";


    return html;

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(text) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        text;

    return div.innerHTML;

}


// ============================================================
// SCROLL CHAT
// ============================================================

function scrollChat() {

    chatBox.scrollTop =
        chatBox.scrollHeight;

}


// ============================================================
// FILE UPLOAD
// ============================================================

const uploadForm =
    document.getElementById(
        "upload-form"
    );


const uploadStatus =
    document.getElementById(
        "upload-status"
    );


if (uploadForm) {

    uploadForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const fileInput =
                document.getElementById(
                    "file"
                );


            if (
                !fileInput.files ||
                fileInput.files.length === 0
            ) {

                uploadStatus.innerText =
                    "Please select a file.";

                return;

            }


            const formData =
                new FormData();

            formData.append(
                "file",
                fileInput.files[0]
            );


            uploadStatus.innerText =
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


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.detail ||
                        "Upload failed."
                    );

                }


                uploadStatus.innerText =
                    `${data.filename} uploaded successfully. ` +
                    `${data.chunks_added} chunks indexed.`;


                fileInput.value = "";


                setTimeout(
                    () => {
                        window.location.reload();
                    },
                    1000
                );


            } catch (error) {

                uploadStatus.innerText =
                    "Error: " +
                    error.message;

            }

        }
    );

}
````
