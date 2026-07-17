// Test de charge AUTOCONNECT — scénario de navigation réaliste.
//
// Simule des visiteurs qui parcourent le catalogue : la majorité du trafic réel
// d'un site de petites annonces. Chaque "utilisateur virtuel" (VU) enchaîne des
// actions avec un temps de réflexion (sleep) entre chaque — comme un vrai humain.
//
// Lancement :
//   k6 run -e BASE_URL=https://staging.autoconnect.sn loadtest/browse.js
//
// ⚠️ À lancer contre un environnement de STAGING, jamais la prod avec de vrais
//    utilisateurs. Les rate-limits peuvent renvoyer des 429 (voir README).

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

// Métriques personnalisées
const errorRate = new Rate('errors');
const browseLatency = new Trend('browse_latency', true);

export const options = {
  // Montée en charge progressive : on observe à partir de quel palier ça se dégrade.
  stages: [
    { duration: '1m', target: 200 },   // échauffement : 0 → 200 VUs
    { duration: '2m', target: 500 },   // 500 utilisateurs simultanés
    { duration: '2m', target: 1500 },  // 1500
    { duration: '3m', target: 3000 },  // 3000 — l'objectif
    { duration: '2m', target: 3000 },  // palier : on tient 3000 pendant 2 min
    { duration: '1m', target: 0 },     // décrue
  ],
  // Critères de réussite/échec automatiques (le test "échoue" s'ils sont dépassés).
  thresholds: {
    http_req_duration: ['p(95)<800'],  // 95% des requêtes sous 800 ms
    errors: ['rate<0.01'],             // moins de 1% d'erreurs
    http_req_failed: ['rate<0.02'],    // moins de 2% de requêtes HTTP en échec
  },
};

const FUELS = ['Essence', 'Diesel', 'Hybride', 'Electrique'];
const SORTS = ['recent', 'price-asc', 'price-desc', 'mileage'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export default function () {
  // 1) Page catalogue (le plus fréquent) — avec filtres/tri aléatoires
  const params = `?sort=${pick(SORTS)}${Math.random() > 0.5 ? '&fuel=' + pick(FUELS) : ''}`;
  let res = http.get(`${BASE_URL}/api/cars/${params}`);
  check(res, { 'cars 200': (r) => r.status === 200 }) || errorRate.add(1);
  browseLatency.add(res.timings.duration);

  // Temps de lecture de la liste
  sleep(Math.random() * 3 + 2);  // 2–5 s

  // 2) 60% des visiteurs ouvrent une fiche voiture
  if (res.status === 200 && Math.random() < 0.6) {
    try {
      const cars = res.json();
      if (cars.length > 0) {
        const car = cars[Math.floor(Math.random() * cars.length)];
        const detail = http.get(`${BASE_URL}/api/cars/${car.id}/`);
        check(detail, { 'car detail 200': (r) => r.status === 200 }) || errorRate.add(1);
        sleep(Math.random() * 4 + 3);  // 3–7 s à lire la fiche
      }
    } catch (e) { /* réponse non-JSON, ignore */ }
  }

  // 3) 25% consultent la liste des vendeurs
  if (Math.random() < 0.25) {
    const sellers = http.get(`${BASE_URL}/api/sellers/`);
    check(sellers, { 'sellers 200': (r) => r.status === 200 }) || errorRate.add(1);
    sleep(Math.random() * 2 + 1);
  }

  // Pause avant de recommencer le parcours
  sleep(Math.random() * 3 + 1);
}
