# Déploiement — AUTOCONNECT (backend)

## Variables d'environnement obligatoires en production

| Variable | Rôle | Exemple |
|---|---|---|
| `DEBUG` | Doit être `False` en prod | `False` |
| `SECRET_KEY` | Clé Django (≥ 50 caractères aléatoires) | `openssl rand -base64 48` |
| `ALLOWED_HOSTS` | Domaines autorisés (séparés par virgule) | `autoconnect.sn,www.autoconnect.sn` |
| `DATABASE_URL` | **PostgreSQL** (obligatoire en prod) | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Cache partagé pour le rate-limit | `redis://default:pass@host:6379` |
| `CORS_ALLOWED_ORIGINS` | Origine(s) du frontend | `https://ton-app.netlify.app` |
| `CSRF_TRUSTED_ORIGINS` | Idem pour CSRF | `https://ton-app.netlify.app` |
| `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | SMTP Gmail (mot de passe d'application) | — |
| `PAYTECH_API_KEY` / `PAYTECH_SECRET_KEY` | Clés API PayTech (paiement Premium) | — |
| `PAYTECH_ENV` | `test` (paiements simulés) ou `prod` (réels) | `prod` |
| `FRONTEND_URL` | Base du frontend (pages de retour PayTech) | `https://ton-app.netlify.app` |
| `BACKEND_PUBLIC_URL` | URL **HTTPS publique** du backend, requise pour l'IPN PayTech | `https://autoconnect-api.up.railway.app` |

> Le serveur **refuse de démarrer** en production si `SECRET_KEY`, `DATABASE_URL`,
> `REDIS_URL`, `ALLOWED_HOSTS` ou `CORS_ALLOWED_ORIGINS` sont absents/invalides.

> **PayTech / IPN** : PayTech **exige une URL IPN HTTPS** pour accepter la demande de
> paiement. Elle est dérivée de `BACKEND_PUBLIC_URL` (sinon de la requête courante si
> elle est déjà en HTTPS, cas prod derrière proxy TLS). En production, renseigner
> `BACKEND_PUBLIC_URL` (ex. `https://autoconnect-api.up.railway.app`) garantit que le
> checkout fonctionne **et** que le Premium s'active automatiquement via le webhook
> `…/api/premium/ipn/`. En dev local sans URL publique, le checkout utilise une IPN
> factice (le lien de paiement s'affiche, mais l'activation se fait via le dashboard
> admin) ; pour tester l'IPN réelle en local, exposer le backend via un tunnel
> (ngrok) et mettre son URL HTTPS dans `BACKEND_PUBLIC_URL`.

> **Certificats TLS** : `truststore` (cf. requirements) est injecté au démarrage pour
> valider les certificats via le magasin de l'OS — corrige les
> `CERTIFICATE_VERIFY_FAILED` rencontrés derrière un antivirus/proxy interceptant le
> TLS (fréquent en dev Windows). Aucune configuration nécessaire.

## Abonnements Premium — tâche planifiée (obligatoire)

Le renouvellement Premium est **manuel** (PayTech ne fait pas de prélèvement
récurrent). Une commande quotidienne envoie les rappels (J-1), les avis de grâce
et désactive les abonnements expirés après le délai de grâce :

```bash
python manage.py process_premium_subscriptions          # exécution réelle
python manage.py process_premium_subscriptions --dry-run # simulation (sans email/écriture)
```

À planifier **une fois par jour** :
- **Railway** : un service *Cron* avec la commande ci-dessus.
- **GitHub Actions** : un workflow `schedule:` quotidien qui exécute la commande.
- **Windows (dev)** : Planificateur de tâches → action lançant `venv\Scripts\python.exe manage.py process_premium_subscriptions`.

La commande est **idempotente** : chaque email n'est envoyé qu'une fois (drapeaux
`premium_renewal_reminded_at` / `premium_expiry_notified_at`).

## Bascule SQLite → PostgreSQL

En dev, sans `DATABASE_URL`, l'app utilise SQLite automatiquement. En prod, il
suffit de définir `DATABASE_URL` ; aucune modification de code n'est nécessaire.

```bash
# 1. Installer les dépendances (inclut psycopg2, argon2-cffi, redis, etc.)
pip install -r requirements.txt

# 2. Définir DATABASE_URL vers le PostgreSQL de prod, puis appliquer le schéma
python manage.py migrate

# 3. Créer un compte administrateur
python manage.py createsuperuser

# 4. (optionnel) Recharger les données de démonstration
python manage.py seed_data

# 5. Collecter les fichiers statiques (servis par WhiteNoise) puis lancer gunicorn
python manage.py collectstatic --noinput
gunicorn autoconnect.wsgi -c gunicorn.conf.py
```

`gunicorn.conf.py` règle automatiquement le nombre de workers selon les CPU et
recycle les workers. Surcharges possibles via les variables d'env :
`WEB_CONCURRENCY` (nb de workers), `GUNICORN_THREADS`, `PORT`.

## Fichiers statiques & médias

- **Statiques** (admin Django, etc.) : servis par **WhiteNoise** (intégré, rien à
  faire à part `collectstatic`).
- **Médias** (uploads : avatars, photos de voitures, logos) : servis par l'app en
  l'état (fonctionne, mais **deux limites en prod**) :
  1. Le disque d'un PaaS (Railway/Heroku) est **éphémère** → les uploads sont
     **perdus au redéploiement**.
  2. Servir les médias via l'app ne passe pas à l'échelle.

  ➜ **Pour la production à fort trafic**, configurer un **stockage objet**
  (Amazon S3, Cloudflare R2, Cloudinary) + **CDN**. Côté Django : ajouter
  `django-storages` + `boto3` et pointer `STORAGES['default']` vers le backend S3.

### Migrer les données existantes depuis SQLite (si besoin)

```bash
# Avec l'ancienne base SQLite active (DATABASE_URL non défini)
python manage.py dumpdata --natural-primary --natural-foreign \
  --exclude contenttypes --exclude auth.permission \
  --exclude admin.logentry --indent 2 > dump.json

# Puis avec DATABASE_URL pointant vers PostgreSQL
python manage.py migrate
python manage.py loaddata dump.json
```

## Optimisations actives (rappel)

- **PostgreSQL** + connexions persistantes (`CONN_MAX_AGE=600`) + `CONN_HEALTH_CHECKS`
- **Argon2** pour le hachage des mots de passe (activé si `argon2-cffi` installé)
- **Redis** pour un rate-limit partagé entre workers
- **Envoi d'email asynchrone** (ne bloque pas les requêtes)
- **GZip** sur les réponses
- **Index** DB sur les champs filtrés/triés
- Requêtes **sans N+1** (select_related / prefetch_related / annotations)
