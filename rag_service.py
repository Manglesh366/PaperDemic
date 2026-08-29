# ============================================================
# RAG SERVICE
# ============================================================

import os
from pathlib import Path

from langchain_community.document_loaders import (
    PyMuPDFLoader,
    TextLoader,
    Docx2txtLoader,
    CSVLoader
)

from langchain_text_splitters import (
    RecursiveCharacterTextSplitter
)

from langchain_google_genai import (
    GoogleGenerativeAIEmbeddings
)

from langchain_chroma import Chroma

from langchain_core.prompts import (
    ChatPromptTemplate
)

from langchain_openai import (
    ChatOpenAI
)

from langchain_community.chat_message_histories import (
    SQLChatMessageHistory
)

from langchain_core.messages import (
    HumanMessage,
    AIMessage
)


# ============================================================
# API KEYS
# ============================================================

GOOGLE_API_KEY = os.getenv(
    "GOOGLE_API_KEY"
)

OPENROUTER_API_KEY = os.getenv(
    "OPENROUTER"
)


if not GOOGLE_API_KEY:

    raise RuntimeError(
        "GOOGLE_API_KEY environment variable is not set."
    )


if not OPENROUTER_API_KEY:

    raise RuntimeError(
        "OPENROUTER environment variable is not set."
    )


# ============================================================
# DIRECTORIES
# ============================================================

BASE_DATA_DIR = Path(
    "data"
)

CHROMA_DIR = (
    BASE_DATA_DIR / "chroma"
)

CHROMA_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ============================================================
# CHAT HISTORY DATABASE
# ============================================================

CHAT_HISTORY_DATABASE = (
    "sqlite:///chat_history.db"
)


# ============================================================
# EMBEDDINGS
# ============================================================

embeddings = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001"
)


# ============================================================
# LLM
# ============================================================

llm = ChatOpenAI(
    model="poolside/laguna-s-2.1:free",
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY
)


# ============================================================
# TEXT SPLITTER
# ============================================================

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200
)


# ============================================================
# PROMPT
# ============================================================

prompt = ChatPromptTemplate.from_template(
    """
You are a helpful document-based AI assistant.

Your job is to answer the user's question using ONLY the
provided context and previous conversation.

Previous conversation:
{chat_history}

Context:
{context}

Current question:
{question}

Follow these response rules:

1. Give a direct answer first.
2. Use clear Markdown formatting.
3. Use short headings when they improve readability.
4. Use bullet points for lists.
5. Use numbered lists for step-by-step explanations.
6. Use **bold** only for important terms.
7. Keep paragraphs short.
8. Use code blocks when explaining code.
9. Do not unnecessarily repeat the question.
10. Do not use excessive headings.
11. Do not add unnecessary introductory phrases.
12. If the answer cannot be found in the context, clearly say:
   "I don't know based on the provided documents."

Return only the final answer.

Answer:
"""
)


# ============================================================
# FORMAT DOCUMENTS
# ============================================================

def format_docs(docs):

    if not docs:

        return (
            "No relevant documents were found "
            "in the user's uploaded documents."
        )

    return "\n\n".join(
        doc.page_content
        for doc in docs
    )


# ============================================================
# GET USER CHROMA DIRECTORY
# ============================================================

def get_user_chroma_directory(
    user_id
):

    user_dir = (
        CHROMA_DIR / f"user_{user_id}"
    )

    user_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    return str(user_dir)


# ============================================================
# GET USER VECTOR STORE
# ============================================================

def get_user_vector_store(
    user_id
):

    persist_directory = (
        get_user_chroma_directory(
            user_id
        )
    )

    vector_store = Chroma(
        collection_name=f"user_{user_id}",
        embedding_function=embeddings,
        persist_directory=persist_directory
    )

    return vector_store


# ============================================================
# LOAD DOCUMENT
# ============================================================

def load_document(
    file_path: str
):

    extension = (
        Path(file_path)
        .suffix
        .lower()
    )

    # --------------------------------------------------------
    # PDF
    # --------------------------------------------------------

    if extension == ".pdf":

        loader = PyMuPDFLoader(
            file_path
        )

    # --------------------------------------------------------
    # TXT
    # --------------------------------------------------------

    elif extension == ".txt":

        loader = TextLoader(
            file_path,
            encoding="utf-8"
        )

    # --------------------------------------------------------
    # DOCX
    # --------------------------------------------------------

    elif extension == ".docx":

        loader = Docx2txtLoader(
            file_path
        )

    # --------------------------------------------------------
    # CSV
    # --------------------------------------------------------

    elif extension == ".csv":

        loader = CSVLoader(
            file_path
        )

    else:

        raise ValueError(
            f"Unsupported file type: {extension}"
        )

    return loader.load()


# ============================================================
# ADD DOCUMENT TO USER VECTOR DATABASE
# ============================================================

def add_document(
    file_path: str,
    user_id
):

    # --------------------------------------------------------
    # Load document
    # --------------------------------------------------------

    docs = load_document(
        file_path
    )

    if not docs:

        raise ValueError(
            "No text could be extracted from the document."
        )

    # --------------------------------------------------------
    # Split into chunks
    # --------------------------------------------------------

    texts = text_splitter.split_documents(
        docs
    )

    if not texts:

        raise ValueError(
            "Document produced no text chunks."
        )

    # --------------------------------------------------------
    # Add metadata
    # --------------------------------------------------------

    for document in texts:

        document.metadata[
            "user_id"
        ] = str(user_id)

        document.metadata[
            "source_file"
        ] = Path(file_path).name

    # --------------------------------------------------------
    # Get user's vector store
    # --------------------------------------------------------

    vector_store = get_user_vector_store(
        user_id
    )

    # --------------------------------------------------------
    # Add chunks
    # --------------------------------------------------------

    vector_store.add_documents(
        documents=texts
    )

    return len(texts)


# ============================================================
# GET USER CHAT HISTORY
# ============================================================

def get_chat_history(
    session_id
):

    history = SQLChatMessageHistory(
        session_id=str(session_id),
        connection=CHAT_HISTORY_DATABASE
    )

    return history


# ============================================================
# FORMAT CHAT HISTORY
# ============================================================

def format_history(
    messages
):

    if not messages:

        return "No previous conversation."

    return "\n".join(
        f"{message.type}: {message.content}"
        for message in messages
    )


# ============================================================
# ASK RAG
# ============================================================

def ask_rag(
    question: str,
    session_id="user_123",
    user_id=None
):

    # --------------------------------------------------------
    # Make sure user_id exists
    # --------------------------------------------------------

    if user_id is None:

        user_id = session_id

    # --------------------------------------------------------
    # Get user's vector store
    # --------------------------------------------------------

    vector_store = get_user_vector_store(
        user_id
    )

    # --------------------------------------------------------
    # Get vector collection
    # --------------------------------------------------------

    collection = vector_store._collection

    document_count = collection.count()

    # --------------------------------------------------------
    # Get conversation history
    # --------------------------------------------------------

    history = get_chat_history(
        session_id
    )

    previous_messages = history.messages

    chat_history = format_history(
        previous_messages
    )

    # --------------------------------------------------------
    # Search user's documents
    # --------------------------------------------------------

    if document_count > 0:

        retriever = vector_store.as_retriever(
            search_kwargs={
                "k": 5
            }
        )

        relevant_docs = retriever.invoke(
            question
        )

        context = format_docs(
            relevant_docs
        )

    else:

        context = (
            "The user has not uploaded any documents yet."
        )

    # --------------------------------------------------------
    # Build prompt
    # --------------------------------------------------------

    formatted_prompt = prompt.invoke({
        "chat_history": chat_history,
        "context": context,
        "question": question
    })

    # --------------------------------------------------------
    # Call LLM
    # --------------------------------------------------------

    response = llm.invoke(
        formatted_prompt
    )

    answer = response.content

    # --------------------------------------------------------
    # Save conversation
    # --------------------------------------------------------

    history.add_message(
        HumanMessage(
            content=question
        )
    )

    history.add_message(
        AIMessage(
            content=answer
        )
    )

    # --------------------------------------------------------
    # Return answer
    # --------------------------------------------------------

    return answer


