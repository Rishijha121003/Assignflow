from typing import List, Optional
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User


def extract_token_from_request(request: Request) -> Optional[str]:
    """
    Extracts JWT access token from:
    1. Authorization header ('Bearer <token>')
    2. HttpOnly cookie (named settings.COOKIE_NAME, e.g. 'access_token')
    """
    # 1. Check Authorization Bearer header first (for explicit token passed by API client)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:].strip()

    # 2. Check HttpOnly cookie (primary browser mechanism against XSS)
    cookie_token = request.cookies.get(settings.COOKIE_NAME)
    if cookie_token:
        # Strip any accidental 'Bearer ' prefix in cookie value
        if cookie_token.startswith("Bearer "):
            return cookie_token[7:].strip()
        return cookie_token.strip()

    return None


async def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency that authenticates the user via JWT cookie or Authorization header.
    Returns the active User instance or raises HTTP 401 Unauthorized.
    """
    token = extract_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token subject.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_role(allowed_roles: List[str]):
    """
    Dependency factory that enforces role-based access control (RBAC).
    Raises HTTP 403 Forbidden if current_user.role is not in allowed_roles.
    """
    def role_dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: {current_user.role.capitalize()} role is not authorized for this operation.",
            )
        return current_user

    return role_dependency


# Common role dependencies
require_teacher = require_role(["teacher"])
require_student = require_role(["student"])
require_authenticated = get_current_user
