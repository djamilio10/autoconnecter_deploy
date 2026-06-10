from rest_framework import serializers
from .models import Car, CarImage, Seller, Appointment, Favorite, Review, Conversation, Message, RentalRequest


class SellerSerializer(serializers.ModelSerializer):
    plan = serializers.ReadOnlyField()
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Seller
        fields = ['id', 'name', 'seller_type', 'avatar', 'logo_url', 'rating',
                  'review_count', 'location', 'phone', 'is_verified',
                  'is_premium', 'premium_until', 'premium_requested', 'plan']

    def get_logo_url(self, obj):
        request = self.context.get('request')
        if obj.logo:
            if request:
                return request.build_absolute_uri(obj.logo.url)
            return obj.logo.url
        return None


class CarImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = CarImage
        fields = ['id', 'url', 'order', 'is_primary']

    def get_url(self, obj):
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url


class CarSerializer(serializers.ModelSerializer):
    seller = SellerSerializer(read_only=True)
    seller_id = serializers.PrimaryKeyRelatedField(
        queryset=Seller.objects.all(), source='seller', write_only=True
    )
    is_favorited = serializers.SerializerMethodField()
    car_images = CarImageSerializer(many=True, read_only=True)
    primary_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Car
        fields = ['id', 'seller', 'seller_id', 'make', 'model', 'year', 'price',
                  'mileage', 'fuel', 'transmission', 'power', 'color', 'doors',
                  'seats', 'location', 'description', 'features', 'tags', 'badge',
                  'gradient', 'accent_color', 'image', 'image_hero', 'is_available',
                  'listing_type', 'rental_price_per_day', 'rental_deposit',
                  'rental_min_days', 'rental_required_docs',
                  'is_favorited', 'car_images', 'primary_image_url', 'created_at']

    def get_is_favorited(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Favorite.objects.filter(user=request.user, car=obj).exists()
        return False

    def get_primary_image_url(self, obj):
        request = self.context.get('request')
        primary = obj.car_images.filter(is_primary=True).first()
        if not primary:
            primary = obj.car_images.first()
        if primary and request:
            return request.build_absolute_uri(primary.image.url)
        if primary:
            return primary.image.url
        return obj.image or obj.image_hero or None


class AppointmentSerializer(serializers.ModelSerializer):
    car = CarSerializer(read_only=True)
    car_id = serializers.PrimaryKeyRelatedField(
        queryset=Car.objects.all(), source='car', write_only=True
    )
    buyer_name = serializers.SerializerMethodField()
    seller_name = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = ['id', 'car', 'car_id', 'buyer_name', 'seller_name',
                  'date', 'time', 'status', 'note', 'cancellation_reason', 'created_at']
        read_only_fields = ['buyer_name', 'seller_name']

    def get_buyer_name(self, obj):
        return obj.buyer.get_full_name() or obj.buyer.email

    def get_seller_name(self, obj):
        return obj.seller.name

    def create(self, validated_data):
        request = self.context['request']
        validated_data['buyer'] = request.user
        car = validated_data['car']
        validated_data['seller'] = car.seller
        return super().create(validated_data)


class FavoriteSerializer(serializers.ModelSerializer):
    car = CarSerializer(read_only=True)

    class Meta:
        model = Favorite
        fields = ['id', 'car', 'created_at']


class ReviewSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.SerializerMethodField()
    reviewer_initials = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ['id', 'reviewer_name', 'reviewer_initials', 'seller', 'car',
                  'rating', 'comment', 'created_at']
        read_only_fields = ['reviewer_name', 'reviewer_initials']

    def get_reviewer_name(self, obj):
        return obj.reviewer.get_full_name() or obj.reviewer.email.split('@')[0]

    def get_reviewer_initials(self, obj):
        return obj.reviewer.avatar_initials or obj.reviewer.email[0].upper()

    def create(self, validated_data):
        validated_data['reviewer'] = self.context['request'].user
        return super().create(validated_data)


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'conversation', 'sender_name', 'is_mine', 'content', 'is_read', 'created_at']
        read_only_fields = ['sender_name', 'is_mine', 'is_read']

    def get_sender_name(self, obj):
        return obj.sender.get_full_name() or obj.sender.email.split('@')[0]

    def get_is_mine(self, obj):
        request = self.context.get('request')
        return request and obj.sender_id == request.user.id

    def create(self, validated_data):
        validated_data['sender'] = self.context['request'].user
        return super().create(validated_data)


class ConversationSerializer(serializers.ModelSerializer):
    seller_name = serializers.SerializerMethodField()
    buyer_name = serializers.SerializerMethodField()
    car_label = serializers.SerializerMethodField()
    last_message_content = serializers.SerializerMethodField()
    last_message_at = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    i_am_seller = serializers.SerializerMethodField()
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = ['id', 'seller', 'seller_name', 'buyer_name', 'car', 'car_label',
                  'last_message_content', 'last_message_at', 'unread_count',
                  'i_am_seller', 'messages', 'created_at', 'updated_at']

    def get_seller_name(self, obj):
        return obj.seller.name

    def get_buyer_name(self, obj):
        return obj.buyer.get_full_name() or obj.buyer.email.split('@')[0]

    def get_car_label(self, obj):
        if obj.car:
            return f'{obj.car.make} {obj.car.model} {obj.car.year}'
        return None

    def get_last_message_content(self, obj):
        last = obj.messages.last()
        return last.content if last else None

    def get_last_message_at(self, obj):
        last = obj.messages.last()
        return last.created_at if last else obj.created_at

    def get_i_am_seller(self, obj):
        request = self.context.get('request')
        if not request:
            return False
        return obj.seller.user_id == request.user.id

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request:
            return 0
        if obj.seller.user_id == request.user.id:
            return obj.unread_count_for_seller
        return obj.unread_count_for_buyer


class RentalRequestSerializer(serializers.ModelSerializer):
    car = CarSerializer(read_only=True)
    car_id = serializers.PrimaryKeyRelatedField(
        queryset=Car.objects.all(), source='car', write_only=True
    )
    renter_name = serializers.SerializerMethodField()
    seller_name = serializers.SerializerMethodField()
    nb_days = serializers.ReadOnlyField()
    status_display = serializers.SerializerMethodField()

    class Meta:
        model = RentalRequest
        fields = [
            'id', 'car', 'car_id', 'renter_name', 'seller_name',
            'start_date', 'end_date', 'nb_days', 'total_price',
            'status', 'status_display', 'renter_message', 'rejection_reason',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['renter_name', 'seller_name', 'total_price', 'nb_days', 'status_display']

    def get_renter_name(self, obj):
        return obj.renter.get_full_name() or obj.renter.email.split('@')[0]

    def get_seller_name(self, obj):
        return obj.seller.name

    def get_status_display(self, obj):
        return obj.get_status_display()

    def create(self, validated_data):
        request = self.context['request']
        validated_data['renter'] = request.user
        car = validated_data['car']
        validated_data['seller'] = car.seller
        return super().create(validated_data)
