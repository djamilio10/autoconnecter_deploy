from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db import models


# Validateurs reutilisables ────────────────────────────────────────────────────
phone_validator = RegexValidator(
    regex=r'^(\+?221)?\s?(7[05678])\s?\d{3}\s?\d{2}\s?\d{2}$',
    message="Numero de telephone senegalais invalide (ex: +221 77 123 45 67).",
)

id_card_validator = RegexValidator(
    regex=r'^[12]\d{12}$|^[12]\d{16}$',
    message="CNI invalide : 13 ou 17 chiffres, commencant par 1 (homme) ou 2 (femme).",
)


class User(AbstractUser):
    BUYER = 'buyer'
    SELLER = 'seller'
    ADMIN = 'admin'
    USER_TYPES = [(BUYER, 'Acheteur'), (SELLER, 'Vendeur'), (ADMIN, 'Administrateur')]

    email = models.EmailField(unique=True)
    user_type = models.CharField(max_length=10, choices=USER_TYPES, default=BUYER)
    company = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=20, validators=[phone_validator])
    id_card_number = models.CharField(
        max_length=17,
        null=True,
        blank=False,
        validators=[id_card_validator],
        verbose_name="Numero CNI",
    )
    location = models.CharField(max_length=200, blank=True)
    is_verified = models.BooleanField(default=False)
    is_banned = models.BooleanField(default=False)
    ban_reason = models.TextField(blank=True)
    ban_until = models.DateTimeField(null=True, blank=True)
    avatar_image = models.FileField(upload_to='avatars/', blank=True, null=True)
    avatar_initials = models.CharField(max_length=3, blank=True)
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0)
    review_count = models.IntegerField(default=0)
    # 2FA TOTP (application d'authentification : Google Authenticator, Authy…).
    # totp_secret reste vide tant que l'utilisateur n'a pas commencé l'enrôlement ;
    # totp_enabled ne passe à True qu'après vérification d'un premier code valide.
    totp_secret = models.CharField(max_length=64, blank=True)
    totp_enabled = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        if not self.avatar_initials:
            name = self.get_full_name() or self.email
            parts = name.split()
            self.avatar_initials = ''.join(p[0].upper() for p in parts[:2])
        super().save(*args, **kwargs)

    @property
    def account_status(self):
        if self.is_banned:
            return 'banned'
        if not self.is_active:
            return 'suspended'
        return 'active'


class EmailVerification(models.Model):
    MAX_ATTEMPTS = 5

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='verifications')
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'email_verifications'
        indexes = [
            models.Index(fields=['user', 'is_used', '-created_at']),
        ]

    def is_valid(self):
        from django.utils import timezone
        return (
            not self.is_used
            and self.attempts < self.MAX_ATTEMPTS
            and self.expires_at > timezone.now()
        )


class PasswordReset(models.Model):
    """Code de réinitialisation de mot de passe envoyé par email.
    Même modèle de sécurité que EmailVerification : code 6 chiffres, expiration
    courte, cap de tentatives anti-brute-force."""
    MAX_ATTEMPTS = 5

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_resets')
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'password_resets'
        indexes = [
            models.Index(fields=['user', 'is_used', '-created_at']),
        ]

    def is_valid(self):
        from django.utils import timezone
        return (
            not self.is_used
            and self.attempts < self.MAX_ATTEMPTS
            and self.expires_at > timezone.now()
        )


class PlatformSettings(models.Model):
    premium_enabled = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'platform_settings'

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Notification(models.Model):
    TYPE_CHOICES = [
        ('appointment_new',       'Nouveau rendez-vous'),
        ('appointment_confirmed', 'Rendez-vous confirmé'),
        ('appointment_cancelled', 'Rendez-vous annulé'),
        ('appointment_completed', 'Rendez-vous terminé'),
        ('new_review',            'Nouvel avis'),
        ('new_message',           'Nouveau message'),
        ('rental_request',        'Demande de location'),
        ('rental_update',         'Mise à jour location'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    message = models.TextField()
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            # Cloche de notifications : poll toutes les 30 s, filtre user + tri date.
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['user', 'is_read']),
        ]

    def __str__(self):
        return f'Notif {self.type} → {self.user}'


class AuditLog(models.Model):
    admin = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_actions')
    action = models.CharField(max_length=60)
    target_type = models.CharField(max_length=20)
    target_id = models.IntegerField()
    target_repr = models.CharField(max_length=200)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action} by {self.admin} on {self.target_repr}'
