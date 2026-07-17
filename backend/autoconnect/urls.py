from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve as media_serve
from django.http import JsonResponse
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .security import is_origin_allowed


def ratelimited_error(request, exception):
    return JsonResponse(
        {'detail': 'Trop de tentatives. Réessayez dans quelques instants.'},
        status=429,
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def token_refresh_cookie(request):
    """Refresh JWT : lit le refresh-token depuis le cookie HttpOnly (jamais
    accessible au JS), renvoie un nouvel access dans le body et rotate le
    refresh-cookie. Origin check anti-CSRF."""
    if not is_origin_allowed(request):
        return Response({'detail': 'Origine non autorisée.'}, status=status.HTTP_403_FORBIDDEN)
    cookie_name = settings.REFRESH_COOKIE_NAME
    refresh = request.COOKIES.get(cookie_name)
    if not refresh:
        return Response({'detail': 'Refresh token absent.'}, status=status.HTTP_401_UNAUTHORIZED)
    serializer = TokenRefreshSerializer(data={'refresh': refresh})
    try:
        serializer.is_valid(raise_exception=True)
    except (InvalidToken, TokenError):
        response = Response({'detail': 'Refresh token invalide.'}, status=status.HTTP_401_UNAUTHORIZED)
        response.delete_cookie(
            key=cookie_name,
            path=settings.REFRESH_COOKIE_PATH,
            samesite=settings.REFRESH_COOKIE_SAMESITE,
        )
        return response

    data = serializer.validated_data
    new_refresh = data.pop('refresh', None)
    response = Response({'access': data['access']})
    if new_refresh:
        response.set_cookie(
            key=cookie_name,
            value=new_refresh,
            max_age=settings.REFRESH_COOKIE_MAX_AGE,
            path=settings.REFRESH_COOKIE_PATH,
            secure=settings.REFRESH_COOKIE_SECURE,
            httponly=True,
            samesite=settings.REFRESH_COOKIE_SAMESITE,
        )
    return response

@api_view(['GET'])
@permission_classes([AllowAny])
def api_root(request):
    return Response({
        'message': 'AutoConnect API',
        'version': '1.0',
        'endpoints': {
            'admin': '/admin/',
            'auth': '/api/auth/',
            'cars': '/api/cars/',
            'sellers': '/api/sellers/',
            'token_refresh': '/api/token/refresh/',
        }
    })

handler429 = ratelimited_error

urlpatterns = [
    path('', api_root),
    path('admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/', include('cars.urls')),
    path('api/token/refresh/', token_refresh_cookie),
    # Service des médias : fonctionne en DEBUG comme en prod (contrairement au
    # helper static() qui renvoie [] quand DEBUG=False → 404 sur les images).
    # ⚠️ Pour la prod à l'échelle, préférer un stockage objet + CDN (cf. DEPLOYMENT.md).
    re_path(r'^media/(?P<path>.*)$', media_serve, {'document_root': settings.MEDIA_ROOT}),
]
