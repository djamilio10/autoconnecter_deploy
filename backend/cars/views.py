from rest_framework import status, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from django.db.models import Q
from .models import Car, CarImage, Seller, Appointment, Favorite, Report, Review, Conversation, Message, RentalRequest
from .serializers import (CarSerializer, CarImageSerializer, SellerSerializer, AppointmentSerializer,
                          FavoriteSerializer, ReviewSerializer, ConversationSerializer, MessageSerializer,
                          RentalRequestSerializer)
from users.models import PlatformSettings, Notification


# ── Cars ──────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def car_list(request):
    cars = Car.objects.filter(is_available=True).select_related('seller')

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

    serializer = CarSerializer(cars, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def car_detail(request, pk):
    try:
        car = Car.objects.select_related('seller').get(pk=pk)
    except Car.DoesNotExist:
        return Response({'error': 'Voiture introuvable'}, status=status.HTTP_404_NOT_FOUND)
    return Response(CarSerializer(car, context={'request': request}).data)


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

    partial = request.method == 'PATCH'
    serializer = CarSerializer(car, data=request.data, partial=partial, context={'request': request})
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
                appointments = Appointment.objects.filter(seller=seller).select_related('car', 'buyer')
            except Exception:
                appointments = Appointment.objects.none()
        else:
            appointments = Appointment.objects.filter(buyer=user).select_related('car', 'car__seller')
        return Response(AppointmentSerializer(appointments, many=True).data)

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

    serializer = AppointmentSerializer(appointment, data=request.data, partial=True)
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
    favs = Favorite.objects.filter(user=request.user).select_related('car', 'car__seller')
    return Response(FavoriteSerializer(favs, many=True).data)


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
def request_premium(request):
    try:
        seller = request.user.seller_profile
    except Exception:
        return Response({'error': 'Profil vendeur introuvable'}, status=404)

    if seller.plan == 'premium':
        return Response({'error': 'Vous êtes déjà Premium'}, status=400)

    seller.premium_requested = True
    seller.save()
    return Response({'success': True, 'message': 'Demande envoyée. L\'équipe vous contactera sous 24h.'})


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

    # POST — vérifier que l'utilisateur n'a pas déjà laissé un avis
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
        # Marquer les messages non lus comme lus (ceux envoyés par l'autre)
        if is_buyer:
            conv.messages.filter(is_read=False).exclude(sender=user).update(is_read=True)
        else:
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

    cars = Car.objects.filter(seller=seller)
    appointments = Appointment.objects.filter(seller=seller).select_related('car', 'buyer')

    return Response({
        'seller': SellerSerializer(seller).data,
        'stats': {
            'total_cars': cars.count(),
            'active_cars': cars.filter(is_available=True).count(),
            'total_appointments': appointments.count(),
            'pending_appointments': appointments.filter(status='pending').count(),
            'confirmed_appointments': appointments.filter(status='confirmed').count(),
        },
        'cars': CarSerializer(cars, many=True, context={'request': request}).data,
        'cars': CarSerializer(cars, many=True, context={'request': request}).data,
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
                qs = RentalRequest.objects.filter(seller=seller).select_related('car', 'renter', 'seller')
            except Exception:
                qs = RentalRequest.objects.none()
        else:
            qs = RentalRequest.objects.filter(renter=user).select_related('car', 'seller')
        return Response(RentalRequestSerializer(qs, many=True, context={'request': request}).data)

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
        rental = RentalRequest.objects.select_related('car', 'renter', 'seller').get(pk=pk)
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
