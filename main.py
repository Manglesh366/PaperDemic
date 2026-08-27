import os
import shutil
from pathlib import Path

from fastapi import (
    FastAPI,
    Request,
    Form,
    Depends,
    HTTPException,
    UploadFile,
    File
)

from fastapi.responses import (
    HTMLResponse,
    RedirectResponse
)

from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

from sqlalchemy.orm import Session

from itsdangerous import URLSafeSerializer

from database import (
    engine,
    Base,
    get_db
)

from models import (
    User,
    ChatHistory
)

from auth import (
    hash_password,
    verify_password
)

from rag_service import (
    ask_rag,
    add_document
)


# ============================================================
# DATABASE
# ============================================================

Base.metadata.create_all(bind=engine)


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="My RAG Assistant"
)


# ============================================================
# TEMPLATES
# ============================================================

templates = Jinja2Templates(
    directory="templates"
)


# ============================================================
# STATIC FILES
# ============================================================

app.mount(
    "/static",
    StaticFiles(directory="static"),
    name="static"
)


# ============================================================
# UPLOAD DIRECTORY
# ============================================================

UPLOAD_DIR = Path("uploads")

UPLOAD_DIR.mkdir(
    exist_ok=True
)


# ============================================================
# SESSION
# ============================================================

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET"
)

serializer = URLSafeSerializer(
    SECRET_KEY
)


def create_session(username: str) -> str:

    return serializer.dumps({
        "username": username
    })


def get_current_user(
    request: Request,
    db: Session
):

    session = request.cookies.get("session")

    if not session:
        return None

    try:

        data = serializer.loads(session)

    except Exception:

        return None

    username = data.get("username")

    if not username:
        return None

    return db.query(User).filter(
        User.username == username
    ).first()


# ============================================================
# LOGIN PAGE
# ============================================================

@app.get(
    "/",
    response_class=HTMLResponse
)
def login_page(
    request: Request
):

    return templates.TemplateResponse(
        request=request,
        name="login.html",
        context={}
    )


# ============================================================
# LOGIN / CREATE USER
# ============================================================

@app.post("/login")
def login(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):

    username = username.strip()

    if not username:

        return templates.TemplateResponse(
            request=request,
            name="login.html",
            context={
                "error": "Username cannot be empty"
            },
            status_code=400
        )

    if not password:

        return templates.TemplateResponse(
            request=request,
            name="login.html",
            context={
                "error": "Password cannot be empty"
            },
            status_code=400
        )

    # --------------------------------------------------------
    # Find user
    # --------------------------------------------------------

    user = db.query(User).filter(
        User.username == username
    ).first()

    # --------------------------------------------------------
    # Create user
    # --------------------------------------------------------

    if not user:

        user = User(
            username=username,
            password_hash=hash_password(password)
        )

        db.add(user)

        db.commit()

        db.refresh(user)

    # --------------------------------------------------------
    # Existing user
    # --------------------------------------------------------

    else:

        if not verify_password(
            password,
            user.password_hash
        ):

            return templates.TemplateResponse(
                request=request,
                name="login.html",
                context={
                    "error": "Incorrect username or password"
                },
                status_code=401
            )

    # --------------------------------------------------------
    # Create session
    # --------------------------------------------------------

    session = create_session(
        user.username
    )

    response = RedirectResponse(
        url="/home",
        status_code=303
    )

    response.set_cookie(
        key="session",
        value=session,
        httponly=True,
        samesite="lax",
        secure=False
    )

    return response


# ============================================================
# HOME
# ============================================================

@app.get(
    "/home",
    response_class=HTMLResponse
)
def home(
    request: Request,
    db: Session = Depends(get_db)
):

    user = get_current_user(
        request=request,
        db=db
    )

    if not user:

        return RedirectResponse(
            url="/",
            status_code=303
        )

    # --------------------------------------------------------
    # Only this user's chat history
    # --------------------------------------------------------

    history = db.query(
        ChatHistory
    ).filter(
        ChatHistory.user_id == user.id
    ).order_by(
        ChatHistory.created_at.desc()
    ).all()

    # --------------------------------------------------------
    # User upload directory
    # --------------------------------------------------------

    user_upload_dir = (
        UPLOAD_DIR / str(user.id)
    )

    user_upload_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    uploaded_files = []

    for file_path in user_upload_dir.iterdir():

        if file_path.is_file():

            uploaded_files.append(
                file_path.name
            )

    return templates.TemplateResponse(
        request=request,
        name="home.html",
        context={
            "username": user.username,
            "history": history,
            "uploaded_files": uploaded_files
        }
    )


# ============================================================
# FILE UPLOAD
# ============================================================

@app.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Authenticate user
    # --------------------------------------------------------

    user = get_current_user(
        request=request,
        db=db
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )

    # --------------------------------------------------------
    # Validate filename
    # --------------------------------------------------------

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="No file selected"
        )

    # --------------------------------------------------------
    # Allowed extensions
    # --------------------------------------------------------

    allowed_extensions = {
        ".pdf",
        ".txt",
        ".docx",
        ".csv"
    }

    extension = Path(
        file.filename
    ).suffix.lower()

    if extension not in allowed_extensions:

        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. "
                "Supported: PDF, TXT, DOCX, CSV"
            )
        )

    # --------------------------------------------------------
    # Create user-specific upload directory
    # --------------------------------------------------------

    user_upload_dir = (
        UPLOAD_DIR / str(user.id)
    )

    user_upload_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    # --------------------------------------------------------
    # Save file
    # --------------------------------------------------------

    safe_filename = Path(
        file.filename
    ).name

    file_path = (
        user_upload_dir / safe_filename
    )

    with file_path.open("wb") as buffer:

        shutil.copyfileobj(
            file.file,
            buffer
        )

    # --------------------------------------------------------
    # Add document to user's vector database
    # --------------------------------------------------------

    try:

        chunks_added = add_document(
            file_path=str(file_path),
            user_id=user.id
        )

    except Exception as e:

        # Remove uploaded file if processing failed

        if file_path.exists():

            file_path.unlink()

        print(
            "DOCUMENT PROCESSING ERROR:",
            e
        )

        raise HTTPException(
            status_code=500,
            detail=f"Could not process document: {str(e)}"
        )

    return {
        "success": True,
        "filename": safe_filename,
        "chunks_added": chunks_added,
        "message": "File uploaded and indexed successfully"
    }


# ============================================================
# CHAT
# ============================================================

@app.post("/chat")
def chat(
    request: Request,
    question: str = Form(...),
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Authenticate user
    # --------------------------------------------------------

    user = get_current_user(
        request=request,
        db=db
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )

    # --------------------------------------------------------
    # Clean question
    # --------------------------------------------------------

    question = question.strip()

    if not question:

        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty"
        )

    # --------------------------------------------------------
    # Run user-specific RAG
    # --------------------------------------------------------

    try:

        answer = ask_rag(
            question=question,
            session_id=str(user.id),
            user_id=user.id
        )

    except Exception as e:

        print(
            "RAG ERROR:",
            e
        )

        raise HTTPException(
            status_code=500,
            detail=f"RAG error: {str(e)}"
        )

    # --------------------------------------------------------
    # Save chat in website database
    # --------------------------------------------------------

    chat_history = ChatHistory(
        user_id=user.id,
        question=question,
        answer=answer
    )

    db.add(chat_history)

    db.commit()

    db.refresh(chat_history)

    # --------------------------------------------------------
    # Return answer
    # --------------------------------------------------------

    return {
        "success": True,
        "question": question,
        "answer": answer,
        "chat_id": chat_history.id
    }


# ============================================================
# LOGOUT
# ============================================================

@app.get("/logout")
def logout():

    response = RedirectResponse(
        url="/",
        status_code=303
    )

    response.delete_cookie(
        key="session"
    )

    return response