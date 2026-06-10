import React from 'react';
import { C, StatusBadge, Spinner, Btn, toCFA, Input } from './Shared';
import { dashboardApi, appointmentsApi, carsApi, sellersApi, rentalApi } from '../api';

// Convertit un File en data URL pour la prévisualisation locale
const toPreview = (file) => new Promise(res => {
  const reader = new FileReader();
  reader.onload = e => res(e.target.result);
  reader.readAsDataURL(file);
});

const TABS_BASE = ['Vue d\'ensemble', 'Annonces', 'Rendez-vous', 'Locations'];
const TABS_PREMIUM = ['Vue d\'ensemble', 'Annonces', 'Rendez-vous', 'Locations', 'Abonnement ⭐'];

// ── Listes de choix pour le formulaire d'annonce ──────────────────────────────
const FUEL_OPTIONS = ['Essence', 'Diesel', 'Hybride', 'Électrique'];
const TRANSMISSION_OPTIONS = ['Automatique', 'Manuelle'];

export default function SellerDashboard({ user, navigate, platformSettings = {} }) {
  const TABS = platformSettings.premium_enabled ? TABS_PREMIUM : TABS_BASE;
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState(0);
  const [rentalRequests, setRentalRequests] = React.useState([]);
  const [showCarForm, setShowCarForm] = React.useState(false);
  const [editingCar, setEditingCar] = React.useState(null);
  const [showPremiumModal, setShowPremiumModal] = React.useState(false);

  const load = () => {
    Promise.all([dashboardApi.seller(), rentalApi.list()])
      .then(([r, rr]) => { setData(r.data); setRentalRequests(rr.data || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  React.useEffect(() => { load(); }, []);

  const updateStatus = async (id, status, cancellation_reason = '') => {
    const payload = { status };
    if (cancellation_reason) payload.cancellation_reason = cancellation_reason;
    await appointmentsApi.update(id, payload);
    load();
  };

  const onCarSaved = () => {
    setShowCarForm(false);
    setEditingCar(null);
    setLoading(true);
    load();
  };

  const deleteCar = async (id) => {
    if (!window.confirm('Supprimer cette annonce ?')) return;
    try {
      await carsApi.delete(id);
      load();
    } catch (e) {
      alert("Suppression impossible : " + (e.response?.data?.detail || e.message));
    }
  };

  if (loading) return <div style={{ background: C.bg, minHeight: '100vh', paddingTop: 64 }}><Spinner /></div>;

  const stats = data?.stats || {};
  const cars = data?.cars || [];
  const appointments = data?.appointments || [];

  const STAT_CARDS = [
    { label: 'Annonces actives', value: stats.active_cars ?? 0, icon: '🚗' },
    { label: 'Total rendez-vous', value: stats.total_appointments ?? 0, icon: '📅' },
    { label: 'En attente', value: stats.pending_appointments ?? 0, icon: '⏳' },
    { label: 'Confirmés', value: stats.confirmed_appointments ?? 0, icon: '✅' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingTop: 64 }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border2}`, padding: '40px 32px 32px', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: C.dm, fontSize: 13, color: C.gold, letterSpacing: '0.06em', marginBottom: 8, textTransform: 'uppercase' }}>
              Dashboard Vendeur
            </div>
            <h1 style={{ fontFamily: C.playfair, fontSize: 36, color: C.text, margin: 0, fontWeight: 700 }}>
              Bonjour, {user?.first_name || 'Vendeur'} 👋
            </h1>
          </div>
          <Btn onClick={() => navigate('catalogue')} variant="secondary">Voir le catalogue</Btn>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 40 }}>
          {STAT_CARDS.map(s => (
            <div key={s.label} style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 16, padding: '24px',
            }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{s.icon}</div>
              <div style={{ fontFamily: C.playfair, fontSize: 32, fontWeight: 700, color: C.gold, marginBottom: 4 }}>{s.value}</div>
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

        {/* Tab 0: Overview */}
        {tab === 0 && (
          <div>
            <h3 style={{ fontFamily: C.playfair, fontSize: 22, color: C.text, marginBottom: 20, fontWeight: 600 }}>Rendez-vous récents</h3>
            {appointments.length === 0 ? (
              <EmptyState icon="📅" text="Aucun rendez-vous pour l'instant" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {appointments.slice(0, 5).map(a => (
                  <AppointmentRow key={a.id} a={a} onUpdate={updateStatus} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 1: Listings */}
        {tab === 1 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h3 style={{ fontFamily: C.playfair, fontSize: 22, color: C.text, margin: 0, fontWeight: 600 }}>Mes annonces ({cars.length})</h3>
              <button
                onClick={() => {
                  const isPremium = data?.seller?.is_premium;
                  const activeCarsCount = stats.active_cars ?? 0;
                  if (!isPremium && activeCarsCount >= 3) {
                    setShowPremiumModal(true);
                  } else {
                    setEditingCar(null);
                    setShowCarForm(true);
                  }
                }}
                style={{
                  background: C.gold, border: 'none', color: C.bg,
                  fontFamily: C.dm, fontSize: 14, fontWeight: 700,
                  padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >+ Nouvelle annonce</button>
            </div>
            {cars.length === 0 ? (
              <EmptyState icon="🚗" text="Aucune annonce publiée — cliquez sur « + Nouvelle annonce » pour commencer" />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
                {cars.map(car => (
                  <div key={car.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
                    <div style={{ height: 160, background: car.gradient, position: 'relative', overflow: 'hidden' }}>
                      {(() => {
                        const img = car.primary_image_url || car.car_images?.find(i => i.is_primary)?.url || car.car_images?.[0]?.url || car.image;
                        return img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null;
                      })()}
                      <div style={{ position: 'absolute', top: 12, right: 12 }}>
                        <span style={{
                          background: car.is_available ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          color: car.is_available ? '#4ade80' : '#f87171',
                          border: `1px solid ${car.is_available ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                          fontFamily: C.dm, fontSize: 11, padding: '3px 10px', borderRadius: 20,
                        }}>{car.is_available ? 'Active' : 'Inactive'}</span>
                      </div>
                    </div>
                    <div style={{ padding: '16px 18px' }}>
                      <div style={{ fontFamily: C.playfair, fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                        {car.make} {car.model} {car.year}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontFamily: C.dm, fontSize: 13, color: C.muted }}>{(car.mileage || 0).toLocaleString('fr-FR')} km · {car.fuel}</span>
                        <span style={{ fontFamily: C.playfair, fontSize: 16, fontWeight: 700, color: C.gold }}>{toCFA(car.price)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => { setEditingCar(car); setShowCarForm(true); }} style={{
                          flex: 1, background: 'transparent', border: `1px solid ${C.border}`,
                          color: C.text, fontFamily: C.dm, fontSize: 12,
                          padding: '7px', borderRadius: 8, cursor: 'pointer',
                        }}>Modifier</button>
                        <button onClick={() => deleteCar(car.id)} style={{
                          flex: 1, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                          color: '#f87171', fontFamily: C.dm, fontSize: 12,
                          padding: '7px', borderRadius: 8, cursor: 'pointer',
                        }}>Supprimer</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal — Formulaire d'annonce */}
        {showCarForm && (
          <CarFormModal
            car={editingCar}
            onClose={() => { setShowCarForm(false); setEditingCar(null); }}
            onSaved={onCarSaved}
            onPremiumRequired={() => setShowPremiumModal(true)}
          />
        )}

        {/* Modal — Upgrade Premium */}
        {showPremiumModal && (
          <PremiumUpgradeModal
            onClose={() => setShowPremiumModal(false)}
            onRequested={() => { setShowPremiumModal(false); load(); }}
          />
        )}

        {/* Tab 2: Appointments */}
        {tab === 2 && (
          <div>
            <h3 style={{ fontFamily: C.playfair, fontSize: 22, color: C.text, marginBottom: 24, fontWeight: 600 }}>
              Tous les rendez-vous ({appointments.length})
            </h3>
            {appointments.length === 0 ? (
              <EmptyState icon="📅" text="Aucun rendez-vous" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {appointments.map(a => (
                  <AppointmentRow key={a.id} a={a} onUpdate={updateStatus} showActions />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 3 && (
          <RentalTab rentalRequests={rentalRequests} onRefresh={load} />
        )}
        {tab === 4 && <PremiumTab seller={data?.seller} onRefresh={load} />}
      </div>
    </div>
  );
}

function AppointmentRow({ a, onUpdate, showActions }) {
  const [refusing, setRefusing] = React.useState(false);
  const [refusalReason, setRefusalReason] = React.useState('');

  const handleRefuse = () => {
    onUpdate(a.id, 'cancelled', refusalReason);
    setRefusing(false);
    setRefusalReason('');
  };

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: '16px 20px', gap: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: C.dm, fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>
            {a.car?.make} {a.car?.model} {a.car?.year}
          </div>
          <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted }}>
            👤 {a.buyer_name} · 📅 {a.date} à {a.time?.slice(0, 5)}
          </div>
          {a.note && (
            <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, marginTop: 6, fontStyle: 'italic', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>💬</span>
              <span>"{a.note}"</span>
            </div>
          )}
          {a.cancellation_reason && (
            <div style={{ fontFamily: C.dm, fontSize: 12, color: '#f87171', marginTop: 6, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ flexShrink: 0 }}>↪</span>
              <span>Raison : {a.cancellation_reason}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <StatusBadge status={a.status} />
          {showActions && a.status === 'pending' && !refusing && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => onUpdate(a.id, 'confirmed')} style={{
                background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                color: '#4ade80', fontFamily: C.dm, fontSize: 12, padding: '5px 12px',
                borderRadius: 8, cursor: 'pointer',
              }}>Confirmer</button>
              <button onClick={() => setRefusing(true)} style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171', fontFamily: C.dm, fontSize: 12, padding: '5px 12px',
                borderRadius: 8, cursor: 'pointer',
              }}>Refuser</button>
            </div>
          )}
        </div>
      </div>

      {refusing && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border2}` }}>
          <label style={{ fontFamily: C.dm, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
            Raison du refus (optionnel)
          </label>
          <textarea
            value={refusalReason}
            onChange={e => setRefusalReason(e.target.value)}
            placeholder="Ex : Véhicule déjà vendu, créneaux indisponibles..."
            rows={3}
            style={{
              width: '100%', background: C.bg, border: `1px solid ${C.border}`,
              color: C.text, fontFamily: C.dm, fontSize: 13, padding: '10px 14px',
              borderRadius: 8, outline: 'none', resize: 'vertical', boxSizing: 'border-box',
            }}
            onFocus={e => e.target.style.borderColor = '#f87171'}
            onBlur={e => e.target.style.borderColor = C.border}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={handleRefuse} style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
              color: '#f87171', fontFamily: C.dm, fontSize: 12, fontWeight: 700,
              padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
            }}>Confirmer le refus</button>
            <button onClick={() => { setRefusing(false); setRefusalReason(''); }} style={{
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.muted, fontFamily: C.dm, fontSize: 12,
              padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
            }}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}


// ── Onglet Locations ──────────────────────────────────────────────────────────
function RentalTab({ rentalRequests, onRefresh }) {
  const [updating, setUpdating] = React.useState(null);
  const [rejReason, setRejReason] = React.useState('');
  const [showRejInput, setShowRejInput] = React.useState(null);

  const updateStatus = async (id, status, reason = '') => {
    setUpdating(id);
    try {
      await rentalApi.update(id, { status, rejection_reason: reason });
      onRefresh();
    } catch { alert('Erreur lors de la mise a jour.'); }
    setUpdating(null);
    setShowRejInput(null);
  };

  const STATUS_COLORS = {
    pending: { bg: 'rgba(234,179,8,0.12)', color: '#eab308', label: 'En attente' },
    confirmed: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', label: 'Confirme' },
    rejected: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: 'Refuse' },
    cancelled: { bg: 'rgba(107,114,128,0.12)', color: '#6b7280', label: 'Annule' },
    active: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', label: 'En cours' },
    completed: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', label: 'Termine' },
  };

  return (
    <div>
      <h3 style={{ fontFamily: C.dm, fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 20 }}>
        Demandes de location ({rentalRequests.length})
      </h3>
      {rentalRequests.length === 0 ? (
        <div style={{ fontFamily: C.dm, fontSize: 14, color: C.muted, padding: '40px 0', textAlign: 'center' }}>Aucune demande de location pour l'instant.</div>
      ) : rentalRequests.map(r => {
        const st = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
        return (
          <div key={r.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: C.dm, fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                  {r.car?.make} {r.car?.model} {r.car?.year}
                </div>
                <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, marginBottom: 8 }}>
                  Demandeur : <strong style={{ color: C.text }}>{r.renter_name}</strong>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: C.dm, fontSize: 13, color: C.muted }}>
                  <span>📅 {r.start_date} → {r.end_date}</span>
                  <span>⏱ {r.nb_days} jour{r.nb_days > 1 ? 's' : ''}</span>
                  {r.total_price && <span style={{ color: C.gold, fontWeight: 600 }}>{parseInt(r.total_price).toLocaleString()} FCFA</span>}
                </div>
                {r.renter_message && (
                  <div style={{ marginTop: 10, fontFamily: C.dm, fontSize: 13, color: C.muted, fontStyle: 'italic', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px' }}>
                    "{r.renter_message}"
                  </div>
                )}
                {r.rejection_reason && (
                  <div style={{ marginTop: 8, fontFamily: C.dm, fontSize: 12, color: '#ef4444' }}>Raison du refus : {r.rejection_reason}</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                <span style={{ background: st.bg, color: st.color, fontFamily: C.dm, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>{st.label}</span>
                {r.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => updateStatus(r.id, 'confirmed')} disabled={updating === r.id} style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', fontFamily: C.dm, fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 8, cursor: 'pointer' }}>
                      {updating === r.id ? '...' : '✓ Confirmer'}
                    </button>
                    <button onClick={() => setShowRejInput(r.id)} disabled={updating === r.id} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontFamily: C.dm, fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 8, cursor: 'pointer' }}>
                      ✗ Refuser
                    </button>
                  </div>
                )}
              </div>
            </div>
            {showRejInput === r.id && (
              <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <input value={rejReason} onChange={e => setRejReason(e.target.value)} placeholder="Raison du refus (optionnel)..." style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontFamily: C.dm, fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => updateStatus(r.id, 'rejected', rejReason)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontFamily: C.dm, fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 8, cursor: 'pointer' }}>Confirmer le refus</button>
                  <button onClick={() => { setShowRejInput(null); setRejReason(''); }} style={{ background: 'none', border: `1px solid ${C.border}`, color: C.muted, fontFamily: C.dm, fontSize: 13, padding: '6px 14px', borderRadius: 8, cursor: 'pointer' }}>Annuler</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Onglet Abonnement Premium ─────────────────────────────────────────────────
function PremiumTab({ seller, onRefresh }) {
  const [requesting, setRequesting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const isPremium = seller?.plan === 'premium';
  const isRequested = seller?.premium_requested;
  const activeUntil = seller?.premium_until ? new Date(seller.premium_until).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  const activeCars = seller ? (seller.car_count || 0) : 0;

  const handleRequest = async () => {
    setRequesting(true);
    try {
      await sellersApi.requestPremium();
      setDone(true);
      onRefresh();
    } catch (e) {
      alert(e.response?.data?.error || 'Erreur');
    } finally {
      setRequesting(false);
    }
  };

  const BENEFITS_FREE = [
    { ok: false, text: 'Badge Premium sur vos annonces' },
    { ok: false, text: 'Priorité en tête du catalogue' },
    { ok: false, text: 'Annonces illimitées' },
    { ok: false, text: 'Badge "Vendeur vérifié Premium"' },
    { ok: false, text: 'Visibilité boostée auprès des acheteurs' },
  ];
  const BENEFITS_PREMIUM = [
    { ok: true, text: 'Annonces illimitées' },
    { ok: true, text: 'Badge ⭐ PREMIUM sur toutes vos annonces' },
    { ok: true, text: 'Priorité absolue en tête du catalogue' },
    { ok: true, text: 'Badge "Vendeur Premium" sur votre profil' },
    { ok: true, text: 'Visibilité boostée auprès des acheteurs' },
    { ok: true, text: 'Support prioritaire' },
  ];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Statut actuel */}
      <div style={{
        background: isPremium
          ? 'linear-gradient(135deg, rgba(201,169,110,0.12), rgba(201,169,110,0.04))'
          : C.surface,
        border: `1px solid ${isPremium ? C.goldBorder : C.border}`,
        borderRadius: 20, padding: 32, marginBottom: 28,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24,
      }}>
        <div>
          <div style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
            Votre plan actuel
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: C.playfair, fontSize: 32, fontWeight: 700, color: isPremium ? C.gold : C.text }}>
              {isPremium ? '⭐ Premium' : 'Gratuit'}
            </span>
            {isPremium && (
              <span style={{
                fontFamily: C.dm, fontSize: 11, fontWeight: 700,
                background: C.goldDim, border: `1px solid ${C.goldBorder}`,
                color: C.gold, padding: '3px 12px', borderRadius: 20,
              }}>ACTIF</span>
            )}
          </div>
          {isPremium && activeUntil && (
            <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, marginTop: 6 }}>
              Actif jusqu'au <strong style={{ color: C.gold }}>{activeUntil}</strong>
            </div>
          )}
          {!isPremium && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontFamily: C.dm, fontSize: 13, color: C.text, fontWeight: 600 }}>
                3 annonces autorisées
              </div>
              <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted }}>
                {activeCars} / 3 annonces actives utilisées
              </div>
            </div>
          )}
        </div>
        {isPremium ? (
          <div style={{ fontSize: 56 }}>⭐</div>
        ) : (
          <div style={{ fontSize: 48, opacity: 0.3 }}>🔒</div>
        )}
      </div>

      {/* Avantages */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 32, marginBottom: 28 }}>
        <h3 style={{ fontFamily: C.playfair, fontSize: 22, color: C.text, margin: '0 0 20px', fontWeight: 600 }}>
          {isPremium ? 'Vos avantages Premium' : 'Passez au Premium'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(isPremium ? BENEFITS_PREMIUM : BENEFITS_FREE).map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: b.ok ? 'rgba(74,222,128,0.15)' : 'rgba(113,113,122,0.15)',
                border: `1px solid ${b.ok ? 'rgba(74,222,128,0.4)' : C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: b.ok ? '#4ade80' : C.subtle,
              }}>{b.ok ? '✓' : '✕'}</span>
              <span style={{ fontFamily: C.dm, fontSize: 14, color: b.ok ? C.text : C.subtle }}>
                {b.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      {!isPremium && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, marginBottom: 24 }}>
            <div>
              <h3 style={{ fontFamily: C.playfair, fontSize: 22, color: C.text, margin: '0 0 8px', fontWeight: 600 }}>
                Abonnement Premium
              </h3>
              <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
                Notre équipe vous contactera par téléphone ou email sous 24h pour valider votre abonnement et organiser le paiement (Wave, Orange Money ou virement).
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: C.playfair, fontSize: 36, fontWeight: 700, color: C.gold }}>5 000</div>
              <div style={{ fontFamily: C.dm, fontSize: 12, color: C.muted }}>FCFA / mois</div>
            </div>
          </div>

          {isRequested || done ? (
            <div style={{
              background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)',
              borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center',
            }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div>
                <div style={{ fontFamily: C.dm, fontSize: 14, fontWeight: 600, color: '#4ade80' }}>
                  Demande envoyée
                </div>
                <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, marginTop: 2 }}>
                  Notre équipe vous contactera sous 24h pour finaliser votre abonnement.
                </div>
              </div>
            </div>
          ) : (
            <button onClick={handleRequest} disabled={requesting} style={{
              width: '100%', padding: '16px',
              background: 'linear-gradient(135deg, rgba(201,169,110,0.2), rgba(201,169,110,0.08))',
              border: `1px solid ${C.goldBorder}`, borderRadius: 12,
              color: C.gold, fontFamily: C.dm, fontSize: 15, fontWeight: 700,
              cursor: requesting ? 'not-allowed' : 'pointer',
              opacity: requesting ? 0.7 : 1,
            }}>
              {requesting ? 'Envoi...' : '⭐ Demander le Premium — 5 000 FCFA/mois'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: C.faint, fontFamily: C.dm }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <p style={{ fontSize: 15, margin: 0 }}>{text}</p>
    </div>
  );
}

// ── Modale d'upgrade Premium ──────────────────────────────────────────────────
function PremiumUpgradeModal({ onClose, onRequested }) {
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const handleRequest = async () => {
    setLoading(true);
    try {
      await sellersApi.requestPremium();
      setDone(true);
      onRequested?.();
    } catch (e) {
      alert(e.response?.data?.error || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const PERKS = [
    'Annonces illimitées',
    'Badge ⭐ PREMIUM sur toutes vos annonces',
    'Priorité absolue en tête du catalogue',
    'Badge "Vendeur Premium" sur votre profil',
    'Visibilité boostée auprès des acheteurs',
    'Support prioritaire',
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(14px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: C.surface,
        border: `1px solid rgba(201,169,110,0.35)`,
        borderRadius: 24, padding: '40px 36px', maxWidth: 480, width: '100%',
        boxShadow: '0 0 80px rgba(201,169,110,0.12)',
      }}>
        {/* Icône */}
        <div style={{
          width: 76, height: 76, borderRadius: '50%', margin: '0 auto 24px',
          background: 'rgba(201,169,110,0.1)', border: '2px solid rgba(201,169,110,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34,
        }}>🔒</div>

        {/* Titre */}
        <h2 style={{
          fontFamily: C.playfair, fontSize: 24, fontWeight: 700,
          color: C.gold, textAlign: 'center', margin: '0 0 10px',
        }}>Limite atteinte</h2>

        <p style={{
          fontFamily: C.dm, fontSize: 14, color: C.muted,
          textAlign: 'center', margin: '0 0 28px', lineHeight: 1.7,
        }}>
          Vous avez atteint la limite de <strong style={{ color: C.text }}>3 annonces actives</strong> du plan Gratuit.<br />
          Passez au <strong style={{ color: C.gold }}>Premium</strong> pour publier sans limite.
        </p>

        {/* Avantages */}
        <div style={{
          background: '#0e0e10', border: `1px solid rgba(201,169,110,0.2)`,
          borderRadius: 14, padding: '18px 20px', marginBottom: 24,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {PERKS.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: '#4ade80',
              }}>✓</span>
              <span style={{ fontFamily: C.dm, fontSize: 13, color: C.text }}>{p}</span>
            </div>
          ))}
        </div>

        {done ? (
          <div style={{
            background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)',
            borderRadius: 12, padding: '14px', textAlign: 'center',
            fontFamily: C.dm, fontSize: 14, color: '#4ade80', marginBottom: 16,
          }}>
            ✅ Demande envoyée ! L'équipe vous contactera sous 24h.
          </div>
        ) : (
          <button onClick={handleRequest} disabled={loading} style={{
            width: '100%', padding: '14px',
            background: loading ? 'rgba(201,169,110,0.4)' : C.gold,
            border: 'none', color: C.bg, fontFamily: C.dm,
            fontSize: 15, fontWeight: 700, borderRadius: 12,
            cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 12,
          }}>
            {loading ? 'Envoi...' : '⭐ Demander l\'accès Premium'}
          </button>
        )}

        <button onClick={onClose} style={{
          width: '100%', padding: '12px',
          background: 'transparent', border: `1px solid ${C.border}`,
          color: C.muted, fontFamily: C.dm, fontSize: 14,
          borderRadius: 12, cursor: 'pointer',
        }}>Fermer</button>
      </div>
    </div>
  );
}

// ── Formulaire de creation / modification d'annonce ──────────────────────────
function CarFormModal({ car, onClose, onSaved, onPremiumRequired }) {
  const isEdit = !!car;
  const [form, setForm] = React.useState({
    make: car?.make || '',
    model: car?.model || '',
    year: car?.year || new Date().getFullYear(),
    price: car?.price || '',
    mileage: car?.mileage || '',
    fuel: car?.fuel || 'Essence',
    transmission: car?.transmission || 'Manuelle',
    power: car?.power || '',
    color: car?.color || '',
    doors: car?.doors || 4,
    seats: car?.seats || 5,
    location: car?.location || 'Dakar',
    description: car?.description || '',
    is_available: car?.is_available ?? true,
    listing_type: car?.listing_type || 'sale',
    rental_price_per_day: car?.rental_price_per_day || '',
    rental_deposit: car?.rental_deposit || '',
    rental_min_days: car?.rental_min_days || 1,
    rental_required_docs: car?.rental_required_docs ? car.rental_required_docs.join(', ') : '',
  });

  // Photos existantes et nouvelles photos
  const [existingImages, setExistingImages] = React.useState(car?.car_images || []);
  const [newFiles, setNewFiles] = React.useState([]);
  const [previews, setPreviews] = React.useState([]);

  // Sélection de l'image principale :
  // primaryType = 'existing' | 'new' | null
  // primaryExistingId = id de l'image existante choisie comme principale
  // primaryNewIdx = index dans newFiles de la nouvelle photo choisie comme principale
  const initialPrimaryId = car?.car_images?.find(i => i.is_primary)?.id ?? car?.car_images?.[0]?.id ?? null;
  const [primaryType, setPrimaryType] = React.useState(initialPrimaryId ? 'existing' : null);
  const [primaryExistingId, setPrimaryExistingId] = React.useState(initialPrimaryId);
  const [primaryNewIdx, setPrimaryNewIdx] = React.useState(null);

  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const [apiError, setApiError] = React.useState('');
  const fileInputRef = React.useRef(null);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: undefined }));
  };

  const selectExistingPrimary = (imgId) => {
    setPrimaryType('existing');
    setPrimaryExistingId(imgId);
    setPrimaryNewIdx(null);
  };

  const selectNewPrimary = (idx) => {
    setPrimaryType('new');
    setPrimaryNewIdx(idx);
    setPrimaryExistingId(null);
  };

  const validate = () => {
    const e = {};
    if (!form.make.trim()) e.make = 'Marque requise';
    if (!form.model.trim()) e.model = 'Modèle requis';
    const year = Number(form.year);
    if (!year || year < 1980 || year > new Date().getFullYear() + 1) e.year = 'Année invalide';
    if (!form.price || Number(form.price) <= 0) e.price = 'Prix invalide';
    if (form.mileage === '' || Number(form.mileage) < 0) e.mileage = 'Kilométrage invalide';
    if (!FUEL_OPTIONS.includes(form.fuel)) e.fuel = 'Carburant requis';
    if (!TRANSMISSION_OPTIONS.includes(form.transmission)) e.transmission = 'Transmission requise';
    if (!form.color.trim()) e.color = 'Couleur requise';
    if (!form.location.trim()) e.location = 'Localisation requise';
    if (!form.description.trim() || form.description.trim().length < 10) e.description = 'Description trop courte (min. 10 caractères)';
    return e;
  };

  const handlePickFiles = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newPreviews = await Promise.all(files.map(toPreview));
    setNewFiles(prev => [...prev, ...files]);
    setPreviews(prev => [...prev, ...newPreviews]);
    e.target.value = '';
  };

  const removeNewFile = (idx) => {
    setNewFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
    if (primaryType === 'new' && primaryNewIdx === idx) {
      setPrimaryType(null);
      setPrimaryNewIdx(null);
    } else if (primaryType === 'new' && primaryNewIdx > idx) {
      setPrimaryNewIdx(n => n - 1);
    }
  };

  const removeExistingImage = async (img) => {
    if (isEdit) {
      try { await carsApi.deleteImage(car.id, img.id); } catch { /* ignore */ }
    }
    setExistingImages(prev => prev.filter(i => i.id !== img.id));
    if (primaryExistingId === img.id) {
      setPrimaryType(null);
      setPrimaryExistingId(null);
    }
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    setApiError('');
    const payload = {
      ...form,
      year: Number(form.year),
      price: Number(form.price),
      mileage: Number(form.mileage),
      doors: Number(form.doors),
      seats: Number(form.seats),
      features: car?.features || [],
      tags: car?.tags || [],
      image: '',
      image_hero: '',
      rental_price_per_day: form.rental_price_per_day ? Number(form.rental_price_per_day) : null,
      rental_deposit: form.rental_deposit ? Number(form.rental_deposit) : null,
      rental_min_days: Number(form.rental_min_days) || 1,
      rental_required_docs: form.rental_required_docs
        ? form.rental_required_docs.split(',').map(s => s.trim()).filter(Boolean)
        : [],
    };
    try {
      let savedCar;
      if (isEdit) {
        const res = await carsApi.update(car.id, payload);
        savedCar = res.data;
      } else {
        const res = await carsApi.create(payload);
        savedCar = res.data;
      }

      // Upload des nouvelles photos
      let uploadedImages = [];
      if (newFiles.length > 0) {
        const uploadRes = await carsApi.uploadImages(savedCar.id, newFiles);
        uploadedImages = uploadRes.data;
      }

      // Définir l'image principale
      let primaryId = null;
      if (primaryType === 'existing' && primaryExistingId) {
        primaryId = primaryExistingId;
      } else if (primaryType === 'new' && primaryNewIdx !== null && uploadedImages[primaryNewIdx]) {
        primaryId = uploadedImages[primaryNewIdx].id;
      } else if (uploadedImages.length > 0 && existingImages.length === 0) {
        // Nouvelle annonce avec photos : la première devient principale
        primaryId = uploadedImages[0].id;
      } else if (!primaryExistingId && existingImages.length > 0) {
        // Pas de principale explicite, mais il y a des images existantes
        primaryId = existingImages[0].id;
      }

      if (primaryId) {
        await carsApi.setPrimaryImage(savedCar.id, primaryId);
      }

      onSaved();
    } catch (err) {
      if (err.response?.status === 403 && onPremiumRequired) {
        onClose();
        onPremiumRequired();
        return;
      }
      const data = err.response?.data;
      if (data?.detail) setApiError(data.detail);
      else if (typeof data === 'object' && data) {
        const firstKey = Object.keys(data)[0];
        setApiError(`${firstKey} : ${Array.isArray(data[firstKey]) ? data[firstKey][0] : data[firstKey]}`);
      } else setApiError("Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 6 };
  const labelStyle = { fontFamily: C.dm, fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' };
  const selectStyle = {
    background: '#0e0e10', border: `1px solid ${C.border}`,
    color: C.text, fontFamily: C.dm, fontSize: 14,
    padding: '11px 14px', borderRadius: 10, outline: 'none',
  };

  const hasImages = existingImages.length > 0 || previews.length > 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 20, padding: 32, width: '100%', maxWidth: 720,
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: C.playfair, fontSize: 24, color: C.text, margin: 0, fontWeight: 700 }}>
            {isEdit ? 'Modifier l\'annonce' : 'Nouvelle annonce'}
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: `1px solid ${C.border}`, color: C.muted,
            width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 16,
          }}>×</button>
        </div>

        {apiError && (
          <div style={{
            background: 'rgba(224,92,92,0.1)', border: '1px solid rgba(224,92,92,0.3)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 20,
            fontFamily: C.dm, fontSize: 13, color: C.error,
          }}>{apiError}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input label="Marque" value={form.make} onChange={e => set('make', e.target.value)} placeholder="Toyota" error={errors.make} />
          <Input label="Modèle" value={form.model} onChange={e => set('model', e.target.value)} placeholder="Corolla" error={errors.model} />
          <Input label="Année" type="number" value={form.year} onChange={e => set('year', e.target.value)} error={errors.year} />
          <Input label="Prix (FCFA)" type="number" value={form.price} onChange={e => set('price', e.target.value)} placeholder="8500000" error={errors.price} />
          <Input label="Kilométrage" type="number" value={form.mileage} onChange={e => set('mileage', e.target.value)} placeholder="50000" error={errors.mileage} />
          <Input label="Puissance" value={form.power} onChange={e => set('power', e.target.value)} placeholder="120 ch" />

          <div style={fieldStyle}>
            <label style={labelStyle}>Carburant</label>
            <select value={form.fuel} onChange={e => set('fuel', e.target.value)} style={selectStyle}>
              {FUEL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            {errors.fuel && <span style={{ fontFamily: C.dm, fontSize: 12, color: C.error }}>{errors.fuel}</span>}
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Transmission</label>
            <select value={form.transmission} onChange={e => set('transmission', e.target.value)} style={selectStyle}>
              {TRANSMISSION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            {errors.transmission && <span style={{ fontFamily: C.dm, fontSize: 12, color: C.error }}>{errors.transmission}</span>}
          </div>

          <Input label="Couleur" value={form.color} onChange={e => set('color', e.target.value)} placeholder="Noir métallisé" error={errors.color} />
          <Input label="Localisation" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Dakar" error={errors.location} />
          <Input label="Portes" type="number" value={form.doors} onChange={e => set('doors', e.target.value)} />
          <Input label="Places" type="number" value={form.seats} onChange={e => set('seats', e.target.value)} />
          <div>
            <label style={labelStyle}>Type d'annonce</label>
            <select value={form.listing_type} onChange={e => set('listing_type', e.target.value)} style={selectStyle}>
              <option value="sale">Vente uniquement</option>
              <option value="rental">Location uniquement</option>
              <option value="both">Vente et Location</option>
            </select>
          </div>
        </div>
        {(form.listing_type === 'rental' || form.listing_type === 'both') && (
          <div style={{ marginTop: 16, background: 'rgba(201,169,110,0.05)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontFamily: C.dm, fontSize: 12, fontWeight: 700, color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>Options de location</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Prix / jour (FCFA)" type="number" value={form.rental_price_per_day} onChange={e => set('rental_price_per_day', e.target.value)} placeholder="25000" />
              <Input label="Caution (FCFA)" type="number" value={form.rental_deposit} onChange={e => set('rental_deposit', e.target.value)} placeholder="100000" />
              <Input label="Durée min. (jours)" type="number" value={form.rental_min_days} onChange={e => set('rental_min_days', e.target.value)} placeholder="1" />
              <div>
                <label style={labelStyle}>Documents requis</label>
                <input value={form.rental_required_docs} onChange={e => set('rental_required_docs', e.target.value)} placeholder="Permis de conduire, CIN, Caution" style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontFamily: C.dm, fontSize: 13, boxSizing: 'border-box' }} />
                <div style={{ fontFamily: C.dm, fontSize: 11, color: C.subtle, marginTop: 4 }}>Séparez par des virgules</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Upload photos ── */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: hasImages ? 8 : 10 }}>
            <label style={labelStyle}>Photos de l'annonce</label>
            {hasImages && (
              <span style={{ fontFamily: C.dm, fontSize: 11, color: C.muted }}>
                Cliquez sur une photo pour la définir comme image principale (⭐)
              </span>
            )}
          </div>

          {/* Grille des photos existantes + nouvelles */}
          {hasImages && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
              {existingImages.map(img => {
                const isPrimary = primaryType === 'existing' && primaryExistingId === img.id;
                return (
                  <div key={img.id} style={{ position: 'relative', width: 100, height: 78 }}>
                    <img
                      src={img.url}
                      alt=""
                      onClick={() => selectExistingPrimary(img.id)}
                      style={{
                        width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8,
                        border: `2px solid ${isPrimary ? C.gold : C.border}`,
                        cursor: 'pointer', boxSizing: 'border-box',
                      }}
                    />
                    {isPrimary && (
                      <div style={{
                        position: 'absolute', bottom: 4, left: 4,
                        background: 'rgba(9,9,11,0.75)', borderRadius: 4,
                        fontSize: 11, padding: '1px 5px', color: C.gold,
                        fontFamily: C.dm, fontWeight: 700,
                      }}>⭐ Principale</div>
                    )}
                    <button onClick={() => removeExistingImage(img)} style={{
                      position: 'absolute', top: -6, right: -6,
                      background: '#e05c5c', border: 'none', color: '#fff',
                      width: 20, height: 20, borderRadius: '50%', cursor: 'pointer',
                      fontSize: 12, lineHeight: '20px', padding: 0,
                    }}>×</button>
                  </div>
                );
              })}
              {previews.map((src, idx) => {
                const isPrimary = primaryType === 'new' && primaryNewIdx === idx;
                return (
                  <div key={idx} style={{ position: 'relative', width: 100, height: 78 }}>
                    <img
                      src={src}
                      alt=""
                      onClick={() => selectNewPrimary(idx)}
                      style={{
                        width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8,
                        border: `2px solid ${isPrimary ? C.gold : C.goldBorder}`,
                        cursor: 'pointer', boxSizing: 'border-box',
                      }}
                    />
                    {isPrimary && (
                      <div style={{
                        position: 'absolute', bottom: 4, left: 4,
                        background: 'rgba(9,9,11,0.75)', borderRadius: 4,
                        fontSize: 11, padding: '1px 5px', color: C.gold,
                        fontFamily: C.dm, fontWeight: 700,
                      }}>⭐ Principale</div>
                    )}
                    <button onClick={() => removeNewFile(idx)} style={{
                      position: 'absolute', top: -6, right: -6,
                      background: '#e05c5c', border: 'none', color: '#fff',
                      width: 20, height: 20, borderRadius: '50%', cursor: 'pointer',
                      fontSize: 12, lineHeight: '20px', padding: 0,
                    }}>×</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bouton choisir */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handlePickFiles}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: 'transparent', border: `1.5px dashed ${C.border}`,
              color: C.muted, fontFamily: C.dm, fontSize: 13,
              padding: '12px 20px', borderRadius: 10, cursor: 'pointer',
              width: '100%',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
          >
            + Ajouter des photos
          </button>
        </div>

        <div style={{ marginTop: 16, ...fieldStyle }}>
          <label style={labelStyle}>Description</label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Décrivez l'état général, les options, l'historique..."
            rows={5}
            style={{
              background: '#0e0e10', border: `1px solid ${errors.description ? C.error : C.border}`,
              color: C.text, fontFamily: C.dm, fontSize: 14,
              padding: '11px 14px', borderRadius: 10, outline: 'none', resize: 'vertical',
            }}
          />
          {errors.description && <span style={{ fontFamily: C.dm, fontSize: 12, color: C.error }}>{errors.description}</span>}
        </div>

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="checkbox"
            id="is_available"
            checked={form.is_available}
            onChange={e => set('is_available', e.target.checked)}
            style={{ accentColor: C.gold, width: 16, height: 16 }}
          />
          <label htmlFor="is_available" style={{ fontFamily: C.dm, fontSize: 14, color: C.text }}>
            Annonce active (visible dans le catalogue)
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 28, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={saving} style={{
            background: 'transparent', border: `1px solid ${C.border}`,
            color: C.text, fontFamily: C.dm, fontSize: 14, fontWeight: 500,
            padding: '11px 22px', borderRadius: 10, cursor: 'pointer',
          }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{
            background: saving ? 'rgba(201,169,110,0.5)' : C.gold,
            border: 'none', color: C.bg, fontFamily: C.dm,
            fontSize: 14, fontWeight: 700, padding: '11px 24px',
            borderRadius: 10, cursor: saving ? 'not-allowed' : 'pointer',
          }}>{saving ? 'Enregistrement...' : (isEdit ? 'Mettre à jour' : 'Publier l\'annonce')}</button>
        </div>
      </div>
    </div>
  );
}
