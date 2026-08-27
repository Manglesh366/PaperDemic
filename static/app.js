// ============================================================
// CHAT
// ============================================================

const chatForm =
    document.getElementById("chat-form");

const questionInput =
    document.getElementById("question");

const chatBox =
    document.getElementById("chat-box");


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
        // Show user message
        // ----------------------------------------------------

        chatBox.innerHTML += `
            <div class="message user-message">

                <strong>
                    You
                </strong>

                <p>
                    ${escapeHtml(question)}
                </p>

            </div>
        `;

        questionInput.value = "";


        // ----------------------------------------------------
        // Loading message
        // ----------------------------------------------------

        const loading =
            document.createElement("div");

        loading.className =
            "message assistant-message";

        loading.innerHTML = `
            <strong>
                RAG Assistant
            </strong>

            <p>
                Searching your documents...
            </p>
        `;

        chatBox.appendChild(
            loading
        );


        chatBox.scrollTop =
            chatBox.scrollHeight;


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


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.detail ||
                    "Something went wrong"
                );

            }


            loading.innerHTML = `
                <strong>
                    RAG Assistant
                </strong>

                <p>
                    ${escapeHtml(data.answer)}
                </p>
            `;


        } catch (error) {

            loading.innerHTML = `
                <strong>
                    Error
                </strong>

                <p>
                    ${escapeHtml(error.message)}
                </p>
            `;

        }


        chatBox.scrollTop =
            chatBox.scrollHeight;

    }
);


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
                    "Upload failed"
                );

            }


            uploadStatus.innerText =
                `${data.filename} uploaded successfully. ` +
                `${data.chunks_added} chunks indexed.`;


            fileInput.value = "";


            // Refresh page so uploaded file appears
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


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHtml(text) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent = text;

    return div.innerHTML;
}