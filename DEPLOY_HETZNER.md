# Déploiement AutoConnect sur Hetzner (VPS unique, Docker Compose)

Domaine : **autoconnect.site** (déjà acheté).

## 1. Créer le VPS

- Hetzner Cloud → nouveau serveur **CX22** (2 vCPU, 4 Go RAM), image **Ubuntu 24.04**,
  région au choix (Falkenstein/Nuremberg).
- Noter l'**IP publique** attribuée.
- Activer l'option **Sauvegardes** (+20% du prix, recommandé).

## 2. Pointer le DNS

Chez le registrar où `autoconnect.site` a été acheté, créer :

| Type | Nom | Valeur |
|---|---|---|
| A | `@` | IP du VPS |
| A | `www` | IP du VPS |

Attendre la propagation (`nslookup autoconnect.site` doit renvoyer l'IP du VPS)
avant l'étape 5, sinon Caddy ne pourra pas générer le certificat HTTPS.

## 3. Préparer le serveur

```bash
ssh root@<IP_DU_VPS>

# Docker + Compose plugin
curl -fsSL https://get.docker.com | sh

# Pare-feu minimal
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## 4. Cloner le projet

```bash
mkdir -p /opt/autoconnect && cd /opt/autoconnect
git clone https://github.com/djamilio10/autoconnecter_deploy.git .
cp .env.production.example .env.production
nano .env.production   # remplir SECRET_KEY, POSTGRES_PASSWORD, EMAIL_*, PAYTECH_* (clés PROD)
```

- `SECRET_KEY` : générer avec `openssl rand -base64 48`
- `POSTGRES_PASSWORD` : mot de passe fort, ne réutiliser nulle part ailleurs
- `PAYTECH_API_KEY` / `PAYTECH_SECRET_KEY` : les clés de **production** PayTech (pas les clés test)

## 5. Lancer la stack

```bash
docker compose up -d --build
docker compose logs -f backend   # vérifier que migrate + collectstatic passent sans erreur
```

Caddy obtient automatiquement le certificat Let's Encrypt pour `autoconnect.site`
dès que le DNS pointe vers le VPS — rien à configurer manuellement.

## 6. Créer le compte admin

⚠️ Ne pas utiliser `createsuperuser` seul : il donne accès à `/admin/` (Django)
mais **pas** au tableau de bord admin de l'application React (qui se base sur
le champ `user_type`, pas sur `is_staff`) — c'est ce qui causait le problème de
"lien introuvable" rencontré précédemment. Utiliser plutôt :

```bash
docker compose exec backend python manage.py create_admin --email admin@autoconnect.site
```

(mot de passe demandé de façon masquée). Cette commande crée un compte valable
pour les deux à la fois :

- **Admin Django** (gestion brute de la base) → `https://autoconnect.site/admin/`
- **Tableau de bord admin de l'app** → pas d'URL directe (c'est une SPA sans
  routeur), il faut se **connecter normalement** sur `https://autoconnect.site`
  avec cet email : le bouton **"Tableau de bord admin"** apparaît alors dans le
  menu du haut, à côté du profil.

Relancer la même commande avec le même email plus tard promeut un compte
existant en admin (idempotent, ne recrée pas de doublon).

## 7. Planifier le renouvellement Premium (cron quotidien)

```bash
crontab -e
```

Ajouter :

```
0 7 * * * cd /opt/autoconnect && docker compose exec -T backend python manage.py process_premium_subscriptions >> /var/log/autoconnect-premium.log 2>&1
```

## 8. Vérifications finales

- `https://autoconnect.site` → l'app React se charge
- `https://autoconnect.site/admin/` → admin Django accessible
- Un paiement Premium test en mode `prod` PayTech → l'IPN doit activer l'abonnement
  (nécessite `BACKEND_PUBLIC_URL=https://autoconnect.site` déjà dans `.env.production`)

## Mises à jour futures

```bash
cd /opt/autoconnect
git pull
docker compose up -d --build
```

## Sauvegardes base de données (en plus du snapshot Hetzner)

```bash
docker compose exec -T db pg_dump -U autoconnect autoconnect > backup-$(date +%F).sql
```

À planifier en cron également, avec envoi vers un stockage externe (ex. Cloudflare R2)
si vous voulez survivre à la perte totale du VPS.
