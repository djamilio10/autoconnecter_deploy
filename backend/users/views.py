import secrets
from datetime import timedelta

from django.conf import settings
from django.db.models import F
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django_ratelimit.decorators import ratelimit
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from autoconnect.security import is_origin_allowed
from .serializers import RegisterSerializer, LoginSerializer, TokenResponseSerializer, UserSerializer
from .models import User, PlatformSettings, Notification, EmailVerification, PasswordReset
from .email_utils import send_verification_email, send_password_reset_email


# ── Helpers cookie refresh-token ─────────────────────────────────────────────

def _set_refresh_cookie(response, refresh_token):
    """Pose le refresh JWT dans un cookie HttpOnly+Secure+SameSite : inaccessible
    au JavaScript, donc hors d'atteinte d'un vol par XSS."""
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=settings.REFRESH_COOKIE_MAX_AGE,
        path=settings.REFRESH_COOKIE_PATH,
        secure=settings.REFRESH_COOKIE_SECURE,
        httponly=True,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
    )


def _clear_refresh_cookie(response):
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        path=settings.REFRESH_COOKIE_PATH,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
    )


def _build_auth_response(user, status_code=status.HTTP_200_OK):
    """Construit la réponse d'authentification : access+user dans le body,
    refresh dans un cookie HttpOnly."""
    tokens = TokenResponseSerializer.get_tokens(user)
    refresh = tokens.pop('refresh')
    response = Response(tokens, status=status_code)
    _set_refresh_cookie(response, refresh)
    return response


# Réponses génériques (évite l'énumération des emails enregistrés).
GENERIC_INVALID_CODE = {'detail': 'Email ou code invalide.'}
GENERIC_RESEND_OK = {'detail': 'Si un compte est en attente de vérification pour cet email, un nouveau code a été envoyé.'}
GENERIC_RESET_REQUEST_OK = {'detail': 'Si un compte existe pour cet email, un code de réinitialisation a été envoyé.'}


def _email_key(group, request):
    """Clé de rate-limit par adresse email (post-data)."""
    return (request.data.get('email') or '').lower().strip()


@api_view(['GET'])
@permission_classes([AllowAny])
def public_settings(request):
    cfg = PlatformSettings.get()
    return Response({'premium_enabled': cfg.premium_enabled})


def _generate_and_send_code(user):
    EmailVerification.objects.filter(user=user, is_used=False).delete()
    code = f"{secrets.randbelow(1_000_000):06d}"
    EmailVerification.objects.create(
        user=user,
        code=code,
        expires_at=timezone.now() + timedelta(minutes=10),
    )
    send_verification_email(user, code)


@api_view(['POST'])
@permission_classes([AllowAny])
@ratelimit(key='ip', rate='5/m', method='POST', block=True)
@ratelimit(key=_email_key, rate='3/h', method='POST', block=True)
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = serializer.save()
    user.is_active = False
    user.save(update_fields=['is_active'])

    try:
        _generate_and_send_code(user)
    except Exception:
        user.delete()
        return Response(
            {'detail': "Impossible d'envoyer l'email de vérification. Vérifiez votre adresse et réessayez."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(
        {'detail': 'Un code de vérification a été envoyé à votre adresse email.', 'email': user.email},
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@permission_classes([AllowAny])
@ratelimit(key='ip', rate='10/m', method='POST', block=True)
@ratelimit(key=_email_key, rate='10/h', method='POST', block=True)
def verify_email(request):
    """Vérifie le code email. Réponses génériques pour éviter l'énumération."""
    email = (request.data.get('email') or '').lower().strip()
    code = (request.data.get('code') or '').strip()

    if not email or not code or len(code) != 6 or not code.isdigit():
        return Response(GENERIC_INVALID_CODE, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(email__iexact=email).first()
    verification = None
    if user:
        verification = (
            EmailVerification.objects
            .filter(user=user, is_used=False)
            .order_by('-created_at')
            .first()
        )

    if not user or not verification or not verification.is_valid():
        # Incrémente quand même le compteur si la vérif existe (anti-brute-force).
        if verification:
            EmailVerification.objects.filter(pk=verification.pk).update(attempts=F('attempts') + 1)
        return Response(GENERIC_INVALID_CODE, status=status.HTTP_400_BAD_REQUEST)

    # Comparaison à temps constant — évite les timing attacks.
    if not secrets.compare_digest(verification.code, code):
        EmailVerification.objects.filter(pk=verification.pk).update(attempts=F('attempts') + 1)
        return Response(GENERIC_INVALID_CODE, status=status.HTTP_400_BAD_REQUEST)

    verification.is_used = True
    verification.save(update_fields=['is_used'])
    user.is_active = True
    user.save(update_fields=['is_active'])

    return _build_auth_response(user)


@api_view(['POST'])
@permission_classes([AllowAny])
@ratelimit(key='ip', rate='3/m', method='POST', block=True)
@ratelimit(key=_email_key, rate='3/h', method='POST', block=True)
def resend_verification(request):
    """Renvoie un nouveau code. Réponse générique pour éviter l'énumération."""
    email = (request.data.get('email') or '').lower().strip()
    if not email:
        return Response({'detail': 'Email requis.'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(email__iexact=email, is_active=False).first()
    if user:
        try:
            _generate_and_send_code(user)
        except Exception:
            # On masque l'erreur SMTP pour ne pas révéler l'existence du compte.
            pass

    return Response(GENERIC_RESEND_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
@ratelimit(key='ip', rate='5/m', method='POST', block=True)
@ratelimit(key=_email_key, rate='10/h', method='POST', block=True)
def login(request):
    """Login — réponses génériques pour comptes inexistants/désactivés.
    Le message spécifique 'email_not_verified' est conservé uniquement après
    validation correcte des credentials (cf. plus bas), pour ne pas révéler
    l'existence du compte sans authentification."""
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user = serializer.validated_data['user']

    if user.is_banned:
        return Response({
            'account_status': 'banned',
            'reason': user.ban_reason or '',
            'ban_until': user.ban_until.isoformat() if user.ban_until else None,
        }, status=status.HTTP_403_FORBIDDEN)

    if not user.is_active:
        pending = EmailVerification.objects.filter(user=user, is_used=False).exists()
        if pending:
            return Response(
                {'account_status': 'email_not_verified', 'email': user.email},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response({
            'account_status': 'suspended',
            'reason': user.ban_reason or '',
            'ban_until': user.ban_until.isoformat() if user.ban_until else None,
        }, status=status.HTTP_403_FORBIDDEN)

    # ── 2FA (TOTP) ────────────────────────────────────────────────────────────
    # Identifiants validés : si la 2FA est active, on exige le code de
    # l'application d'authentification avant de délivrer les jetons.
    if user.totp_enabled and user.totp_secret:
        otp = (serializer.validated_data.get('otp') or '').strip()
        if not otp:
            # 1ʳᵉ étape : mot de passe correct, on réclame le code (sans jetons).
            return Response({'two_factor_required': True}, status=status.HTTP_200_OK)
        import pyotp
        # valid_window=1 tolère le décalage d'horloge d'une période (±30 s).
        if not pyotp.TOTP(user.totp_secret).verify(otp, valid_window=1):
            return Response({'detail': 'Code de vérification 2FA invalide.'},
                            status=status.HTTP_401_UNAUTHORIZED)

    return _build_auth_response(user)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """Déconnexion : blackliste le refresh-token (cookie HttpOnly) et supprime
    le cookie. Origin check anti-CSRF : refuse les POST forgés depuis un site
    hors liste blanche (utile car SameSite=None expose le cookie cross-site)."""
    if not is_origin_allowed(request):
        return Response({'detail': 'Origine non autorisée.'}, status=status.HTTP_403_FORBIDDEN)
    refresh = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
    if refresh:
        try:
            RefreshToken(refresh).blacklist()
        except (TokenError, AttributeError):
            pass
    response = Response({'detail': 'Déconnexion réussie.'}, status=status.HTTP_200_OK)
    _clear_refresh_cookie(response)
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile(request):
    return Response(UserSerializer(request.user).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_profile(request):
    serializer = UserSerializer(request.user, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


ALLOWED_IMAGE_FORMATS = {'JPEG', 'PNG', 'WEBP', 'GIF'}
MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 Mo
_FORMAT_EXT = {'JPEG': '.jpg', 'PNG': '.png', 'WEBP': '.webp', 'GIF': '.gif'}


def _validate_image(file):
    """Valide une image par magic-bytes via Pillow et renomme le fichier en
    UUID + extension issue du format détecté (évite les noms à doubles
    extensions type 'evil.jpg.html' que nginx pourrait servir en HTML).
    Retourne (None, err) en cas d'erreur."""
    if file.size > MAX_UPLOAD_SIZE:
        return 'Le fichier ne doit pas dépasser 5 Mo.'
    try:
        from PIL import Image
        file.seek(0)
        img = Image.open(file)
        img.verify()  # lit l'en-tête, lève une exception si corrompu/forgé
        fmt = (img.format or '').upper()
    except Exception:
        return 'Image invalide ou corrompue.'
    finally:
        file.seek(0)
    if fmt not in ALLOWED_IMAGE_FORMATS:
        return 'Format non supporté. Utilisez JPG, PNG, WebP ou GIF.'
    # Nom serveur sûr : UUID + extension cohérente avec le format réel.
    import uuid
    file.name = f'{uuid.uuid4().hex}{_FORMAT_EXT[fmt]}'
    return None


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_avatar(request):
    file = request.FILES.get('avatar')
    if not file:
        return Response({'error': 'Aucun fichier fourni.'}, status=status.HTTP_400_BAD_REQUEST)
    err = _validate_image(file)
    if err:
        return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)
    user = request.user
    if user.avatar_image:
        user.avatar_image.delete(save=False)
    user.avatar_image = file
    user.save()
    return Response(UserSerializer(user, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notifications_list(request):
    notifs = Notification.objects.filter(user=request.user)[:50]
    data = [{
        'id': n.id,
        'type': n.type,
        'message': n.message,
        'data': n.data,
        'is_read': n.is_read,
        'created_at': n.created_at.isoformat(),
    } for n in notifs]
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def notifications_mark_read(request):
    raw_ids = request.data.get('ids', [])
    if not isinstance(raw_ids, list):
        return Response({'error': 'ids doit être une liste.'}, status=status.HTTP_400_BAD_REQUEST)
    safe_ids = []
    for i in raw_ids:
        try:
            safe_ids.append(int(i))
        except (TypeError, ValueError):
            continue
    if safe_ids:
        Notification.objects.filter(user=request.user, id__in=safe_ids).update(is_read=True)
    else:
        Notification.objects.filter(user=request.user).update(is_read=True)
    return Response({'ok': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    user = request.user
    old_password = request.data.get('old_password', '')
    new_password = request.data.get('new_password', '')

    if not user.check_password(old_password):
        return Response({'error': 'Mot de passe actuel incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

    # Applique les validateurs Django (longueur, mot de passe courant, similarité, non-numérique).
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError as DjangoValidationError
    try:
        validate_password(new_password, user=user)
    except DjangoValidationError as e:
        return Response({'error': ' '.join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save()
    return Response({'detail': 'Mot de passe modifié avec succès.'})


# ── 2FA TOTP (application d'authentification) ─────────────────────────────────

def _totp_qr_data_uri(otpauth_url):
    """Génère le QR code de l'URL otpauth:// en PNG encodé base64 (data URI),
    affichable directement dans une balise <img> côté frontend."""
    import base64
    import io
    import qrcode
    img = qrcode.make(otpauth_url)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def two_factor_setup(request):
    """Démarre l'enrôlement 2FA : génère un secret (non encore activé), renvoie le
    QR code à scanner avec l'application d'authentification + le secret en clair
    (saisie manuelle de secours). La 2FA n'est PAS encore active à ce stade."""
    user = request.user
    if user.totp_enabled:
        return Response({'detail': 'La 2FA est déjà activée.'}, status=status.HTTP_400_BAD_REQUEST)

    import pyotp
    secret = pyotp.random_base32()
    user.totp_secret = secret
    user.save(update_fields=['totp_secret'])

    otpauth_url = pyotp.TOTP(secret).provisioning_uri(
        name=user.email, issuer_name='AUTOCONNECT',
    )
    return Response({
        'secret': secret,
        'otpauth_url': otpauth_url,
        'qr': _totp_qr_data_uri(otpauth_url),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@ratelimit(key='user', rate='10/m', method='POST', block=True)
def two_factor_enable(request):
    """Confirme l'enrôlement : vérifie un premier code TOTP, puis active la 2FA."""
    user = request.user
    if user.totp_enabled:
        return Response({'detail': 'La 2FA est déjà activée.'}, status=status.HTTP_400_BAD_REQUEST)
    if not user.totp_secret:
        return Response({'detail': "Aucun enrôlement en cours. Relancez l'activation."},
                        status=status.HTTP_400_BAD_REQUEST)

    code = (request.data.get('code') or '').strip()
    import pyotp
    if not code or not pyotp.TOTP(user.totp_secret).verify(code, valid_window=1):
        return Response({'detail': 'Code invalide. Vérifiez votre application d\'authentification.'},
                        status=status.HTTP_400_BAD_REQUEST)

    user.totp_enabled = True
    user.save(update_fields=['totp_enabled'])
    return Response({'detail': '2FA activée.', 'two_factor_enabled': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@ratelimit(key='user', rate='10/m', method='POST', block=True)
def two_factor_disable(request):
    """Désactive la 2FA après vérification d'un code TOTP valide (empêche un tiers
    ayant accès à une session ouverte de la désactiver sans l'appareil)."""
    user = request.user
    if not user.totp_enabled:
        return Response({'detail': 'La 2FA n\'est pas activée.'}, status=status.HTTP_400_BAD_REQUEST)

    code = (request.data.get('code') or '').strip()
    import pyotp
    if not code or not pyotp.TOTP(user.totp_secret).verify(code, valid_window=1):
        return Response({'detail': 'Code invalide.'}, status=status.HTTP_400_BAD_REQUEST)

    user.totp_enabled = False
    user.totp_secret = ''
    user.save(update_fields=['totp_enabled', 'totp_secret'])
    return Response({'detail': '2FA désactivée.', 'two_factor_enabled': False})


# ── Mot de passe oublié (réinitialisation par code email) ─────────────────────

def _generate_and_send_reset_code(user):
    PasswordReset.objects.filter(user=user, is_used=False).delete()
    code = f"{secrets.randbelow(1_000_000):06d}"
    PasswordReset.objects.create(
        user=user,
        code=code,
        expires_at=timezone.now() + timedelta(minutes=10),
    )
    send_password_reset_email(user, code)


@api_view(['POST'])
@permission_classes([AllowAny])
@ratelimit(key='ip', rate='5/m', method='POST', block=True)
@ratelimit(key=_email_key, rate='3/h', method='POST', block=True)
def password_reset_request(request):
    """Étape 1 : l'utilisateur demande un code de réinitialisation par email.
    Réponse générique (anti-énumération) quel que soit l'état du compte."""
    email = (request.data.get('email') or '').lower().strip()
    if not email:
        return Response({'detail': 'Email requis.'}, status=status.HTTP_400_BAD_REQUEST)

    # On n'envoie un code qu'aux comptes actifs (un compte non vérifié passe par
    # le flux de vérification email, pas par la réinitialisation).
    user = User.objects.filter(email__iexact=email, is_active=True, is_banned=False).first()
    if user:
        try:
            _generate_and_send_reset_code(user)
        except Exception:
            # On masque l'erreur SMTP pour ne pas révéler l'existence du compte.
            pass

    return Response(GENERIC_RESET_REQUEST_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
@ratelimit(key='ip', rate='10/m', method='POST', block=True)
@ratelimit(key=_email_key, rate='10/h', method='POST', block=True)
def password_reset_confirm(request):
    """Étape 2 : l'utilisateur soumet email + code + nouveau mot de passe.
    Réponses génériques, cap de tentatives, validateurs de mot de passe,
    invalidation de toutes les sessions existantes après changement."""
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError as DjangoValidationError

    email = (request.data.get('email') or '').lower().strip()
    code = (request.data.get('code') or '').strip()
    new_password = request.data.get('new_password') or ''

    if not email or not code or len(code) != 6 or not code.isdigit():
        return Response(GENERIC_INVALID_CODE, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(email__iexact=email, is_active=True, is_banned=False).first()
    reset = None
    if user:
        reset = (
            PasswordReset.objects
            .filter(user=user, is_used=False)
            .order_by('-created_at')
            .first()
        )

    if not user or not reset or not reset.is_valid():
        if reset:
            PasswordReset.objects.filter(pk=reset.pk).update(attempts=F('attempts') + 1)
        return Response(GENERIC_INVALID_CODE, status=status.HTTP_400_BAD_REQUEST)

    # Comparaison à temps constant (anti timing-attack).
    if not secrets.compare_digest(reset.code, code):
        PasswordReset.objects.filter(pk=reset.pk).update(attempts=F('attempts') + 1)
        return Response(GENERIC_INVALID_CODE, status=status.HTTP_400_BAD_REQUEST)

    # Code valide : on valide la robustesse du nouveau mot de passe.
    try:
        validate_password(new_password, user=user)
    except DjangoValidationError as e:
        return Response({'detail': ' '.join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

    reset.is_used = True
    reset.save(update_fields=['is_used'])
    user.set_password(new_password)
    user.save(update_fields=['password'])

    # Invalide toutes les sessions existantes : un attaquant ayant un ancien
    # refresh-token ne doit pas survivre à une réinitialisation de mot de passe.
    try:
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
        for token in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=token)
    except Exception:
        pass

    return Response({'detail': 'Mot de passe réinitialisé avec succès. Vous pouvez vous connecter.'})
