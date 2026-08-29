import os
from pathlib import Path

from langchain_community.document_loaders import (
    PyMuPDFLoader,
    TextLoader,
    Docx2txtLoader,
    CSVLoader,
)
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import (
    GoogleGenerativeAIEmbeddings,
    ChatGoogleGenerativeAI,
)
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_community.chat_message_histories import SQLChatMessageHistory
from langchain_core.messages import HumanMessage, AIMessage


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
    raise RuntimeError("GOOGLE_API_KEY is not set.")


# Local storage for Chroma and SQLite.
BASE_DATA_DIR = Path("data")
CHROMA_DIR = BASE_DATA_DIR / "chroma"

CHROMA_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

CHAT_HISTORY_DATABASE = "sqlite:///chat_history.db"


# Gemini embedding model converts document text into vectors.
embeddings = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001",
    google_api_key=GOOGLE_API_KEY,
)


# Gemini generates the final answer from retrieved context.
llm = ChatGoogleGenerativeAI(
    model="gemini-3.6-flash",
    google_api_key=GOOGLE_API_KEY,
)


# Splits large documents into smaller searchable chunks.
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
)


# Prompt used to generate answers from documents and chat history.
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


# Converts retrieved documents into one context string.
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


# Returns the Chroma directory for a specific user.
def get_user_chroma_directory(user_id):
    user_dir = CHROMA_DIR / f"user_{user_id}"

    user_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    return str(user_dir)


# Returns the user's private vector store.
def get_user_vector_store(user_id):
    persist_directory = get_user_chroma_directory(user_id)

    return Chroma(
        collection_name=f"user_{user_id}",
        embedding_function=embeddings,
        persist_directory=persist_directory,
    )


# Loads PDF, TXT, DOCX, or CSV files.
def load_document(file_path: str):
    extension = Path(file_path).suffix.lower()

    if extension == ".pdf":
        loader = PyMuPDFLoader(file_path)

    elif extension == ".txt":
        loader = TextLoader(
            file_path,
            encoding="utf-8",
        )

    elif extension == ".docx":
        loader = Docx2txtLoader(file_path)

    elif extension == ".csv":
        loader = CSVLoader(file_path)

    else:
        raise ValueError(
            f"Unsupported file type: {extension}"
        )

    return loader.load()


# Loads, splits, and stores a document in the user's vector database.
def add_document(
    file_path: str,
    user_id,
):
    docs = load_document(file_path)

    if not docs:
        raise ValueError(
            "No text could be extracted from the document."
        )

    texts = text_splitter.split_documents(docs)

    if not texts:
        raise ValueError(
            "Document produced no text chunks."
        )

    # Add information that identifies the document owner and file.
    for document in texts:
        document.metadata["user_id"] = str(user_id)
        document.metadata["source_file"] = Path(
            file_path
        ).name

    vector_store = get_user_vector_store(user_id)

    vector_store.add_documents(
        documents=texts
    )

    return len(texts)


# Opens the SQLite conversation history for a session.
def get_chat_history(session_id):
    return SQLChatMessageHistory(
        session_id=str(session_id),
        connection=CHAT_HISTORY_DATABASE,
    )


# Converts previous messages into text for the prompt.
def format_history(messages):
    if not messages:
        return "No previous conversation."

    return "\n".join(
        f"{message.type}: {message.content}"
        for message in messages
    )


# Converts Gemini's response into plain text.
#
# Gemini can sometimes return:
# [{"type": "text", "text": "The tortoise won."}]
#
# SQLite cannot store this list directly, so we extract the text.
def get_answer_text(content):
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        text_parts = []

        for item in content:
            if isinstance(item, dict):
                text = item.get("text")

                if text:
                    text_parts.append(text)

        return "".join(text_parts)

    return str(content)


# Retrieves relevant documents and generates the final answer.
def ask_rag(
    question: str,
    session_id="user_123",
    user_id=None,
):
    # Use the session ID when no separate user ID is provided.
    if user_id is None:
        user_id = session_id

    # Open the user's vector database.
    vector_store = get_user_vector_store(user_id)

    # Check whether the user has uploaded documents.
    document_count = vector_store._collection.count()

    # Load previous conversation.
    history = get_chat_history(session_id)
    previous_messages = history.messages

    chat_history = format_history(
        previous_messages
    )

    # Retrieve the most relevant document chunks.
    if document_count > 0:
        retriever = vector_store.as_retriever(
            search_kwargs={
                "k": 5
            }
        )

        relevant_docs = retriever.invoke(question)

        context = format_docs(
            relevant_docs
        )

    else:
        context = (
            "The user has not uploaded any documents yet."
        )

    # Add history, context, and question to the prompt.
    formatted_prompt = prompt.invoke({
        "chat_history": chat_history,
        "context": context,
        "question": question,
    })

    # Generate the answer with Gemini.
    response = llm.invoke(formatted_prompt)

    # Convert Gemini's response to plain text.
    answer = get_answer_text(
        response.content
    )

    # Save the conversation for future questions.
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

    return answer
