import React from 'react';
import { C, StatusBadge, Spinner, Btn, toCFA } from './Shared';
import { adminApi, settingsApi } from '../api';

const REASON_LABELS = {
  fake: 'Annonce frauduleuse', wrong_price: 'Prix trompeur',
  not_responding: 'Vendeur ne répond pas', not_serious: 'Vendeur pas sérieux',
  already_sold: 'Véhicule déjà vendu', harassment: 'Comportement inapproprié', other: 'Autre raison',
};

const TABS = ['Vue d\'ensemble', 'Utilisateurs', 'Annonces', 'Vendeurs', 'Rendez-vous', 'Signalements', 'Sécurité & Audit', 'Paramètres'];

// ── Helpers ───────────────────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, ...style }}>
    {children}
  </div>
);

const ActionBtn = ({ label, color, bg, border, onClick }) => (
  <button onClick={onClick} style={{
    background: bg, border: `1px solid ${border}`, color,
    fontFamily: C.dm, fontSize: 11, fontWeight: 600, padding: '5px 12px',
    borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
  }}>{label}</button>
);

const SearchBar = ({ value, onChange, placeholder }) => (
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{
      background: C.surface, border: `1px solid ${C.border}`, color: C.text,
      fontFamily: C.dm, fontSize: 13, padding: '9px 14px', borderRadius: 8,
      outline: 'none', width: 240,
    }}
    onFocus={e => e.target.style.borderColor = C.gold}
    onBlur={e => e.target.style.borderColor = C.border}
  />
);

const EmptyState = ({ icon, text }) => (
  <div style={{ textAlign: 'center', padding: '60px 0', color: C.faint, fontFamily: C.dm }}>
    <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
    <p style={{ fontSize: 15, margin: 0 }}>{text}</p>
  </div>
);

const TableHeader = ({ cols }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: cols.join(' '),
    padding: '10px 16px', borderBottom: `1px solid ${C.border}`,
    fontFamily: C.dm, fontSize: 11, color: C.muted,
    textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
  }}>
    {cols.map((_, i) => <span key={i}>{['Nom', 'Email', 'Type', 'Statut', 'Actions'][i] || ''}</span>)}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminDashboard({ user, navigate, platformSettings = {}, onSettingsChange }) {
  const [tab, setTab] = React.useState(0);
  const [stats, setStats] = React.useState(null);
  const [loadingStats, setLoadingStats] = React.useState(true);

  React.useEffect(() => {
    adminApi.stats()
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingTop: 64 }}>
      {/* Header */}
      <div className="ac-page-header" style={{ borderBottom: `1px solid ${C.border2}`, padding: '32px 32px 24px', maxWidth: 1400, margin: '0 auto' }}>
        <div className="ac-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171', fontFamily: C.dm, fontSize: 11, fontWeight: 700,
                padding: '3px 10px', borderRadius: 20, letterSpacing: '0.06em',
              }}>ADMIN</div>
              <span style={{ fontFamily: C.dm, fontSize: 13, color: C.muted }}>Panneau d'administration</span>
            </div>
            <h1 className="ac-h1" style={{ fontFamily: C.playfair, fontSize: 34, color: C.text, margin: 0, fontWeight: 700 }}>
              AutoConnect Admin
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="secondary" onClick={() => navigate('home')}>← Site public</Btn>
          </div>
        </div>
      </div>

      <div className="ac-container" style={{ maxWidth: 1400, margin: '0 auto', padding: '0 32px 80px' }}>
        {/* Tabs */}
        <div className="ac-tabs" style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, margin: '24px 0 32px' }}>
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{
              background: 'none', border: 'none', color: tab === i ? C.gold : C.muted,
              fontFamily: C.dm, fontSize: 14, fontWeight: tab === i ? 600 : 400,
              padding: '12px 22px', cursor: 'pointer',
              borderBottom: `2px solid ${tab === i ? C.gold : 'transparent'}`,
              marginBottom: -1,
            }}>{t}</button>
          ))}
        </div>

        {/* Tab 0: Overview */}
        {tab === 0 && (
          loadingStats ? <Spinner /> : <OverviewTab stats={stats} />
        )}

        {/* Tab 1: Users */}
        {tab === 1 && <UsersTab />}

        {/* Tab 2: Cars */}
        {tab === 2 && <CarsTab navigate={navigate} />}

        {/* Tab 3: Sellers */}
        {tab === 3 && <SellersTab />}

        {/* Tab 4: Appointments */}
        {tab === 4 && <AppointmentsTab />}

        {/* Tab 5: Reports */}
        {tab === 5 && <ReportsTab />}

        {/* Tab 6: Security & Audit */}
        {tab === 6 && <SecurityTab />}

        {/* Tab 7: Platform settings */}
        {tab === 7 && <PlatformSettingsTab platformSettings={platformSettings} onSettingsChange={onSettingsChange} />}
      </div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
function OverviewTab({ stats }) {
  if (!stats) return <EmptyState icon="📊" text="Données indisponibles" />;

  const statCards = [
    { icon: '👥', label: 'Utilisateurs totaux', value: stats.users.total, sub: `+${stats.users.new_this_week} cette semaine`, color: '#818cf8' },
    { icon: '🚗', label: 'Annonces publiées', value: stats.cars.total, sub: `${stats.cars.active} actives`, color: C.gold },
    { icon: '📅', label: 'Rendez-vous', value: stats.appointments.total, sub: `${stats.appointments.pending} en attente`, color: '#4ade80' },
    { icon: '🏪', label: 'Vendeurs', value: stats.sellers.total, sub: `${stats.sellers.verified} vérifiés`, color: '#38bdf8' },
    { icon: '🚨', label: 'Signalements', value: stats.reports?.pending ?? 0, sub: 'en attente de traitement', color: '#f87171' },
    { icon: '🔒', label: 'Comptes bannis', value: stats.security?.banned_users ?? 0, sub: 'utilisateurs bannis', color: '#fb923c' },
  ];

  return (
    <div>
      {/* KPI cards */}
      <div className="ac-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 }}>
        {statCards.map(s => (
          <Card key={s.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 28 }}>{s.icon}</div>
              <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted, background: '#18181b', padding: '3px 8px', borderRadius: 6 }}>
                {s.sub}
              </div>
            </div>
            <div style={{ fontFamily: C.playfair, fontSize: 38, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <div className="ac-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
        {/* User breakdown */}
        <Card>
          <h3 style={{ fontFamily: C.playfair, fontSize: 18, color: C.text, margin: '0 0 20px', fontWeight: 600 }}>Répartition utilisateurs</h3>
          {[
            { label: 'Acheteurs', val: stats.users.buyers, color: C.gold },
            { label: 'Vendeurs', val: stats.users.sellers, color: '#818cf8' },
          ].map(item => {
            const pct = stats.users.total ? Math.round((item.val / stats.users.total) * 100) : 0;
            return (
              <div key={item.label} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: C.dm, fontSize: 13, color: C.text }}>{item.label}</span>
                  <span style={{ fontFamily: C.dm, fontSize: 13, color: item.color, fontWeight: 600 }}>{item.val} ({pct}%)</span>
                </div>
                <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: item.color, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </Card>

        {/* Appointments breakdown */}
        <Card>
          <h3 style={{ fontFamily: C.playfair, fontSize: 18, color: C.text, margin: '0 0 20px', fontWeight: 600 }}>Rendez-vous par statut</h3>
          {[
            { label: 'Confirmés', val: stats.appointments.confirmed, color: '#4ade80' },
            { label: 'En attente', val: stats.appointments.pending, color: '#facc15' },
            { label: 'Annulés', val: stats.appointments.cancelled, color: '#f87171' },
          ].map(item => {
            const pct = stats.appointments.total ? Math.round((item.val / stats.appointments.total) * 100) : 0;
            return (
              <div key={item.label} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: C.dm, fontSize: 13, color: C.text }}>{item.label}</span>
                  <span style={{ fontFamily: C.dm, fontSize: 13, color: item.color, fontWeight: 600 }}>{item.val} ({pct}%)</span>
                </div>
                <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: item.color, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </Card>

        {/* Fuel breakdown */}
        <Card>
          <h3 style={{ fontFamily: C.playfair, fontSize: 18, color: C.text, margin: '0 0 20px', fontWeight: 600 }}>Carburant annonces</h3>
          {(stats.cars.fuel_breakdown || []).map((f, i) => {
            const colors = [C.gold, '#818cf8', '#4ade80', '#38bdf8', '#f87171'];
            return (
              <div key={f.fuel} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: colors[i % colors.length], flexShrink: 0 }} />
                  <span style={{ fontFamily: C.dm, fontSize: 13, color: C.text }}>{f.fuel}</span>
                </div>
                <span style={{ fontFamily: C.dm, fontSize: 13, color: colors[i % colors.length], fontWeight: 600 }}>{f.count}</span>
              </div>
            );
          })}
        </Card>
      </div>

      {/* Recent activity */}
      <Card style={{ marginTop: 24 }}>
        <h3 style={{ fontFamily: C.playfair, fontSize: 18, color: C.text, margin: '0 0 20px', fontWeight: 600 }}>Activité récente</h3>
        {(stats.recent_activity || []).length === 0 ? (
          <EmptyState icon="📋" text="Aucune activité récente" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(stats.recent_activity || []).map(a => (
              <div key={a.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: C.bg, borderRadius: 10,
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: C.goldDim,
                    border: `1px solid ${C.goldBorder}`, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 14, flexShrink: 0,
                  }}>📅</div>
                  <div>
                    <div style={{ fontFamily: C.dm, fontSize: 13, color: C.text }}>{a.text}</div>
                    <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted }}>{a.date}</div>
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [confirm, setConfirm] = React.useState(null);
  const [banTarget, setBanTarget] = React.useState(null);
  const [banForm, setBanForm] = React.useState({ action: 'ban', reason: '', duration_days: '' });
  const [banLoading, setBanLoading] = React.useState(false);

  const load = (params = {}) => {
    setLoading(true);
    adminApi.users(params).then(r => setUsers(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  React.useEffect(() => {
    const params = {};
    if (search) params.q = search;
    if (typeFilter) params.type = typeFilter;
    const t = setTimeout(() => load(params), 300);
    return () => clearTimeout(t);
  }, [search, typeFilter]);

  const deleteUser = async (id) => {
    await adminApi.deleteUser(id);
    setUsers(prev => prev.filter(x => x.id !== id));
    setConfirm(null);
  };

  const handleBan = async () => {
    if (!banTarget) return;
    setBanLoading(true);
    try {
      const r = await adminApi.banUser(banTarget.id, banForm);
      setUsers(prev => prev.map(x => x.id === banTarget.id ? { ...x, account_status: r.data.account_status, is_banned: banForm.action === 'ban', is_active: banForm.action !== 'suspend' } : x));
      setBanTarget(null);
      setBanForm({ action: 'ban', reason: '', duration_days: '' });
    } catch (e) {
      alert(e.response?.data?.error || 'Erreur');
    } finally {
      setBanLoading(false);
    }
  };

  const STATUS_STYLE = {
    active: { bg: 'rgba(34,197,94,0.1)', color: '#4ade80', border: 'rgba(34,197,94,0.3)', label: 'Actif' },
    banned: { bg: 'rgba(239,68,68,0.1)', color: '#f87171', border: 'rgba(239,68,68,0.3)', label: 'Banni' },
    suspended: { bg: 'rgba(251,146,60,0.1)', color: '#fb923c', border: 'rgba(251,146,60,0.3)', label: 'Suspendu' },
  };
  const TYPE_COLORS = { buyer: { bg: C.goldDim, color: C.gold, border: C.goldBorder }, seller: { bg: 'rgba(129,140,248,0.1)', color: '#818cf8', border: 'rgba(129,140,248,0.3)' }, admin: { bg: 'rgba(239,68,68,0.1)', color: '#f87171', border: 'rgba(239,68,68,0.3)' } };

  return (
    <div>
      <div className="ac-wrap" style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un utilisateur..." />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{
          background: C.surface, border: `1px solid ${C.border}`, color: C.text,
          fontFamily: C.dm, fontSize: 13, padding: '9px 14px', borderRadius: 8, outline: 'none',
        }}>
          <option value="">Tous les types</option>
          <option value="buyer">Acheteurs</option>
          <option value="seller">Vendeurs</option>
          <option value="admin">Admins</option>
        </select>
        <span style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, marginLeft: 'auto' }}>
          {users.length} utilisateur{users.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? <Spinner /> : users.length === 0 ? <EmptyState icon="👥" text="Aucun utilisateur trouvé" /> : (
        <div className="ac-scroll-x">
        <Card style={{ padding: 0 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '40px 1fr 1fr 110px 110px 100px 160px',
            padding: '12px 20px', borderBottom: `1px solid ${C.border}`,
            fontFamily: C.dm, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {['', 'Nom', 'Email', 'Type', 'Statut', 'Signalements', 'Actions'].map(h => <span key={h}>{h}</span>)}
          </div>
          {users.map((u, i) => {
            const tc = TYPE_COLORS[u.user_type] || TYPE_COLORS.buyer;
            const sc = STATUS_STYLE[u.account_status] || STATUS_STYLE.active;
            return (
              <div key={u.id} style={{
                display: 'grid', gridTemplateColumns: '40px 1fr 1fr 110px 110px 100px 160px',
                padding: '14px 20px', alignItems: 'center', gap: 8,
                borderBottom: i < users.length - 1 ? `1px solid ${C.border2}` : 'none',
                background: u.is_banned ? 'rgba(239,68,68,0.03)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: C.goldDim,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: C.dm, fontSize: 11, fontWeight: 700, color: C.gold,
                }}>{u.avatar_initials || '?'}</div>
                <span style={{ fontFamily: C.dm, fontSize: 13, color: C.text, fontWeight: 500 }}>{u.name}</span>
                <span style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</span>
                <span style={{
                  fontFamily: C.dm, fontSize: 11, fontWeight: 600,
                  background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`,
                  padding: '3px 10px', borderRadius: 20, justifySelf: 'start',
                }}>{u.user_type}</span>
                <span style={{
                  fontFamily: C.dm, fontSize: 11, fontWeight: 600,
                  background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                  padding: '3px 10px', borderRadius: 20, justifySelf: 'start',
                }}>{sc.label}</span>
                <span style={{ fontFamily: C.dm, fontSize: 13, color: u.report_count > 0 ? '#f87171' : C.subtle, fontWeight: u.report_count > 0 ? 700 : 400, textAlign: 'center' }}>
                  {u.report_count > 0 ? `🚨 ${u.report_count}` : '—'}
                </span>
                <div style={{ display: 'flex', gap: 5 }}>
                  <ActionBtn label="Gérer"
                    color="#818cf8" bg="rgba(129,140,248,0.1)" border="rgba(129,140,248,0.3)"
                    onClick={() => { setBanTarget(u); setBanForm({ action: u.is_banned ? 'unban' : 'ban', reason: '', duration_days: '' }); }} />
                  <ActionBtn label="Suppr."
                    color="#f87171" bg="rgba(239,68,68,0.1)" border="rgba(239,68,68,0.3)"
                    onClick={() => setConfirm(u)} />
                </div>
              </div>
            );
          })}
        </Card>
        </div>
      )}

      {/* Ban / manage modal */}
      {banTarget && (
        <div className="ac-modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20,
        }}>
          <div className="ac-modal" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 36, maxWidth: 460, width: '90%' }}>
            <h3 style={{ fontFamily: C.playfair, fontSize: 22, color: C.text, margin: '0 0 6px' }}>Gérer le compte</h3>
            <p style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, margin: '0 0 24px' }}>
              {banTarget.name} · <span style={{ color: C.text }}>{banTarget.email}</span>
            </p>

            <label style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, display: 'block', marginBottom: 8 }}>Action</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {[
                { val: 'ban', label: '🔨 Bannir (permanent)', color: '#f87171' },
                { val: 'suspend', label: '⏸ Suspendre (temporaire)', color: '#fb923c' },
                { val: 'unban', label: '✓ Lever le bannissement', color: '#4ade80' },
                { val: 'unsuspend', label: '▶ Réactiver le compte', color: '#4ade80' },
              ].map(opt => (
                <button key={opt.val} onClick={() => setBanForm(f => ({ ...f, action: opt.val }))} style={{
                  background: banForm.action === opt.val ? 'rgba(255,255,255,0.07)' : 'transparent',
                  border: `1px solid ${banForm.action === opt.val ? C.border : C.border2}`,
                  color: banForm.action === opt.val ? opt.color : C.muted,
                  fontFamily: C.dm, fontSize: 12, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                }}>{opt.label}</button>
              ))}
            </div>

            {banForm.action === 'suspend' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, display: 'block', marginBottom: 6 }}>Durée (jours)</label>
                <input type="number" min="1" value={banForm.duration_days}
                  onChange={e => setBanForm(f => ({ ...f, duration_days: e.target.value }))}
                  placeholder="Ex: 7"
                  style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.dm, fontSize: 13, padding: '10px 14px', borderRadius: 8, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {['ban', 'suspend'].includes(banForm.action) && (
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, display: 'block', marginBottom: 6 }}>Motif</label>
                <textarea value={banForm.reason}
                  onChange={e => setBanForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Raison de la sanction..."
                  rows={3}
                  style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: C.dm, fontSize: 13, padding: '10px 14px', borderRadius: 8, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button onClick={() => setBanTarget(null)} style={{
                flex: 1, background: 'none', border: `1px solid ${C.border}`, color: C.text,
                fontFamily: C.dm, fontSize: 14, padding: '12px', borderRadius: 10, cursor: 'pointer',
              }}>Annuler</button>
              <button onClick={handleBan} disabled={banLoading} style={{
                flex: 1, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
                color: '#f87171', fontFamily: C.dm, fontSize: 14, fontWeight: 700,
                padding: '12px', borderRadius: 10, cursor: 'pointer', opacity: banLoading ? 0.6 : 1,
              }}>{banLoading ? '...' : 'Confirmer l\'action'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirm && (
        <ConfirmModal
          title="Supprimer l'utilisateur ?"
          message={`Cette action est irréversible. L'utilisateur "${confirm.name}" et toutes ses données seront supprimés.`}
          onConfirm={() => deleteUser(confirm.id)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ── Cars Tab ──────────────────────────────────────────────────────────────────
function CarsTab({ navigate }) {
  const [cars, setCars] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [confirm, setConfirm] = React.useState(null);

  const load = (params = {}) => {
    setLoading(true);
    adminApi.cars(params).then(r => setCars(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  React.useEffect(() => {
    const t = setTimeout(() => load(search ? { q: search } : {}), 300);
    return () => clearTimeout(t);
  }, [search]);

  const toggleAvail = async (c) => {
    await adminApi.updateCar(c.id, { is_available: !c.is_available });
    setCars(prev => prev.map(x => x.id === c.id ? { ...x, is_available: !c.is_available } : x));
  };

  const deleteCar = async (id) => {
    await adminApi.deleteCar(id);
    setCars(prev => prev.filter(x => x.id !== id));
    setConfirm(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Rechercher une annonce..." />
        <span style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, marginLeft: 'auto' }}>
          {cars.length} annonce{cars.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? <Spinner /> : cars.length === 0 ? <EmptyState icon="🚗" text="Aucune annonce" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cars.map(c => (
            <Card key={c.id} style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 0 }}>
                {/* Image */}
                <div style={{ height: 90, background: C.border, position: 'relative', overflow: 'hidden' }}>
                  {c.image && <img src={c.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                {/* Info */}
                <div style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontFamily: C.playfair, fontSize: 16, fontWeight: 700, color: C.text }}>
                      {c.make} {c.model} {c.year}
                    </span>
                    {c.badge && (
                      <span style={{
                        fontFamily: C.dm, fontSize: 10, color: C.gold, background: C.goldDim,
                        border: `1px solid ${C.goldBorder}`, padding: '2px 8px', borderRadius: 20,
                      }}>{c.badge}</span>
                    )}
                    <span style={{
                      fontFamily: C.dm, fontSize: 11, fontWeight: 600,
                      background: c.is_available ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      color: c.is_available ? '#4ade80' : '#f87171',
                      border: `1px solid ${c.is_available ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                      padding: '2px 8px', borderRadius: 20,
                    }}>{c.is_available ? 'Active' : 'Suspendue'}</span>
                  </div>
                  <div style={{ fontFamily: C.dm, fontSize: 12, color: C.muted }}>
                    🏪 {c.seller_name} {c.seller_verified ? '✓' : ''} · 📍 {c.location} · ⛽ {c.fuel}
                    · {(c.mileage || 0).toLocaleString('fr-FR')} km · 📅 {c.appointment_count} RDV · Publié le {c.created_at}
                  </div>
                </div>
                {/* Price + actions */}
                <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', gap: 8, minWidth: 200 }}>
                  <div style={{ fontFamily: C.playfair, fontSize: 20, fontWeight: 700, color: C.gold }}>
                    {toCFA(c.price)}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <ActionBtn label={c.is_available ? 'Suspendre' : 'Réactiver'}
                      color={c.is_available ? '#facc15' : '#4ade80'}
                      bg={c.is_available ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)'}
                      border={c.is_available ? 'rgba(234,179,8,0.3)' : 'rgba(34,197,94,0.3)'}
                      onClick={() => toggleAvail(c)} />
                    <ActionBtn label="Supprimer"
                      color="#f87171" bg="rgba(239,68,68,0.1)" border="rgba(239,68,68,0.3)"
                      onClick={() => setConfirm(c)} />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title="Supprimer l'annonce ?"
          message={`L'annonce "${confirm.make} ${confirm.model} ${confirm.year}" et tous ses rendez-vous seront supprimés définitivement.`}
          onConfirm={() => deleteCar(confirm.id)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ── Sellers Tab ───────────────────────────────────────────────────────────────
function SellersTab() {
  const [sellers, setSellers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [premiumModal, setPremiumModal] = React.useState(null);
  const [premiumMonths, setPremiumMonths] = React.useState(1);
  const [premiumSaving, setPremiumSaving] = React.useState(false);

  const load = () => {
    adminApi.sellers().then(r => setSellers(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  React.useEffect(() => { load(); }, []);

  const toggleVerify = async (s) => {
    await adminApi.verifySeller(s.id, { is_verified: !s.is_verified });
    setSellers(prev => prev.map(x => x.id === s.id ? { ...x, is_verified: !s.is_verified } : x));
  };

  const handlePremium = async (action) => {
    if (!premiumModal) return;
    setPremiumSaving(true);
    try {
      const r = await adminApi.sellerPremium(premiumModal.id, { action, months: premiumMonths });
      setSellers(prev => prev.map(x => x.id === premiumModal.id ? { ...x, ...r.data, premium_requested: false } : x));
      setPremiumModal(null);
    } catch (e) {
      alert(e.response?.data?.error || 'Erreur');
    } finally {
      setPremiumSaving(false);
    }
  };

  const pendingRequests = sellers.filter(s => s.premium_requested && !s.is_premium).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {pendingRequests > 0 && (
            <div style={{
              background: 'rgba(201,169,110,0.12)', border: `1px solid ${C.goldBorder}`,
              borderRadius: 10, padding: '8px 16px', fontFamily: C.dm, fontSize: 13, color: C.gold,
            }}>
              ⭐ {pendingRequests} demande{pendingRequests > 1 ? 's' : ''} Premium en attente
            </div>
          )}
        </div>
        <span style={{ fontFamily: C.dm, fontSize: 13, color: C.muted }}>
          {sellers.length} vendeur{sellers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? <Spinner /> : sellers.length === 0 ? <EmptyState icon="🏪" text="Aucun vendeur" /> : (
        <div className="ac-cards-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
          {sellers.map(s => (
            <Card key={s.id} style={{ border: `1px solid ${s.is_premium ? C.goldBorder : C.border}`, background: s.is_premium ? 'rgba(201,169,110,0.04)' : C.surface }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: s.is_premium ? 'rgba(201,169,110,0.2)' : '#27272A', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: C.dm, fontSize: 14, fontWeight: 700, color: s.is_premium ? C.gold : C.muted,
                }}>{s.avatar}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                    <span style={{ fontFamily: C.dm, fontSize: 15, fontWeight: 600, color: C.text }}>{s.name}</span>
                    {s.is_premium && (
                      <span style={{
                        fontFamily: C.dm, fontSize: 10, fontWeight: 800, color: '#09090B',
                        background: 'linear-gradient(135deg, #C9A96E, #b48c46)',
                        padding: '2px 8px', borderRadius: 20,
                      }}>⭐ PREMIUM</span>
                    )}
                    {s.is_verified && (
                      <span style={{
                        fontFamily: C.dm, fontSize: 10, color: '#4ade80', background: 'rgba(34,197,94,0.1)',
                        border: '1px solid rgba(34,197,94,0.3)', padding: '2px 8px', borderRadius: 20,
                      }}>✓ Vérifié</span>
                    )}
                    {s.premium_requested && !s.is_premium && (
                      <span style={{
                        fontFamily: C.dm, fontSize: 10, color: C.gold, background: C.goldDim,
                        border: `1px solid ${C.goldBorder}`, padding: '2px 8px', borderRadius: 20,
                      }}>⏳ Demande Premium</span>
                    )}
                  </div>
                  <div style={{ fontFamily: C.dm, fontSize: 12, color: C.muted }}>
                    {s.seller_type === 'pro' ? 'Professionnel' : 'Particulier'} · {s.location}
                  </div>
                  {s.is_premium && s.premium_until && (
                    <div style={{ fontFamily: C.dm, fontSize: 11, color: C.gold, marginTop: 2 }}>
                      Expire le {new Date(s.premium_until).toLocaleDateString('fr-FR')}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: C.playfair, fontSize: 18, color: C.gold, fontWeight: 700 }}>★ {s.rating}</div>
                  <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted }}>{s.review_count} avis</div>
                </div>
              </div>

              <div className="ac-specs-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'Annonces', val: s.car_count },
                  { label: 'RDV', val: s.appointment_count },
                  { label: 'Signalements', val: s.report_count, alert: s.report_count > 0 },
                  { label: 'Téléphone', val: s.phone || '—' },
                ].map(item => (
                  <div key={item.label} style={{ background: C.bg, borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontFamily: C.dm, fontSize: 14, fontWeight: 700, color: item.alert ? '#f87171' : C.text }}>{item.val}</div>
                    <div style={{ fontFamily: C.dm, fontSize: 10, color: C.muted }}>{item.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <ActionBtn
                  label={s.is_verified ? '✕ Retirer verif.' : '✓ Vérifier'}
                  color={s.is_verified ? '#f87171' : '#4ade80'}
                  bg={s.is_verified ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)'}
                  border={s.is_verified ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}
                  onClick={() => toggleVerify(s)}
                />
                <ActionBtn
                  label={s.is_premium ? '⭐ Gérer Premium' : (s.premium_requested ? '⭐ Activer Premium !' : '⭐ Activer Premium')}
                  color={C.gold}
                  bg={s.premium_requested && !s.is_premium ? 'rgba(201,169,110,0.2)' : C.goldDim}
                  border={C.goldBorder}
                  onClick={() => { setPremiumModal(s); setPremiumMonths(1); }}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal premium */}
      {premiumModal && (
        <div className="ac-modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20,
        }}>
          <div className="ac-modal" style={{ background: C.surface, border: `1px solid ${C.goldBorder}`, borderRadius: 20, padding: 36, maxWidth: 440, width: '100%' }}>
            <h3 style={{ fontFamily: C.playfair, fontSize: 22, color: C.text, margin: '0 0 6px' }}>
              ⭐ Abonnement Premium
            </h3>
            <p style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, margin: '0 0 24px' }}>
              {premiumModal.name} · {premiumModal.plan === 'premium' ? 'Actuellement Premium' : 'Compte gratuit'}
            </p>

            {premiumModal.plan !== 'premium' && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, display: 'block', marginBottom: 8 }}>
                  Durée de l'abonnement
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 3, 6, 12].map(m => (
                    <button key={m} onClick={() => setPremiumMonths(m)} style={{
                      flex: 1, padding: '10px 0',
                      background: premiumMonths === m ? C.goldDim : 'transparent',
                      border: `1px solid ${premiumMonths === m ? C.goldBorder : C.border2}`,
                      color: premiumMonths === m ? C.gold : C.muted,
                      fontFamily: C.dm, fontSize: 13, fontWeight: premiumMonths === m ? 700 : 400,
                      borderRadius: 10, cursor: 'pointer',
                    }}>{m} mois</button>
                  ))}
                </div>
                <div style={{ fontFamily: C.dm, fontSize: 13, color: C.gold, marginTop: 10, textAlign: 'right' }}>
                  Total : {(5000 * premiumMonths).toLocaleString('fr-FR')} FCFA
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPremiumModal(null)} style={{
                flex: 1, background: 'none', border: `1px solid ${C.border}`, color: C.muted,
                fontFamily: C.dm, fontSize: 14, padding: '12px', borderRadius: 10, cursor: 'pointer',
              }}>Annuler</button>
              {premiumModal.plan === 'premium' ? (
                <button onClick={() => handlePremium('deactivate')} disabled={premiumSaving} style={{
                  flex: 1, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#f87171', fontFamily: C.dm, fontSize: 14, fontWeight: 700,
                  padding: '12px', borderRadius: 10, cursor: 'pointer', opacity: premiumSaving ? 0.6 : 1,
                }}>{premiumSaving ? '...' : 'Désactiver Premium'}</button>
              ) : (
                <button onClick={() => handlePremium('activate')} disabled={premiumSaving} style={{
                  flex: 2, background: C.goldDim, border: `1px solid ${C.goldBorder}`,
                  color: C.gold, fontFamily: C.dm, fontSize: 14, fontWeight: 700,
                  padding: '12px', borderRadius: 10, cursor: 'pointer', opacity: premiumSaving ? 0.6 : 1,
                }}>{premiumSaving ? '...' : `⭐ Activer ${premiumMonths} mois`}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Appointments Tab ──────────────────────────────────────────────────────────
function AppointmentsTab() {
  const [appts, setAppts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState('');

  const load = (params = {}) => {
    setLoading(true);
    adminApi.appointments(params).then(r => setAppts(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  React.useEffect(() => {
    load(statusFilter ? { status: statusFilter } : {});
  }, [statusFilter]);

  const changeStatus = async (id, s) => {
    await adminApi.updateAppointment(id, { status: s });
    setAppts(prev => prev.map(x => x.id === id ? { ...x, status: s } : x));
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['', 'Tous'], ['pending', 'En attente'], ['confirmed', 'Confirmés'], ['cancelled', 'Annulés'], ['completed', 'Terminés']].map(([val, label]) => (
            <button key={val} onClick={() => setStatusFilter(val)} style={{
              background: statusFilter === val ? C.goldDim : 'transparent',
              border: `1px solid ${statusFilter === val ? C.goldBorder : C.border}`,
              color: statusFilter === val ? C.gold : C.muted,
              fontFamily: C.dm, fontSize: 12, padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
        <span style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, marginLeft: 'auto' }}>
          {appts.length} rendez-vous
        </span>
      </div>

      {loading ? <Spinner /> : appts.length === 0 ? <EmptyState icon="📅" text="Aucun rendez-vous" /> : (
        <div className="ac-scroll-x">
        <Card style={{ padding: 0 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 110px 110px 160px',
            padding: '12px 20px', borderBottom: `1px solid ${C.border}`,
            fontFamily: C.dm, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {['Véhicule', 'Acheteur', 'Vendeur', 'Date / Heure', 'Statut', 'Actions'].map(h => <span key={h}>{h}</span>)}
          </div>
          {appts.map((a, i) => (
            <div key={a.id} style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 110px 110px 160px',
              padding: '14px 20px', alignItems: 'center', gap: 8,
              borderBottom: i < appts.length - 1 ? `1px solid ${C.border2}` : 'none',
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
            }}>
              <span style={{ fontFamily: C.dm, fontSize: 13, color: C.text, fontWeight: 500 }}>{a.car}</span>
              <span style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.buyer}</span>
              <span style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.seller}</span>
              <span style={{ fontFamily: C.dm, fontSize: 12, color: C.text }}>{a.date}<br /><span style={{ color: C.muted }}>{a.time}</span></span>
              <StatusBadge status={a.status} />
              <div style={{ display: 'flex', gap: 6 }}>
                {a.status === 'pending' && (
                  <>
                    <ActionBtn label="Confirmer" color="#4ade80" bg="rgba(34,197,94,0.1)" border="rgba(34,197,94,0.3)" onClick={() => changeStatus(a.id, 'confirmed')} />
                    <ActionBtn label="Annuler" color="#f87171" bg="rgba(239,68,68,0.1)" border="rgba(239,68,68,0.3)" onClick={() => changeStatus(a.id, 'cancelled')} />
                  </>
                )}
                {a.status === 'confirmed' && (
                  <ActionBtn label="Terminer" color="#818cf8" bg="rgba(129,140,248,0.1)" border="rgba(129,140,248,0.3)" onClick={() => changeStatus(a.id, 'completed')} />
                )}
              </div>
            </div>
          ))}
        </Card>
        </div>
      )}
    </div>
  );
}

// ── Reports Tab ───────────────────────────────────────────────────────────────
function ReportsTab() {
  const [reports, setReports] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState('pending');
  const [selected, setSelected] = React.useState(null);
  const [form, setForm] = React.useState({ status: 'resolved', admin_note: '', admin_action: '' });
  const [saving, setSaving] = React.useState(false);

  const load = (params = {}) => {
    setLoading(true);
    adminApi.reports(params).then(r => setReports(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  React.useEffect(() => {
    load(statusFilter ? { status: statusFilter } : {});
  }, [statusFilter]);

  const openReport = (r) => {
    setSelected(r);
    setForm({ status: 'resolved', admin_note: r.admin_note || '', admin_action: r.admin_action || '' });
  };

  const handleSubmit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await adminApi.handleReport(selected.id, form);
      setReports(prev => prev.map(r => r.id === selected.id ? { ...r, ...form } : r));
      setSelected(null);
    } catch (e) {
      alert(e.response?.data?.error || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const REPORT_STATUS = {
    pending: { color: '#facc15', label: 'En attente' },
    resolved: { color: '#4ade80', label: 'Résolu' },
    dismissed: { color: C.muted, label: 'Rejeté' },
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center' }}>
        {[['pending', 'En attente'], ['resolved', 'Résolus'], ['dismissed', 'Rejetés'], ['', 'Tous']].map(([val, label]) => (
          <button key={val} onClick={() => setStatusFilter(val)} style={{
            background: statusFilter === val ? C.goldDim : 'transparent',
            border: `1px solid ${statusFilter === val ? C.goldBorder : C.border}`,
            color: statusFilter === val ? C.gold : C.muted,
            fontFamily: C.dm, fontSize: 12, padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
          }}>{label}</button>
        ))}
        <span style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, marginLeft: 'auto' }}>
          {reports.length} signalement{reports.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? <Spinner /> : reports.length === 0 ? <EmptyState icon="🚨" text="Aucun signalement" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reports.map(r => {
            const sc = REPORT_STATUS[r.status] || REPORT_STATUS.pending;
            return (
              <Card key={r.id} style={{ cursor: 'pointer' }} onClick={() => openReport(r)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Badges statut / motif */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                      <span style={{
                        fontFamily: C.dm, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                        background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)',
                        padding: '3px 12px', borderRadius: 20,
                      }}>{REASON_LABELS[r.reason] || r.reason}</span>
                      <span style={{
                        fontFamily: C.dm, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                        color: sc.color, border: `1px solid ${sc.color}50`, background: `${sc.color}18`,
                        padding: '3px 12px', borderRadius: 20,
                      }}>{sc.label}</span>
                    </div>
                    {/* Vendeur / annonce */}
                    <div style={{ display: 'flex', gap: 20, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: C.dm, fontSize: 13, color: C.text, fontWeight: 500 }}>
                        🏪 <span style={{ color: C.text }}>{r.seller_name}</span>
                      </span>
                      <span style={{ fontFamily: C.dm, fontSize: 13, color: C.muted }}>
                        🚗 {r.car_label}
                      </span>
                    </div>
                    <div style={{ fontFamily: C.dm, fontSize: 12, color: C.muted }}>
                      Signalé par <strong style={{ color: C.subtle }}>{r.reporter_name}</strong> · {r.created_at}
                    </div>
                    {r.description && (
                      <p style={{
                        fontFamily: C.dm, fontSize: 12, color: C.subtle, margin: '8px 0 0',
                        lineHeight: 1.5, fontStyle: 'italic',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>"{r.description}"</p>
                    )}
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <ActionBtn label="Traiter →" color={C.gold} bg={C.goldDim} border={C.goldBorder} onClick={() => openReport(r)} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Report handling modal */}
      {selected && (
        <div className="ac-modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px',
        }}>
          <div className="ac-modal" style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20,
            width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* En-tête */}
            <div style={{ padding: '28px 28px 20px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                    Signalement #{selected.id}
                  </div>
                  <h3 style={{ fontFamily: C.playfair, fontSize: 20, color: C.text, margin: 0 }}>
                    {REASON_LABELS[selected.reason] || selected.reason}
                  </h3>
                </div>
                <button onClick={() => setSelected(null)} style={{
                  background: 'none', border: 'none', color: C.muted, fontSize: 20,
                  cursor: 'pointer', padding: 4, lineHeight: 1,
                }}>✕</button>
              </div>
              {/* Infos vendeur / annonce */}
              <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                <div style={{ background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 10, padding: '10px 16px', flex: 1 }}>
                  <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted, marginBottom: 4 }}>VENDEUR</div>
                  <div style={{ fontFamily: C.dm, fontSize: 13, color: C.text, fontWeight: 600 }}>{selected.seller_name}</div>
                </div>
                <div style={{ background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 10, padding: '10px 16px', flex: 1 }}>
                  <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted, marginBottom: 4 }}>ANNONCE</div>
                  <div style={{ fontFamily: C.dm, fontSize: 13, color: C.text, fontWeight: 600 }}>{selected.car_label}</div>
                </div>
                <div style={{ background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 10, padding: '10px 16px', flex: 1 }}>
                  <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted, marginBottom: 4 }}>SIGNALÉ PAR</div>
                  <div style={{ fontFamily: C.dm, fontSize: 13, color: C.text, fontWeight: 600 }}>{selected.reporter_name}</div>
                </div>
              </div>
              {selected.description && (
                <div style={{ background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 10, padding: '12px 16px', marginTop: 12 }}>
                  <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted, marginBottom: 4 }}>MESSAGE</div>
                  <p style={{ fontFamily: C.dm, fontSize: 13, color: C.subtle, margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
                    "{selected.description}"
                  </p>
                </div>
              )}
            </div>

            {/* Corps */}
            <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Action */}
              <div>
                <div style={{ fontFamily: C.dm, fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                  Action à appliquer
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { val: '', label: 'Aucune action', icon: '—', color: C.muted },
                    { val: 'warn', label: 'Envoyer un avertissement au vendeur', icon: '⚠', color: '#facc15' },
                    { val: 'suspend_car', label: "Suspendre l'annonce", icon: '🚗', color: '#fb923c' },
                    { val: 'suspend_user', label: 'Suspendre le compte vendeur', icon: '⏸', color: '#fb923c' },
                    { val: 'ban_user', label: 'Bannir définitivement le vendeur', icon: '🔨', color: '#f87171' },
                  ].map(opt => {
                    const active = form.admin_action === opt.val;
                    return (
                      <button key={opt.val} onClick={() => setForm(f => ({ ...f, admin_action: opt.val }))} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
                        border: `1px solid ${active ? opt.color + '60' : C.border2}`,
                        borderRadius: 10, padding: '11px 14px', cursor: 'pointer', textAlign: 'left', width: '100%',
                      }}>
                        <span style={{ fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 }}>{opt.icon}</span>
                        <span style={{ fontFamily: C.dm, fontSize: 13, color: active ? opt.color : C.muted, fontWeight: active ? 600 : 400 }}>
                          {opt.label}
                        </span>
                        {active && <span style={{ marginLeft: 'auto', color: opt.color, fontSize: 14 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Décision */}
              <div>
                <div style={{ fontFamily: C.dm, fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                  Clôturer le signalement
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { val: 'resolved', label: '✓ Résolu', color: '#4ade80' },
                    { val: 'dismissed', label: '✕ Rejeter', color: C.muted },
                  ].map(({ val, label, color }) => (
                    <button key={val} onClick={() => setForm(f => ({ ...f, status: val }))} style={{
                      flex: 1, padding: '12px',
                      background: form.status === val ? (val === 'resolved' ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)') : 'transparent',
                      border: `1px solid ${form.status === val ? color + '60' : C.border2}`,
                      color: form.status === val ? color : C.muted,
                      fontFamily: C.dm, fontSize: 13, fontWeight: form.status === val ? 600 : 400,
                      borderRadius: 10, cursor: 'pointer',
                    }}>{label}</button>
                  ))}
                </div>
              </div>

              {/* Note admin */}
              <div>
                <div style={{ fontFamily: C.dm, fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                  Note interne (facultatif)
                </div>
                <textarea
                  value={form.admin_note}
                  onChange={e => setForm(f => ({ ...f, admin_note: e.target.value }))}
                  placeholder="Ajoutez une note visible uniquement par les admins..."
                  rows={3}
                  style={{
                    width: '100%', background: C.bg, border: `1px solid ${C.border}`, color: C.text,
                    fontFamily: C.dm, fontSize: 13, padding: '11px 14px', borderRadius: 10,
                    outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Pied */}
            <div style={{ padding: '0 28px 28px', display: 'flex', gap: 10 }}>
              <button onClick={() => setSelected(null)} style={{
                flex: 1, background: 'none', border: `1px solid ${C.border}`, color: C.muted,
                fontFamily: C.dm, fontSize: 14, padding: '13px', borderRadius: 12, cursor: 'pointer',
              }}>Annuler</button>
              <button onClick={handleSubmit} disabled={saving} style={{
                flex: 2, background: C.goldDim, border: `1px solid ${C.goldBorder}`, color: C.gold,
                fontFamily: C.dm, fontSize: 14, fontWeight: 700, padding: '13px', borderRadius: 12,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
              }}>{saving ? 'Enregistrement...' : 'Valider la décision'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Security & Audit Tab ───────────────────────────────────────────────────────
function SecurityTab() {
  const [logs, setLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    adminApi.auditLog().then(r => setLogs(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const ACTION_ICONS = {
    ban_user: '🔨', unban_user: '✓', suspend_user: '⏸', unsuspend_user: '▶',
    update_user: '✏️', handle_report_resolved: '✅', handle_report_dismissed: '❌',
    handle_report_warn: '⚠', handle_report_suspend_car: '🚗', handle_report_ban_user: '🔨',
  };

  const ACTION_COLORS = {
    ban_user: '#f87171', unban_user: '#4ade80', suspend_user: '#fb923c',
    unsuspend_user: '#4ade80', update_user: '#818cf8',
  };

  return (
    <div>
      <div className="ac-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 className="ac-h2" style={{ fontFamily: C.playfair, fontSize: 24, color: C.text, margin: '0 0 4px' }}>Journal d'audit</h2>
          <p style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, margin: 0 }}>
            Toutes les actions administrateur sont enregistrées ici. Les 100 dernières entrées sont affichées.
          </p>
        </div>
        <button onClick={() => { setLoading(true); adminApi.auditLog().then(r => setLogs(r.data)).finally(() => setLoading(false)); }} style={{
          background: C.goldDim, border: `1px solid ${C.goldBorder}`, color: C.gold,
          fontFamily: C.dm, fontSize: 13, padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
        }}>↻ Actualiser</button>
      </div>

      {loading ? <Spinner /> : logs.length === 0 ? <EmptyState icon="🔒" text="Aucune entrée dans le journal" /> : (
        <div className="ac-scroll-x">
        <Card style={{ padding: 0 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1fr auto',
            padding: '12px 20px', borderBottom: `1px solid ${C.border}`,
            fontFamily: C.dm, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {['', 'Action', 'Admin', 'Cible', 'Date'].map(h => <span key={h}>{h}</span>)}
          </div>
          {logs.map((l, i) => {
            const icon = ACTION_ICONS[l.action] || '•';
            const color = ACTION_COLORS[l.action] || C.muted;
            return (
              <div key={l.id} style={{
                display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1fr auto',
                padding: '13px 20px', alignItems: 'center', gap: 8,
                borderBottom: i < logs.length - 1 ? `1px solid ${C.border2}` : 'none',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
              }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <div>
                  <span style={{ fontFamily: C.dm, fontSize: 13, fontWeight: 600, color }}>
                    {l.action.replace(/_/g, ' ')}
                  </span>
                  {l.note && <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted, marginTop: 2 }}>{l.note}</div>}
                </div>
                <span style={{ fontFamily: C.dm, fontSize: 12, color: C.muted }}>{l.admin_name || l.admin}</span>
                <div>
                  <div style={{ fontFamily: C.dm, fontSize: 12, color: C.text }}>{l.target_repr}</div>
                  <div style={{ fontFamily: C.dm, fontSize: 11, color: C.subtle }}>{l.target_type} #{l.target_id}</div>
                </div>
                <span style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>{l.created_at}</span>
              </div>
            );
          })}
        </Card>
        </div>
      )}
    </div>
  );
}

// ── Platform Settings Tab ─────────────────────────────────────────────────────
function PlatformSettingsTab({ platformSettings, onSettingsChange }) {
  const [settings, setSettings] = React.useState(null);
  const [saving, setSaving] = React.useState(null);
  const [saved, setSaved] = React.useState(null);

  React.useEffect(() => {
    settingsApi.admin().then(r => setSettings(r.data)).catch(() => {});
  }, []);

  const toggle = async (key) => {
    if (!settings) return;
    const newVal = !settings[key];
    setSaving(key);
    try {
      const r = await settingsApi.update({ [key]: newVal });
      setSettings(r.data);
      onSettingsChange && onSettingsChange(prev => ({ ...prev, [key]: newVal }));
      setSaved(key);
      setTimeout(() => setSaved(null), 2500);
    } catch (e) {
      alert('Erreur lors de la mise à jour');
    } finally {
      setSaving(null);
    }
  };

  if (!settings) return <Spinner />;

  const features = [
    {
      key: 'premium_enabled',
      icon: '⭐',
      title: 'Abonnements Premium vendeurs',
      description: 'Permet aux vendeurs de souscrire à un abonnement Premium (5 000 FCFA/mois). Leurs annonces sont boostées en tête du catalogue et affichent un badge ⭐ PREMIUM. Tant que cette option est désactivée, aucun vendeur ne voit l\'onglet Abonnement et aucun badge n\'apparaît dans le catalogue.',
      impact: [
        'Onglet "Abonnement ⭐" visible dans le dashboard vendeur',
        'Badge ⭐ PREMIUM sur les cartes annonces',
        'Annonces Premium triées en priorité dans le catalogue',
        'Demandes de souscription activées',
      ],
    },
  ];

  return (
    <div style={{ maxWidth: 740, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: C.playfair, fontSize: 26, color: C.text, margin: '0 0 6px' }}>
          Paramètres de la plateforme
        </h2>
        <p style={{ fontFamily: C.dm, fontSize: 14, color: C.muted, margin: 0 }}>
          Activez ou désactivez les fonctionnalités de la plateforme. Les changements s'appliquent immédiatement à tous les utilisateurs.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {features.map(f => {
          const isOn = settings[f.key];
          const isSaving = saving === f.key;
          const justSaved = saved === f.key;

          return (
            <div key={f.key} style={{
              background: isOn ? 'rgba(201,169,110,0.04)' : C.surface,
              border: `1px solid ${isOn ? C.goldBorder : C.border}`,
              borderRadius: 20, overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{ padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 24 }}>{f.icon}</span>
                    <span style={{ fontFamily: C.dm, fontSize: 16, fontWeight: 700, color: C.text }}>{f.title}</span>
                    <span style={{
                      fontFamily: C.dm, fontSize: 11, fontWeight: 700,
                      background: isOn ? 'rgba(74,222,128,0.12)' : 'rgba(113,113,122,0.15)',
                      color: isOn ? '#4ade80' : C.muted,
                      border: `1px solid ${isOn ? 'rgba(74,222,128,0.35)' : C.border}`,
                      padding: '2px 10px', borderRadius: 20,
                    }}>{isOn ? 'ACTIF' : 'INACTIF'}</span>
                    {justSaved && (
                      <span style={{ fontFamily: C.dm, fontSize: 12, color: '#4ade80' }}>✓ Sauvegardé</span>
                    )}
                  </div>
                  <p style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.7 }}>
                    {f.description}
                  </p>
                </div>

                {/* Toggle switch */}
                <button
                  onClick={() => toggle(f.key)}
                  disabled={isSaving}
                  style={{
                    width: 56, height: 30, borderRadius: 15, border: 'none',
                    background: isOn ? C.gold : '#3f3f46',
                    cursor: isSaving ? 'wait' : 'pointer',
                    position: 'relative', flexShrink: 0,
                    transition: 'background 0.25s',
                    opacity: isSaving ? 0.7 : 1,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3,
                    left: isOn ? 29 : 3,
                    width: 24, height: 24, borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.25s',
                    display: 'block',
                  }} />
                </button>
              </div>

              {/* Impact list */}
              <div style={{ borderTop: `1px solid ${C.border2}`, padding: '16px 28px', background: 'rgba(0,0,0,0.15)' }}>
                <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                  Ce que cette option active
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {f.impact.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ color: isOn ? '#4ade80' : C.subtle, flexShrink: 0, marginTop: 1 }}>
                        {isOn ? '✓' : '○'}
                      </span>
                      <span style={{ fontFamily: C.dm, fontSize: 12, color: isOn ? C.text : C.subtle, lineHeight: 1.5 }}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dernière modification */}
              {settings.updated_at && (
                <div style={{ padding: '10px 28px', borderTop: `1px solid ${C.border2}` }}>
                  <span style={{ fontFamily: C.dm, fontSize: 11, color: C.subtle }}>
                    Dernière modification : {new Date(settings.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {settings.updated_by && ` par ${settings.updated_by}`}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <div className="ac-modal-overlay" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20,
    }}>
      <div className="ac-modal" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 36, maxWidth: 420, width: '90%' }}>
        <h3 style={{ fontFamily: C.playfair, fontSize: 22, color: C.text, margin: '0 0 12px' }}>{title}</h3>
        <p style={{ fontFamily: C.dm, fontSize: 14, color: C.muted, margin: '0 0 28px', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onCancel} style={{
            flex: 1, background: 'none', border: `1px solid ${C.border}`, color: C.text,
            fontFamily: C.dm, fontSize: 14, padding: '12px', borderRadius: 10, cursor: 'pointer',
          }}>Annuler</button>
          <button onClick={onConfirm} style={{
            flex: 1, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
            color: '#f87171', fontFamily: C.dm, fontSize: 14, fontWeight: 700,
            padding: '12px', borderRadius: 10, cursor: 'pointer',
          }}>Confirmer</button>
        </div>
      </div>
    </div>
  );
}
