import React from 'react';
import { C, CarCard, StatusBadge, Spinner, Btn, toCFA } from './Shared';
import { appointmentsApi, favoritesApi, rentalApi } from '../api';

const TABS = ['Mes rendez-vous', 'Mes locations', 'Mes favoris', 'Mon profil'];

export default function BuyerDashboard({ user, navigate, favorites, onToggleFavorite }) {
  const [appointments, setAppointments] = React.useState([]);
  const [rentalRequests, setRentalRequests] = React.useState([]);
  const [favCars, setFavCars] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState(0);

  React.useEffect(() => {
    Promise.all([
      appointmentsApi.list().then(r => setAppointments(r.data)).catch(() => {}),
      favoritesApi.list().then(r => setFavCars(r.data.map(f => f.car))).catch(() => {}),
      rentalApi.list().then(r => setRentalRequests(r.data || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const cancelAppointment = async (id) => {
    await appointmentsApi.update(id, { status: 'cancelled' });
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a));
  };

  if (loading) return <div style={{ background: C.bg, minHeight: '100vh', paddingTop: 64 }}><Spinner /></div>;

  const upcoming = appointments.filter(a => a.status !== 'cancelled' && a.status !== 'completed');
  const past = appointments.filter(a => a.status === 'cancelled' || a.status === 'completed');

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingTop: 64 }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border2}`, padding: '40px 32px 32px', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: C.dm, fontSize: 13, color: C.gold, letterSpacing: '0.06em', marginBottom: 8, textTransform: 'uppercase' }}>
              Espace Acheteur
            </div>
            <h1 style={{ fontFamily: C.playfair, fontSize: 36, color: C.text, margin: 0, fontWeight: 700 }}>
              Bonjour, {user?.first_name || 'Acheteur'} 👋
            </h1>
          </div>
          <Btn onClick={() => navigate('catalogue')}>Explorer le catalogue</Btn>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px' }}>
        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 40 }}>
          {[
            { icon: '📅', val: upcoming.length, label: 'Rendez-vous à venir' },
            { icon: '♥', val: favCars.length, label: 'Véhicules favoris' },
            { icon: '🏁', val: past.length, label: 'Essais réalisés' },
          ].map(s => (
            <div key={s.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{s.icon}</div>
              <div style={{ fontFamily: C.playfair, fontSize: 32, fontWeight: 700, color: C.gold, marginBottom: 4 }}>{s.val}</div>
              <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 32 }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{
              background: 'none', border: 'none', color: tab === i ? C.gold : C.muted,
              fontFamily: C.dm, fontSize: 14, fontWeight: tab === i ? 600 : 400,
              padding: '12px 24px', cursor: 'pointer',
              borderBottom: `2px solid ${tab === i ? C.gold : 'transparent'}`,
              marginBottom: -1,
            }}>{t}</button>
          ))}
        </div>

        {/* Tab 0: Appointments */}
        {tab === 0 && (
          <div>
            {appointments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>📅</div>
                <p style={{ fontFamily: C.dm, fontSize: 15, color: C.muted, marginBottom: 20 }}>Aucun rendez-vous planifié</p>
                <Btn onClick={() => navigate('catalogue')}>Trouver une voiture</Btn>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {appointments.map(a => (
                  <div key={a.id} style={{
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 16, padding: '20px 24px',
                    display: 'grid', gridTemplateColumns: '1fr auto',
                    gap: 20, alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div style={{ fontFamily: C.playfair, fontSize: 18, fontWeight: 700, color: C.text }}>
                          {a.car?.make} {a.car?.model} {a.car?.year}
                        </div>
                        <StatusBadge status={a.status} />
                      </div>
                      <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted }}>
                        🏪 {a.seller_name} · 📅 {a.date} à {a.time?.slice(0, 5)}
                      </div>
                      {a.car?.price && (
                        <div style={{ fontFamily: C.playfair, fontSize: 15, color: C.gold, marginTop: 6 }}>
                          {toCFA(a.car.price)}
                        </div>
                      )}
                      {a.note && (
                        <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, marginTop: 6, fontStyle: 'italic', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <span style={{ fontSize: 14, flexShrink: 0 }}>💬</span>
                          <span>"{a.note}"</span>
                        </div>
                      )}
                      {a.status === 'cancelled' && a.cancellation_reason && (
                        <div style={{ fontFamily: C.dm, fontSize: 13, color: '#f87171', marginTop: 6, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <span style={{ flexShrink: 0 }}>↪</span>
                          <span>Raison du refus : {a.cancellation_reason}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {a.car?.id && (
                        <button onClick={() => navigate('car-detail', { carId: a.car.id })} style={{
                          background: C.goldDim, border: `1px solid ${C.goldBorder}`,
                          color: C.gold, fontFamily: C.dm, fontSize: 12, padding: '8px 14px',
                          borderRadius: 8, cursor: 'pointer',
                        }}>Voir l'annonce</button>
                      )}
                      {a.status === 'pending' && (
                        <button onClick={() => cancelAppointment(a.id)} style={{
                          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                          color: '#f87171', fontFamily: C.dm, fontSize: 12, padding: '8px 14px',
                          borderRadius: 8, cursor: 'pointer',
                        }}>Annuler</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 1: Locations */}
        {tab === 1 && (
          <div>
            {rentalRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>🔑</div>
                <p style={{ fontFamily: C.dm, fontSize: 15, color: C.muted, marginBottom: 20 }}>Aucune demande de location</p>
                <Btn onClick={() => navigate('catalogue')}>Explorer le catalogue</Btn>
              </div>
            ) : rentalRequests.map(r => {
              const STATUS = { pending: { color: '#eab308', label: 'En attente' }, confirmed: { color: '#22c55e', label: 'Confirmé' }, rejected: { color: '#ef4444', label: 'Refusé' }, cancelled: { color: '#6b7280', label: 'Annulé' }, active: { color: '#3b82f6', label: 'En cours' }, completed: { color: '#a855f7', label: 'Terminé' } };
              const st = STATUS[r.status] || STATUS.pending;
              return (
                <div key={r.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: C.dm, fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                        {r.car?.make} {r.car?.model} {r.car?.year}
                      </div>
                      <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, marginBottom: 6 }}>
                        Vendeur : <strong style={{ color: C.text }}>{r.seller_name}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: C.dm, fontSize: 13, color: C.muted }}>
                        <span>📅 {r.start_date} → {r.end_date}</span>
                        <span>⏱ {r.nb_days} jour{r.nb_days > 1 ? 's' : ''}</span>
                        {r.total_price && <span style={{ color: C.gold, fontWeight: 600 }}>{parseInt(r.total_price).toLocaleString()} FCFA</span>}
                      </div>
                      {r.rejection_reason && (
                        <div style={{ marginTop: 8, fontFamily: C.dm, fontSize: 12, color: '#ef4444' }}>Refus : {r.rejection_reason}</div>
                      )}
                      {r.status === 'confirmed' && (
                        <div style={{ marginTop: 10, background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '10px 14px', fontFamily: C.dm, fontSize: 13, color: '#4ade80' }}>
                          ✅ Votre location est confirmée. Présentez-vous chez le vendeur avec les documents requis.
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                      <span style={{ background: `${st.color}22`, color: st.color, fontFamily: C.dm, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>{st.label}</span>
                      {r.status === 'pending' && (
                        <button onClick={async () => { await rentalApi.update(r.id, { status: 'cancelled' }); setRentalRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: 'cancelled' } : x)); }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontFamily: C.dm, fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8, cursor: 'pointer' }}>
                          Annuler
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Favorites */}
        {tab === 2 && (
          <div>
            {favCars.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>♡</div>
                <p style={{ fontFamily: C.dm, fontSize: 15, color: C.muted, marginBottom: 20 }}>Aucun véhicule en favori</p>
                <Btn onClick={() => navigate('catalogue')}>Explorer le catalogue</Btn>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                {favCars.map(car => (
                  <CarCard
                    key={car.id}
                    car={car}
                    seller={car.seller}
                    onClick={() => navigate('car-detail', { carId: car.id })}
                    isFavorite={true}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Profile */}
        {tab === 3 && (
          <div style={{ maxWidth: 480 }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', background: C.goldDim,
                  border: `2px solid ${C.goldBorder}`, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontFamily: C.playfair, fontSize: 22, fontWeight: 700, color: C.gold,
                }}>{user?.avatar_initials || '?'}</div>
                <div>
                  <div style={{ fontFamily: C.playfair, fontSize: 20, fontWeight: 700, color: C.text }}>
                    {user?.first_name} {user?.last_name}
                  </div>
                  <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted }}>{user?.email}</div>
                  <div style={{ fontFamily: C.dm, fontSize: 12, color: C.gold, marginTop: 2 }}>Acheteur</div>
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${C.border2}`, paddingTop: 24 }}>
                <p style={{ fontFamily: C.dm, fontSize: 14, color: C.muted }}>
                  Membre depuis 2026 · {appointments.length} rendez-vous · {favCars.length} favoris
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
