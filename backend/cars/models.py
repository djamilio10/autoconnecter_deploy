from datetime import timedelta

from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.db.models import Avg
from users.models import User


class Seller(models.Model):
    PRO = 'pro'
    PARTICULIER = 'particulier'
    SELLER_TYPES = [(PRO, 'Professionnel'), (PARTICULIER, 'Particulier')]

    PLAN_FREE = 'free'
    PLAN_PREMIUM = 'premium'
    PLAN_CHOICES = [(PLAN_FREE, 'Gratuit'), (PLAN_PREMIUM, 'Premium')]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='seller_profile', null=True, blank=True)
    name = models.CharField(max_length=200)
    seller_type = models.CharField(max_length=20, choices=SELLER_TYPES, default=PRO)
    avatar = models.CharField(max_length=5)
    logo = models.FileField(upload_to='logos/', blank=True, null=True)
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0)
    review_count = models.IntegerField(default=0)
    location = models.CharField(max_length=200)
    phone = models.CharField(max_length=20)
    is_verified = models.BooleanField(default=False)
    is_premium = models.BooleanField(default=False)
    premium_until = models.DateTimeField(null=True, blank=True)
    premium_requested = models.BooleanField(default=False)
    # Lifecycle de renouvellement (anti-doublon des emails envoyés par la commande
    # process_premium_subscriptions). Réinitialisés à chaque nouveau paiement.
    premium_renewal_reminded_at = models.DateTimeField(null=True, blank=True)
    premium_expiry_notified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    FREE_CAR_LIMIT = 3

    @property
    def premium_grace_end(self):
        """Fin de la période de grâce : date d'échéance + délai configurable.
        Les avantages Premium restent actifs jusqu'à cette date même si le paiement
        n'a pas été renouvelé."""
        if self.premium_until is None:
            return None
        return self.premium_until + timedelta(days=settings.PREMIUM_GRACE_DAYS)

    @property
    def plan(self):
        from django.utils import timezone
        # On considère la fin de grâce (et pas seulement premium_until) : les avantages
        # couvrent les jours de grâce. Auto-correctif si la commande quotidienne tarde.
        if self.is_premium and (self.premium_until is None or self.premium_grace_end > timezone.now()):
            return self.PLAN_PREMIUM
        return self.PLAN_FREE

    @property
    def can_post(self):
        if self.plan == self.PLAN_PREMIUM:
            return True
        return self.cars.filter(is_available=True).count() < self.FREE_CAR_LIMIT

    def extend_premium(self, months=1):
        """Active ou prolonge le Premium de `months` mois. Si l'abonnement est encore
        valide (renouvellement anticipé), le temps s'empile sur l'échéance en cours ;
        sinon il démarre maintenant. Réinitialise les drapeaux de relance."""
        from django.utils import timezone
        now = timezone.now()
        base = self.premium_until if (self.premium_until and self.premium_until > now) else now
        self.is_premium = True
        self.premium_until = base + timedelta(days=30 * months)
        self.premium_requested = False
        self.premium_renewal_reminded_at = None
        self.premium_expiry_notified_at = None
        self.save(update_fields=[
            'is_premium', 'premium_until', 'premium_requested',
            'premium_renewal_reminded_at', 'premium_expiry_notified_at',
        ])
        return self.premium_until

    class Meta:
        db_table = 'sellers'

    def __str__(self):
        return self.name


class Car(models.Model):
    FUEL_CHOICES = [
        ('Essence', 'Essence'),
        ('Diesel', 'Diesel'),
        ('Hybride', 'Hybride'),
        ('Électrique', 'Électrique'),
    ]
    TRANSMISSION_CHOICES = [
        ('Automatique', 'Automatique'),
        ('Manuelle', 'Manuelle'),
    ]

    LISTING_SALE = 'sale'
    LISTING_RENTAL = 'rental'
    LISTING_BOTH = 'both'
    LISTING_CHOICES = [
        (LISTING_SALE, 'Vente uniquement'),
        (LISTING_RENTAL, 'Location uniquement'),
        (LISTING_BOTH, 'Vente et Location'),
    ]

    seller = models.ForeignKey(Seller, on_delete=models.CASCADE, related_name='cars')
    make = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    year = models.IntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    mileage = models.IntegerField()
    fuel = models.CharField(max_length=20, choices=FUEL_CHOICES)
    transmission = models.CharField(max_length=20, choices=TRANSMISSION_CHOICES)
    power = models.CharField(max_length=50)
    color = models.CharField(max_length=100)
    doors = models.IntegerField(default=4)
    seats = models.IntegerField(default=5)
    location = models.CharField(max_length=200)
    description = models.TextField()
    features = models.JSONField(default=list)
    tags = models.JSONField(default=list)
    badge = models.CharField(max_length=50, blank=True)
    gradient = models.CharField(max_length=200, blank=True)
    accent_color = models.CharField(max_length=10, blank=True)
    image = models.URLField(max_length=500, blank=True)
    image_hero = models.URLField(max_length=500, blank=True)
    is_available = models.BooleanField(default=True)
    # ── Champs location ──────────────────────────────────────────────────────
    listing_type = models.CharField(max_length=10, choices=LISTING_CHOICES, default=LISTING_SALE)
    rental_price_per_day = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    rental_deposit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    rental_min_days = models.IntegerField(default=1)
    rental_required_docs = models.JSONField(default=list, blank=True,
        help_text="Liste des documents exigés (ex: ['Permis de conduire', 'CIN'])")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'cars'
        ordering = ['-created_at']
        indexes = [
            # car_list filtre sur is_available et trie par created_at/price.
            models.Index(fields=['is_available', '-created_at']),
            models.Index(fields=['is_available', 'price']),
            models.Index(fields=['listing_type']),
        ]

    def __str__(self):
        return f'{self.make} {self.model} {self.year}'


class Appointment(models.Model):
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('confirmed', 'Confirmé'),
        ('cancelled', 'Annulé'),
        ('completed', 'Terminé'),
    ]

    car = models.ForeignKey(Car, on_delete=models.CASCADE, related_name='appointments')
    buyer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='appointments')
    seller = models.ForeignKey(Seller, on_delete=models.CASCADE, related_name='appointments')
    date = models.DateField()
    time = models.TimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    note = models.TextField(blank=True)
    cancellation_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'appointments'
        ordering = ['date', 'time']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['seller', 'status']),
        ]

    def __str__(self):
        return f'{self.buyer} → {self.car} on {self.date}'


class CarImage(models.Model):
    car = models.ForeignKey(Car, on_delete=models.CASCADE, related_name='car_images')
    image = models.FileField(upload_to='cars/')
    order = models.IntegerField(default=0)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'car_images'
        ordering = ['-is_primary', 'order', 'created_at']

    def __str__(self):
        return f'Image #{self.order} — {self.car}'


class Report(models.Model):
    REASON_CHOICES = [
        ('fake',           'Annonce frauduleuse'),
        ('wrong_price',    'Prix trompeur'),
        ('not_responding', 'Vendeur ne répond pas'),
        ('not_serious',    'Vendeur pas sérieux'),
        ('already_sold',   'Véhicule déjà vendu'),
        ('harassment',     'Comportement inapproprié'),
        ('other',          'Autre raison'),
    ]
    STATUS_CHOICES = [
        ('pending',   'En attente'),
        ('resolved',  'Résolu'),
        ('dismissed', 'Rejeté'),
    ]
    ACTION_CHOICES = [
        ('',              'Aucune'),
        ('warn',          'Avertissement envoyé'),
        ('suspend_car',   'Annonce suspendue'),
        ('suspend_user',  'Compte suspendu'),
        ('ban_user',      'Compte banni'),
    ]

    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reports_sent')
    seller = models.ForeignKey(Seller, on_delete=models.CASCADE, related_name='reports_received')
    car = models.ForeignKey(Car, on_delete=models.SET_NULL, null=True, blank=True, related_name='reports')
    reason = models.CharField(max_length=30, choices=REASON_CHOICES)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_note = models.TextField(blank=True)
    admin_action = models.CharField(max_length=20, choices=ACTION_CHOICES, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reports'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        return f'Report #{self.pk} — {self.reason}'


class Favorite(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favorites')
    car = models.ForeignKey(Car, on_delete=models.CASCADE, related_name='favorited_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'favorites'
        unique_together = ('user', 'car')


class Review(models.Model):
    reviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews_given')
    seller = models.ForeignKey(Seller, on_delete=models.CASCADE, related_name='reviews')
    car = models.ForeignKey(Car, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviews')
    rating = models.IntegerField(
        default=5,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reviews'
        unique_together = ('reviewer', 'seller')
        ordering = ['-created_at']

    def __str__(self):
        return f'Review by {self.reviewer} on {self.seller} ({self.rating}★)'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Recalcule rating/review_count du vendeur
        reviews = self.seller.reviews.all()
        count = reviews.count()
        avg = reviews.aggregate(models.Avg('rating'))['rating__avg'] or 0
        self.seller.rating = round(avg, 1)
        self.seller.review_count = count
        self.seller.save(update_fields=['rating', 'review_count'])


class Conversation(models.Model):
    buyer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations')
    seller = models.ForeignKey(Seller, on_delete=models.CASCADE, related_name='conversations')
    car = models.ForeignKey(Car, on_delete=models.SET_NULL, null=True, blank=True, related_name='conversations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'conversations'
        unique_together = ('buyer', 'seller', 'car')
        ordering = ['-updated_at']

    def __str__(self):
        return f'Conv {self.buyer} <-> {self.seller}'

    @property
    def last_message(self):
        return self.messages.last()

    @property
    def unread_count_for_buyer(self):
        return self.messages.filter(sender=self.seller.user, is_read=False).count()

    @property
    def unread_count_for_seller(self):
        return self.messages.filter(is_read=False).exclude(sender=self.seller.user).count()


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='messages_sent')
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'messages'
        ordering = ['created_at']

    def __str__(self):
        return f'Msg from {self.sender} in conv #{self.conversation_id}'


class RentalRequest(models.Model):
    STATUS_CHOICES = [
        ('pending',   'En attente'),
        ('confirmed', 'Confirme'),
        ('rejected',  'Refuse'),
        ('cancelled', 'Annule'),
        ('active',    'En cours'),
        ('completed', 'Termine'),
    ]

    car = models.ForeignKey(Car, on_delete=models.CASCADE, related_name='rental_requests')
    renter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='rental_requests')
    seller = models.ForeignKey(Seller, on_delete=models.CASCADE, related_name='rental_requests')
    start_date = models.DateField()
    end_date = models.DateField()
    total_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    renter_message = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'rental_requests'
        ordering = ['-created_at']
        indexes = [
            # Vérification de disponibilité : filtre car + status + chevauchement de dates.
            models.Index(fields=['car', 'status']),
        ]

    def __str__(self):
        return f'Location #{self.pk} -- {self.renter} -> {self.car} ({self.start_date} -> {self.end_date})'

    @property
    def nb_days(self):
        if self.start_date and self.end_date:
            return max(1, (self.end_date - self.start_date).days)
        return 0

    def save(self, *args, **kwargs):
        if self.car and self.car.rental_price_per_day and self.start_date and self.end_date:
            self.total_price = self.car.rental_price_per_day * self.nb_days
        super().save(*args, **kwargs)


class PremiumPayment(models.Model):
    """Une transaction PayTech pour l'abonnement Premium d'un vendeur.

    Chaque paiement est unique (PayTech ne fait pas de prélèvement récurrent). Le
    statut passe de 'pending' à 'success' une fois l'IPN PayTech vérifié, ce qui
    déclenche l'activation/prolongation du Premium. On conserve la trace de
    l'acceptation des CGU (preuve de consentement au moment de l'achat)."""

    PENDING = 'pending'
    SUCCESS = 'success'
    CANCELLED = 'cancelled'
    FAILED = 'failed'
    STATUS_CHOICES = [
        (PENDING, 'En attente'),
        (SUCCESS, 'Payé'),
        (CANCELLED, 'Annulé'),
        (FAILED, 'Échec'),
    ]

    seller = models.ForeignKey(Seller, on_delete=models.CASCADE, related_name='premium_payments')
    # Référence unique transmise à PayTech (ref_command) et utilisée pour rapprocher
    # l'IPN. Non devinable (uuid) pour éviter qu'un tiers ne forge un rapprochement.
    ref_command = models.CharField(max_length=64, unique=True)
    amount = models.PositiveIntegerField(help_text='Montant en FCFA, fixé côté serveur')
    months = models.PositiveSmallIntegerField(default=1)
    currency = models.CharField(max_length=8, default='XOF')
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=PENDING)
    token = models.CharField(max_length=128, blank=True)
    payment_method = models.CharField(max_length=50, blank=True)
    client_phone = models.CharField(max_length=30, blank=True)
    # Consentement aux CGU (RGPD / preuve de souscription).
    cgu_accepted = models.BooleanField(default=False)
    cgu_version = models.CharField(max_length=20, blank=True)
    cgu_accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'premium_payments'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['seller', '-created_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'Premium #{self.pk} — {self.seller} — {self.status}'
