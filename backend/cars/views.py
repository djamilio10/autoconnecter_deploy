import hashlib
import hmac
import json
import logging
import uuid

import requests
from django_ratelimit.decorators import ratelimit
from rest_framework import status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from .models import (Car, CarImage, Seller, Appointment, Favorite, Report, Review,
                     Conversation, Message, RentalRequest, PremiumPayment)
from .serializers import (CarSerializer, CarImageSerializer, SellerSerializer, AppointmentSerializer,
                          FavoriteSerializer, ReviewSerializer, ConversationSerializer, MessageSerializer,
                          RentalRequestSerializer)
from users.models import PlatformSettings, Notification, AuditLog

logger = logging.getLogger(__name__)


# ── Cars ──────────────────────────────────────────────────────────────────────

def _favorited_ids(request):
    """Ensemble des car_id favoris de l'utilisateur (1 requête) pour éviter le N+1
    dans CarSerializer.get_is_favorited."""
    if request.user.is_authenticated:
        return set(Favorite.objects.filter(user=request.user).values_list('car_id', flat=True))
    return set()


@api_view(['GET'])
@permission_classes([AllowAny])
def car_list(request):
    cars = Car.objects.filter(is_available=True).select_related('seller').prefetch_related('car_images')

    q = request.query_params.get('q', '')
    if q:
        cars = cars.filter(Q(make__icontains=q) | Q(model__icontains=q) | Q(location__icontains=q))

    fuel = request.query_params.get('fuel')
    if fuel:
        cars = cars.filter(fuel=fuel)

    transmission = request.query_params.get('transmission')
    if transmission:
        cars = cars.filter(transmission=transmission)

    min_price = request.query_params.get('min_price')
    if min_price:
        cars = cars.filter(price__gte=min_price)

    max_price = request.query_params.get('max_price')
    if max_price:
        cars = cars.filter(price__lte=max_price)

    max_mileage = request.query_params.get('max_mileage')
    if max_mileage:
        cars = cars.filter(mileage__lte=max_mileage)

    seller_name = request.query_params.get('seller', '')
    if seller_name:
        cars = cars.filter(seller__name__icontains=seller_name)

    premium_on = PlatformSettings.get().premium_enabled
    sort = request.query_params.get('sort', 'recent')
    if sort == 'price-asc':
        cars = cars.order_by('-seller__is_premium' if premium_on else 'price', 'price')
    elif sort == 'price-desc':
        cars = cars.order_by('-seller__is_premium' if premium_on else '-price', '-price')
    elif sort == 'mileage':
        cars = cars.order_by('-seller__is_premium' if premium_on else 'mileage', 'mileage')
    else:
        cars = cars.order_by('-seller__is_premium' if premium_on else '-created_at', '-created_at')

    ctx = {'request': request, 'favorited_ids': _favorited_ids(request)}
    serializer = CarSerializer(cars, many=True, context=ctx)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def car_detail(request, pk):
    try:
        car = Car.objects.select_related('seller').prefetch_related('car_images').get(pk=pk)
    except Car.DoesNotExist:
        return Response({'error': 'Voiture introuvable'}, status=status.HTTP_404_NOT_FOUND)
    ctx = {'request': request, 'favorited_ids': _favorited_ids(request)}
    return Response(CarSerializer(car, context=ctx).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def car_create(request):
    """Creation d'annonce. Le seller est force a celui de l'utilisateur connecte
    (un vendeur ne peut pas creer une annonce au nom d'un autre)."""
    user = request.user

    # Seuls les vendeurs (et admins) peuvent poster une annonce
    if user.user_type not in ('seller', 'admin') and not user.is_staff:
        return Response(
            {'detail': "Seuls les vendeurs peuvent publier une annonce."},
            status=status.HTTP_403_FORBIDDEN,
        )

    # On retrouve / cree le profil vendeur lie au user
    seller, _ = Seller.objects.get_or_create(
        user=user,
        defaults={
            'name': user.company or user.get_full_name() or user.email,
            'seller_type': 'pro' if user.company else 'particulier',
            'avatar': (user.avatar_initials or 'V')[:5],
            'location': user.location or 'Dakar',
            'phone': user.phone or '',
        },
    )

    # Limite gratuite : 3 annonces actives max
    if not seller.can_post:
        return Response(
            {'detail': f"Limite atteinte. Les comptes gratuits peuvent publier au maximum {seller.FREE_CAR_LIMIT} annonces actives. Passez en Premium pour publier sans limite."},
            status=status.HTTP_403_FORBIDDEN,
        )

    # On force le seller en ignorant tout seller_id passe dans la requete
    data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
    data['seller_id'] = seller.pk

    serializer = CarSerializer(data=data, context={'request': request})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def car_update(request, pk):
    try:
        car = Car.objects.get(pk=pk, seller__user=request.user)
    except Car.DoesNotExist:
        return Response({'error': 'Non autorisé'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'DELETE':
        car.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # Anti-mass-assignment (OWASP A01/A08) : seller_id est writable dans le serializer.
    # On le force à la valeur actuelle pour empêcher un vendeur de réassigner sa voiture
    # à un autre vendeur (ce qui permettrait de polluer/faire bannir le profil d'un tiers).
    # Re-injecter (plutôt que supprimer) garde le PUT non-partiel valide.
    data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
    data['seller_id'] = car.seller_id

    partial = request.method == 'PATCH'
    serializer = CarSerializer(car, data=data, partial=partial, context={'request': request})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ── Sellers ───────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def seller_list(request):
    sellers = Seller.objects.all()
    return Response(SellerSerializer(sellers, many=True).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def seller_detail(request, pk):
    try:
        seller = Seller.objects.get(pk=pk)
    except Seller.DoesNotExist:
        return Response({'error': 'Vendeur introuvable'}, status=status.HTTP_404_NOT_FOUND)
    return Response(SellerSerializer(seller).data)


# ── Appointments ──────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def appointment_list(request):
    if request.method == 'GET':
        user = request.user
        if user.user_type == 'seller':
            try:
                seller = user.seller_profile
                appointments = (Appointment.objects.filter(seller=seller)
                                .select_related('car', 'car__seller', 'buyer', 'seller')
                                .prefetch_related('car__car_images'))
            except Exception:
                appointments = Appointment.objects.none()
        else:
            appointments = (Appointment.objects.filter(buyer=user)
                            .select_related('car', 'car__seller', 'buyer', 'seller')
                            .prefetch_related('car__car_images'))
        ctx = {'request': request, 'favorited_ids': _favorited_ids(request)}
        return Response(AppointmentSerializer(appointments, many=True, context=ctx).data)

    serializer = AppointmentSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        appointment = serializer.save()
        # Notifier le vendeur
        if appointment.seller.user:
            car_label = f'{appointment.car.make} {appointment.car.model}'
            Notification.objects.create(
                user=appointment.seller.user,
                type='appointment_new',
                message=f'Nouveau rendez-vous pour votre {car_label} le {appointment.date}.',
                data={'appointment_id': appointment.id, 'car_id': appointment.car.id},
            )
        return Response(AppointmentSerializer(appointment).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def appointment_update(request, pk):
    try:
        user = request.user
        if user.user_type == 'seller':
            appointment = Appointment.objects.get(pk=pk, seller__user=user)
        else:
            appointment = Appointment.objects.get(pk=pk, buyer=user)
    except Appointment.DoesNotExist:
        return Response({'error': 'Non autorisé'}, status=status.HTTP_404_NOT_FOUND)

    serializer = AppointmentSerializer(
        appointment, data=request.data, partial=True, context={'request': request}
    )
    if serializer.is_valid():
        old_status = appointment.status
        updated = serializer.save()
        new_status = updated.status
        # Notifier l'acheteur si le statut change
        if old_status != new_status and new_status in ('confirmed', 'cancelled', 'completed'):
            type_map = {
                'confirmed': 'appointment_confirmed',
                'cancelled': 'appointment_cancelled',
                'completed': 'appointment_completed',
            }
            msg_map = {
                'confirmed': f'Votre rendez-vous pour {updated.car.make} {updated.car.model} a été confirmé.',
                'cancelled': f'Votre rendez-vous pour {updated.car.make} {updated.car.model} a été annulé.',
                'completed': f'Votre rendez-vous pour {updated.car.make} {updated.car.model} est terminé.',
            }
            Notification.objects.create(
                user=updated.buyer,
                type=type_map[new_status],
                message=msg_map[new_status],
                data={'appointment_id': updated.id, 'car_id': updated.car.id},
            )
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ── Favorites ─────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def favorites_list(request):
    favs = (
        Favorite.objects.filter(user=request.user)
        .select_related('car', 'car__seller')
        .prefetch_related('car__car_images')
    )
    # Toutes les voitures listées ici sont par définition favorites.
    ctx = {'request': request, 'favorited_ids': {f.car_id for f in favs}}
    return Response(FavoriteSerializer(favs, many=True, context=ctx).data)


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def toggle_favorite(request, car_id):
    try:
        car = Car.objects.get(pk=car_id)
    except Car.DoesNotExist:
        return Response({'error': 'Voiture introuvable'}, status=status.HTTP_404_NOT_FOUND)

    fav, created = Favorite.objects.get_or_create(user=request.user, car=car)
    if not created:
        fav.delete()
        return Response({'favorited': False})
    return Response({'favorited': True}, status=status.HTTP_201_CREATED)


# ── Car Images ───────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def car_upload_images(request, pk):
    try:
        car = Car.objects.get(pk=pk, seller__user=request.user)
    except Car.DoesNotExist:
        return Response({'error': 'Non autorisé'}, status=status.HTTP_404_NOT_FOUND)

    files = request.FILES.getlist('images')
    if not files:
        return Response({'error': 'Aucun fichier fourni'}, status=status.HTTP_400_BAD_REQUEST)

    # Validation magic-bytes de chaque fichier (sinon n'importe quel .php/.html peut être uploadé)
    for f in files:
        err = _validate_image(f)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

    base_order = car.car_images.count()
    images = []
    for i, f in enumerate(files):
        img = CarImage.objects.create(car=car, image=f, order=base_order + i)
        images.append(img)

    serializer = CarImageSerializer(images, many=True, context={'request': request})
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def car_set_primary_image(request, pk, image_id):
    try:
        car = Car.objects.get(pk=pk, seller__user=request.user)
        img = CarImage.objects.get(pk=image_id, car=car)
    except (Car.DoesNotExist, CarImage.DoesNotExist):
        return Response({'error': 'Non autorisé'}, status=status.HTTP_404_NOT_FOUND)

    car.car_images.update(is_primary=False)
    img.is_primary = True
    img.save()
    return Response(CarImageSerializer(img, context={'request': request}).data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def car_delete_image(request, pk, image_id):
    try:
        car = Car.objects.get(pk=pk, seller__user=request.user)
        img = CarImage.objects.get(pk=image_id, car=car)
    except (Car.DoesNotExist, CarImage.DoesNotExist):
        return Response({'error': 'Non autorisé'}, status=status.HTTP_404_NOT_FOUND)

    img.image.delete(save=False)
    img.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Premium subscription ──────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@ratelimit(key='user', rate='5/d', method='POST', block=True)
def request_premium(request):
    try:
        seller = request.user.seller_profile
    except Exception:
        return Response({'error': 'Profil vendeur introuvable'}, status=404)

    if seller.plan == 'premium':
        return Response({'error': 'Vous êtes déjà Premium'}, status=400)
    if seller.premium_requested:
        return Response({'error': 'Une demande est déjà en cours.'}, status=400)

    seller.premium_requested = True
    seller.save(update_fields=['premium_requested'])
    return Response({'success': True, 'message': 'Demande envoyée. L\'équipe vous contactera sous 24h.'})


# ── Paiement Premium via PayTech ──────────────────────────────────────────────
# PayTech (https://paytech.sn) : passerelle de paiement (cartes + mobile money).
# Flux : checkout (on initie le paiement et on redirige le vendeur vers PayTech) →
# le vendeur paie → PayTech notifie notre IPN (webhook) → on active le Premium.
# Aucun prélèvement récurrent côté PayTech : le renouvellement est manuel.

def _premium_ipn_url(request):
    """URL HTTPS de l'IPN PayTech. PayTech REFUSE la requête s'il n'y a pas d'IPN, et
    exige du HTTPS (les URLs http/localhost sont rejetées). On la dérive de
    BACKEND_PUBLIC_URL, sinon de la requête courante si elle est déjà en HTTPS
    (cas production derrière proxy TLS). Renvoie '' si aucune URL HTTPS n'est dispo."""
    if settings.BACKEND_PUBLIC_URL:
        return settings.BACKEND_PUBLIC_URL.rstrip('/') + '/api/premium/ipn/'
    candidate = request.build_absolute_uri('/api/premium/ipn/')
    return candidate if candidate.startswith('https://') else ''


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@ratelimit(key='user', rate='10/h', method='POST', block=True)
def premium_checkout(request):
    """Initie un paiement PayTech pour l'abonnement Premium (5 000 FCFA / mois).
    Exige l'acceptation des CGU. Renvoie l'URL de redirection vers la page PayTech."""
    if not PlatformSettings.get().premium_enabled:
        return Response({'detail': "Les abonnements Premium ne sont pas activés."}, status=403)

    try:
        seller = request.user.seller_profile
    except Exception:
        return Response({'detail': 'Profil vendeur introuvable.'}, status=404)

    if not request.data.get('cgu_accepted'):
        return Response({'detail': "Vous devez accepter les Conditions Générales d'Utilisation."}, status=400)

    if not settings.PAYTECH_API_KEY or not settings.PAYTECH_SECRET_KEY:
        logger.error('PayTech non configuré : PAYTECH_API_KEY/SECRET_KEY manquants.')
        return Response({'detail': "Le paiement en ligne est momentanément indisponible."}, status=503)

    amount = settings.PREMIUM_PRICE_XOF  # montant FIXÉ serveur (jamais depuis le client)
    ref_command = f"AC-PREM-{seller.pk}-{uuid.uuid4().hex[:12]}"

    payment = PremiumPayment.objects.create(
        seller=seller,
        ref_command=ref_command,
        amount=amount,
        months=1,
        currency='XOF',
        status=PremiumPayment.PENDING,
        cgu_accepted=True,
        cgu_version=settings.PREMIUM_CGU_VERSION,
        cgu_accepted_at=timezone.now(),
    )

    success_url = f"{settings.FRONTEND_URL.rstrip('/')}/?premium=success&ref={ref_command}"
    cancel_url = f"{settings.FRONTEND_URL.rstrip('/')}/?premium=cancel&ref={ref_command}"
    payload = {
        'item_name': 'Abonnement Premium AUTOCONNECT (1 mois)',
        'item_price': amount,
        'currency': 'XOF',
        'ref_command': ref_command,
        'command_name': 'Abonnement Premium AUTOCONNECT',
        'env': settings.PAYTECH_ENV,
        'success_url': success_url,
        'cancel_url': cancel_url,
        'custom_field': json.dumps({'seller_id': seller.pk, 'ref_command': ref_command}),
    }
    # PayTech exige une IPN HTTPS pour renvoyer le lien de paiement.
    ipn_url = _premium_ipn_url(request)
    if not ipn_url:
        if settings.DEBUG:
            # Dev sans URL publique : on envoie une IPN factice (non joignable) juste
            # pour obtenir le lien de paiement. L'activation se fait alors via l'admin
            # (ou configurez BACKEND_PUBLIC_URL avec un tunnel ngrok pour l'IPN réelle).
            ipn_url = 'https://example.com/api/premium/ipn/'
            logger.warning("PayTech (dev) : BACKEND_PUBLIC_URL absent — IPN factice utilisée, "
                           "activez le Premium via l'admin ou configurez un tunnel HTTPS.")
        else:
            logger.error('PayTech : aucune URL IPN HTTPS disponible (BACKEND_PUBLIC_URL manquant).')
            return Response({'detail': "Paiement indisponible : configuration serveur incomplète."}, status=503)
    payload['ipn_url'] = ipn_url

    headers = {
        'API_KEY': settings.PAYTECH_API_KEY,
        'API_SECRET': settings.PAYTECH_SECRET_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }

    try:
        resp = requests.post(settings.PAYTECH_REQUEST_URL, json=payload, headers=headers, timeout=20)
        data = resp.json()
    except Exception as exc:
        logger.exception('Échec de la requête PayTech : %s', exc)
        payment.status = PremiumPayment.FAILED
        payment.save(update_fields=['status', 'updated_at'])
        return Response({'detail': "Impossible de contacter le service de paiement. Réessayez."}, status=502)

    if str(data.get('success')) != '1' or not data.get('redirect_url'):
        logger.error('Réponse PayTech inattendue : %s', data)
        payment.status = PremiumPayment.FAILED
        payment.save(update_fields=['status', 'updated_at'])
        return Response({'detail': "Le service de paiement a refusé la demande."}, status=502)

    payment.token = data.get('token', '')
    payment.save(update_fields=['token', 'updated_at'])

    return Response({
        'redirect_url': data['redirect_url'],
        'ref_command': ref_command,
    })


def _sha256(value):
    return hashlib.sha256((value or '').encode('utf-8')).hexdigest()


@api_view(['POST'])
@permission_classes([AllowAny])
def premium_ipn(request):
    """Webhook IPN appelé par PayTech (serveur→serveur) pour notifier le résultat.
    Sécurité : on vérifie que les hash SHA256 des clés transmis par PayTech
    correspondent aux nôtres (comparaison à temps constant). Idempotent."""
    data = request.data

    api_key_sha256 = data.get('api_key_sha256', '')
    api_secret_sha256 = data.get('api_secret_sha256', '')
    ok_key = hmac.compare_digest(api_key_sha256, _sha256(settings.PAYTECH_API_KEY))
    ok_secret = hmac.compare_digest(api_secret_sha256, _sha256(settings.PAYTECH_SECRET_KEY))
    if not (ok_key and ok_secret):
        logger.warning('IPN PayTech rejeté : signature invalide (ref=%s).', data.get('ref_command'))
        return Response({'detail': 'Signature invalide.'}, status=403)

    ref_command = data.get('ref_command', '')
    try:
        payment = PremiumPayment.objects.select_related('seller').get(ref_command=ref_command)
    except PremiumPayment.DoesNotExist:
        logger.warning('IPN PayTech : ref_command introuvable (%s).', ref_command)
        return Response({'detail': 'Référence inconnue.'}, status=404)

    type_event = data.get('type_event', '')

    if type_event == 'sale_complete':
        if payment.status == PremiumPayment.SUCCESS:
            return Response({'detail': 'Déjà traité.'})  # idempotent
        # Contrôle du montant : on refuse si PayTech annonce un montant différent.
        try:
            paid = int(float(data.get('item_price', payment.amount)))
        except (TypeError, ValueError):
            paid = payment.amount
        if paid < payment.amount:
            logger.error('IPN PayTech : montant insuffisant (%s < %s) ref=%s.', paid, payment.amount, ref_command)
            payment.status = PremiumPayment.FAILED
            payment.save(update_fields=['status', 'updated_at'])
            return Response({'detail': 'Montant invalide.'}, status=400)

        payment.status = PremiumPayment.SUCCESS
        payment.paid_at = timezone.now()
        payment.payment_method = (data.get('payment_method') or '')[:50]
        payment.client_phone = (data.get('client_phone') or '')[:30]
        payment.save(update_fields=['status', 'paid_at', 'payment_method', 'client_phone', 'updated_at'])

        seller = payment.seller
        premium_until = seller.extend_premium(months=payment.months)
        AuditLog.objects.create(
            admin=None, action='premium_payment',
            target_type='seller', target_id=seller.pk, target_repr=seller.name,
            note=f"Paiement PayTech {payment.amount} {payment.currency} — expire {premium_until:%d/%m/%Y}",
        )
        try:
            from users.email_utils import send_premium_payment_confirmation
            send_premium_payment_confirmation(seller, premium_until)
        except Exception:
            logger.exception('Envoi email confirmation Premium échoué (ref=%s).', ref_command)
        return Response({'detail': 'OK'})

    if type_event == 'sale_canceled':
        if payment.status == PremiumPayment.PENDING:
            payment.status = PremiumPayment.CANCELLED
            payment.save(update_fields=['status', 'updated_at'])
        return Response({'detail': 'OK'})

    return Response({'detail': 'Événement ignoré.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def premium_status(request):
    """Permet au frontend de sonder l'état d'un paiement après la redirection PayTech
    (l'IPN étant asynchrone). Ne renvoie que les paiements du vendeur connecté."""
    ref = request.query_params.get('ref', '')
    try:
        seller = request.user.seller_profile
    except Exception:
        return Response({'detail': 'Profil vendeur introuvable.'}, status=404)
    try:
        payment = PremiumPayment.objects.get(ref_command=ref, seller=seller)
    except PremiumPayment.DoesNotExist:
        return Response({'detail': 'Paiement introuvable.'}, status=404)

    return Response({
        'status': payment.status,
        'plan': seller.plan,
        'is_premium': seller.is_premium,
        'premium_until': seller.premium_until.isoformat() if seller.premium_until else None,
    })


# ── Reports ──────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def report_car(request, car_id):
    try:
        car = Car.objects.select_related('seller').get(pk=car_id)
    except Car.DoesNotExist:
        return Response({'error': 'Annonce introuvable'}, status=status.HTTP_404_NOT_FOUND)

    reason = request.data.get('reason', '')
    if not reason:
        return Response({'error': 'Raison requise'}, status=status.HTTP_400_BAD_REQUEST)

    valid_reasons = [r[0] for r in Report.REASON_CHOICES]
    if reason not in valid_reasons:
        return Response({'error': 'Raison invalide'}, status=status.HTTP_400_BAD_REQUEST)

    if Report.objects.filter(reporter=request.user, car=car).exists():
        return Response({'error': 'Vous avez déjà signalé cette annonce'}, status=status.HTTP_400_BAD_REQUEST)

    Report.objects.create(
        reporter=request.user,
        seller=car.seller,
        car=car,
        reason=reason,
        description=request.data.get('description', ''),
    )
    return Response({'success': True, 'message': 'Signalement envoyé'}, status=status.HTTP_201_CREATED)


# ── Logo vendeur ──────────────────────────────────────────────────────────────

ALLOWED_IMAGE_FORMATS = {'JPEG', 'PNG', 'WEBP'}
MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 Mo
_FORMAT_EXT = {'JPEG': '.jpg', 'PNG': '.png', 'WEBP': '.webp'}


def _validate_image(file):
    """Valide une image par magic-bytes via Pillow et renomme le fichier en
    UUID + extension cohérente (anti 'evil.jpg.html' servi en HTML)."""
    if file.size > MAX_UPLOAD_SIZE:
        return 'Le fichier ne doit pas dépasser 5 Mo.'
    try:
        from PIL import Image
        file.seek(0)
        img = Image.open(file)
        img.verify()
        fmt = (img.format or '').upper()
    except Exception:
        return 'Image invalide ou corrompue.'
    finally:
        file.seek(0)
    if fmt not in ALLOWED_IMAGE_FORMATS:
        return 'Format non supporté. Utilisez JPG, PNG ou WebP.'
    import uuid
    file.name = f'{uuid.uuid4().hex}{_FORMAT_EXT[fmt]}'
    return None


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_seller_logo(request):
    try:
        seller = request.user.seller_profile
    except Exception:
        return Response({'error': 'Profil vendeur introuvable'}, status=404)
    file = request.FILES.get('logo')
    if not file:
        return Response({'error': 'Aucun fichier fourni'}, status=400)
    err = _validate_image(file)
    if err:
        return Response({'error': err}, status=400)
    if seller.logo:
        seller.logo.delete(save=False)
    seller.logo = file
    seller.save()
    return Response(SellerSerializer(seller, context={'request': request}).data)


# ── Reviews ───────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedOrReadOnly])
def seller_reviews(request, seller_id):
    try:
        seller = Seller.objects.get(pk=seller_id)
    except Seller.DoesNotExist:
        return Response({'error': 'Vendeur introuvable'}, status=404)

    if request.method == 'GET':
        reviews = seller.reviews.all()
        return Response(ReviewSerializer(reviews, many=True, context={'request': request}).data)

    # POST — interdire l'auto-review (un vendeur ne peut pas noter son propre profil)
    if seller.user_id == request.user.id:
        return Response({'error': 'Vous ne pouvez pas évaluer votre propre profil.'}, status=400)

    # Vérifier que l'utilisateur n'a pas déjà laissé un avis
    if Review.objects.filter(reviewer=request.user, seller=seller).exists():
        return Response({'error': 'Vous avez déjà laissé un avis pour ce vendeur.'}, status=400)

    car_id = request.data.get('car')
    data = dict(request.data)
    data['seller'] = seller_id
    serializer = ReviewSerializer(data=data, context={'request': request})
    if serializer.is_valid():
        review = serializer.save()
        # Notifier le vendeur
        if seller.user:
            Notification.objects.create(
                user=seller.user,
                type='new_review',
                message=f'{request.user.get_full_name() or request.user.email} a laissé un avis ({review.rating}★).',
                data={'review_id': review.id, 'seller_id': seller_id},
            )
        return Response(ReviewSerializer(review, context={'request': request}).data, status=201)
    return Response(serializer.errors, status=400)


# ── Messagerie ────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def conversation_list(request):
    user = request.user
    if request.method == 'GET':
        convs = (
            Conversation.objects
            .filter(Q(buyer=user) | Q(seller__user=user))
            .distinct()
            .prefetch_related('messages')
            .order_by('-updated_at')
        )
        return Response(ConversationSerializer(convs, many=True, context={'request': request}).data)

    # POST — créer ou récupérer une conversation
    seller_id = request.data.get('seller_id')
    car_id = request.data.get('car_id')
    try:
        seller = Seller.objects.get(pk=seller_id)
    except Seller.DoesNotExist:
        return Response({'error': 'Vendeur introuvable'}, status=404)

    car = None
    if car_id:
        try:
            car = Car.objects.get(pk=car_id)
        except Car.DoesNotExist:
            pass

    conv, _ = Conversation.objects.get_or_create(
        buyer=user,
        seller=seller,
        car=car,
    )
    return Response(ConversationSerializer(conv, context={'request': request}).data, status=200)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def conversation_messages(request, conv_id):
    user = request.user
    try:
        conv = Conversation.objects.get(pk=conv_id)
        # Vérifier accès
        is_buyer = conv.buyer == user
        is_seller = conv.seller.user == user
        if not is_buyer and not is_seller:
            return Response({'error': 'Non autorisé'}, status=403)
    except Conversation.DoesNotExist:
        return Response({'error': 'Conversation introuvable'}, status=404)

    if request.method == 'GET':
        conv.messages.filter(is_read=False).exclude(sender=user).update(is_read=True)
        msgs = conv.messages.all()
        return Response(MessageSerializer(msgs, many=True, context={'request': request}).data)

    # POST — envoyer un message
    content = (request.data.get('content') or '').strip()
    if not content:
        return Response({'error': 'Message vide'}, status=400)

    msg = Message.objects.create(conversation=conv, sender=user, content=content)

    # Mise à jour de updated_at sur la conversation
    conv.save(update_fields=['updated_at'])

    # Notifier le destinataire
    if is_buyer:
        recipient = conv.seller.user
    else:
        recipient = conv.buyer

    if recipient:
        Notification.objects.create(
            user=recipient,
            type='new_message',
            message=f'Nouveau message de {user.get_full_name() or user.email}.',
            data={'conversation_id': conv.id},
        )

    return Response(MessageSerializer(msg, context={'request': request}).data, status=201)


# ── Seller Dashboard ───────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def seller_dashboard(request):
    try:
        seller = request.user.seller_profile
    except Exception:
        return Response({'error': 'Profil vendeur introuvable'}, status=404)

    cars = Car.objects.filter(seller=seller).prefetch_related('car_images')
    appointments = Appointment.objects.filter(seller=seller).select_related('car', 'buyer')

    ctx = {'request': request, 'favorited_ids': _favorited_ids(request)}
    return Response({
        'seller': SellerSerializer(seller, context=ctx).data,
        'stats': {
            'total_cars': cars.count(),
            'active_cars': cars.filter(is_available=True).count(),
            'total_appointments': appointments.count(),
            'pending_appointments': appointments.filter(status='pending').count(),
            'confirmed_appointments': appointments.filter(status='confirmed').count(),
        },
        'cars': CarSerializer(cars, many=True, context=ctx).data,
        'appointments': AppointmentSerializer(appointments, many=True).data,
    })


# -- Location (Rental) --------------------------------------------------------

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def rental_request_list(request):
    user = request.user

    if request.method == 'GET':
        if user.user_type in ('seller', 'admin') or hasattr(user, 'seller_profile'):
            try:
                seller = user.seller_profile
                qs = (RentalRequest.objects.filter(seller=seller)
                      .select_related('car', 'car__seller', 'renter', 'seller')
                      .prefetch_related('car__car_images'))
            except Exception:
                qs = RentalRequest.objects.none()
        else:
            qs = (RentalRequest.objects.filter(renter=user)
                  .select_related('car', 'car__seller', 'renter', 'seller')
                  .prefetch_related('car__car_images'))
        ctx = {'request': request, 'favorited_ids': _favorited_ids(request)}
        return Response(RentalRequestSerializer(qs, many=True, context=ctx).data)

    # POST -- create rental request
    car_id = request.data.get('car_id')
    try:
        car = Car.objects.get(pk=car_id)
    except Car.DoesNotExist:
        return Response({'error': 'Voiture introuvable'}, status=404)

    if car.listing_type == Car.LISTING_SALE:
        return Response({'error': "Cette voiture n'est pas disponible a la location."}, status=400)

    start_date = request.data.get('start_date')
    end_date = request.data.get('end_date')
    if not start_date or not end_date:
        return Response({'error': 'Les dates de debut et de fin sont obligatoires.'}, status=400)

    from datetime import date
    try:
        sd = date.fromisoformat(str(start_date))
        ed = date.fromisoformat(str(end_date))
    except (ValueError, TypeError):
        return Response({'error': 'Format de date invalide (YYYY-MM-DD attendu).'}, status=400)
    if sd >= ed:
        return Response({'error': 'La date de fin doit être strictement après la date de début.'}, status=400)

    overlap = RentalRequest.objects.filter(
        car=car,
        status__in=['confirmed', 'active'],
        start_date__lt=end_date,
        end_date__gt=start_date,
    ).exists()
    if overlap:
        return Response({'error': 'La voiture est deja reservee pour ces dates.'}, status=400)

    data = {
        'car_id': car_id,
        'start_date': start_date,
        'end_date': end_date,
        'renter_message': request.data.get('renter_message', ''),
    }
    serializer = RentalRequestSerializer(data=data, context={'request': request})
    if serializer.is_valid():
        rental = serializer.save()
        if car.seller.user:
            Notification.objects.create(
                user=car.seller.user,
                type='rental_request',
                message=f'{request.user.get_full_name() or request.user.email} souhaite louer votre {car.make} {car.model} du {start_date} au {end_date}.',
                data={'rental_request_id': rental.id, 'car_id': car.id},
            )
        return Response(RentalRequestSerializer(rental, context={'request': request}).data, status=201)
    return Response(serializer.errors, status=400)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def rental_request_detail(request, pk):
    try:
        rental = (RentalRequest.objects
                  .select_related('car', 'car__seller', 'renter', 'seller')
                  .prefetch_related('car__car_images')
                  .get(pk=pk))
    except RentalRequest.DoesNotExist:
        return Response({'error': 'Demande introuvable'}, status=404)

    user = request.user
    is_renter = rental.renter == user
    is_seller = rental.seller.user == user
    is_admin = user.is_staff or user.user_type == 'admin'

    if not (is_renter or is_seller or is_admin):
        return Response({'error': 'Non autorise'}, status=403)

    if request.method == 'GET':
        return Response(RentalRequestSerializer(rental, context={'request': request}).data)

    new_status = request.data.get('status')
    if is_seller and new_status in ('confirmed', 'rejected'):
        rental.status = new_status
        if new_status == 'rejected':
            rental.rejection_reason = request.data.get('rejection_reason', '')
        rental.save()
        msg = ('Votre demande de location a ete confirmee' if new_status == 'confirmed'
               else f'Votre demande de location a ete refusee. Raison : {rental.rejection_reason or "non precisee"}')
        Notification.objects.create(
            user=rental.renter,
            type='rental_update',
            message=f'{rental.car.make} {rental.car.model} -- {msg}',
            data={'rental_request_id': rental.id},
        )
    elif is_renter and new_status == 'cancelled':
        rental.status = new_status
        rental.save()
    elif is_admin and new_status in ('confirmed', 'rejected', 'cancelled', 'active', 'completed'):
        rental.status = new_status
        rental.save()
    else:
        return Response({'error': 'Action non autorisee.'}, status=403)

    return Response(RentalRequestSerializer(rental, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def car_rental_availability(request, car_id):
    try:
        car = Car.objects.get(pk=car_id)
    except Car.DoesNotExist:
        return Response({'error': 'Voiture introuvable'}, status=404)

    blocked = RentalRequest.objects.filter(
        car=car,
        status__in=['confirmed', 'active'],
    ).values('start_date', 'end_date')
    return Response({'blocked_dates': list(blocked)})
