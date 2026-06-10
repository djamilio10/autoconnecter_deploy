import random
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from .serializers import RegisterSerializer, LoginSerializer, TokenResponseSerializer, UserSerializer
from .models import User, PlatformSettings, Notification, EmailVerification
from .email_utils import send_verification_email


@api_view(['GET'])
@permission_classes([AllowAny])
def public_settings(request):
    cfg = PlatformSettings.get()
    return Response({'premium_enabled': cfg.premium_enabled})


def _generate_and_send_code(user):
    EmailVerification.objects.filter(user=user, is_used=False).delete()
    code = f"{random.randint(0, 999999):06d}"
    EmailVerification.objects.create(
        user=user,
        code=code,
        expires_at=timezone.now() + timedelta(minutes=10),
    )
    send_verification_email(user, code)


@api_view(['POST'])
@permission_classes([AllowAny])
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
def verify_email(request):
    email = (request.data.get('email') or '').lower().strip()
    code = (request.data.get('code') or '').strip()

    if not email or not code:
        return Response({'detail': 'Email et code requis.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        return Response({'detail': 'Aucun compte associé à cet email.'}, status=status.HTTP_404_NOT_FOUND)

    verification = (
        EmailVerification.objects
        .filter(user=user, is_used=False)
        .order_by('-created_at')
        .first()
    )

    if not verification or not verification.is_valid():
        return Response(
            {'detail': 'Code expiré. Demandez un nouveau code.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if verification.code != code:
        return Response({'detail': 'Code incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

    verification.is_used = True
    verification.save(update_fields=['is_used'])
    user.is_active = True
    user.save(update_fields=['is_active'])

    return Response(TokenResponseSerializer.get_tokens(user), status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def resend_verification(request):
    email = (request.data.get('email') or '').lower().strip()
    if not email:
        return Response({'detail': 'Email requis.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(email__iexact=email, is_active=False)
    except User.DoesNotExist:
        return Response(
            {'detail': "Aucun compte en attente de vérification pour cet email."},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        _generate_and_send_code(user)
    except Exception:
        return Response(
            {'detail': "Impossible d'envoyer l'email. Réessayez dans quelques instants."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response({'detail': 'Un nouveau code a été envoyé à votre adresse email.'})


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    email = (request.data.get('email') or '').lower().strip()
    try:
        u = User.objects.get(email__iexact=email)
        if u.is_banned:
            return Response({
                'account_status': 'banned',
                'reason': u.ban_reason or '',
                'ban_until': u.ban_until.isoformat() if u.ban_until else None,
            }, status=status.HTTP_403_FORBIDDEN)
        if not u.is_active:
            pending = EmailVerification.objects.filter(user=u, is_used=False).exists()
            if pending:
                return Response(
                    {'account_status': 'email_not_verified', 'email': u.email},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return Response({
                'account_status': 'suspended',
                'reason': u.ban_reason or '',
                'ban_until': u.ban_until.isoformat() if u.ban_until else None,
            }, status=status.HTTP_403_FORBIDDEN)
    except User.DoesNotExist:
        pass

    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']
        return Response(TokenResponseSerializer.get_tokens(user))
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """Deconnexion : on essaie de blacklister le refresh token si possible.
    Ne bloque jamais : meme sans blacklist, le client supprime ses tokens."""
    refresh = request.data.get('refresh')
    if refresh:
        try:
            RefreshToken(refresh).blacklist()
        except (TokenError, AttributeError):
            # Blacklist app non installee ou token invalide : on ignore
            pass
    return Response({'detail': 'Deconnexion reussie.'}, status=status.HTTP_200_OK)


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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_avatar(request):
    file = request.FILES.get('avatar')
    if not file:
        return Response({'error': 'Aucun fichier fourni.'}, status=status.HTTP_400_BAD_REQUEST)
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
    ids = request.data.get('ids', [])
    if ids:
        Notification.objects.filter(user=request.user, id__in=ids).update(is_read=True)
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
    if len(new_password) < 6:
        return Response({'error': 'Le nouveau mot de passe doit contenir au moins 6 caractères.'}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save()
    return Response({'detail': 'Mot de passe modifié avec succès.'})
