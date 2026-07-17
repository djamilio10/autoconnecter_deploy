"""Utilitaires sécurité partagés (anti-CSRF, permissions, etc.)."""
from django.conf import settings
from rest_framework.permissions import BasePermission


class IsPlatformAdmin(BasePermission):
    """Autorise uniquement les administrateurs de la plateforme.

    Centralise le contrôle d'accès admin (is_staff OU user_type == 'admin') en une
    permission DRF réutilisable. Évite la duplication manuelle du check dans chaque
    vue admin — et donc le risque d'exposer une nouvelle vue en oubliant le contrôle.
    """
    message = 'Accès refusé'

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_staff or getattr(user, 'user_type', None) == 'admin')
        )


def is_origin_allowed(request):
    """Anti-CSRF léger : valide le header Origin de la requête contre la
    whitelist (CORS_ALLOWED_ORIGINS ∪ CSRF_TRUSTED_ORIGINS).

    - Origin absent → accepté (couvre les requêtes same-origin où le navigateur
      omet le header, et les outils server-to-server).
    - Origin 'null' (iframe sandboxée, file://) → refusé.
    - Origin présent et hors whitelist → refusé.

    À utiliser sur les vues qui s'authentifient via cookie (refresh, logout),
    car SameSite=None expose le cookie aux requêtes cross-site.
    """
    origin = request.META.get('HTTP_ORIGIN')
    if not origin:
        return True
    allowed = set(getattr(settings, 'CORS_ALLOWED_ORIGINS', []) or [])
    allowed.update(getattr(settings, 'CSRF_TRUSTED_ORIGINS', []) or [])
    return origin in allowed
