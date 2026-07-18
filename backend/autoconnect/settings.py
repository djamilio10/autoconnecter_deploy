import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def env(key, default=None, cast=str):
    val = os.getenv(key, default)
    if val is None:
        return None
    if cast is bool:
        return str(val).strip().lower() in ('1', 'true', 'yes', 'on')
    if cast is list:
        return [v.strip() for v in str(val).split(',') if v.strip()]
    return cast(val)


# ── Sécurité ──────────────────────────────────────────────────────────────────
DEBUG = env('DEBUG', 'True', cast=bool)

SECRET_KEY = env('SECRET_KEY')
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError(
            'SECRET_KEY est obligatoire en production. Définissez-la dans la variable '
            "d'environnement SECRET_KEY (>=50 caractères aléatoires)."
        )
    SECRET_KEY = 'dev-only-secret-change-me-in-production'

ALLOWED_HOSTS = env('ALLOWED_HOSTS', '*', cast=list)
if not DEBUG and ALLOWED_HOSTS == ['*']:
    raise RuntimeError(
        'ALLOWED_HOSTS=* est interdit en production. Définissez la liste des hôtes autorisés.'
    )

# Derrière un reverse proxy (Railway, Heroku, etc.), on doit faire confiance au header
# X-Forwarded-Proto pour que request.is_secure() fonctionne et que le rate-limit reçoive
# la vraie IP cliente via X-Forwarded-For.
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = True  # force HTTP → HTTPS
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True

# ── Applications ──────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_ratelimit',
    'users',
    'cars',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.gzip.GZipMiddleware',  # compresse les réponses JSON (perf réseau)
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # sert /static/ en prod
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'autoconnect.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'autoconnect.wsgi.application'

# ── Base de données ───────────────────────────────────────────────────────────
# Prod : PostgreSQL via DATABASE_URL (postgres://user:pass@host:5432/db).
# Dev  : repli SQLite si DATABASE_URL absent.
# conn_max_age garde les connexions ouvertes entre requêtes (évite de rouvrir une
# connexion Postgres à chaque requête → gros gain de latence) ; conn_health_checks
# vérifie qu'une connexion réutilisée est toujours vivante.
DATABASE_URL = env('DATABASE_URL', '')

# En Docker, POSTGRES_* sont fournis via env_file : on construit l'URL ici,
# sans dépendre de l'interpolation docker-compose (qui exigerait un fichier .env).
if not DATABASE_URL:
    pg_user = env('POSTGRES_USER', '')
    pg_pass = env('POSTGRES_PASSWORD', '')
    pg_db = env('POSTGRES_DB', '')
    pg_host = env('POSTGRES_HOST', 'db')
    pg_port = env('POSTGRES_PORT', '5432')
    if pg_user and pg_pass and pg_db:
        DATABASE_URL = f'postgresql://{pg_user}:{pg_pass}@{pg_host}:{pg_port}/{pg_db}?sslmode=disable'

if DATABASE_URL:
    import dj_database_url
    DATABASES = {
        'default': dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,
            # TLS désactivé par défaut : la base tourne sur le réseau Docker
            # interne privé. Mettre DB_SSL_REQUIRE=True si la base est distante.
            ssl_require=env('DB_SSL_REQUIRE', 'False', cast=bool),
        )
    }
else:
    if not DEBUG:
        raise RuntimeError(
            'DATABASE_URL est obligatoire en production (PostgreSQL). '
            'SQLite ne supporte pas la concurrence en écriture nécessaire en prod.'
        )
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / env('DB_NAME', 'db.sqlite3'),
        }
    }

AUTH_USER_MODEL = 'users.User'

# ── Hachage des mots de passe ─────────────────────────────────────────────────
# Argon2 (recommandé OWASP : mémoire-dur, résistant GPU) est plus rapide ET plus
# sûr que PBKDF2-600k. On l'active automatiquement si le paquet `argon2-cffi` est
# installé (cf. requirements.txt), avec repli transparent sur PBKDF2. Les anciens
# hachages PBKDF2 restent valides et sont ré-encodés en Argon2 à la connexion.
try:
    import argon2  # noqa: F401
    PASSWORD_HASHERS = [
        'django.contrib.auth.hashers.Argon2PasswordHasher',
        'django.contrib.auth.hashers.PBKDF2PasswordHasher',
        'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
        'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
    ]
except ImportError:
    # Dev sans argon2-cffi : PBKDF2 par défaut de Django (600k itérations, OWASP).
    pass

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ── Internationalisation ──────────────────────────────────────────────────────
LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Africa/Dakar'
USE_I18N = True
USE_TZ = True

# ── Fichiers statiques (WhiteNoise) ───────────────────────────────────────────
# WhiteNoise sert les statiques (admin Django, etc.) en production sans dépendre
# d'un serveur web externe. Sans lui, DEBUG=False renvoie des 404 sur /static/.
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        # Compresse les statiques sans manifeste hashé (robuste : ne plante pas
        # si un fichier référencé manque, contrairement au Manifest storage).
        'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
    },
}

# ── Fichiers media (uploads utilisateur) ──────────────────────────────────────
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
# NOTE production : servir les médias via l'app (cf. urls.py) fonctionne mais ne
# passe pas à l'échelle et le disque d'un PaaS (Railway) est éphémère → les
# uploads sont perdus au redéploiement. Pour la prod à fort trafic, configurez un
# stockage objet (S3 / Cloudinary) + CDN. Voir DEPLOYMENT.md.

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ── DRF + JWT ─────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=env('JWT_ACCESS_MINUTES', '60', cast=int)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=env('JWT_REFRESH_DAYS', '7', cast=int)),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ── Cookie refresh-token (anti-XSS) ───────────────────────────────────────────
# Le refresh token est stocké en cookie HttpOnly+Secure : inaccessible au JS,
# donc à l'abri d'un vol par XSS. L'access token reste retourné en JSON et est
# conservé en mémoire côté frontend (perdu au refresh, restauré via /token/refresh).
REFRESH_COOKIE_NAME = 'ac_refresh'
REFRESH_COOKIE_MAX_AGE = int(timedelta(days=env('JWT_REFRESH_DAYS', '7', cast=int)).total_seconds())
# Scope minimal : le cookie n'est envoyé qu'aux endpoints qui en ont besoin
# (/api/token/refresh/, /api/auth/logout/) — réduit l'exposition CSRF.
REFRESH_COOKIE_PATH = '/api/'
REFRESH_COOKIE_SECURE = not DEBUG  # exige HTTPS en prod
# Cross-site (Netlify frontend ↔ Railway backend) impose SameSite=None + Secure.
# En dev (SameSite=Lax), utilisez le MÊME hostname côté front et back (les deux en
# 'localhost' OU les deux en '127.0.0.1'). Mélanger les deux crée un cross-site
# qui bloque l'envoi du cookie sur les POST.
REFRESH_COOKIE_SAMESITE = 'None' if not DEBUG else 'Lax'

# ── CORS ──────────────────────────────────────────────────────────────────────
# En prod : CORS_ALLOW_ALL forcé à False ; il faut renseigner CORS_ALLOWED_ORIGINS.
CORS_ALLOW_ALL_ORIGINS = env('CORS_ALLOW_ALL', 'False', cast=bool) if DEBUG else False
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173', cast=list)

CSRF_TRUSTED_ORIGINS = env('CSRF_TRUSTED_ORIGINS', 'http://localhost:5173', cast=list)

if not DEBUG and not CORS_ALLOWED_ORIGINS:
    raise RuntimeError('CORS_ALLOWED_ORIGINS doit être défini en production.')

# ── Rate limiting ─────────────────────────────────────────────────────────────
# django-ratelimit exige un cache atomique : Redis ou Memcached en prod.
# En dev (DEBUG=True, un seul process) LocMemCache fonctionne ; on silence le check.
RATELIMIT_USE_CACHE = 'default'
REDIS_URL = env('REDIS_URL', '')
# W001 : django-ratelimit ne « supporte officiellement » que memcached, mais Redis
# fournit bien l'incrément atomique requis → faux positif, silencé globalement.
SILENCED_SYSTEM_CHECKS = ['django_ratelimit.W001']
if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
        }
    }
else:
    if not DEBUG:
        raise RuntimeError(
            'REDIS_URL est obligatoire en production : django-ratelimit exige un cache '
            'partagé (atomic increment) entre les workers gunicorn. Configurez Redis.'
        )
    CACHES = {
        'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}
    }
    # LocMemCache n'est pas un cache partagé : E003 s'applique mais convient en dev.
    SILENCED_SYSTEM_CHECKS = ['django_ratelimit.W001', 'django_ratelimit.E003']

# ── Email (Gmail SMTP) ────────────────────────────────────────────────────────
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = env('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = f'AUTOCONNECT <{env("EMAIL_HOST_USER", "noreply@autoconnect.sn")}>'

# ── PayTech (paiement Premium) ────────────────────────────────────────────────
# Passerelle de paiement sénégalaise : cartes Visa/Mastercard + mobile money
# (Orange Money, Wave, Free Money, etc.). Chaque paiement est UNIQUE : PayTech ne
# fait pas de prélèvement récurrent → le renouvellement Premium se fait sur action
# du vendeur (cf. commande process_premium_subscriptions).
PAYTECH_API_KEY = env('PAYTECH_API_KEY', '')
PAYTECH_SECRET_KEY = env('PAYTECH_SECRET_KEY', '')
PAYTECH_REQUEST_URL = 'https://paytech.sn/api/payment/request-payment'
# 'test' par défaut en dev (aucun débit réel), 'prod' en production.
PAYTECH_ENV = env('PAYTECH_ENV', 'test' if DEBUG else 'prod')
# URL du frontend (pages de retour) et URL publique HTTPS du backend (IPN webhook).
FRONTEND_URL = env('FRONTEND_URL', 'http://localhost:5173')
BACKEND_PUBLIC_URL = env('BACKEND_PUBLIC_URL', '')

# ── Paramètres de l'abonnement Premium ────────────────────────────────────────
PREMIUM_PRICE_XOF = env('PREMIUM_PRICE_XOF', '5000', cast=int)   # prix mensuel (FCFA)
PREMIUM_GRACE_DAYS = env('PREMIUM_GRACE_DAYS', '2', cast=int)    # grâce après échéance
PREMIUM_REMINDER_DAYS_BEFORE = env('PREMIUM_REMINDER_DAYS_BEFORE', '1', cast=int)
PREMIUM_CGU_VERSION = 'v1-2026-06'
