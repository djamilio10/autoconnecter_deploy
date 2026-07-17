# Tests de charge — AUTOCONNECT

Mesurer combien d'utilisateurs simultanés l'application encaisse réellement,
avec [k6](https://k6.io) (open-source, gratuit).

## 1. Installer k6

| Système | Commande |
|---|---|
| Windows | `winget install k6 --source winget` (ou `choco install k6`) |
| macOS | `brew install k6` |
| Linux (Debian/Ubuntu) | voir https://grafana.com/docs/k6/latest/set-up/install-k6/ |

Vérifier : `k6 version`

## 2. Préparer un environnement de test

> ⚠️ **Ne jamais tester la production pendant que de vrais utilisateurs l'utilisent.**
> Déployez une copie (staging) avec la même config et des données de démo
> (`python manage.py seed_data`).

Deux points à régler sur le staging avant un test de capacité :

1. **Rate-limiting** : vos limites (ex. login 5/min/IP) feront renvoyer des `429`
   dès que k6 tape fort depuis une seule IP. Pour un test de *capacité brute*,
   désactivez-le temporairement sur le staging :
   ```bash
   # variable d'env sur le staging uniquement
   RATELIMIT_ENABLE=False
   ```
2. **Email / inscriptions** : ne testez pas `/register` en masse (ça enverrait des
   milliers d'emails via Gmail → blocage). Le script `browse.js` ne teste que la
   navigation (lecture), ce qui représente l'essentiel du trafic réel.

## 3. Lancer le test

```bash
# Navigation réaliste, montée jusqu'à 3000 utilisateurs simultanés
k6 run -e BASE_URL=https://staging.autoconnect.sn loadtest/browse.js
```

Le scénario monte progressivement : 200 → 500 → 1500 → 3000 VUs, maintient 3000
pendant 2 min, puis redescend (~11 min au total). On observe **à quel palier** la
latence ou les erreurs se dégradent.

## 4. Lire les résultats

À la fin, k6 affiche un récapitulatif. Les lignes qui comptent :

```
http_req_duration..............: avg=45ms  p(95)=210ms  p(99)=480ms   ← latence
http_req_failed................: 0.12%                                 ← % d'échecs
errors.........................: 0.08%                                 ← nos checks
http_reqs......................: 142000  (≈ 230/s)                     ← débit (RPS)
vus............................: 3000                                  ← utilisateurs simultanés
```

- **p(95)** = 95% des requêtes sont plus rapides que cette valeur. C'est l'indicateur
  clé (mieux que la moyenne, qui masque les pics). Objectif : **< 800 ms**.
- **http_req_failed** : doit rester **< 2%**. S'il grimpe → le serveur sature.
- **RPS** (`http_reqs`/s) : le débit réel encaissé.
- En bas, `✓ thresholds` (vert) ou `✗` (rouge) : le test **passe ou échoue** selon
  les seuils définis dans `browse.js`.

**Comment interpréter :**
- Si p(95) reste bas et 0 erreur jusqu'à 3000 VUs → ✅ ça tient.
- Si la latence explose à partir de, disons, 1500 VUs → c'est votre **plafond
  actuel** : il faut alors scaler (plus d'instances, PgBouncer, CDN — cf.
  `backend/DEPLOYMENT.md`).

## 5. Aller plus loin

- **Test authentifié** : générer un token JWT et l'envoyer en header
  `Authorization: Bearer ...` pour tester les endpoints connectés.
- **Test d'endurance** (soak) : tenir une charge modérée 1–2 h pour détecter les
  fuites mémoire.
- **Test de pic** (spike) : monter brutalement à 3000 d'un coup pour simuler un
  afflux (campagne pub, etc.).
- **k6 Cloud** : pour générer la charge depuis plusieurs régions/machines si une
  seule machine de test ne suffit pas à produire 3000 VUs.

## Conseils

- Lancez k6 depuis une **machine différente** du serveur testé (sinon vous mesurez
  les deux qui se gênent).
- Une machine de test correcte génère facilement 3000 VUs ; au-delà de ~10 000,
  envisagez le mode distribué.
- Surveillez **en parallèle** les métriques du serveur (CPU, RAM, connexions DB)
  pendant le test : c'est là qu'on voit *quelle* ressource sature en premier.
