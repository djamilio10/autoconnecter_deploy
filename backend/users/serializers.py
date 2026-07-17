import uuid

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, phone_validator, id_card_validator


class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    two_factor_enabled = serializers.BooleanField(source='totp_enabled', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'user_type',
                  'company', 'phone', 'id_card_number', 'location', 'is_verified',
                  'avatar_initials', 'avatar_url', 'rating', 'review_count', 'is_staff',
                  'two_factor_enabled']
        read_only_fields = ['id', 'is_verified', 'is_staff', 'avatar_initials',
                            'avatar_url', 'rating', 'review_count', 'two_factor_enabled']

    def get_avatar_url(self, obj):
        if not obj.avatar_image:
            return None
        request = self.context.get('request')
        url = obj.avatar_image.url
        return request.build_absolute_uri(url) if request else url


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    phone = serializers.CharField(required=True, validators=[phone_validator])
    id_card_number = serializers.CharField(required=True, validators=[id_card_validator])

    class Meta:
        model = User
        fields = ['email', 'password', 'first_name', 'last_name',
                  'user_type', 'company', 'phone', 'id_card_number', 'location']
        extra_kwargs = {
            'first_name': {'required': True, 'allow_blank': False},
            'last_name': {'required': True, 'allow_blank': False},
        }

    # ── Validation unicite email / CNI ────────────────────────────────────────
    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cette adresse email.")
        return value

    def validate_id_card_number(self, value):
        value = value.strip().replace(' ', '')
        if User.objects.filter(id_card_number=value).exists():
            raise serializers.ValidationError("Cette carte d'identité est déjà enregistrée.")
        return value

    def validate_phone(self, value):
        value = value.strip().replace(' ', '')
        if User.objects.filter(phone=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec ce numéro de téléphone.")
        return value

    def validate_password(self, value):
        # Applique les validateurs Django (longueur, mot de passe courant, non-numérique…).
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def validate(self, data):
        # Unicité du nom de vendeur (company)
        if data.get('user_type') == User.SELLER and data.get('company'):
            company = data['company'].strip()
            from cars.models import Seller
            if Seller.objects.filter(name__iexact=company).exists():
                raise serializers.ValidationError(
                    {'company': "Ce nom de vendeur est déjà utilisé. Veuillez en choisir un autre."}
                )
            if User.objects.filter(company__iexact=company, user_type=User.SELLER).exists():
                raise serializers.ValidationError(
                    {'company': "Ce nom de vendeur est déjà utilisé. Veuillez en choisir un autre."}
                )
        return data

    def create(self, validated_data):
        password = validated_data.pop('password')
        email = validated_data['email']
        # Username unique base sur l'email (suffixe court si collision)
        base = email.split('@')[0]
        username = base
        while User.objects.filter(username=username).exists():
            username = f"{base}_{uuid.uuid4().hex[:6]}"
        user = User(**validated_data)
        user.username = username
        user.set_password(password)
        user.save()

        # Auto-creation du profil vendeur si l'utilisateur s'inscrit comme seller
        if user.user_type == User.SELLER:
            from cars.models import Seller
            full_name = (user.get_full_name() or user.company or user.email).strip()
            initials = ''.join(p[0].upper() for p in full_name.split()[:2]) or 'V'
            Seller.objects.get_or_create(
                user=user,
                defaults={
                    'name': user.company or full_name,
                    'seller_type': 'pro' if user.company else 'particulier',
                    'avatar': initials[:5],
                    'location': user.location or 'Dakar',
                    'phone': user.phone or '',
                    'is_verified': False,
                },
            )
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()
    otp = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        email = data['email'].lower().strip()
        # Vérification manuelle des credentials : authenticate() rejette les comptes
        # is_active=False, ce qui empêche la vue de renvoyer 'email_not_verified'.
        # Le statut (banni / non vérifié / suspendu) est géré dans la vue login().
        user = User.objects.filter(email__iexact=email).first()
        if not user or not user.check_password(data['password']):
            raise serializers.ValidationError('Email ou mot de passe incorrect.')
        data['user'] = user
        return data


class TokenResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    user = UserSerializer()

    @staticmethod
    def get_tokens(user):
        """Génère access+refresh. Le refresh sera posé en cookie HttpOnly par la vue
        via `set_refresh_cookie(response, refresh_str)`. Le body JSON ne contient
        que l'access (gardé en mémoire côté frontend) et les infos user."""
        refresh = RefreshToken.for_user(user)
        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),  # consommé par la vue pour poser le cookie
            'user': UserSerializer(user).data,
        }
