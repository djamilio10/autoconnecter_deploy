import React from 'react';
import { notificationsApi } from '../api';

// ── Prix FCFA ─────────────────────────────────────────────────────────────────
export const toCFA = (price) => {
  return Math.round(price || 0).toLocaleString('fr-FR').replace(/\s/g, '.') + ' FCFA';
};

// ── Design tokens ─────────────────────────────────────────────────────────────
export const C = {
  bg: '#09090B',
  surface: '#111113',
  border: '#27272A',
  border2: '#1e1e21',
  gold: '#C9A96E',
  goldDim: 'rgba(201,169,110,0.1)',
  goldBorder: 'rgba(201,169,110,0.4)',
  text: '#FAFAFA',
  muted: '#71717A',
  subtle: '#52525B',
  faint: '#3f3f46',
  error: '#e05c5c',
  playfair: "'Playfair Display', serif",
  dm: "'DM Sans', sans-serif",
};

// ── Senegal Flag ──────────────────────────────────────────────────────────────
export const SenegalFlag = ({ size = 18 }) => (
  <svg width={size * 1.5} height={size} viewBox="0 0 30 20" style={{ borderRadius: 2, flexShrink: 0 }}>
    <rect width="10" height="20" fill="#00853F" />
    <rect x="10" width="10" height="20" fill="#FDEF42" />
    <rect x="20" width="10" height="20" fill="#E31B23" />
    <polygon
      points="15,6.5 16.18,10.09 19.94,10.09 16.88,12.27 18.06,15.86 15,13.68 11.94,15.86 13.12,12.27 10.06,10.09 13.82,10.09"
      fill="#00853F"
    />
  </svg>
);

// ── Logo Icon SVG (double anneau avec glow) ───────────────────────────────────
const LogoIcon = ({ size }) => (
  <svg width={size} height={size * 0.75} viewBox="0 0 80 60" fill="none">
    <defs>
      <filter id="goldGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <radialGradient id="ringGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#F0D898" />
        <stop offset="60%" stopColor="#C9A96E" />
        <stop offset="100%" stopColor="#9B7A3F" />
      </radialGradient>
    </defs>
    {/* Anneau gauche */}
    <circle cx="28" cy="30" r="20" stroke="url(#ringGrad)" strokeWidth="1.8" filter="url(#goldGlow)" />
    {/* Anneau droit */}
    <circle cx="52" cy="30" r="20" stroke="url(#ringGrad)" strokeWidth="1.8" filter="url(#goldGlow)" />
    {/* Emblème central */}
    <circle cx="40" cy="30" r="7.5" stroke="#C9A96E" strokeWidth="1.2" />
    <circle cx="40" cy="30" r="2.2" fill="#C9A96E" />
    <line x1="40" y1="22.5" x2="40" y2="37.5" stroke="#C9A96E" strokeWidth="0.8" />
    <line x1="32.5" y1="30" x2="47.5" y2="30" stroke="#C9A96E" strokeWidth="0.8" />
    <line x1="35" y1="24.8" x2="45" y2="35.2" stroke="#C9A96E" strokeWidth="0.6" />
    <line x1="45" y1="24.8" x2="35" y2="35.2" stroke="#C9A96E" strokeWidth="0.6" />
  </svg>
);

// ── Logo ──────────────────────────────────────────────────────────────────────
export const Logo = ({ size = 'md', onClick }) => {
  const cfg = {
    sm: { icon: 36, titleSize: 14, taglineSize: 8,  flagSize: 13, gap: 8,  showTagline: false },
    md: { icon: 48, titleSize: 18, taglineSize: 9,  flagSize: 16, gap: 10, showTagline: false },
    lg: { icon: 72, titleSize: 28, taglineSize: 10, flagSize: 20, gap: 16, showTagline: true  },
  };
  const s = cfg[size] || cfg.md;

  return (
    <div
      onClick={onClick}
      className="ac-logo"
      style={{ display: 'flex', alignItems: 'center', gap: s.gap, cursor: onClick ? 'pointer' : 'default', flexShrink: 0 }}
    >
      <LogoIcon size={s.icon} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Titre */}
        <span style={{ fontFamily: C.playfair, fontSize: s.titleSize, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
          <span style={{ color: C.text }}>Auto</span>
          <span style={{ color: C.gold }}> Connect</span>
        </span>

        {/* Ligne dorée + tagline — uniquement en lg */}
        {s.showTagline && (
          <>
            <div style={{ height: 1, background: `linear-gradient(to right, ${C.gold}, rgba(201,169,110,0.2))`, margin: '5px 0 5px' }} />
            <span style={{ fontFamily: C.dm, fontSize: s.taglineSize, color: C.muted, letterSpacing: '0.22em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Trouvez · Essayez · Achetez
            </span>
          </>
        )}
      </div>

      {/* Séparateur vertical + drapeau — uniquement en lg */}
      {s.showTagline && (
        <>
          <div style={{ width: 1, height: 48, background: `rgba(201,169,110,0.3)`, margin: '0 6px' }} />
          <SenegalFlag size={s.flagSize} />
        </>
      )}

      {/* Drapeau compact pour sm/md */}
      {!s.showTagline && <SenegalFlag size={s.flagSize} />}
    </div>
  );
};

// ── NotificationBell ─────────────────────────────────────────────────────────
export const NotificationBell = ({ user, navigate }) => {
  const [open, setOpen] = React.useState(false);
  const [notifs, setNotifs] = React.useState([]);
  const ref = React.useRef(null);

  const unread = notifs.filter(n => !n.is_read).length;

  const load = React.useCallback(() => {
    if (!user) return;
    // Ne pas interroger le serveur si l'onglet est en arrière-plan : la plupart
    // des onglets ouverts ne sont pas visibles → grosse économie de charge serveur
    // à l'échelle (sinon chaque client génère une requête fixe toutes les 60 s).
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    notificationsApi.list().then(r => setNotifs(r.data || [])).catch(() => {});
  }, [user]);

  React.useEffect(() => {
    load();
    const id = setInterval(load, 60000); // poll toutes les 60s (onglet visible uniquement)
    // Rafraîchit immédiatement quand l'utilisateur revient sur l'onglet.
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open && unread > 0) {
      notificationsApi.markRead([]).then(() => {
        setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
      }).catch(() => {});
    }
  };

  const TYPE_ICONS = {
    appointment_new: '📅',
    appointment_confirmed: '✅',
    appointment_cancelled: '❌',
    appointment_completed: '🏁',
    new_review: '⭐',
    new_message: '💬',
  };

  const handleNotifClick = (n) => {
    setOpen(false);
    if (!navigate) return;
    if (n.type === 'new_message') {
      navigate('messaging');
    } else if (['appointment_new', 'appointment_confirmed', 'appointment_cancelled', 'appointment_completed'].includes(n.type)) {
      if (user?.user_type === 'seller') navigate('seller_dashboard');
      else navigate('buyer_dashboard');
    } else if (n.type === 'new_review') {
      navigate('seller_dashboard');
    }
  };

  if (!user) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={handleOpen}
        style={{
          position: 'relative', background: 'none', border: 'none',
          color: open ? C.gold : C.muted, cursor: 'pointer',
          width: 36, height: 36, borderRadius: 8, display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 18,
          transition: 'color 0.15s',
        }}
        title="Notifications"
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            background: '#e05c5c', color: '#fff',
            fontSize: 9, fontWeight: 700, fontFamily: C.dm,
            width: 16, height: 16, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 44, right: 0, width: 320,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 14, boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
          zIndex: 300, overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 16px', borderBottom: `1px solid ${C.border2}`,
            fontFamily: C.dm, fontSize: 13, fontWeight: 600, color: C.text,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>Notifications</span>
            {unread > 0 && (
              <span style={{
                background: 'rgba(224,92,92,0.15)', color: '#f87171',
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
              }}>{unread} non lu{unread > 1 ? 'es' : 'e'}</span>
            )}
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifs.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', fontFamily: C.dm, fontSize: 13, color: C.muted }}>
                Aucune notification
              </div>
            ) : notifs.slice(0, 20).map(n => (
              <div key={n.id} onClick={() => handleNotifClick(n)} style={{
                padding: '12px 16px',
                background: n.is_read ? 'transparent' : 'rgba(201,169,110,0.04)',
                borderBottom: `1px solid ${C.border2}`,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,169,110,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(201,169,110,0.04)'}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{TYPE_ICONS[n.type] || '🔔'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: C.dm, fontSize: 13, color: C.text, lineHeight: 1.4 }}>{n.message}</div>
                    <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted, marginTop: 4 }}>
                      {new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {!n.is_read && (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.gold, flexShrink: 0, marginTop: 4 }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Navbar ────────────────────────────────────────────────────────────────────
export const Navbar = ({ user, navigate, currentView, onLogout }) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [burgerOpen, setBurgerOpen] = React.useState(false);
  const menuRef = React.useRef(null);
  const burgerRef = React.useRef(null);

  // Ferme le menu utilisateur quand on clique ailleurs
  React.useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  // Ferme le menu hamburger quand on clique ailleurs
  React.useEffect(() => {
    if (!burgerOpen) return;
    const onClick = (e) => {
      if (burgerRef.current && !burgerRef.current.contains(e.target)) setBurgerOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [burgerOpen]);

  const navLinks = [
    { label: 'Catalogue', view: 'catalogue' },
    { label: 'Comment ça marche', view: 'how' },
  ];

  return (
    <nav className="ac-nav" style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(9,9,11,0.85)', backdropFilter: 'blur(16px)',
      borderBottom: `1px solid ${C.border2}`, height: 64,
      display: 'flex', alignItems: 'center', padding: '0 32px',
    }}>
      <Logo size="md" onClick={() => navigate('home')} />

      <div style={{ flex: 1 }} />

      {/* Liens de navigation — cachés en mobile */}
      <div className="ac-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 28, marginRight: 28 }}>
        {navLinks.map(l => (
          <button key={l.view} onClick={() => navigate(l.view)} style={{
            background: 'none', border: 'none',
            color: currentView === l.view ? C.gold : C.muted,
            fontFamily: C.dm, fontSize: 14, fontWeight: 500, cursor: 'pointer',
            transition: 'color 0.2s',
          }}>{l.label}</button>
        ))}
      </div>

      {/* Section auth/utilisateur — TOUJOURS visible */}
      <div className="ac-nav-auth" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {user && <NotificationBell user={user} navigate={navigate} />}

        {user ? (
          <div ref={menuRef} style={{ display: 'flex', gap: 10, alignItems: 'center', position: 'relative' }}>
            {(user.is_staff || user.user_type === 'admin') && (
              <button onClick={() => navigate('admin-dashboard')} className="ac-admin-btn" style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)',
                color: '#f87171', fontFamily: C.dm, fontSize: 11, fontWeight: 700,
                padding: '6px 12px', borderRadius: 8, cursor: 'pointer', letterSpacing: '0.04em',
              }}>⚙ ADMIN</button>
            )}
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="ac-user-btn"
              style={{
                background: C.goldDim, border: `1px solid ${C.goldBorder}`,
                color: C.gold, fontFamily: C.dm, fontSize: 13, fontWeight: 600,
                padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: '50%',
                background: C.gold, color: C.bg, fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', flexShrink: 0,
              }}>
                {user.avatar_url
                  ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (user.avatar_initials || (user.first_name?.[0] || 'U').toUpperCase())
                }
              </span>
              <span className="ac-user-name">{user.first_name || 'Mon espace'}</span>
              <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
            </button>

            {menuOpen && (
              <div style={{
                position: 'absolute', top: 48, right: 0, minWidth: 220,
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 12, padding: 6, boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                zIndex: 200,
              }}>
                <div style={{
                  padding: '10px 14px', borderBottom: `1px solid ${C.border2}`, marginBottom: 4,
                }}>
                  <div style={{ fontFamily: C.dm, fontSize: 13, color: C.text, fontWeight: 600 }}>
                    {user.first_name} {user.last_name}
                  </div>
                  <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {user.email}
                  </div>
                </div>

                {[
                  { label: '📊  Mon tableau de bord', action: () => navigate(user.user_type === 'seller' ? 'seller-dashboard' : user.user_type === 'admin' ? 'admin-dashboard' : 'buyer-dashboard') },
                  { label: '💬  Messagerie',           action: () => navigate('messaging') },
                  { label: '⚙️  Paramètres',          action: () => navigate('settings') },
                ].map(item => (
                  <button key={item.label}
                    onClick={() => { setMenuOpen(false); item.action(); }}
                    style={{
                      width: '100%', textAlign: 'left', background: 'none', border: 'none',
                      color: C.text, fontFamily: C.dm, fontSize: 13,
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = C.border2}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >{item.label}</button>
                ))}

                <div style={{ height: 1, background: C.border2, margin: '4px 0' }} />

                <button
                  onClick={() => { setMenuOpen(false); onLogout && onLogout(); }}
                  style={{
                    width: '100%', textAlign: 'left', background: 'none', border: 'none',
                    color: C.error, fontFamily: C.dm, fontSize: 13, fontWeight: 600,
                    padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(224,92,92,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >↪ Se déconnecter</button>
              </div>
            )}
          </div>
        ) : (
          <div className="ac-auth-btns" style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigate('auth', { mode: 'login' })} className="ac-btn-login" style={{
              background: 'none', border: `1px solid ${C.border}`,
              color: C.text, fontFamily: C.dm, fontSize: 14, fontWeight: 500,
              padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
              transition: 'border-color 0.2s', whiteSpace: 'nowrap',
            }}>Connexion</button>
            <button onClick={() => navigate('auth', { mode: 'register' })} className="ac-btn-register" style={{
              background: C.gold, border: 'none', color: C.bg,
              fontFamily: C.dm, fontSize: 14, fontWeight: 700,
              padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}>S'inscrire</button>
          </div>
        )}

        {/* Hamburger mobile — visible uniquement en mobile via CSS */}
        <div ref={burgerRef} className="ac-nav-burger" style={{ position: 'relative' }}>
          <button
            onClick={() => setBurgerOpen(o => !o)}
            style={{
              background: 'none', border: `1px solid ${C.border}`,
              color: C.text, cursor: 'pointer',
              width: 38, height: 38, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, padding: 0,
            }}
            aria-label="Menu"
          >☰</button>

          {burgerOpen && (
            <div style={{
              position: 'absolute', top: 48, right: 0, minWidth: 200,
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 12, padding: 6, boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
              zIndex: 200,
            }}>
              {navLinks.map(l => (
                <button key={l.view}
                  onClick={() => { setBurgerOpen(false); navigate(l.view); }}
                  style={{
                    width: '100%', textAlign: 'left', background: 'none', border: 'none',
                    color: currentView === l.view ? C.gold : C.text,
                    fontFamily: C.dm, fontSize: 14, fontWeight: 500,
                    padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.border2}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >{l.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

// ── Car Card ──────────────────────────────────────────────────────────────────
export const CarCard = ({ car, seller, onClick, isFavorite, onToggleFavorite, premiumEnabled = false }) => {
  const [hovered, setHovered] = React.useState(false);

  const cardImage = car.primary_image_url
    || car.car_images?.find(i => i.is_primary)?.url
    || car.car_images?.[0]?.url
    || car.image
    || null;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.surface, border: `1px solid ${hovered ? C.faint : C.border}`,
        borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
        transition: 'border-color 0.2s, transform 0.2s',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      {/* Image */}
      <div style={{
        height: 200, background: car.gradient || C.surface,
        position: 'relative', overflow: 'hidden',
      }}>
        {cardImage && (
          <img src={cardImage} alt={`${car.make} ${car.model}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(9,9,11,0.6) 0%, transparent 60%)' }} />
        {/* Badge Premium vendeur — visible seulement si le mode premium est actif */}
        {premiumEnabled && seller?.is_premium && (
          <div style={{
            position: 'absolute', top: 12, left: 12,
            background: 'linear-gradient(135deg, rgba(201,169,110,0.95), rgba(180,140,70,0.95))',
            backdropFilter: 'blur(6px)',
            border: `1px solid ${C.gold}`,
            color: '#09090B',
            fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 20,
            fontFamily: C.dm, letterSpacing: '0.08em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>⭐ PREMIUM</div>
        )}
        {!seller?.is_premium && car.badge && (
          <div style={{
            position: 'absolute', top: 12, left: 12,
            background: 'rgba(9,9,11,0.65)', backdropFilter: 'blur(6px)',
            border: `1px solid ${C.goldBorder}`, color: C.gold,
            fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
            fontFamily: C.dm, letterSpacing: '0.06em',
          }}>{car.badge}</div>
        )}
        <button
          onClick={e => { e.stopPropagation(); onToggleFavorite && onToggleFavorite(car.id); }}
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(9,9,11,0.6)', border: 'none',
            color: isFavorite ? '#e05c5c' : C.muted, fontSize: 16,
            width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >{isFavorite ? '♥' : '♡'}</button>
      </div>

      {/* Body */}
      <div style={{ padding: '16px 18px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontFamily: C.playfair, fontSize: 18, fontWeight: 700, color: C.text }}>
              {car.make} {car.model}
            </div>
            <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, marginTop: 2 }}>
              {car.year} · {(car.mileage || 0).toLocaleString('fr-FR')} km
            </div>
          </div>
          <div style={{ fontFamily: C.playfair, fontSize: 15, fontWeight: 700, color: C.gold, flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap', marginLeft: 8 }}>
            {toCFA(car.price)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {[car.fuel, car.transmission].filter(Boolean).map(tag => (
            <span key={tag} style={{
              fontFamily: C.dm, fontSize: 11, color: C.subtle,
              background: '#18181b', border: `1px solid ${C.border}`,
              padding: '3px 8px', borderRadius: 6,
            }}>{tag}</span>
          ))}
        </div>

        {seller && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12, borderTop: `1px solid ${C.border2}` }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: '#27272A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: C.dm, fontSize: 10, fontWeight: 700, color: C.muted, flexShrink: 0,
              overflow: 'hidden',
            }}>
              {seller.logo_url
                ? <img src={seller.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : seller.avatar}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: C.dm, fontSize: 12, color: C.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {seller.name}
                {seller.is_verified && <span style={{ color: C.gold, marginLeft: 4 }}>✓</span>}
                {premiumEnabled && seller.is_premium && <span style={{ color: '#C9A96E', marginLeft: 6, fontSize: 10, fontWeight: 700, background: 'rgba(201,169,110,0.15)', padding: '1px 6px', borderRadius: 10, border: '1px solid rgba(201,169,110,0.3)' }}>⭐ Premium</span>}
              </div>
              <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted }}>
                ★ {seller.rating} · {seller.location}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Button ────────────────────────────────────────────────────────────────────
export const Btn = ({ children, onClick, variant = 'primary', disabled, style = {} }) => {
  const base = {
    fontFamily: C.dm, fontSize: 14, fontWeight: 700,
    padding: '12px 24px', borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none', transition: 'opacity 0.2s', opacity: disabled ? 0.5 : 1,
    ...style,
  };
  const variants = {
    primary: { background: C.gold, color: C.bg },
    secondary: { background: 'transparent', border: `1px solid ${C.border}`, color: C.text },
    ghost: { background: 'transparent', color: C.muted },
  };
  return (
    <button onClick={!disabled ? onClick : undefined} style={{ ...base, ...variants[variant] }}>
      {children}
    </button>
  );
};

// ── Input ─────────────────────────────────────────────────────────────────────
export const Input = ({ label, error, ...props }) => (
  <div>
    {label && (
      <label style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </label>
    )}
    <input
      {...props}
      style={{
        width: '100%', background: '#111113',
        border: `1px solid ${error ? C.error : C.border}`,
        color: C.text, fontFamily: C.dm, fontSize: 14,
        padding: '13px 16px', borderRadius: 10, outline: 'none',
        boxSizing: 'border-box',
        ...props.style,
      }}
      onFocus={e => { e.target.style.borderColor = C.gold; props.onFocus?.(e); }}
      onBlur={e => { e.target.style.borderColor = error ? C.error : C.border; props.onBlur?.(e); }}
    />
    {error && <p style={{ fontFamily: C.dm, fontSize: 12, color: C.error, marginTop: 5 }}>{error}</p>}
  </div>
);

// ── Badge ─────────────────────────────────────────────────────────────────────
export const StatusBadge = ({ status }) => {
  const styles = {
    confirmed: { bg: 'rgba(34,197,94,0.1)', color: '#4ade80', border: 'rgba(34,197,94,0.3)', label: 'Confirmé' },
    pending:   { bg: 'rgba(234,179,8,0.1)',  color: '#facc15', border: 'rgba(234,179,8,0.3)',  label: 'En attente' },
    cancelled: { bg: 'rgba(239,68,68,0.1)',  color: '#f87171', border: 'rgba(239,68,68,0.3)',  label: 'Annulé' },
    completed: { bg: 'rgba(99,102,241,0.1)', color: '#818cf8', border: 'rgba(99,102,241,0.3)', label: 'Terminé' },
  };
  const s = styles[status] || styles.pending;
  return (
    <span style={{
      fontFamily: C.dm, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      padding: '3px 10px', borderRadius: 20, letterSpacing: '0.04em',
    }}>{s.label}</span>
  );
};

// ── Loading ───────────────────────────────────────────────────────────────────
export const Spinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
    <div style={{
      width: 36, height: 36, border: `3px solid ${C.border}`,
      borderTopColor: C.gold, borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ── Conditions Générales d'Utilisation — Abonnement Premium ───────────────────
// Doit rester cohérent avec la version backend (settings.PREMIUM_CGU_VERSION).
export const CGU_PREMIUM_VERSION = 'v1 — juin 2026';
export const CGU_PREMIUM = [
  ['1. Objet', "Les présentes conditions régissent l'abonnement « Premium » proposé par AUTOCONNECT aux vendeurs inscrits sur la plateforme. En cochant la case d'acceptation et en procédant au paiement, le vendeur reconnaît avoir lu et accepté l'intégralité des présentes conditions."],
  ['2. Avantages Premium', "L'abonnement Premium donne droit, pendant sa période de validité : à la publication d'annonces en nombre illimité ; à l'affichage du badge « ⭐ Premium » sur les annonces et le profil ; à la priorité d'affichage en tête du catalogue ; à une visibilité renforcée et au support prioritaire."],
  ['3. Prix', "L'abonnement est de 5 000 FCFA par mois, payable d'avance. Les prix s'entendent toutes taxes comprises."],
  ['4. Paiement', "Les paiements sont opérés exclusivement via le prestataire PayTech (carte bancaire Visa/Mastercard ou mobile money : Orange Money, Wave, Free Money, etc.). AUTOCONNECT ne collecte ni ne conserve aucune donnée de carte bancaire : ces données sont traitées par PayTech. Le Premium est activé dès la confirmation du paiement par PayTech."],
  ['5. Durée et renouvellement', "L'abonnement est conclu pour une durée déterminée d'un (1) mois à compter de la confirmation du paiement. Il n'existe aucun prélèvement automatique : le renouvellement nécessite une nouvelle action de paiement volontaire du vendeur. Un email de rappel est envoyé un (1) jour avant l'échéance. En cas de renouvellement effectué avant l'échéance, la nouvelle période d'un mois s'ajoute à la date d'expiration en cours (aucun jour payé n'est perdu)."],
  ['6. Non-renouvellement et délai de grâce', "À défaut de renouvellement à l'échéance, un délai de grâce de deux (2) jours est accordé, durant lequel les avantages Premium restent actifs. Passé ce délai sans paiement, le compte repasse automatiquement en formule Gratuite et perd l'ensemble des avantages Premium."],
  ['7. Retour en formule Gratuite', "En formule Gratuite, le vendeur est limité à trois (3) annonces actives. Les annonces publiées au-delà de cette limite pendant la période Premium restent visibles, mais aucune nouvelle annonce ne peut être publiée tant que le nombre d'annonces actives dépasse la limite gratuite ou que l'abonnement Premium n'a pas été réactivé. Le droit aux annonces gratuites s'applique de nouveau dans la limite ci-dessus."],
  ['8. Résiliation', "Le vendeur peut cesser de renouveler son abonnement à tout moment, sans frais ni préavis : il lui suffit de ne pas effectuer de nouveau paiement. Aucun engagement de durée n'est imposé au-delà du mois en cours."],
  ['9. Remboursement', "Les sommes versées au titre d'un mois entamé ne sont pas remboursables, sauf erreur technique avérée imputable à AUTOCONNECT ou à PayTech."],
  ['10. Données personnelles', "L'adresse email du vendeur est utilisée pour l'envoi des rappels d'échéance, confirmations de paiement et avis liés à l'abonnement."],
  ['11. Disponibilité', "AUTOCONNECT met en œuvre les moyens raisonnables pour assurer la continuité du service mais ne saurait être tenue responsable d'une indisponibilité due au prestataire de paiement ou à un cas de force majeure."],
  ['12. Modification', "AUTOCONNECT peut faire évoluer les présentes conditions ; la version applicable est celle acceptée lors du paiement."],
  ['13. Droit applicable', "Les présentes conditions sont régies par le droit sénégalais. Tout litige relève des juridictions compétentes de Dakar."],
];

// Pop-up affichant les CGU Premium en entier.
export const CGUModal = ({ onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}
  >
    <div
      onClick={e => e.stopPropagation()}
      style={{
        background: C.surface, border: `1px solid ${C.goldBorder}`, borderRadius: 20,
        maxWidth: 640, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 0 80px rgba(201,169,110,0.12)',
      }}
    >
      <div style={{
        padding: '24px 28px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16,
      }}>
        <div>
          <h2 style={{ fontFamily: C.playfair, fontSize: 22, fontWeight: 700, color: C.gold, margin: 0 }}>
            Conditions Générales d'Utilisation
          </h2>
          <div style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, marginTop: 4 }}>
            Abonnement Premium · {CGU_PREMIUM_VERSION}
          </div>
        </div>
        <button onClick={onClose} aria-label="Fermer" style={{
          background: 'none', border: 'none', color: C.muted, fontSize: 26,
          cursor: 'pointer', lineHeight: 1, padding: 0,
        }}>×</button>
      </div>
      <div style={{ padding: '24px 28px', overflowY: 'auto' }}>
        {CGU_PREMIUM.map(([title, body], i) => (
          <div key={i} style={{ marginBottom: 18 }}>
            <h3 style={{ fontFamily: C.dm, fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 6px' }}>
              {title}
            </h3>
            <p style={{ fontFamily: C.dm, fontSize: 13.5, color: C.muted, lineHeight: 1.7, margin: 0 }}>
              {body}
            </p>
          </div>
        ))}
      </div>
      <div style={{ padding: '16px 28px', borderTop: `1px solid ${C.border}`, textAlign: 'right' }}>
        <button onClick={onClose} style={{
          background: C.goldDim, border: `1px solid ${C.goldBorder}`, color: C.gold,
          fontFamily: C.dm, fontSize: 14, fontWeight: 700, padding: '10px 24px',
          borderRadius: 10, cursor: 'pointer',
        }}>Fermer</button>
      </div>
    </div>
  </div>
);
