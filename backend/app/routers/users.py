import os
import smtplib
from email.message import EmailMessage
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user, require_roles
from ..core.security import hash_password


router = APIRouter(
    prefix="/api/users",
    tags=["Users"],
)


# ============================================================
# SMTP CONFIGURATION
# ============================================================

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))

SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")


# ============================================================
# TEAM INVITATION EMAIL
# ============================================================

def send_team_invite_email(
    target_email: str,
    full_name: str,
    password: str,
    role_name: str,
):
    """
    Sends a welcome/invitation email to a newly invited
    MarketMind AI team member.
    """

    if not SENDER_EMAIL or not SENDER_PASSWORD:
        raise RuntimeError(
            "SENDER_EMAIL or SENDER_PASSWORD environment variable is missing."
        )

    message = EmailMessage()

    message["Subject"] = "Welcome to MarketMind AI - Team Invitation"
    message["From"] = f"MarketMind AI <{SENDER_EMAIL}>"
    message["To"] = target_email

    message.set_content(
        f"""
Hello {full_name},

Welcome to MarketMind AI!

You have been invited to join your business team on the
MarketMind AI platform.

Your account has been created successfully.

Login Details
-------------
Email: {target_email}
Temporary Password: {password}
Role: {role_name}

Please use the above credentials to log in to MarketMind AI.

IMPORTANT:
This is a temporary password. For security purposes, please
change your password immediately after your first login.

Please keep your login credentials confidential and do not
share your password with anyone.

Regards,
MarketMind AI Team
"""
    )

    try:
        with smtplib.SMTP(
            SMTP_SERVER,
            SMTP_PORT,
        ) as server:

            server.starttls()

            server.login(
                SENDER_EMAIL,
                SENDER_PASSWORD,
            )

            server.send_message(message)

    except Exception as exc:
        raise RuntimeError(
            f"Team invitation email could not be sent: {exc}"
        )


# ============================================================
# REQUEST MODEL
# ============================================================

class InviteRequest(BaseModel):
    full_name: str
    email: str
    password: str
    role_name: str


# ============================================================
# LIST TEAM MEMBERS
# ============================================================

@router.get(
    "/",
    response_model=List[schemas.UserOut],
)
def list_team(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return (
        db.query(models.User)
        .options(
            joinedload(models.User.role),
            joinedload(models.User.business),
        )
        .filter(
            models.User.business_id == current_user.business_id
        )
        .all()
    )


# ============================================================
# INVITE / CREATE TEAM MEMBER
# ============================================================

@router.post(
    "/",
    response_model=schemas.UserOut,
    status_code=status.HTTP_201_CREATED,
)
def invite_user(
    payload: InviteRequest,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "business_owner",
            "admin",
        )
    ),
):
    # --------------------------------------------------------
    # Check whether email already exists
    # --------------------------------------------------------

    existing = (
        db.query(models.User)
        .filter(
            models.User.email == payload.email
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    # --------------------------------------------------------
    # Find requested role
    # --------------------------------------------------------

    role = (
        db.query(models.Role)
        .filter(
            models.Role.role_name == payload.role_name
        )
        .first()
    )

    if not role:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role: {payload.role_name}",
        )

    # --------------------------------------------------------
    # Create user
    # --------------------------------------------------------

    user = models.User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(
            payload.password
        ),
        role_id=role.id,
        business_id=current_user.business_id,
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)

    except Exception as exc:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Could not create team member: {exc}",
        )

    # --------------------------------------------------------
    # Send invitation email
    # --------------------------------------------------------

    try:
        send_team_invite_email(
            target_email=payload.email,
            full_name=payload.full_name,
            password=payload.password,
            role_name=payload.role_name,
        )

    except Exception as exc:
        # The account has already been created successfully,
        # but the invitation email could not be delivered.
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )

    # --------------------------------------------------------
    # Return created user
    # --------------------------------------------------------

    created_user = (
        db.query(models.User)
        .options(
            joinedload(models.User.role),
            joinedload(models.User.business),
        )
        .filter(
            models.User.id == user.id
        )
        .first()
    )

    return created_user


# ============================================================
# DELETE TEAM MEMBER
# ============================================================

@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_roles(
            "business_owner",
            "admin",
        )
    ),
):
    # --------------------------------------------------------
    # Prevent deleting yourself
    # --------------------------------------------------------

    if user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Cannot remove yourself",
        )

    # --------------------------------------------------------
    # Find user within current business
    # --------------------------------------------------------

    user = (
        db.query(models.User)
        .filter(
            models.User.id == user_id,
            models.User.business_id
            == current_user.business_id,
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    # --------------------------------------------------------
    # Delete user
    # --------------------------------------------------------

    db.delete(user)
    db.commit()

    return None