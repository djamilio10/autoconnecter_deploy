import React from 'react';
import { Navbar } from './components/Shared';
import HomePage from './components/HomePage';
import Catalogue from './components/Catalogue';
import CarDetail from './components/CarDetail';
import Booking from './components/Booking';
import Auth from './components/Auth';
import SellerDashboard from './components/SellerDashboard';
import BuyerDashboard from './components/BuyerDashboard';
import AdminDashboard from './components/AdminDashboard';
import Settings from './components/Settings';
import Messaging from './components/Messaging';
import RentalRequest from './components/RentalRequest';
import { favoritesApi, authApi, clearAuth, settingsApi, bootstrapAuth, sellersApi } from './api';

export default function App() {
  const [view, setView] = React.useState('home');
  const [params, setParams] = React.useState({});
  const [user, setUser] = React.useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [favorites, setFavorites] = React.useState([]);
  const [visible, setVisible] = React.useState(true);
  const [platformSettings, setPlatformSettings] = React.useState({ premium_enabled: false });
  // Bandeau de retour de paiement PayTech (?premium=success|cancel&ref=...).
  const [premiumNotice, setPremiumNotice] = React.useState(null);

  const navigate = React.useCallback((newView, newParams = {}) => {
    setVisible(false);
    setTimeout(() => {
      setView(newView);
      setParams(newParams);
      setVisible(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 120);
  }, []);

  const handleSetUser = React.useCallback((u) => {
    setUser(u);
    if (u) localStorage.setItem('user', JSON.stringify(u));
    else localStorage.removeItem('user');
  }, []);

  const handleLogout = React.useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearAuth();
    setFavorites([]);
    handleSetUser(null);
    navigate('home');
  }, [navigate, handleSetUser]);

  // ── Validation de la session au montage et sync entre onglets ─────────────
  React.useEffect(() => {
    // Refresh-token est dans un cookie HttpOnly : on tente une restauration silencieuse
    // au démarrage. Si le cookie est valide, /token/refresh renvoie un nouvel access
    // qui est stocké en mémoire. On rappelle ensuite /profile/ pour rafraîchir l'user.
    (async () => {
      const ok = await bootstrapAuth();
      if (!ok) {
        if (user) handleSetUser(null);
        return;
      }
      try {
        const res = await authApi.profile();
        handleSetUser(res.data);
      } catch {
        clearAuth();
        handleSetUser(null);
      }
    })();

    // Charger les settings publics de la plateforme
    settingsApi.public().then(r => setPlatformSettings(r.data)).catch(() => {});

    // Auto-logout si l'intercepteur axios declenche un evenement
    const onAuthLogout = () => {
      clearAuth();
      setFavorites([]);
      handleSetUser(null);
      navigate('home');
    };
    window.addEventListener('auth:logout', onAuthLogout);

    // Sync logout entre plusieurs onglets : si une autre instance retire l'entrée
    // user du localStorage, on se déconnecte ici aussi.
    const onStorage = (e) => {
      if (e.key === 'user' && !e.newValue) {
        handleSetUser(null);
        setFavorites([]);
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('auth:logout', onAuthLogout);
      window.removeEventListener('storage', onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Retour de paiement PayTech ─────────────────────────────────────────────
  // PayTech redirige vers FRONTEND_URL/?premium=success|cancel&ref=... À l'activation
  // étant asynchrone (via IPN), on sonde l'état du paiement quelques secondes.
  React.useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const result = sp.get('premium');
    const ref = sp.get('ref');
    if (!result) return;

    // Nettoie l'URL pour éviter de rejouer au rafraîchissement.
    window.history.replaceState({}, '', window.location.pathname);

    if (result === 'cancel') {
      setPremiumNotice({ type: 'cancel', text: 'Paiement annulé. Aucun montant n\'a été débité.' });
      return;
    }
    if (result !== 'success') return;

    setPremiumNotice({ type: 'pending', text: 'Paiement reçu — activation de votre Premium en cours…' });
    navigate('seller-dashboard');

    let tries = 0;
    const poll = async () => {
      tries += 1;
      try {
        const r = await sellersApi.premiumStatus(ref);
        if (r.data.status === 'success' || r.data.plan === 'premium') {
          setPremiumNotice({ type: 'success', text: '⭐ Premium activé ! Merci de votre confiance.' });
          return;
        }
      } catch { /* on réessaie */ }
      if (tries < 8) {
        setTimeout(poll, 2500);
      } else {
        setPremiumNotice({
          type: 'pending',
          text: 'Paiement en cours de traitement. Votre Premium s\'activera dès confirmation (sous quelques minutes).',
        });
      }
    };
    setTimeout(poll, 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Charge les favoris quand l'utilisateur se connecte
  React.useEffect(() => {
    if (!user) { setFavorites([]); return; }
    favoritesApi.list()
      .then(res => setFavorites((res.data || []).map(f => f.car?.id || f.car_id || f.id).filter(Boolean)))
      .catch(() => {});
  }, [user?.id]);

  const toggleFavorite = React.useCallback(async (carId) => {
    try {
      await favoritesApi.toggle(carId);
      setFavorites(prev =>
        prev.includes(carId) ? prev.filter(id => id !== carId) : [...prev, carId]
      );
    } catch {
      // If not logged in, optimistic toggle for UI
      setFavorites(prev =>
        prev.includes(carId) ? prev.filter(id => id !== carId) : [...prev, carId]
      );
    }
  }, []);

  const renderView = () => {
    switch (view) {
      case 'home':
        return <HomePage navigate={navigate} user={user} />;
      case 'catalogue':
        return <Catalogue navigate={navigate} favorites={favorites} onToggleFavorite={toggleFavorite} platformSettings={platformSettings} />;
      case 'car-detail':
        return <CarDetail carId={params.carId} navigate={navigate} user={user} favorites={favorites} onToggleFavorite={toggleFavorite} />;
      case 'booking':
        return <Booking carId={params.carId} sellerId={params.sellerId} navigate={navigate} user={user} />;
      case 'rental-request':
        return <RentalRequest carId={params.carId} navigate={navigate} user={user} />;
      case 'auth':
        return <Auth navigate={navigate} setUser={handleSetUser} initialMode={params.mode} initialType={params.type} />;
      case 'seller-dashboard':
        return <SellerDashboard user={user} navigate={navigate} platformSettings={platformSettings} />;
      case 'buyer-dashboard':
        return <BuyerDashboard user={user} navigate={navigate} favorites={favorites} onToggleFavorite={toggleFavorite} />;
      case 'admin-dashboard':
        return <AdminDashboard user={user} navigate={navigate} platformSettings={platformSettings} onSettingsChange={setPlatformSettings} />;
      case 'settings':
        return <Settings user={user} setUser={handleSetUser} navigate={navigate} onLogout={handleLogout} />;
      case 'messaging':
        return <Messaging user={user} navigate={navigate} />;
      default:
        return <HomePage navigate={navigate} user={user} />;
    }
  };

  return (
    <div style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.12s ease' }}>
      <Navbar user={user} navigate={navigate} currentView={view} onLogout={handleLogout} />
      {premiumNotice && <PremiumNotice notice={premiumNotice} onClose={() => setPremiumNotice(null)} />}
      {renderView()}
    </div>
  );
}

// Bandeau flottant de retour de paiement PayTech.
function PremiumNotice({ notice, onClose }) {
  const palette = {
    success: { bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.45)', color: '#4ade80' },
    cancel:  { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.45)',  color: '#f87171' },
    pending: { bg: 'rgba(201,169,110,0.12)', border: 'rgba(201,169,110,0.45)', color: '#C9A96E' },
  };
  const p = palette[notice.type] || palette.pending;
  React.useEffect(() => {
    if (notice.type === 'success' || notice.type === 'cancel') {
      const t = setTimeout(onClose, 8000);
      return () => clearTimeout(t);
    }
  }, [notice, onClose]);
  return (
    <div style={{
      position: 'fixed', top: 84, left: '50%', transform: 'translateX(-50%)', zIndex: 1200,
      background: '#111113', border: `1px solid ${p.border}`, borderRadius: 12,
      padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14,
      maxWidth: 'calc(100vw - 40px)', boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    }}>
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: p.color, fontWeight: 600 }}>
        {notice.text}
      </span>
      <button onClick={onClose} aria-label="Fermer" style={{
        background: 'none', border: 'none', color: '#71717A', fontSize: 20, cursor: 'pointer', lineHeight: 1,
      }}>×</button>
    </div>
  );
}
