import uuid

from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .models import User, phone_validator, id_card_validator


class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'user_type',
                  'company', 'phone', 'id_card_number', 'location', 'is_verified',
                  'avatar_initials', 'avatar_url', 'rating', 'review_count', 'is_staff']
        read_only_fields = ['id', 'is_verified', 'is_staff', 'avatar_initials',
                            'avatar_url', 'rating', 'review_count']

    def get_avatar_url(self, obj):
        if not obj.avatar_image:
            return None
        request = self.context.get('request')
        url = obj.avatar_image.url
        return request.build_absolute_uri(url) if request else url


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
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
        user_type = self.initial_data.get('user_type', User.BUYER)
        if User.objects.filter(email__iexact=value, user_type=user_type).exists():
            raise serializers.ValidationError(
                "Un compte de ce type existe déjà avec cette adresse email."
            )
        return value

    def validate_id_card_number(self, value):
        value = value.strip().replace(' ', '')
        user_type = self.initial_data.get('user_type', User.BUYER)
        if User.objects.filter(id_card_number=value, user_type=user_type).exists():
            raise serializers.ValidationError(
                "Un compte de ce type existe déjà avec ce numéro de carte d'identité."
            )
        return value

    def validate_phone(self, value):
        value = value.strip().replace(' ', '')
        user_type = self.initial_data.get('user_type', User.BUYER)
        if User.objects.filter(phone=value, user_type=user_type).exists():
            raise serializers.ValidationError(
                "Un compte de ce type existe déjà avec ce numéro de téléphone."
            )
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

    def validate(self, data):
        email = data['email'].lower().strip()
        # Authentification par email (USERNAME_FIELD = 'email')
        user = authenticate(username=email, password=data['password'])
        if not user:
            raise serializers.ValidationError('Email ou mot de passe incorrect.')
        if not user.is_active:
            raise serializers.ValidationError('Ce compte est desactive.')
        data['user'] = user
        return data


class TokenResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer()

    @staticmethod
    def get_tokens(user):
        refresh = RefreshToken.for_user(user)
        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        }
