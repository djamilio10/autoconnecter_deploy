"""Configuration gunicorn pour la production.

Lancement : gunicorn autoconnect.wsgi -c gunicorn.conf.py

Ajuste automatiquement le nombre de workers au nombre de CPU. Sur un PaaS qui
fixe le nombre de cœurs (Railway/Heroku), surcharger via les variables d'env
WEB_CONCURRENCY / GUNICORN_THREADS.
"""
import multiprocessing
import os

# Port fourni par le PaaS (Railway/Heroku exposent $PORT).
bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"

# ── Workers ───────────────────────────────────────────────────────────────────
# Règle classique : (2 × cœurs) + 1. Surchargée par WEB_CONCURRENCY si défini.
workers = int(os.getenv('WEB_CONCURRENCY', (multiprocessing.cpu_count() * 2) + 1))

# Worker à threads : chaque worker gère plusieurs requêtes I/O en parallèle
# (utile pour les requêtes en attente de DB/réseau) sans multiplier les process.
worker_class = 'gthread'
threads = int(os.getenv('GUNICORN_THREADS', '4'))

# ── Robustesse ────────────────────────────────────────────────────────────────
# Recycle les workers périodiquement : évite l'accumulation mémoire sur le long
# terme (fuites éventuelles dans des libs). Le jitter évite que tous les workers
# redémarrent en même temps.
max_requests = 1000
max_requests_jitter = 100

# Tue un worker bloqué au-delà de 30 s (évite qu'une requête pendante fige un worker).
timeout = 30
graceful_timeout = 30
keepalive = 5

# ── Logs ──────────────────────────────────────────────────────────────────────
accesslog = '-'   # stdout
errorlog = '-'    # stderr
loglevel = os.getenv('GUNICORN_LOGLEVEL', 'info')
