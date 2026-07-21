import React from 'react';
import { C, Input } from './Shared';
import { authApi, sellersApi } from '../api';

// ── Helpers ───────────────────────────────────────────────────────────────────
const NOTIF_KEY = 'ac_notifications';
const PRIV_KEY  = 'ac_privacy';

const defaultNotif = {
  new_listings:   true,
  appointments:   true,
  seller_messages: true,
  newsletter:     false,
};
const defaultPriv = {
  phone_visible: true,
  profile_public: true,
};

const loadPref = (key, defaults) => {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(key) || '{}') }; }
  catch { return defaults; }
};

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
        background: checked ? C.gold : C.border,
        position: 'relative', transition: 'background 0.25s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: checked ? C.bg : C.muted,
        transition: 'left 0.25s',
      }} />
    </div>
  );
}

// ── Row avec toggle ───────────────────────────────────────────────────────────
function PrefRow({ label, sub, checked, onChange }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 0', borderBottom: `1px solid ${C.border2}`,
    }}>
      <div>
        <div style={{ fontFamily: C.dm, fontSize: 14, color: C.text, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, marginTop: 3 }}>{sub}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

// ── Section container ─────────────────────────────────────────────────────────
function Section({ title, sub, children }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, marginBottom: 20 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: C.playfair, fontSize: 20, fontWeight: 700, color: C.text }}>{title}</div>
        {sub && <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, marginTop: 4 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────────
function Alert({ type, msg }) {
  if (!msg) return null;
  const isOk = type === 'success';
  return (
    <div style={{
      background: isOk ? 'rgba(76,175,125,0.1)' : 'rgba(224,92,92,0.1)',
      border: `1px solid ${isOk ? 'rgba(76,175,125,0.35)' : 'rgba(224,92,92,0.35)'}`,
      borderRadius: 10, padding: '11px 16px', marginBottom: 16,
      fontFamily: C.dm, fontSize: 13,
      color: isOk ? '#4caf7d' : C.error,
    }}>{msg}</div>
  );
}

// ── Bouton save ───────────────────────────────────────────────────────────────
function SaveBtn({ onClick, loading, label = 'Enregistrer' }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      background: loading ? 'rgba(201,169,110,0.5)' : C.gold,
      border: 'none', color: C.bg, fontFamily: C.dm,
      fontSize: 14, fontWeight: 700, padding: '11px 24px',
      borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 20,
    }}>{loading ? 'Enregistrement...' : label}</button>
  );
}

// ── SECTIONS ──────────────────────────────────────────────────────────────────

function LogoUploader({ user }) {
  const [logoPreview, setLogoPreview] = React.useState(null);
  const [uploading, setUploading] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
    setUploading(true); setDone(false);
    try {
      await sellersApi.uploadLogo(file);
      setDone(true);
    } catch { /* ignore */ }
    finally { setUploading(false); e.target.value = ''; }
  };

  return (
    <div style={{ marginBottom: 24, padding: 20, background: '#18181b', borderRadius: 12, border: `1px solid ${C.border}` }}>
      <div style={{ fontFamily: C.dm, fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>Logo de boutique</div>
      <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 60, height: 60, borderRadius: 10, background: '#27272A',
          border: `2px dashed ${done ? '#4caf7d' : C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', flexShrink: 0, transition: 'border-color 0.2s',
        }}>
          {logoPreview
            ? <img src={logoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 22 }}>🏪</span>
          }
        </div>
        <div>
          <div style={{ fontFamily: C.dm, fontSize: 13, color: done ? '#4caf7d' : C.muted }}>
            {uploading ? '⏳ Envoi...' : done ? '✓ Logo mis à jour !' : 'Cliquer pour changer le logo'}
          </div>
          <div style={{ fontFamily: C.dm, fontSize: 11, color: C.faint, marginTop: 3 }}>JPG, PNG, WebP</div>
        </div>
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      </label>
    </div>
  );
}

function ProfileSection({ user, setUser }) {
  const [form, setForm] = React.useState({
    first_name: user.first_name || '',
    last_name:  user.last_name  || '',
    phone:      user.phone      || '',
    location:   user.location   || '',
  });
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState(null);

  const save = async () => {
    setLoading(true); setMsg(null);
    try {
      const res = await authApi.updateProfile(form);
      setUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
      setMsg({ type: 'success', text: 'Profil mis à jour.' });
    } catch (e) {
      const d = e.response?.data;
      setMsg({ type: 'error', text: d?.phone?.[0] || d?.detail || 'Échec de la mise à jour.' });
    } finally { setLoading(false); }
  };

  return (
    <Section title="Informations personnelles" sub="Modifiez vos informations de profil">
      {user.user_type === 'seller' && <LogoUploader user={user} />}
      <Alert type={msg?.type} msg={msg?.text} />
      <div className="ac-form-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Input label="Prénom" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
        <Input label="Nom" value={form.last_name}  onChange={e => setForm(f => ({ ...f, last_name:  e.target.value }))} />
        <Input label="Téléphone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+221 77 123 45 67" />
        <Input label="Localisation" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Dakar" />
      </div>
      <div style={{ marginTop: 16 }}>
        <label style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Adresse email</label>
        <div style={{
          marginTop: 7, background: '#0e0e10', border: `1px solid ${C.border}`,
          color: C.subtle, fontFamily: C.dm, fontSize: 14,
          padding: '13px 16px', borderRadius: 10,
        }}>{user.email} <span style={{ fontSize: 11, color: C.faint }}>(non modifiable)</span></div>
      </div>
      <SaveBtn onClick={save} loading={loading} />
    </Section>
  );
}

function SecuritySection({ onLogout, user, setUser }) {
  const [pwd, setPwd] = React.useState({ old: '', new: '', confirm: '' });
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState(null);

  const changePassword = async () => {
    if (pwd.new !== pwd.confirm) { setMsg({ type: 'error', text: 'Les nouveaux mots de passe ne correspondent pas.' }); return; }
    if (pwd.new.length < 6) { setMsg({ type: 'error', text: 'Minimum 6 caractères.' }); return; }
    setLoading(true); setMsg(null);
    try {
      await authApi.changePassword({ old_password: pwd.old, new_password: pwd.new });
      setPwd({ old: '', new: '', confirm: '' });
      setMsg({ type: 'success', text: 'Mot de passe modifié avec succès.' });
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Échec du changement de mot de passe.' });
    } finally { setLoading(false); }
  };

  return (
    <Section title="Sécurité" sub="Protégez votre compte">
      {/* Changer mot de passe */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: C.dm, fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 16 }}>
          Changer le mot de passe
        </div>
        <Alert type={msg?.type} msg={msg?.text} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Mot de passe actuel" type="password" value={pwd.old}     onChange={e => setPwd(p => ({ ...p, old: e.target.value }))}     placeholder="••••••••" />
          <Input label="Nouveau mot de passe" type="password" value={pwd.new}     onChange={e => setPwd(p => ({ ...p, new: e.target.value }))}     placeholder="••••••••" />
          <Input label="Confirmer le nouveau" type="password" value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} placeholder="••••••••" />
        </div>
        <SaveBtn onClick={changePassword} loading={loading} label="Changer le mot de passe" />
      </div>

      <div style={{ height: 1, background: C.border2, margin: '8px 0 24px' }} />

      {/* 2FA */}
      <TwoFactorRow user={user} setUser={setUser} />

      <div style={{ height: 1, background: C.border2, margin: '24px 0' }} />

      {/* Déconnecter partout */}
      <div>
        <div style={{ fontFamily: C.dm, fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>Déconnexion globale</div>
        <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, marginBottom: 14 }}>
          Déconnectez votre compte de tous les appareils et navigateurs.
        </div>
        <button onClick={onLogout} style={{
          background: 'rgba(224,92,92,0.08)', border: '1px solid rgba(224,92,92,0.3)',
          color: '#f87171', fontFamily: C.dm, fontSize: 13, fontWeight: 600,
          padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
        }}>↪ Se déconnecter de tous les appareils</button>
      </div>
    </Section>
  );
}

// ── Authentification à deux facteurs (TOTP / application d'authentification) ──
function TwoFactorRow({ user, setUser }) {
  const enabled = !!user?.two_factor_enabled;
  const [setup, setSetup] = React.useState(null);   // {secret, otpauth_url, qr}
  const [mode, setMode] = React.useState(null);     // 'enroll' | 'disable'
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);

  const syncUser = (twoFAEnabled) => {
    const next = { ...user, two_factor_enabled: twoFAEnabled };
    setUser(next);
    localStorage.setItem('user', JSON.stringify(next));
  };

  const startEnroll = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await authApi.twoFactorSetup();
      setSetup(r.data); setMode('enroll'); setCode('');
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || 'Impossible de démarrer l\'activation.' });
    } finally { setBusy(false); }
  };

  const confirmEnroll = async () => {
    setBusy(true); setMsg(null);
    try {
      await authApi.twoFactorEnable(code.trim());
      syncUser(true);
      setSetup(null); setMode(null); setCode('');
      setMsg({ type: 'success', text: '2FA activée. Un code vous sera demandé à chaque connexion.' });
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || 'Code invalide.' });
    } finally { setBusy(false); }
  };

  const confirmDisable = async () => {
    setBusy(true); setMsg(null);
    try {
      await authApi.twoFactorDisable(code.trim());
      syncUser(false);
      setMode(null); setCode('');
      setMsg({ type: 'success', text: '2FA désactivée.' });
    } catch (e) {
      setMsg({ type: 'error', text: e.response?.data?.detail || 'Code invalide.' });
    } finally { setBusy(false); }
  };

  const cancel = () => { setSetup(null); setMode(null); setCode(''); setMsg(null); };

  const codeInput = (onValidate, label) => (
    <div style={{ marginTop: 16 }}>
      <input
        value={code}
        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="Code à 6 chiffres"
        inputMode="numeric"
        autoFocus
        style={{
          width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`,
          color: C.text, fontFamily: C.dm, fontSize: 18, letterSpacing: '0.3em',
          textAlign: 'center', padding: '12px 14px', borderRadius: 10, outline: 'none',
        }}
      />
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button onClick={onValidate} disabled={busy || code.length !== 6} style={{
          flex: 1, padding: '11px', background: (busy || code.length !== 6) ? 'rgba(201,169,110,0.35)' : C.gold,
          border: 'none', color: C.bg, fontFamily: C.dm, fontSize: 14, fontWeight: 700,
          borderRadius: 10, cursor: (busy || code.length !== 6) ? 'not-allowed' : 'pointer',
        }}>{busy ? '...' : label}</button>
        <button onClick={cancel} style={{
          padding: '11px 18px', background: 'transparent', border: `1px solid ${C.border}`,
          color: C.muted, fontFamily: C.dm, fontSize: 14, borderRadius: 10, cursor: 'pointer',
        }}>Annuler</button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '16px 0', borderBottom: `1px solid ${C.border2}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <div style={{ fontFamily: C.dm, fontSize: 14, color: C.text, fontWeight: 500 }}>
            Authentification à deux facteurs (2FA)
          </div>
          <div style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, marginTop: 3 }}>
            {enabled
              ? 'Activée — un code de votre application d\'authentification est demandé à chaque connexion'
              : 'Désactivée — protégez votre compte avec une application d\'authentification'}
          </div>
        </div>
        {!mode && (
          enabled ? (
            <button onClick={() => { setMode('disable'); setCode(''); setMsg(null); }} style={{
              background: 'rgba(224,92,92,0.08)', border: '1px solid rgba(224,92,92,0.3)',
              color: '#f87171', fontFamily: C.dm, fontSize: 13, fontWeight: 600,
              padding: '8px 16px', borderRadius: 10, cursor: 'pointer', flexShrink: 0,
            }}>Désactiver</button>
          ) : (
            <button onClick={startEnroll} disabled={busy} style={{
              background: C.goldDim, border: `1px solid ${C.goldBorder}`,
              color: C.gold, fontFamily: C.dm, fontSize: 13, fontWeight: 600,
              padding: '8px 16px', borderRadius: 10, cursor: busy ? 'not-allowed' : 'pointer', flexShrink: 0,
            }}>{busy ? '...' : 'Activer'}</button>
          )
        )}
      </div>

      {msg && (
        <div style={{
          marginTop: 12, borderRadius: 10, padding: '10px 14px', fontFamily: C.dm, fontSize: 13,
          background: msg.type === 'success' ? 'rgba(74,222,128,0.1)' : 'rgba(224,92,92,0.1)',
          border: `1px solid ${msg.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(224,92,92,0.3)'}`,
          color: msg.type === 'success' ? '#4ade80' : '#f87171',
        }}>{msg.text}</div>
      )}

      {/* Enrôlement : QR à scanner + saisie du code */}
      {mode === 'enroll' && setup && (
        <div style={{
          marginTop: 14, background: 'rgba(201,169,110,0.06)', border: `1px solid ${C.goldBorder}`,
          borderRadius: 12, padding: 20,
        }}>
          <div style={{ fontFamily: C.dm, fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 14 }}>
            1. Scannez ce QR code avec <strong>Google Authenticator</strong>, Authy ou Microsoft Authenticator.<br />
            2. Saisissez le code à 6 chiffres affiché par l'application pour confirmer.
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <img src={setup.qr} alt="QR code 2FA" width={200} height={200}
                 style={{ borderRadius: 12, background: '#fff', padding: 8 }} />
          </div>
          <div style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, textAlign: 'center', marginBottom: 4 }}>
            Saisie manuelle (si le scan échoue) :
          </div>
          <div style={{
            fontFamily: 'monospace', fontSize: 13, color: C.gold, textAlign: 'center',
            wordBreak: 'break-all', background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: '8px 12px',
          }}>{setup.secret}</div>
          {codeInput(confirmEnroll, 'Confirmer l\'activation')}
        </div>
      )}

      {/* Désactivation : confirmation par code */}
      {mode === 'disable' && (
        <div style={{
          marginTop: 14, background: 'rgba(224,92,92,0.05)', border: '1px solid rgba(224,92,92,0.25)',
          borderRadius: 12, padding: 20,
        }}>
          <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
            Pour désactiver la 2FA, saisissez un code de votre application d'authentification.
          </div>
          {codeInput(confirmDisable, 'Désactiver la 2FA')}
        </div>
      )}
    </div>
  );
}

function NotificationsSection() {
  const [prefs, setPrefs] = React.useState(() => loadPref(NOTIF_KEY, defaultNotif));
  const [saved, setSaved] = React.useState(false);

  const toggle = (key) => {
    setPrefs(p => { const next = { ...p, [key]: !p[key] }; localStorage.setItem(NOTIF_KEY, JSON.stringify(next)); return next; });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Section title="Notifications" sub="Choisissez les alertes que vous souhaitez recevoir">
      {saved && <Alert type="success" msg="Préférences sauvegardées." />}
      <PrefRow label="Nouvelles annonces" sub="Soyez alerté quand une voiture correspond à vos critères de recherche" checked={prefs.new_listings}    onChange={() => toggle('new_listings')} />
      <PrefRow label="Rendez-vous"        sub="Confirmations et rappels de vos essais programmés"                        checked={prefs.appointments}   onChange={() => toggle('appointments')} />
      <PrefRow label="Messages vendeurs"  sub="Réponses et messages de la part des vendeurs"                             checked={prefs.seller_messages} onChange={() => toggle('seller_messages')} />
      <div style={{ paddingTop: 16 }}>
        <PrefRow label="Newsletter AutoConnect" sub="Actualités, conseils d'achat et offres exclusives" checked={prefs.newsletter} onChange={() => toggle('newsletter')} />
      </div>
    </Section>
  );
}

function PrivacySection() {
  const [prefs, setPrefs] = React.useState(() => loadPref(PRIV_KEY, defaultPriv));
  const [saved, setSaved] = React.useState(false);

  const toggle = (key) => {
    setPrefs(p => { const next = { ...p, [key]: !p[key] }; localStorage.setItem(PRIV_KEY, JSON.stringify(next)); return next; });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const clearHistory = () => {
    localStorage.removeItem('ac_recent_searches');
    localStorage.removeItem('ac_viewed_cars');
    alert('Historique effacé.');
  };

  return (
    <Section title="Confidentialité" sub="Contrôlez la visibilité de vos données">
      {saved && <Alert type="success" msg="Préférences sauvegardées." />}
      <PrefRow label="Téléphone visible" sub="Les vendeurs peuvent voir votre numéro quand vous prenez un rendez-vous" checked={prefs.phone_visible}  onChange={() => toggle('phone_visible')} />
      <PrefRow label="Profil public"     sub="Votre profil est visible dans le système de rendez-vous"               checked={prefs.profile_public} onChange={() => toggle('profile_public')} />

      <div style={{ height: 1, background: C.border2, margin: '8px 0 8px' }} />

      <div style={{ paddingTop: 16 }}>
        <div style={{ fontFamily: C.dm, fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 6 }}>Historique de navigation</div>
        <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, marginBottom: 14 }}>
          Effacez vos recherches récentes et vos voitures consultées.
        </div>
        <button onClick={clearHistory} style={{
          background: 'transparent', border: `1px solid ${C.border}`,
          color: C.muted, fontFamily: C.dm, fontSize: 13,
          padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
        }}>Effacer l'historique</button>
      </div>
    </Section>
  );
}

// ── Avatar uploader ───────────────────────────────────────────────────────────
function AvatarUploader({ user, setUser }) {
  const inputRef = React.useRef(null);
  const [uploading, setUploading] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await authApi.uploadAvatar(file);
      setUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
    } catch { /* ignore */ }
    finally { setUploading(false); e.target.value = ''; }
  };

  const src = user.avatar_url;

  return (
    <div style={{ padding: '16px 12px 20px', textAlign: 'center', borderBottom: `1px solid ${C.border2}`, marginBottom: 8 }}>
      <div
        onClick={() => inputRef.current?.click()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 72, height: 72, borderRadius: '50%',
          background: src ? 'transparent' : C.goldDim,
          border: `2px solid ${hovered ? C.gold : C.goldBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 10px', cursor: 'pointer', position: 'relative', overflow: 'hidden',
          transition: 'border-color 0.2s',
        }}
      >
        {src
          ? <img src={src} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ color: C.gold, fontFamily: C.dm, fontSize: 22, fontWeight: 700 }}>
              {user.avatar_initials || user.first_name?.[0] || 'U'}
            </span>
        }
        {/* Overlay au survol */}
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hovered ? 1 : 0, transition: 'opacity 0.2s',
          fontSize: 18,
        }}>
          {uploading ? '⏳' : '📷'}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      <div style={{ fontFamily: C.dm, fontSize: 13, fontWeight: 600, color: C.text }}>
        {user.first_name} {user.last_name}
      </div>
      <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted, marginTop: 2 }}>
        {user.user_type === 'seller' ? 'Vendeur' : user.user_type === 'admin' ? 'Admin' : 'Acheteur'}
      </div>
      <div style={{ fontFamily: C.dm, fontSize: 10, color: C.faint, marginTop: 6 }}>
        Cliquer pour changer la photo
      </div>
    </div>
  );
}

// ── Page principale Paramètres ────────────────────────────────────────────────
const SECTIONS = [
  { id: 'profile',       icon: '👤', label: 'Profil' },
  { id: 'security',      icon: '🔒', label: 'Sécurité' },
  { id: 'notifications', icon: '🔔', label: 'Notifications' },
  { id: 'privacy',       icon: '🛡', label: 'Confidentialité' },
];

export default function Settings({ user, setUser, navigate, onLogout }) {
  const [active, setActive] = React.useState('profile');

  if (!user) { navigate('auth', { mode: 'login' }); return null; }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingTop: 64 }}>
      <div className="ac-container" style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: C.dm, fontSize: 12, color: C.gold, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            Mon compte
          </div>
          <h1 className="ac-h1" style={{ fontFamily: C.playfair, fontSize: 36, fontWeight: 700, color: C.text, margin: 0 }}>
            Paramètres
          </h1>
        </div>

        <div className="ac-split" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 28, alignItems: 'start' }}>

          {/* Sidebar */}
          <div className="ac-unsticky" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 8, position: 'sticky', top: 80 }}>
            <AvatarUploader user={user} setUser={setUser} />

            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => setActive(s.id)} style={{
                width: '100%', textAlign: 'left', background: active === s.id ? C.goldDim : 'none',
                border: active === s.id ? `1px solid ${C.goldBorder}` : '1px solid transparent',
                color: active === s.id ? C.gold : C.muted,
                fontFamily: C.dm, fontSize: 13, fontWeight: active === s.id ? 600 : 400,
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2,
              }}>
                <span style={{ fontSize: 15 }}>{s.icon}</span> {s.label}
              </button>
            ))}

            <div style={{ height: 1, background: C.border2, margin: '8px 0' }} />
            <button onClick={() => navigate(user.user_type === 'seller' ? 'seller-dashboard' : 'buyer-dashboard')} style={{
              width: '100%', textAlign: 'left', background: 'none',
              border: '1px solid transparent', color: C.muted,
              fontFamily: C.dm, fontSize: 13, padding: '10px 14px',
              borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 15 }}>◀</span> Mon tableau de bord
            </button>
          </div>

          {/* Content */}
          <div>
            {active === 'profile'       && <ProfileSection user={user} setUser={setUser} />}
            {active === 'security'      && <SecuritySection onLogout={onLogout} user={user} setUser={setUser} />}
            {active === 'notifications' && <NotificationsSection />}
            {active === 'privacy'       && <PrivacySection />}
          </div>
        </div>
      </div>
    </div>
  );
}
