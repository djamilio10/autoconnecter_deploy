import React from 'react';
import { C, CarCard, Btn } from './Shared';
import { carsApi } from '../api';

// Rotating hero car images (Unsplash — free, no API key needed)
const HERO_CARS = [
  {
    url: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=90',
    label: 'Mercedes-AMG GT',
  },
  {
    url: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&w=1200&q=90',
    label: 'Range Rover Sport',
  },
  {
    url: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=90',
    label: 'BMW Série 5',
  },
  {
    url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=90',
    label: 'Porsche 911',
  },
];

function HeroCarPhoto() {
  const [idx, setIdx] = React.useState(0);
  const [fading, setFading] = React.useState(false);

  React.useEffect(() => {
    const t = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIdx(i => (i + 1) % HERO_CARS.length);
        setFading(false);
      }, 500);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const car = HERO_CARS[idx];

  return (
    <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Ambient gold glow behind */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(201,169,110,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Photo frame */}
      <div style={{
        position: 'relative', width: '100%', borderRadius: 24,
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,169,110,0.15)',
        aspectRatio: '16/10',
      }}>
        {/* Photo */}
        <img
          src={car.url}
          alt={car.label}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            opacity: fading ? 0 : 1,
            transition: 'opacity 0.5s ease',
            display: 'block',
          }}
        />

        {/* Dark vignette overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, rgba(9,9,11,0.35) 0%, transparent 40%, transparent 60%, rgba(9,9,11,0.2) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Bottom gradient + car name */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(9,9,11,0.75) 0%, transparent 100%)',
          padding: '28px 24px 20px',
        }}>
          <div style={{ fontFamily: C.dm, fontSize: 11, color: 'rgba(201,169,110,0.7)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            À la une
          </div>
          <div style={{ fontFamily: C.playfair, fontSize: 20, fontWeight: 700, color: '#fff', opacity: fading ? 0 : 1, transition: 'opacity 0.4s' }}>
            {car.label}
          </div>
        </div>

        {/* Gold corner accent */}
        <div style={{
          position: 'absolute', top: 16, right: 16,
          background: 'rgba(9,9,11,0.55)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(201,169,110,0.35)',
          borderRadius: 20, padding: '5px 12px',
          fontFamily: C.dm, fontSize: 11, color: C.gold, fontWeight: 600, letterSpacing: '0.06em',
        }}>PREMIUM</div>

        {/* Dot indicators */}
        <div style={{
          position: 'absolute', bottom: 20, right: 20,
          display: 'flex', gap: 6,
        }}>
          {HERO_CARS.map((_, i) => (
            <button
              key={i}
              onClick={() => { setFading(true); setTimeout(() => { setIdx(i); setFading(false); }, 400); }}
              style={{
                width: i === idx ? 20 : 6, height: 6, borderRadius: 3,
                background: i === idx ? C.gold : 'rgba(255,255,255,0.3)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* Reflection under the photo */}
      <div style={{
        position: 'absolute', bottom: -30, left: '10%', right: '10%', height: 30,
        background: 'radial-gradient(ellipse, rgba(201,169,110,0.2) 0%, transparent 70%)',
        filter: 'blur(10px)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

const STATS = [
  { value: '2 400+', label: 'Annonces actives' },
  { value: '1 800+', label: 'Vendeurs certifiés' },
  { value: '12 000+', label: 'Essais réalisés' },
  { value: '98%', label: 'Acheteurs satisfaits' },
];

const STEPS = [
  { n: '01', title: 'Parcourez le catalogue', desc: 'Explorez des centaines d\'annonces vérifiées avec filtres avancés.' },
  { n: '02', title: 'Réservez un essai', desc: 'Choisissez un créneau pour rencontrer le vendeur et essayer le véhicule.' },
  { n: '03', title: 'Achetez en confiance', desc: 'Transaction sécurisée avec historique complet et garanties.' },
];

export default function HomePage({ navigate, user }) {
  const [featured, setFeatured] = React.useState([]);
  const [sellers, setSellers] = React.useState({});

  React.useEffect(() => {
    carsApi.list({ sort: 'recent' })
      .then(r => {
        const cars = r.data.slice(0, 6);
        setFeatured(cars);
        const map = {};
        cars.forEach(c => { if (c.seller) map[c.id] = c.seller; });
        setSellers(map);
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* ── Hero ── */}
      <section style={{
        minHeight: '100vh', paddingTop: 64, display: 'flex', alignItems: 'center',
        background: 'linear-gradient(135deg, #09090B 0%, #0f0f14 50%, #09090B 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', right: '5%', top: '50%', transform: 'translateY(-50%)',
          width: 600, height: 400,
          background: 'radial-gradient(ellipse, rgba(201,169,110,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 64, alignItems: 'center', width: '100%' }}>
          {/* Left */}
          <div>
            <div style={{
              display: 'inline-block', background: C.goldDim, border: `1px solid ${C.goldBorder}`,
              color: C.gold, fontFamily: C.dm, fontSize: 12, fontWeight: 600,
              padding: '6px 14px', borderRadius: 20, marginBottom: 28, letterSpacing: '0.08em',
            }}>🇸🇳 Plateforme N°1 au Sénégal</div>

            <h1 style={{ fontFamily: C.playfair, fontSize: 62, fontWeight: 700, color: C.text, lineHeight: 1.1, marginBottom: 24 }}>
              Trouvez votre<br />
              <span style={{ color: C.gold, fontStyle: 'italic' }}>voiture idéale</span>,<br />
              rencontrez le vendeur.
            </h1>

            <p style={{ fontFamily: C.dm, fontSize: 17, color: C.muted, lineHeight: 1.7, marginBottom: 40, maxWidth: 480 }}>
              AutoConnect met en relation acheteurs et vendeurs de véhicules premium.
              Réservez un essai, rencontrez le vendeur, achetez en toute confiance.
            </p>

            <div style={{ display: 'flex', gap: 14 }}>
              <Btn onClick={() => navigate('catalogue')} style={{ fontSize: 15, padding: '14px 28px' }}>
                Explorer les annonces
              </Btn>
              <Btn variant="secondary" onClick={() => navigate('auth', { mode: 'register', type: 'seller' })} style={{ fontSize: 15, padding: '14px 28px' }}>
                Vendre ma voiture →
              </Btn>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginTop: 56, paddingTop: 40, borderTop: `1px solid ${C.border2}` }}>
              {STATS.map(s => (
                <div key={s.value}>
                  <div style={{ fontFamily: C.playfair, fontSize: 26, fontWeight: 700, color: C.gold }}>{s.value}</div>
                  <div style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Real car photo */}
          <HeroCarPhoto />
        </div>

        {/* Scroll indicator */}
        <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
          <div style={{ fontFamily: C.dm, fontSize: 11, color: C.faint, marginBottom: 8, letterSpacing: '0.08em' }}>DÉFILER</div>
          <div style={{ width: 1, height: 40, background: `linear-gradient(to bottom, ${C.faint}, transparent)`, margin: '0 auto' }} />
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: '100px 32px', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ fontFamily: C.dm, fontSize: 12, color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>PROCESSUS SIMPLIFIÉ</div>
          <h2 style={{ fontFamily: C.playfair, fontSize: 42, color: C.text, fontWeight: 700 }}>Comment ça marche ?</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 40 }}>
          {STEPS.map(s => (
            <div key={s.n} style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 20, padding: 36,
            }}>
              <div style={{ fontFamily: C.playfair, fontSize: 48, fontWeight: 700, color: C.goldBorder, marginBottom: 20 }}>{s.n}</div>
              <h3 style={{ fontFamily: C.playfair, fontSize: 22, color: C.text, marginBottom: 12, fontWeight: 600 }}>{s.title}</h3>
              <p style={{ fontFamily: C.dm, fontSize: 14, color: C.muted, lineHeight: 1.7 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Featured Cars ── */}
      {featured.length > 0 && (
        <section style={{ padding: '0 32px 100px', maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
            <div>
              <div style={{ fontFamily: C.dm, fontSize: 12, color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>SÉLECTION</div>
              <h2 style={{ fontFamily: C.playfair, fontSize: 36, color: C.text, fontWeight: 700 }}>Annonces à la une</h2>
            </div>
            <Btn variant="secondary" onClick={() => navigate('catalogue')}>Voir tout le catalogue →</Btn>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {featured.map(car => (
              <CarCard
                key={car.id}
                car={car}
                seller={car.seller}
                onClick={() => navigate('car-detail', { carId: car.id })}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Seller CTA ── */}
      <section style={{
        margin: '0 32px 80px', maxWidth: 1280, marginLeft: 'auto', marginRight: 'auto',
        background: 'linear-gradient(135deg, #0f0e09 0%, #1a1608 50%, #0f0e09 100%)',
        border: `1px solid rgba(201,169,110,0.2)`, borderRadius: 24, padding: '60px 64px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <h2 style={{ fontFamily: C.playfair, fontSize: 36, color: C.text, fontWeight: 700, marginBottom: 12 }}>
            Vendez votre voiture<br /><span style={{ color: C.gold }}>rapidement et sereinement</span>
          </h2>
          <p style={{ fontFamily: C.dm, fontSize: 15, color: C.muted, maxWidth: 480 }}>
            Publiez votre annonce gratuitement. Nos acheteurs qualifiés vous contactent directement pour organiser un essai.
          </p>
        </div>
        <div style={{ flexShrink: 0 }}>
          <Btn onClick={() => navigate('auth', { mode: 'register', type: 'seller' })} style={{ fontSize: 15, padding: '16px 32px' }}>
            Publier une annonce →
          </Btn>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${C.border2}`, padding: '40px 32px', maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <circle cx="11" cy="16" r="9" stroke={C.gold} strokeWidth="2" />
            <circle cx="21" cy="16" r="9" stroke={C.gold} strokeWidth="2" />
            <circle cx="16" cy="16" r="3" fill={C.gold} />
          </svg>
          <span style={{ fontFamily: C.dm, fontSize: 13, color: C.muted }}>© 2026 AutoConnect — Sénégal</span>
        </div>
        <span style={{ fontFamily: C.dm, fontSize: 12, color: C.faint }}>Plateforme de mise en relation automobile</span>
      </footer>
    </div>
  );
}
