from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token
from app.core.auth import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserRegister, UserLogin, UserResponse, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def set_auth_cookie(response: Response, token: str) -> None:
    """
    Sets a secure, HttpOnly session cookie containing the JWT token.
    Protects against XSS token exfiltration while permitting browser authentication.
    """
    max_age_seconds = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    # In local development without SSL, secure=False allows localhost cookies over HTTP
    is_secure = not settings.DEBUG and settings.ENVIRONMENT != "development"
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        httponly=True,
        secure=is_secure,
        samesite="lax",
        max_age=max_age_seconds,
        path="/",
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new teacher or student account",
)
def register(
    payload: UserRegister,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Creates a new user account with hashed password and returns an auth session.
    """
    email_clean = payload.email.strip().lower()

    # Check for existing email in assignflow schema
    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    # Secure modern password hash via bcrypt
    hashed = hash_password(payload.password)

    new_user = User(
        email=email_clean,
        full_name=payload.full_name.strip(),
        hashed_password=hashed,
        role=payload.role,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Generate JWT
    token_data = {
        "sub": str(new_user.id),
        "email": new_user.email,
        "role": new_user.role,
    }
    token = create_access_token(token_data)

    # Set secure HttpOnly cookie
    set_auth_cookie(response, token)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(new_user),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate user and obtain session token",
)
def login(
    payload: UserLogin,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Authenticates user credentials and establishes an authenticated session.
    """
    email_clean = payload.email.strip().lower()

    user = db.query(User).filter(User.email == email_clean).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is disabled. Please contact administrator.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Generate JWT
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
    }
    token = create_access_token(token_data)

    # Set secure HttpOnly cookie
    set_auth_cookie(response, token)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/logout",
    summary="Terminate current user session",
)
def logout(response: Response):
    """
    Clears the authentication cookie and ends the session.
    """
    is_secure = not settings.DEBUG and settings.ENVIRONMENT != "development"
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        path="/",
        httponly=True,
        secure=is_secure,
        samesite="lax",
    )
    return {"message": "Logged out successfully."}


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Retrieve currently authenticated user profile",
)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the profile and role of the currently logged-in user.
    """
    return current_user
