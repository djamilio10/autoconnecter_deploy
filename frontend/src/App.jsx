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
import { favoritesApi, authApi, clearAuth, settingsApi } from './api';

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
    // Si un access_token existe, on verifie qu'il est encore valide
    const access = localStorage.getItem('access_token');
    if (access && user) {
      authApi.profile()
        .then(res => handleSetUser(res.data))
        .catch(() => {
          clearAuth();
          handleSetUser(null);
        });
    } else if (!access && user) {
      // Token disparu mais user en cache : nettoyer
      handleSetUser(null);
    }

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

    // Sync logout entre plusieurs onglets
    const onStorage = (e) => {
      if (e.key === 'access_token' && !e.newValue) {
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
      {renderView()}
    </div>
  );
}
