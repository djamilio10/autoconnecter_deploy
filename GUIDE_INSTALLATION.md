# 🚀 Guide d'installation — AutoConnect (pour collaborer)

Ce guide explique comment lancer le projet sur un autre PC **avec les mêmes données**
(comptes, annonces, photos).

---

## 1. Avant de zipper (côté expéditeur)

Le dossier contient 2 sous-dossiers **à NE PAS envoyer** (ils sont lourds et liés à
ton PC — ils seront recréés chez le destinataire) :

| ❌ À supprimer avant de zipper | Pourquoi |
|---|---|
| `backend/venv/` (et `backend/env/` s'il existe) | Contient des chemins figés vers ton PC → cassé ailleurs. Recréé en 1 commande. |
| `frontend/node_modules/` | ~49 Mo, réinstallé avec `npm install`. |

| ✅ À GARDER absolument dans le zip | Contenu |
|---|---|
| `backend/db.sqlite3` | **La base de données = toutes les données** (comptes, annonces…). |
| `backend/media/` | **Les photos** des voitures, avatars, logos. |
| `backend/.env` | La configuration (clés PayTech, email, etc.). |
| Tout le reste du code (`backend/`, `frontend/src`, etc.) | Le projet. |

> 💡 Astuce : supprime juste `venv` et `node_modules`, puis zippe le dossier `autoconnect`.

---

## 2. Prérequis (côté destinataire)

À installer une seule fois sur le PC :

- **Python 3.11** → https://www.python.org/downloads/ (coche « Add Python to PATH » à l'installation)
- **Node.js 18+** → https://nodejs.org/ (version LTS)

Vérifier dans un terminal : `python --version` et `node --version`.

---

## 3. Installation du backend (Django)

Ouvrir un terminal **dans le dossier `backend/`** :

### Windows (PowerShell) — méthode recommandée (sans activation)
Sur Windows, l'activation du venv déclenche souvent une **erreur de sécurité**
(`UnauthorizedAccess`) car les scripts sont bloqués par défaut. Le plus simple est de
**ne pas activer** et d'appeler directement le Python du venv par son chemin :

```powershell
python -m venv venv
.\venv\Scripts\python.exe -m pip install --upgrade pip
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py runserver
```

> ❌ N'utilise PAS `source venv/Scripts/activate` : `source` est une commande
> **Mac/Linux**, elle n'existe pas sur Windows.
>
> Si tu préfères vraiment activer le venv, autorise d'abord les scripts (une seule fois) :
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```
> (répondre `O`), puis `.\venv\Scripts\Activate.ps1`.

### macOS / Linux
```bash
python3 -m venv venv
source venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

> ⚠️ **Ne PAS lancer `python manage.py seed_data`** : ça rajouterait des annonces de
> démonstration. Les données réelles sont déjà dans le `db.sqlite3` fourni.
>
> `migrate` ne fait rien si la base est déjà à jour (cas normal ici) — c'est juste une
> sécurité.

Le backend tourne sur **http://127.0.0.1:8000**.

---

## 4. Installation du frontend (React / Vite)

Ouvrir un **second terminal dans le dossier `frontend/`** :

```bash
npm install
npm run dev
```

Le site est accessible sur **http://localhost:3000**.

---

## 5. Comptes de connexion (données fournies)

| Rôle | Email | Mot de passe |
|---|---|---|
| Vendeur | `motor10@gmail.com` | `Passer@2` |
| Acheteur / Admin | `ibrahima@gmail.com` | `Passer@2` |
| Admin | `admin@autoconnect.sn` | *(mot de passe d'origine)* |

---

## 6. Bon à savoir

- **Les deux terminaux doivent rester ouverts** pendant le travail (un pour le backend,
  un pour le frontend).
- **Pour relancer plus tard** : il suffit d'activer le venv (`.\venv\Scripts\activate`)
  puis `python manage.py runserver` côté backend, et `npm run dev` côté frontend. Pas
  besoin de tout réinstaller.
- **La base `db.sqlite3` est un fichier local** : chacun travaille sur sa copie. Vos
  modifications de données ne se synchronisent pas automatiquement entre vos deux PC —
  pour partager du nouveau code, utilisez plutôt **Git** ; pour repartager des données,
  renvoyez le `db.sqlite3` + `media/`.
- **Certificats / antivirus** : le projet inclut `truststore` (dans `requirements.txt`)
  qui règle automatiquement les erreurs de certificat SSL en local (ex. paiement PayTech).
  Rien à configurer.
- **Sécurité** : le `.env` contient des clés secrètes (PayTech, email). À ne partager
  qu'avec une personne de confiance, et à ne jamais publier sur internet/GitHub.
```
