import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.core.config import settings
from app.core.security import create_access_token, verify_password, get_password_hash
from app.models.tenant import Tenant
from app.models.role import Role
from app.models.user import User

router = APIRouter()


class GoogleLoginRequest(BaseModel):
    id_token: str


class PinLoginRequest(BaseModel):
    device_id: str
    pin: str


@router.post("/google")
def google_login(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    """
    Autentica a un usuario mediante Google ID Token.
    Si el usuario/tenant no existe, lo crea automáticamente.
    """
    id_token = payload.id_token
    email = None
    name = None
    
    # Soporte para login de desarrollo/pruebas locales
    if settings.ENVIRONMENT == "development" or id_token == "test-token":
        email = "test@comercio.com"
        name = "Usuario Admin de Pruebas"
    else:
        try:
            from google.oauth2 import id_token as google_id_token
            from google.auth.transport import requests
            
            idinfo = google_id_token.verify_oauth2_token(
                id_token, requests.Request(), settings.GOOGLE_CLIENT_ID
            )
            email = idinfo.get("email")
            name = idinfo.get("name", "Usuario Google")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token de Google inválido: {str(e)}"
            )
            
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se pudo obtener el correo del token de Google"
        )
        
    # Intentar buscar el usuario por email
    user = db.query(User).filter(User.email == email).first()
    tenant = None
    
    if not user:
        # Crear tenant por defecto
        tenant = Tenant(
            name="Mi Comercio POS",
            email=email,
            phone="123456789",
            currency="ARS",
            timezone="America/Argentina/Buenos_Aires"
        )
        db.add(tenant)
        db.flush()  # Genera el ID de tenant para usar de clave foránea
        
        # Crear rol de administrador para este tenant
        role = Role(
            tenant_id=tenant.id,
            name="admin"
        )
        db.add(role)
        db.flush()
        
        # Crear el usuario administrador
        user = User(
            tenant_id=tenant.id,
            role_id=role.id,
            name=name,
            email=email,
            google_id="google_mock_id" if id_token == "test-token" else id_token[:100],
            is_active=True,
            pin="1234"  # PIN por defecto
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
        
    # Obtener el rol del usuario
    role_name = "admin"
    if user.role_id:
        role_obj = db.query(Role).filter(Role.id == user.role_id).first()
        if role_obj:
            role_name = role_obj.name
            
    # Generar access token y refresh token
    access_token = create_access_token(
        subject=user.id, tenant_id=user.tenant_id, role=role_name
    )
    refresh_token = create_access_token(
        subject=user.id, tenant_id=user.tenant_id, role=role_name
    )
    
    # Registrar última fecha de acceso
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "role": role_name
        },
        "tenant": {
            "id": str(tenant.id),
            "name": tenant.name,
            "currency": tenant.currency
        }
    }


@router.post("/pin-login")
def pin_login(payload: PinLoginRequest, db: Session = Depends(get_db)):
    """
    Inicio de sesión rápido para cajeros utilizando un PIN de 4 dígitos.
    """
    user = db.query(User).filter(User.pin == payload.pin, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="PIN incorrecto o usuario inactivo"
        )
        
    role_name = "cashier"
    if user.role_id:
        role_obj = db.query(Role).filter(Role.id == user.role_id).first()
        if role_obj:
            role_name = role_obj.name
            
    access_token = create_access_token(
        subject=user.id, tenant_id=user.tenant_id, role=role_name
    )
    refresh_token = create_access_token(
        subject=user.id, tenant_id=user.tenant_id, role=role_name
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token
    }
