# ============================================================
# RAG SERVICE
# ============================================================

import os
import re
from pathlib import Path

from dotenv import load_dotenv

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
# LOAD ENVIRONMENT VARIABLES
# ============================================================

load_dotenv()


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
    model="models/gemini-embedding-001",
    google_api_key=GOOGLE_API_KEY
)


# ============================================================
# LLM
# ============================================================

llm = ChatOpenAI(
    model="poolside/laguna-s-2.1:free",
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
    temperature=0.2,

    # OpenRouter model fallbacks
    extra_body={
        "models": [
            "poolside/laguna-s-2.1:free",
            "openrouter/free"
        ]
    }
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
provided document context and previous conversation.

============================================================
RESPONSE STYLE
============================================================

Write the answer like a polished professional AI assistant.

Follow these rules carefully:

1. Start directly with the answer.

2. Do NOT add unnecessary introductions such as:
   - "Sure!"
   - "Certainly!"
   - "Of course!"
   - "Here is the answer:"
   - "Based on the documents..."

3. Use clean Markdown formatting.

4. Use a short heading when the answer contains multiple
   sections.

5. Use bullet points when presenting multiple related items.

6. Use numbered lists when explaining a process or steps.

7. Use **bold** for important terms, definitions, or key ideas.

8. Keep paragraphs short.

9. Leave a blank line between separate sections.

10. Do not put unnecessary spaces at the beginning of lines.

11. Do not indent normal paragraphs.

12. Do not repeat the same information.

13. Do not unnecessarily repeat the user's question.

14. If explaining a concept, prefer this structure when useful:

   ### Main Idea

   Short explanation.

   ### How It Works

   - Point
   - Point
   - Point

   ### Example

   Short example.

15. If the answer is a comparison, use a Markdown table when
    appropriate.

16. If code is necessary, use a proper Markdown code block.

17. Do not use excessive headings.

18. Do not use excessive bold formatting.

19. Do not use decorative characters or unnecessary symbols.

20. Do not output internal reasoning or chain-of-thought.

21. Keep the answer concise while still answering the question
    completely.

22. Never invent information that is not supported by the
    provided context.

23. If the answer cannot be found in the context, clearly say:

   "I don't know based on the provided documents."

============================================================
PREVIOUS CONVERSATION
============================================================

{chat_history}

============================================================
DOCUMENT CONTEXT
============================================================

{context}

============================================================
CURRENT QUESTION
============================================================

{question}

============================================================
FINAL ANSWER
============================================================

Return ONLY the final answer.

Do not include:
- analysis
- reasoning
- "Answer:"
- unnecessary introductions
- unnecessary conclusions
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

    formatted_documents = []

    for doc in docs:

        source = doc.metadata.get(
            "source_file",
            doc.metadata.get(
                "source",
                "Unknown source"
            )
        )

        page = doc.metadata.get(
            "page"
        )

        if page is not None:

            page_number = page + 1

            source_label = (
                f"[Source: {source}, Page: {page_number}]"
            )

        else:

            source_label = (
                f"[Source: {source}]"
            )

        content = doc.page_content.strip()

        formatted_documents.append(
            f"{source_label}\n{content}"
        )

    return "\n\n---\n\n".join(
        formatted_documents
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

    formatted_messages = []

    for message in messages:

        if message.type == "human":

            role = "User"

        elif message.type == "ai":

            role = "Assistant"

        else:

            role = message.type.capitalize()

        content = str(
            message.content
        ).strip()

        formatted_messages.append(
            f"{role}: {content}"
        )

    return "\n\n".join(
        formatted_messages
    )


# ============================================================
# CLEAN LLM ANSWER
# ============================================================

def clean_answer(
    answer: str
):

    if not answer:

        return (
            "I couldn't generate an answer."
        )


    # --------------------------------------------------------
    # Convert to string
    # --------------------------------------------------------

    answer = str(
        answer
    )


    # --------------------------------------------------------
    # Normalize line endings
    # --------------------------------------------------------

    answer = answer.replace(
        "\r\n",
        "\n"
    )

    answer = answer.replace(
        "\r",
        "\n"
    )


    # --------------------------------------------------------
    # Remove leading/trailing whitespace
    # --------------------------------------------------------

    answer = answer.strip()


    # --------------------------------------------------------
    # Remove excessive spaces at the beginning of lines
    #
    # This fixes responses like:
    #
    #     The attention mechanism...
    #
    # --------------------------------------------------------

    lines = answer.split("\n")

    cleaned_lines = []

    for line in lines:

        # Remove trailing spaces
        line = line.rstrip()

        # Preserve indentation inside code blocks
        # but clean normal Markdown/text lines.
        if not line.startswith("```"):

            line = line.lstrip()

        cleaned_lines.append(
            line
        )

    answer = "\n".join(
        cleaned_lines
    )


    # --------------------------------------------------------
    # Normalize excessive blank lines
    # --------------------------------------------------------

    answer = re.sub(
        r"\n{3,}",
        "\n\n",
        answer
    )


    # --------------------------------------------------------
    # Remove spaces before Markdown bullets
    # --------------------------------------------------------

    answer = re.sub(
        r"(?m)^[ \t]*[-*+][ \t]+",
        "- ",
        answer
    )


    # --------------------------------------------------------
    # Normalize numbered lists
    # --------------------------------------------------------

    answer = re.sub(
        r"(?m)^[ \t]*(\d+)\.[ \t]+",
        r"\1. ",
        answer
    )


    # --------------------------------------------------------
    # Normalize Markdown headings
    # --------------------------------------------------------

    answer = re.sub(
        r"(?m)^[ \t]*#{1,6}[ \t]*",
        lambda match: match.group(0).lstrip(),
        answer
    )


    # --------------------------------------------------------
    # Remove accidental "Answer:" prefix
    # --------------------------------------------------------

    answer = re.sub(
        r"^\s*(Answer|Final Answer)\s*:\s*",
        "",
        answer,
        flags=re.IGNORECASE
    )


    # --------------------------------------------------------
    # Final cleanup
    # --------------------------------------------------------

    answer = answer.strip()

    return answer


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
    # Clean question
    # --------------------------------------------------------

    question = str(
        question
    ).strip()

    if not question:

        raise ValueError(
            "Question cannot be empty."
        )


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


    # --------------------------------------------------------
    # Get answer
    # --------------------------------------------------------

    answer = response.content


    # --------------------------------------------------------
    # Clean and refine answer
    # --------------------------------------------------------

    answer = clean_answer(
        answer
    )


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