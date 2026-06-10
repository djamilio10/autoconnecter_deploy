import React from 'react';
import { C, Btn, Spinner, toCFA } from './Shared';
import { carsApi, messagingApi } from '../api';
import Reviews from './Reviews';

const REPORT_REASONS = [
  { val: 'fake', label: 'Annonce frauduleuse' },
  { val: 'wrong_price', label: 'Prix trompeur' },
  { val: 'not_responding', label: 'Vendeur ne répond pas' },
  { val: 'not_serious', label: 'Vendeur pas sérieux' },
  { val: 'already_sold', label: 'Véhicule déjà vendu' },
  { val: 'harassment', label: 'Comportement inapproprié' },
  { val: 'other', label: 'Autre raison' },
];

export default function CarDetail({ carId, navigate, user, favorites, onToggleFavorite }) {
  const [car, setCar] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [activeImg, setActiveImg] = React.useState(0);
  const [showReport, setShowReport] = React.useState(false);
  const [reportForm, setReportForm] = React.useState({ reason: '', description: '' });
  const [reportSending, setReportSending] = React.useState(false);
  const [reportDone, setReportDone] = React.useState(false);
  const [contactLoading, setContactLoading] = React.useState(false);
  const isFav = favorites.includes(carId);

  React.useEffect(() => {
    carsApi.detail(carId)
      .then(r => setCar(r.data))
      .catch(() => navigate('catalogue'))
      .finally(() => setLoading(false));
  }, [carId]);

  const submitReport = async () => {
    if (!reportForm.reason) return;
    setReportSending(true);
    try {
      await carsApi.report(car.id, reportForm);
      setReportDone(true);
    } catch (e) {
      alert(e.response?.data?.error || 'Erreur lors du signalement');
    } finally {
      setReportSending(false);
    }
  };

  if (loading) return <div style={{ background: C.bg, minHeight: '100vh', paddingTop: 64 }}><Spinner /></div>;
  if (!car) return null;

  const seller = car.seller;
  // Toutes les images disponibles : uploadées d'abord, puis fallback URL legacy
  const allImages = car.car_images?.length
    ? car.car_images.map(i => i.url)
    : [car.image_hero || car.image].filter(Boolean);
  const mainSrc = allImages[activeImg] || null;
  const specs = [
    { label: 'Année', value: car.year },
    { label: 'Kilométrage', value: `${(car.mileage || 0).toLocaleString('fr-FR')} km` },
    { label: 'Carburant', value: car.fuel },
    { label: 'Boîte', value: car.transmission },
    { label: 'Puissance', value: car.power },
    { label: 'Couleur', value: car.color },
    { label: 'Portes', value: car.doors },
    { label: 'Places', value: car.seats },
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingTop: 64 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px 0' }}>
        <button onClick={() => navigate('catalogue')} style={{
          background: 'none', border: 'none', color: C.muted, fontFamily: C.dm,
          fontSize: 14, cursor: 'pointer', padding: 0,
        }}
          onMouseEnter={e => e.target.style.color = C.text}
          onMouseLeave={e => e.target.style.color = C.muted}
        >← Retour au catalogue</button>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 32px 80px', display: 'grid', gridTemplateColumns: '1fr 360px', gap: 40 }}>
        {/* Left */}
        <div>
          {/* Hero image */}
          <div style={{
            height: 420, borderRadius: 20, background: car.gradient || C.surface,
            border: `1px solid ${C.border}`, marginBottom: 12,
            position: 'relative', overflow: 'hidden',
          }}>
            {mainSrc && (
              <img src={mainSrc} alt={`${car.make} ${car.model}`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(9,9,11,0.55) 0%, transparent 60%)' }} />
            {car.badge && (
              <div style={{
                position: 'absolute', top: 16, left: 16,
                background: 'rgba(9,9,11,0.6)', backdropFilter: 'blur(8px)',
                border: `1px solid ${C.goldBorder}`, color: C.gold,
                fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 20,
                fontFamily: C.dm, letterSpacing: '0.06em',
              }}>{car.badge}</div>
            )}
            {/* Flèches navigation */}
            {allImages.length > 1 && (
              <>
                <button onClick={() => setActiveImg(i => (i - 1 + allImages.length) % allImages.length)} style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(9,9,11,0.6)', border: `1px solid ${C.border}`,
                  color: C.text, width: 36, height: 36, borderRadius: '50%',
                  cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>‹</button>
                <button onClick={() => setActiveImg(i => (i + 1) % allImages.length)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(9,9,11,0.6)', border: `1px solid ${C.border}`,
                  color: C.text, width: 36, height: 36, borderRadius: '50%',
                  cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>›</button>
                <div style={{
                  position: 'absolute', bottom: 54, right: 16,
                  background: 'rgba(9,9,11,0.6)', backdropFilter: 'blur(6px)',
                  fontFamily: C.dm, fontSize: 12, color: C.text,
                  padding: '3px 10px', borderRadius: 20,
                }}>{activeImg + 1} / {allImages.length}</div>
              </>
            )}
            <div style={{ position: 'absolute', bottom: 16, left: 16 }}>
              <div style={{ fontFamily: C.playfair, fontSize: 28, fontWeight: 700, color: C.text }}>{car.make} {car.model}</div>
              <div style={{ fontFamily: C.dm, fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>{car.year} · {(car.mileage || 0).toLocaleString('fr-FR')} km</div>
            </div>
          </div>

          {/* Thumbnails */}
          {allImages.length > 0 && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 36, overflowX: 'auto' }}>
              {allImages.map((src, i) => (
                <div key={i} onClick={() => setActiveImg(i)} style={{
                  height: 80, minWidth: 120, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                  border: `1.5px solid ${i === activeImg ? C.gold : C.border}`,
                  opacity: i === activeImg ? 1 : 0.55, cursor: 'pointer',
                  background: car.gradient || C.surface, transition: 'opacity 0.2s, border-color 0.2s',
                }}>
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}

          {/* Title + price */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <h1 style={{ fontFamily: C.playfair, fontSize: 42, color: C.text, margin: 0, fontWeight: 700 }}>
              {car.make} <span style={{ fontWeight: 400 }}>{car.model}</span>
            </h1>
            <button onClick={() => onToggleFavorite(car.id)} style={{
              background: 'none', border: `1px solid ${C.border}`, borderRadius: 10,
              color: isFav ? '#e05c5c' : C.muted, fontSize: 20, padding: '10px 14px',
              cursor: 'pointer',
            }}>{isFav ? '♥' : '♡'}</button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
            {(car.tags || []).map(t => (
              <span key={t} style={{
                fontFamily: C.dm, fontSize: 12, color: C.gold,
                background: C.goldDim, border: `1px solid ${C.goldBorder}`,
                padding: '4px 12px', borderRadius: 20,
              }}>{t}</span>
            ))}
          </div>

          {/* Description */}
          <p style={{ fontFamily: C.dm, fontSize: 15, color: C.muted, lineHeight: 1.8, marginBottom: 36 }}>{car.description}</p>

          {/* Specs grid */}
          <h3 style={{ fontFamily: C.dm, fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 20px' }}>Caractéristiques</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 36 }}>
            {specs.map(s => (
              <div key={s.label} style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: '16px',
              }}>
                <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontFamily: C.dm, fontSize: 14, fontWeight: 600, color: C.text }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Features */}
          <h3 style={{ fontFamily: C.dm, fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 16px' }}>Équipements</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {(car.features || []).map(f => (
              <div key={f} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                fontFamily: C.dm, fontSize: 14, color: C.text,
              }}>
                <span style={{ color: C.gold, flexShrink: 0 }}>✓</span> {f}
              </div>
            ))}
          </div>
        </div>

        {/* Report modal */}
        {showReport && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
          }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 36, maxWidth: 480, width: '90%' }}>
              {reportDone ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                  <h3 style={{ fontFamily: C.playfair, fontSize: 22, color: C.text, margin: '0 0 10px' }}>Signalement envoyé</h3>
                  <p style={{ fontFamily: C.dm, fontSize: 14, color: C.muted, margin: '0 0 24px', lineHeight: 1.6 }}>
                    Notre équipe va examiner votre signalement sous 24–48h. Merci de nous aider à maintenir la plateforme sûre.
                  </p>
                  <Btn onClick={() => setShowReport(false)} style={{ width: '100%' }}>Fermer</Btn>
                </div>
              ) : (
                <>
                  <h3 style={{ fontFamily: C.playfair, fontSize: 22, color: C.text, margin: '0 0 6px' }}>Signaler l'annonce</h3>
                  <p style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, margin: '0 0 20px' }}>
                    {car.make} {car.model} {car.year} · {car.seller?.name}
                  </p>

                  <label style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, display: 'block', marginBottom: 10 }}>Motif du signalement *</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                    {REPORT_REASONS.map(r => (
                      <button key={r.val} onClick={() => setReportForm(f => ({ ...f, reason: r.val }))} style={{
                        background: reportForm.reason === r.val ? 'rgba(239,68,68,0.1)' : 'transparent',
                        border: `1px solid ${reportForm.reason === r.val ? 'rgba(239,68,68,0.4)' : C.border2}`,
                        color: reportForm.reason === r.val ? '#f87171' : C.muted,
                        fontFamily: C.dm, fontSize: 13, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      }}>{r.label}</button>
                    ))}
                  </div>

                  <label style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, display: 'block', marginBottom: 8 }}>Description (facultatif)</label>
                  <textarea value={reportForm.description}
                    onChange={e => setReportForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Donnez plus de détails..."
                    rows={3}
                    style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.dm, fontSize: 13, padding: '10px 14px', borderRadius: 8, outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 24 }}
                  />

                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={() => setShowReport(false)} style={{
                      flex: 1, background: 'none', border: `1px solid ${C.border}`, color: C.text,
                      fontFamily: C.dm, fontSize: 14, padding: '12px', borderRadius: 10, cursor: 'pointer',
                    }}>Annuler</button>
                    <button onClick={submitReport} disabled={!reportForm.reason || reportSending} style={{
                      flex: 1, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                      color: '#f87171', fontFamily: C.dm, fontSize: 14, fontWeight: 700,
                      padding: '12px', borderRadius: 10, cursor: reportForm.reason ? 'pointer' : 'not-allowed',
                      opacity: !reportForm.reason || reportSending ? 0.5 : 1,
                    }}>{reportSending ? '...' : 'Envoyer le signalement'}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Right sidebar */}
        <div>
          <div style={{ position: 'sticky', top: 80 }}>
            {/* Price card */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 28, marginBottom: 16 }}>
              <div style={{ fontFamily: C.playfair, fontSize: 38, fontWeight: 700, color: C.gold, marginBottom: 6 }}>
                {toCFA(car.price)}
              </div>
              <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, marginBottom: 28 }}>
                📍 {car.location}
              </div>
              {/* Vente */}
              {(car.listing_type === 'sale' || car.listing_type === 'both' || !car.listing_type) && (
                <Btn
                  onClick={() => {
                    if (!user) { navigate('auth', { mode: 'login' }); return; }
                    navigate('booking', { carId: car.id, sellerId: seller?.id });
                  }}
                  style={{ width: '100%', fontSize: 15, padding: '14px', marginBottom: 10 }}
                >
                  Réserver un essai
                </Btn>
              )}
              {/* Location */}
              {(car.listing_type === 'rental' || car.listing_type === 'both') && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontFamily: C.dm, fontSize: 22, fontWeight: 800, color: C.gold }}>
                      {car.rental_price_per_day ? parseInt(car.rental_price_per_day).toLocaleString() : '—'}
                    </span>
                    <span style={{ fontFamily: C.dm, fontSize: 13, color: C.muted }}>FCFA / jour</span>
                  </div>
                  {car.rental_deposit && (
                    <div style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, marginBottom: 8 }}>
                      Caution : {parseInt(car.rental_deposit).toLocaleString()} FCFA
                    </div>
                  )}
                  {car.rental_required_docs?.length > 0 && (
                    <div style={{ background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.25)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                      <div style={{ fontFamily: C.dm, fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Documents requis</div>
                      {car.rental_required_docs.map((doc, i) => (
                        <div key={i} style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, display: 'flex', gap: 6, marginBottom: 2 }}>
                          <span style={{ color: C.gold }}>•</span> {doc}
                        </div>
                      ))}
                    </div>
                  )}
                  <Btn
                    onClick={() => {
                      if (!user) { navigate('auth', { mode: 'login' }); return; }
                      navigate('rental-request', { carId: car.id });
                    }}
                    style={{ width: '100%', fontSize: 15, padding: '14px' }}
                  >
                    🔑 Louer cette voiture
                  </Btn>
                </div>
              )}
              <Btn
                variant="secondary"
                style={{ width: '100%', fontSize: 14, padding: '12px' }}
                onClick={async () => {
                  if (!user) { navigate('auth', { mode: 'login' }); return; }
                  if (user.user_type !== 'buyer') return;
                  setContactLoading(true);
                  try {
                    await messagingApi.startConversation({ seller_id: seller.id, car_id: car.id });
                    navigate('messaging');
                  } catch { /* ignore */ }
                  setContactLoading(false);
                }}
                disabled={contactLoading}
              >
                {contactLoading ? 'Ouverture...' : '💬 Contacter le vendeur'}
              </Btn>
              {user && user.user_type === 'buyer' && (
                <button
                  onClick={() => { setShowReport(true); setReportDone(false); setReportForm({ reason: '', description: '' }); }}
                  style={{
                    background: 'none', border: 'none', color: C.subtle, fontFamily: C.dm,
                    fontSize: 12, cursor: 'pointer', marginTop: 8, padding: 0, textDecoration: 'underline',
                    display: 'block', width: '100%', textAlign: 'center',
                  }}
                  onMouseEnter={e => e.target.style.color = '#f87171'}
                  onMouseLeave={e => e.target.style.color = C.subtle}
                >
                  🚨 Signaler cette annonce
                </button>
              )}
            </div>

            {/* Seller card */}
            {seller && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', background: '#27272A',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: C.dm, fontSize: 14, fontWeight: 700, color: C.muted, flexShrink: 0,
                    overflow: 'hidden',
                  }}>
                  {seller.logo_url
                    ? <img src={seller.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : seller.avatar}
                </div>
                  <div>
                    <div style={{ fontFamily: C.dm, fontSize: 15, fontWeight: 600, color: C.text }}>
                      {seller.name}
                      {seller.is_verified && <span style={{ color: C.gold, fontSize: 13, marginLeft: 6 }}>✓</span>}
                    </div>
                    <div style={{ fontFamily: C.dm, fontSize: 12, color: C.muted }}>
                      {seller.seller_type === 'pro' ? 'Professionnel' : 'Particulier'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: C.bg, borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontFamily: C.playfair, fontSize: 20, fontWeight: 700, color: C.gold }}>★ {seller.rating}</div>
                    <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted }}>{seller.review_count} avis</div>
                  </div>
                  <div style={{ background: C.bg, borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontFamily: C.playfair, fontSize: 13, fontWeight: 600, color: C.text }}>{seller.location}</div>
                    <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted }}>Localisation</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section avis */}
          {seller && (
            <Reviews sellerId={seller.id} carId={car.id} user={user} />
          )}
        </div>
      </div>
    </div>
  );
}
