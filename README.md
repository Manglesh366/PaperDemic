# 🤖 PaperDemic — Multi-User RAG Assistant

PaperDemic is a **Retrieval-Augmented Generation (RAG) web application** built with **Python, FastAPI, LangChain, ChromaDB, Google Gemini Embeddings, and OpenRouter**.

The application allows users to:

- Create an account with a username and password
- Log in securely
- Upload their own documents
- Convert documents into vector embeddings
- Store embeddings in a user-specific Chroma vector database
- Ask questions about uploaded documents
- Maintain conversation history for each user
- Use previous conversations as context for follow-up questions
- View previous chats
- Keep different users' documents and conversations separated

---

## 📌 Table of Contents

- [Project Overview](#-project-overview)
- [Features](#-features)
- [How RAG Works](#-how-rag-works)
- [Architecture](#-architecture)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Database Architecture](#-database-architecture)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Running the Application](#-running-the-application)
- [How Document Upload Works](#-how-document-upload-works)
- [How Chat History Works](#-how-chat-history-works)
- [How a Question Is Processed](#-how-a-question-is-processed)
- [Multi-User Architecture](#-multi-user-architecture)
- [RAG Pipeline](#-rag-pipeline)
- [Troubleshooting](#-troubleshooting)
- [Security Notes](#-security-notes)
- [Future Improvements](#-future-improvements)
- [Author](#-author)

---

# 🚀 Project Overview

Traditional chatbots generate answers primarily from the knowledge contained within their language model.

PaperDemic uses **Retrieval-Augmented Generation (RAG)**.

Instead of asking the LLM to answer directly, the application first searches the user's uploaded documents for relevant information.

The retrieved information is then provided to the language model as context.

```text
User Question
      │
      ▼
Generate Query Embedding
      │
      ▼
Search ChromaDB
      │
      ▼
Retrieve Relevant Document Chunks
      │
      ▼
Combine:
  - Retrieved Context
  - Previous Conversation
  - Current Question
      │
      ▼
OpenRouter LLM
      │
      ▼
Generated Answer
```

This allows the assistant to answer questions based on the user's own documents.

---

# ✨ Features

## 👤 User Authentication

Users can:

- Create an account
- Log in
- Log out
- Maintain their own session
- Keep their documents and conversations associated with their account

Passwords are stored as **password hashes**, not plain-text passwords.

---

## 📄 Document Upload

Users can upload documents through the web interface.

The uploaded document is:

```text
Document
   ↓
Text Extraction
   ↓
Text Chunking
   ↓
Gemini Embeddings
   ↓
ChromaDB
```

The document itself is stored separately from its vector representation.

---

## 🧠 Retrieval-Augmented Generation

The application retrieves relevant chunks from the user's documents before generating an answer.

This reduces the need for the LLM to rely only on its pretrained knowledge.

---

## 💬 Conversation History

The application remembers previous questions and answers.

For example:

```text
User:
What is attention?

AI:
Attention allows a model to focus on relevant parts
of an input sequence.

User:
Why is it important?

AI:
It is important because...
```

The second question can be interpreted using the previous conversation.

---

## 👥 Multi-User Support

Each user has their own identity.

Documents and conversations are associated with the corresponding user.

Conceptually:

```text
User 1
 ├── Documents
 └── Chat History

User 2
 ├── Documents
 └── Chat History

User 3
 ├── Documents
 └── Chat History
```

---

# 🧠 How RAG Works

RAG consists of two major stages.

## 1. Retrieval

The application searches the vector database for information relevant to the question.

```text
Question
   ↓
Embedding
   ↓
Vector Search
   ↓
Relevant Chunks
```

## 2. Generation

The retrieved information is passed to the language model.

```text
Retrieved Context
       +
Chat History
       +
Current Question
       ↓
      LLM
       ↓
    Answer
```

---

# 🏗 Architecture

The overall architecture is:

```text
                         ┌───────────────────┐
                         │      Browser      │
                         │   Web Interface   │
                         └─────────┬─────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │      FastAPI      │
                         │   Web Application  │
                         └─────────┬─────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
                 SQLite        RAG Service     File Storage
                    │              │              │
                    │              │              │
                    │              ▼              │
                    │          ChromaDB           │
                    │              │              │
                    │              ▼              │
                    │       Gemini Embeddings     │
                    │                             │
                    │              │              │
                    │              ▼              │
                    │         OpenRouter          │
                    │           LLM               │
                    │                             │
                    └──────────────┴──────────────┘
```

---

# 🛠 Technology Stack

| Technology | Purpose |
|---|---|
| Python | Main programming language |
| FastAPI | Backend web framework |
| Jinja2 | HTML templating |
| SQLAlchemy | Database ORM |
| SQLite | Application database |
| LangChain | RAG orchestration |
| ChromaDB | Vector database |
| Google Gemini | Document embeddings |
| OpenRouter | LLM API |
| PyMuPDF | PDF text extraction |
| Itsdangerous | Session handling |
| HTML/CSS/JavaScript | Frontend |

---

# 📁 Project Structure

A recommended project structure is:

```text
PaperDemic/
│
├── main.py
├── database.py
├── models.py
├── auth.py
├── rag_service.py
│
├── requirements.txt
├── README.md
│
├── database.db
├── chat_history.db
│
├── templates/
│   ├── login.html
│   └── home.html
│
├── static/
│   ├── style.css
│   └── app.js
│
├── uploads/
│   ├── user_1/
│   ├── user_2/
│   └── ...
│
└── data/
    └── chroma/
        ├── user_1/
        ├── user_2/
        └── ...
```

---

# 🗄 Database Architecture

PaperDemic currently uses SQLite for application and conversation data.

There are two important relational databases in the current implementation.

## `database.db`

Used by FastAPI/SQLAlchemy.

It contains information such as:

```text
users
chat_history
```

### Users

Conceptually:

```text
users
--------------------------------
id
username
password_hash
```

Example:

```text
id    username    password_hash
--------------------------------
1     user1       $argon2id$...
2     user2       $argon2id$...
```

---

## Chat History

Conceptually:

```text
chat_history
--------------------------------
id
user_id
question
answer
created_at
```

Example:

```text
id    user_id    question
--------------------------------
1     1          What is RAG?
2     1          How does it work?
3     2          What is attention?
```

The `user_id` connects each conversation to a specific user.

---

# 💬 LangChain Chat History

The current RAG implementation also uses:

```python
SQLChatMessageHistory
```

with:

```text
chat_history.db
```

This database stores LangChain conversation messages.

Conceptually:

```text
session_id
     │
     ├── HumanMessage
     ├── AIMessage
     ├── HumanMessage
     └── AIMessage
```

This allows the RAG system to retrieve previous conversation messages and provide them to the LLM.

---

# 🧠 ChromaDB

ChromaDB is used for **vector search**, not normal application data.

When a document is uploaded:

```text
PDF
 ↓
Extract text
 ↓
Split into chunks
 ↓
Generate embeddings
 ↓
Store vectors in Chroma
```

For example:

```text
data/
└── chroma/
    ├── user_1/
    ├── user_2/
    └── user_3/
```

This allows document retrieval to be separated by user.

---

# 🔐 Multi-User Architecture

User isolation is an important part of the application.

Suppose:

```text
User 1 → user_id = 1

User 2 → user_id = 2
```

Their vector stores can be separated:

```text
data/chroma/
│
├── user_1/
│
└── user_2/
```

Similarly, uploaded files can be stored as:

```text
uploads/
│
├── user_1/
│   ├── paper.pdf
│   └── research.pdf
│
└── user_2/
    └── document.pdf
```

This prevents the retrieval system from intentionally mixing documents belonging to different users.

---

# 🔑 Environment Variables

The application requires API credentials.

Do **not** hard-code API keys in your source code.

Set them as environment variables.

### Linux/macOS

```bash
export GOOGLE_API_KEY="your_google_api_key"
export OPENROUTER="your_openrouter_api_key"
export SECRET_KEY="your_secret_key"
```

Verify:

```bash
echo $GOOGLE_API_KEY
echo $OPENROUTER
```

Do not commit these values to GitHub.

---

# 📦 Installation

## 1. Clone the repository

```bash
git clone <your-repository-url>
```

Enter the project:

```bash
cd PaperDemic
```

---

## 2. Create a virtual environment

```bash
python -m venv .venv
```

Activate it.

### Linux/macOS

```bash
source .venv/bin/activate
```

### Windows

```powershell
.venv\Scripts\activate
```

---

## 3. Install dependencies

```bash
pip install -r requirements.txt
```

If you don't have `requirements.txt` yet, install the main packages:

```bash
pip install fastapi
pip install uvicorn
pip install sqlalchemy
pip install jinja2
pip install python-multipart
pip install itsdangerous
pip install passlib
pip install langchain
pip install langchain-community
pip install langchain-text-splitters
pip install langchain-chroma
pip install langchain-google-genai
pip install langchain-openai
pip install chromadb
pip install pymupdf
```

---

# ▶️ Running the Application

Start FastAPI with:

```bash
uvicorn main:app --reload
```

The application will normally be available at:

```text
http://127.0.0.1:8000
```

Open the address in your browser.

---

# 📄 How Document Upload Works

When a user uploads a document:

```text
                Uploaded File
                     │
                     ▼
              File Validation
                     │
                     ▼
             Save Original File
                     │
                     ▼
              Document Loader
                     │
                     ▼
             Extract Text
                     │
                     ▼
           Recursive Text Splitter
                     │
                     ▼
                Text Chunks
                     │
                     ▼
           Gemini Embedding Model
                     │
                     ▼
              Vector Embeddings
                     │
                     ▼
                  ChromaDB
```

---

# ✂️ Text Chunking

The project uses:

```python
RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)
```

This means the document is divided into approximately 1000-character chunks.

There is a 200-character overlap between neighboring chunks.

For example:

```text
Chunk 1
-----------------------
AAAAAAAAAAAAAAAAAAAA
BBBBBBBBBBBBBBBBBBBB
CCCCCCCCCCCCCCCCCCCC
```

and:

```text
Chunk 2
-----------------------
CCCCCCCCCCCCCCCCCCCC
DDDDDDDDDDDDDDDDDDDD
EEEEEEEEEEEEEEEEEEEE
```

The overlap helps preserve context between chunks.

---

# 🔎 How Retrieval Works

When the user asks:

```text
What is the attention mechanism?
```

the question is converted into an embedding.

```text
"What is attention?"
          ↓
     Embedding Model
          ↓
[0.12, -0.43, 0.88, ...]
```

Chroma searches for document vectors that are semantically similar.

The most relevant chunks are returned.

---

# 🤖 How a Question Is Processed

The complete process is:

```text
User
 │
 │ Question
 ▼
FastAPI
 │
 ▼
Authenticate User
 │
 ▼
Get User ID
 │
 ▼
Load User Conversation
 │
 ▼
Search User's ChromaDB
 │
 ▼
Retrieve Relevant Documents
 │
 ▼
Build Prompt
 │
 ├── Previous Conversation
 │
 ├── Retrieved Context
 │
 └── Current Question
 │
 ▼
OpenRouter LLM
 │
 ▼
Answer
 │
 ├── Save conversation
 │
 └── Return answer
 │
 ▼
Frontend
```

---

# 🧩 Prompt Structure

The RAG prompt contains three major pieces of information:

```text
Previous conversation:
{chat_history}

Context:
{context}

Current question:
{question}
```

This allows the model to use:

1. Previous conversation
2. Retrieved document information
3. Current user question

---

# 🔄 Follow-Up Questions

Conversation history is especially useful for follow-up questions.

Example:

### Question 1

```text
What is self-attention?
```

### Answer

```text
Self-attention allows each token to interact with
other tokens in the sequence.
```

### Question 2

```text
Why is it useful?
```

The second question is ambiguous by itself.

However, the RAG system has:

```text
Previous conversation:

User:
What is self-attention?

AI:
Self-attention allows...
```

Therefore the LLM can understand that:

```text
"it"
```

refers to:

```text
self-attention
```

---

# 🗂 Separation of Responsibilities

Each storage system has a different responsibility.

| Storage | Purpose |
|---|---|
| SQLite | Users and application data |
| SQL chat history | Conversation messages |
| ChromaDB | Document embeddings and retrieval |
| `uploads/` | Original documents |

The distinction is:

```text
Chat History
    ↓
"What did we talk about?"

ChromaDB
    ↓
"What information exists in the documents?"

Uploads
    ↓
"What original files did the user upload?"
```

---

# ⚠️ Troubleshooting

## Google Authentication Error

If you see:

```text
401 UNAUTHENTICATED
```

or:

```text
ACCESS_TOKEN_TYPE_UNSUPPORTED
```

make sure `GOOGLE_API_KEY` is correctly configured.

Check:

```bash
echo $GOOGLE_API_KEY
```

If you're accidentally using Google Cloud OAuth credentials, remove:

```bash
unset GOOGLE_APPLICATION_CREDENTIALS
```

Then set:

```bash
export GOOGLE_API_KEY="your_api_key"
```

Restart FastAPI.

---

## OpenRouter Rate Limit

If you see:

```text
429
```

the selected OpenRouter provider/model may be temporarily rate limited.

Possible solutions:

- Retry the request
- Use another model
- Configure your own provider/API key
- Change the OpenRouter model

---

## FastAPI Internal Server Error

Run:

```bash
uvicorn main:app --reload
```

and inspect the terminal.

The traceback usually identifies the exact problem.

Common causes include:

- Missing environment variable
- Incorrect database configuration
- Missing template
- Missing static directory
- RAG exception
- Chroma configuration problem
- Invalid uploaded document

---

# 🔒 Security Notes

This project is intended as a learning/development project.

Before deploying it publicly, improve the following:

### 1. Secret key

Do not use:

```python
SECRET_KEY = "CHANGE_THIS"
```

Use an environment variable instead.

---

### 2. API keys

Never commit:

```text
GOOGLE_API_KEY
OPENROUTER
```

to GitHub.

Add secrets to:

```text
.env
```

and add `.env` to `.gitignore`.

---

### 3. Passwords

Never store plain-text passwords.

Always store password hashes.

---

### 4. File validation

Before production deployment, validate:

- File extension
- MIME type
- File size
- Filename
- Malicious uploads

---

### 5. Production database

SQLite is excellent for development and small applications.

For a larger production application, consider:

```text
PostgreSQL
```

---

# 📈 Future Improvements

The current project can be extended significantly.

## 🔹 Multiple Conversations

Instead of one history per user:

```text
User
 ├── Chat 1
 ├── Chat 2
 └── Chat 3
```

Each conversation can have its own session ID.

---

## 🔹 Chat Sidebar

Add a ChatGPT-style sidebar:

```text
New Chat

Recent
──────────────
Attention Mechanism
RAG Project
Transformer Research
Machine Learning
```

---

## 🔹 Document Management

Allow users to:

- View uploaded documents
- Delete documents
- Rename documents
- See upload dates
- Search documents

---

## 🔹 Streaming Responses

Instead of waiting for the entire answer:

```text
Generating...
```

the response can appear token by token.

```text
Attention is...
Attention is a mechanism...
Attention is a mechanism that allows...
```

---

## 🔹 Better Authentication

Future versions can include:

- Email authentication
- Password reset
- Email verification
- OAuth
- JWT authentication
- Secure session management

---

## 🔹 PostgreSQL

For production:

```text
SQLite
   ↓
PostgreSQL
```

This provides better scalability for multiple concurrent users.

---

## 🔹 Better Vector Database

The project can later support:

- ChromaDB
- FAISS
- Qdrant
- Pinecone
- Weaviate

---

## 🔹 Reranking

A reranker can be added after retrieval:

```text
Question
   ↓
Retrieve 20 chunks
   ↓
Reranker
   ↓
Best 5 chunks
   ↓
LLM
```

This can improve retrieval quality.

---

# 🧪 Example Use Case

Suppose a researcher uploads:

```text
Attention_Is_All_You_Need.pdf
```

They can ask:

```text
What is the attention mechanism?
```

Then:

```text
Why is multi-head attention useful?
```

Then:

```text
How does it improve the model compared with recurrent networks?
```

The system retrieves relevant passages from the uploaded research paper while using previous conversation to understand follow-up questions.

---

# 🎯 Project Goal

The main goal of PaperDemic is to demonstrate how modern AI applications can combine:

```text
Web Development
       +
User Authentication
       +
Document Processing
       +
Vector Databases
       +
Embeddings
       +
Retrieval
       +
Large Language Models
       +
Conversation Memory
```

into a single practical application.

---

# 📚 Learning Concepts Demonstrated

This project provides hands-on experience with:

- FastAPI
- REST APIs
- HTML/CSS/JavaScript
- Jinja2
- SQLAlchemy
- SQLite
- Authentication
- Password hashing
- Sessions and cookies
- File uploads
- PDF processing
- Text chunking
- Embeddings
- Vector databases
- Semantic search
- LangChain
- RAG
- Prompt engineering
- LLM integration
- Conversation memory
- Multi-user architecture

---

# 👨‍💻 Author

**Manglesh Prajapati**

PaperDemic is developed as a practical project for learning and implementing modern **RAG and AI application development** using Python.

---

# ⭐ Project Status

🚧 **Active Development**

Current capabilities:

- [x] User registration
- [x] User login
- [x] Password hashing
- [x] Session-based authentication
- [x] Document upload
- [x] Document processing
- [x] Gemini embeddings
- [x] ChromaDB retrieval
- [x] OpenRouter LLM
- [x] RAG question answering
- [x] Conversation history
- [x] User-specific document storage
- [x] User-specific chat history

Planned:

- [ ] Multiple chat sessions
- [ ] Chat sidebar
- [ ] Delete conversations
- [ ] Delete documents
- [ ] Document management UI
- [ ] Streaming responses
- [ ] PostgreSQL
- [ ] Production authentication
- [ ] RAG evaluation
- [ ] Retrieval reranking

---

# ⭐ If You Find This Project Useful

If you're learning RAG, FastAPI, LangChain, or LLM application development, feel free to explore and improve the project.

```text
Build → Experiment → Evaluate → Improve
```

That's the goal of PaperDemic.