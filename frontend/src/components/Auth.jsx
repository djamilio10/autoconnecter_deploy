import React from 'react';
import { C, Logo, Input } from './Shared';
import { authApi, sellersApi, setAccessToken } from '../api';

// ── Helpers de validation ────────────────────────────────────────────────────
const PHONE_RE = /^(\+?221)?\s?(7[05678])\s?\d{3}\s?\d{2}\s?\d{2}$/;
const VALID_PREFIXES = ['70', '75', '76', '77', '78'];
const CNI_RE = /^[12]\d{12}$|^[12]\d{16}$/;
const cleanDigits = (v) => (v || '').replace(/\s+/g, '');

const validatePhoneLive = (raw) => {
  const cleaned = (raw || '').replace(/\s+/g, '').replace(/^\+?221/, '');
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length >= 2 && !VALID_PREFIXES.some(p => digits.startsWith(p))) {
    return 'Le numéro doit commencer par 70, 75, 76, 77 ou 78';
  }
  if (digits.length > 9) {
    return 'Le numéro doit contenir exactement 9 chiffres';
  }
  return null;
};

// ── Indicateur de solidité du mot de passe ───────────────────────────────────
function passwordStrength(pwd) {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) score++;
  return Math.min(score, 4);
}

const STRENGTH_LABELS = ['', 'Faible', 'Moyen', 'Bon', 'Fort'];
const STRENGTH_COLORS = ['', '#e05c5c', '#e08a3c', '#d4c043', '#4caf7d'];

function PasswordStrengthBar({ password }) {
  const s = passwordStrength(password);
  if (!password) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 4,
            background: i <= s ? STRENGTH_COLORS[s] : '#27272A',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
      <span style={{ fontFamily: C.dm, fontSize: 11, color: STRENGTH_COLORS[s] }}>
        {STRENGTH_LABELS[s]}
      </span>
    </div>
  );
}

function PasswordInput({ label, value, onChange, placeholder, error, show, onToggle }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <div>
      {label && (
        <label style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, display: 'block', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{
            width: '100%', background: '#111113',
            border: `1px solid ${error ? C.error : focused ? C.gold : C.border}`,
            color: C.text, fontFamily: C.dm, fontSize: 14,
            padding: '13px 46px 13px 16px', borderRadius: 10, outline: 'none',
            boxSizing: 'border-box', transition: 'border-color 0.15s',
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <button
          type="button"
          onClick={onToggle}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: show ? C.gold : C.muted, fontSize: 17, padding: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.15s',
          }}
          tabIndex={-1}
          title={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          {show ? (
            // Œil barré
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            // Œil ouvert
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {error && <p style={{ fontFamily: C.dm, fontSize: 12, color: C.error, marginTop: 5 }}>{error}</p>}
    </div>
  );
}

// ── Modale de compte bloqué ───────────────────────────────────────────────────
function BlockedModal({ info, onClose }) {
  const isBanned = info.account_status === 'banned';

  const formatDate = (iso) => {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: C.surface, border: `1px solid ${isBanned ? 'rgba(239,68,68,0.4)' : 'rgba(234,179,8,0.4)'}`,
        borderRadius: 24, padding: '40px 36px', maxWidth: 480, width: '100%',
        boxShadow: `0 0 60px ${isBanned ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.1)'}`,
      }}>
        {/* Icône */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px',
          background: isBanned ? 'rgba(239,68,68,0.12)' : 'rgba(234,179,8,0.12)',
          border: `2px solid ${isBanned ? 'rgba(239,68,68,0.4)' : 'rgba(234,179,8,0.4)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
        }}>
          {isBanned ? '🚫' : '⏸️'}
        </div>

        {/* Titre */}
        <h2 style={{
          fontFamily: C.playfair, fontSize: 26, fontWeight: 700,
          color: isBanned ? '#f87171' : '#facc15',
          textAlign: 'center', margin: '0 0 8px',
        }}>
          {isBanned ? 'Compte banni' : 'Compte suspendu'}
        </h2>

        {/* Sous-titre */}
        <p style={{ fontFamily: C.dm, fontSize: 14, color: C.muted, textAlign: 'center', margin: '0 0 24px' }}>
          {isBanned
            ? "Votre accès à AutoConnect a été définitivement révoqué par l'administration."
            : "Votre compte a été temporairement suspendu par l'administration."}
        </p>

        {/* Note admin */}
        {info.reason ? (
          <div style={{
            background: isBanned ? 'rgba(239,68,68,0.07)' : 'rgba(234,179,8,0.07)',
            border: `1px solid ${isBanned ? 'rgba(239,68,68,0.25)' : 'rgba(234,179,8,0.25)'}`,
            borderRadius: 12, padding: '16px 18px', marginBottom: 20,
          }}>
            <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Motif communiqué par l'administration
            </div>
            <div style={{ fontFamily: C.dm, fontSize: 14, color: C.text, lineHeight: 1.6 }}>
              "{info.reason}"
            </div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(113,113,122,0.08)', border: `1px solid ${C.border}`,
            borderRadius: 12, padding: '14px 18px', marginBottom: 20,
          }}>
            <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, fontStyle: 'italic' }}>
              Aucun motif précisé par l'administration.
            </div>
          </div>
        )}

        {/* Date de fin (ban ou suspension avec durée) */}
        {info.ban_until && (
          <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 20 }}>
            {isBanned ? 'Banni' : 'Suspendu'} jusqu'au{' '}
            <strong style={{ color: isBanned ? '#f87171' : '#facc15' }}>{formatDate(info.ban_until)}</strong>
          </div>
        )}

        {/* Bouton retour */}
        <button onClick={onClose} style={{
          width: '100%', padding: '14px',
          background: isBanned ? 'rgba(239,68,68,0.12)' : 'rgba(234,179,8,0.12)',
          border: `1px solid ${isBanned ? 'rgba(239,68,68,0.35)' : 'rgba(234,179,8,0.35)'}`,
          color: isBanned ? '#f87171' : '#facc15',
          fontFamily: C.dm, fontSize: 14, fontWeight: 700,
          borderRadius: 12, cursor: 'pointer',
        }}>
          Retourner à l'accueil
        </button>
      </div>
    </div>
  );
}

function useWindowWidth() {
  const [width, setWidth] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 768);
  React.useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}

// ── Étape de vérification email ───────────────────────────────────────────────
function VerifyEmailStep({ email, onVerified, onBack, isMobile }) {
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  const handleVerify = async () => {
    if (code.length !== 6) { setError('Le code doit contenir 6 chiffres.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await authApi.verifyEmail({ email, code });
      setAccessToken(res.data.access);
      onVerified(res.data.user);
    } catch (err) {
      setError(err.response?.data?.detail || 'Code incorrect ou expiré.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setSuccess('');
    try {
      await authApi.resendVerification(email);
      setSuccess('Un nouveau code a été envoyé à votre adresse email.');
      setCode('');
    } catch (err) {
      setError(err.response?.data?.detail || "Impossible d'envoyer le code.");
    } finally {
      setResending(false);
    }
  };

  const inputsRef = React.useRef([]);
  const digits = code.split('');

  const handleDigitChange = (i, val) => {
    const d = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    const newCode = next.join('').slice(0, 6);
    setCode(newCode);
    setError('');
    if (d && i < 5) inputsRef.current[i + 1]?.focus();
  };

  const handleDigitKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
    if (e.key === 'Enter' && code.length === 6) handleVerify();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) { setCode(pasted); setError(''); inputsRef.current[Math.min(pasted.length, 5)]?.focus(); }
    e.preventDefault();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
      {/* Icône enveloppe */}
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'rgba(201,169,110,0.1)', border: '2px solid rgba(201,169,110,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
      }}>✉️</div>

      <div style={{ textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 10px', fontFamily: C.playfair, fontSize: 22, color: C.text }}>
          Vérifiez votre email
        </h2>
        <p style={{ margin: 0, fontFamily: C.dm, fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
          Un code à 6 chiffres a été envoyé à<br />
          <strong style={{ color: C.gold }}>{email}</strong>
        </p>
      </div>

      {/* Inputs chiffres */}
      <div style={{ display: 'flex', gap: isMobile ? 8 : 12 }} onPaste={handlePaste}>
        {[0,1,2,3,4,5].map(i => (
          <input
            key={i}
            ref={el => inputsRef.current[i] = el}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digits[i] || ''}
            onChange={e => handleDigitChange(i, e.target.value)}
            onKeyDown={e => handleDigitKeyDown(i, e)}
            style={{
              width: isMobile ? 42 : 52, height: isMobile ? 52 : 64,
              textAlign: 'center', fontSize: isMobile ? 22 : 28, fontWeight: 700,
              fontFamily: C.dm, color: digits[i] ? C.gold : C.text,
              background: '#111113',
              border: `2px solid ${digits[i] ? C.goldBorder : error ? 'rgba(224,92,92,0.5)' : C.border}`,
              borderRadius: 12, outline: 'none',
              transition: 'border-color 0.15s',
            }}
          />
        ))}
      </div>

      {error && (
        <div style={{
          background: 'rgba(224,92,92,0.1)', border: '1px solid rgba(224,92,92,0.3)',
          borderRadius: 10, padding: '10px 16px', width: '100%', boxSizing: 'border-box',
          fontFamily: C.dm, fontSize: 13, color: C.error, textAlign: 'center',
        }}>{error}</div>
      )}

      {success && (
        <div style={{
          background: 'rgba(76,175,125,0.1)', border: '1px solid rgba(76,175,125,0.3)',
          borderRadius: 10, padding: '10px 16px', width: '100%', boxSizing: 'border-box',
          fontFamily: C.dm, fontSize: 13, color: '#4caf7d', textAlign: 'center',
        }}>{success}</div>
      )}

      <button onClick={handleVerify} disabled={loading || code.length !== 6} style={{
        width: '100%', background: (loading || code.length !== 6) ? 'rgba(201,169,110,0.4)' : C.gold,
        border: 'none', color: C.bg, fontFamily: C.dm, fontSize: 15, fontWeight: 700,
        padding: '14px', borderRadius: 10,
        cursor: (loading || code.length !== 6) ? 'not-allowed' : 'pointer',
      }}>
        {loading ? 'Vérification...' : 'Valider mon email'}
      </button>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', width: '100%', justifyContent: 'center' }}>
        <button onClick={handleResend} disabled={resending} style={{
          background: 'none', border: 'none', fontFamily: C.dm, fontSize: 13,
          color: resending ? C.muted : C.gold, cursor: resending ? 'not-allowed' : 'pointer',
          textDecoration: 'underline', padding: 0,
        }}>
          {resending ? 'Envoi...' : 'Renvoyer le code'}
        </button>
        <span style={{ color: C.border }}>·</span>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', fontFamily: C.dm, fontSize: 13,
          color: C.muted, cursor: 'pointer', padding: 0,
        }}>
          Retour
        </button>
      </div>
    </div>
  );
}

// ── Mot de passe oublié (demande de code → réinitialisation) ──────────────────
function ForgotPasswordStep({ onDone, onBack, isMobile }) {
  const [phase, setPhase] = React.useState('request'); // 'request' | 'reset'
  const [email, setEmail] = React.useState('');
  const [code, setCode] = React.useState('');
  const [pwd, setPwd] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [showPwd, setShowPwd] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [info, setInfo] = React.useState('');

  const inputsRef = React.useRef([]);
  const digits = code.split('');

  const handleRequest = async () => {
    if (!email.includes('@')) { setError('Adresse email invalide.'); return; }
    setLoading(true); setError(''); setInfo('');
    try {
      const res = await authApi.requestPasswordReset(email.trim());
      setInfo(res.data?.detail || 'Si un compte existe, un code a été envoyé.');
      setPhase('reset');
    } catch (err) {
      setError(err.response?.data?.detail || "Impossible d'envoyer le code. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (code.length !== 6) { setError('Le code doit contenir 6 chiffres.'); return; }
    if (pwd.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    if (pwd !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true); setError('');
    try {
      await authApi.confirmPasswordReset({ email: email.trim(), code, new_password: pwd });
      onDone('Mot de passe réinitialisé. Connectez-vous avec votre nouveau mot de passe.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Code invalide ou expiré.');
    } finally {
      setLoading(false);
    }
  };

  const handleDigitChange = (i, val) => {
    const d = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    setCode(next.join('').slice(0, 6));
    setError('');
    if (d && i < 5) inputsRef.current[i + 1]?.focus();
  };
  const handleDigitKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputsRef.current[i - 1]?.focus();
  };
  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) { setCode(pasted); setError(''); inputsRef.current[Math.min(pasted.length, 5)]?.focus(); }
    e.preventDefault();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'rgba(201,169,110,0.1)', border: '2px solid rgba(201,169,110,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
      }}>🔑</div>

      <div style={{ textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 10px', fontFamily: C.playfair, fontSize: 22, color: C.text }}>
          {phase === 'request' ? 'Mot de passe oublié' : 'Réinitialiser le mot de passe'}
        </h2>
        <p style={{ margin: 0, fontFamily: C.dm, fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
          {phase === 'request'
            ? 'Entrez votre adresse email pour recevoir un code de réinitialisation.'
            : <>Entrez le code à 6 chiffres envoyé à<br /><strong style={{ color: C.gold }}>{email}</strong> et votre nouveau mot de passe.</>}
        </p>
      </div>

      {error && (
        <div style={{
          background: 'rgba(224,92,92,0.1)', border: '1px solid rgba(224,92,92,0.3)',
          borderRadius: 10, padding: '10px 16px', width: '100%', boxSizing: 'border-box',
          fontFamily: C.dm, fontSize: 13, color: C.error, textAlign: 'center',
        }}>{error}</div>
      )}
      {info && phase === 'reset' && (
        <div style={{
          background: 'rgba(76,175,125,0.1)', border: '1px solid rgba(76,175,125,0.3)',
          borderRadius: 10, padding: '10px 16px', width: '100%', boxSizing: 'border-box',
          fontFamily: C.dm, fontSize: 13, color: '#4caf7d', textAlign: 'center',
        }}>{info}</div>
      )}

      {phase === 'request' ? (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}
             onKeyDown={e => { if (e.key === 'Enter' && !loading) handleRequest(); }}>
          <Input
            label="Adresse email"
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }}
            placeholder="votre@email.com"
          />
          <button onClick={handleRequest} disabled={loading} style={{
            width: '100%', background: loading ? 'rgba(201,169,110,0.4)' : C.gold,
            border: 'none', color: C.bg, fontFamily: C.dm, fontSize: 15, fontWeight: 700,
            padding: '14px', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Envoi...' : 'Envoyer le code'}
          </button>
        </div>
      ) : (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', gap: isMobile ? 8 : 12, justifyContent: 'center' }} onPaste={handlePaste}>
            {[0,1,2,3,4,5].map(i => (
              <input
                key={i}
                ref={el => inputsRef.current[i] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digits[i] || ''}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleDigitKeyDown(i, e)}
                style={{
                  width: isMobile ? 42 : 52, height: isMobile ? 52 : 64,
                  textAlign: 'center', fontSize: isMobile ? 22 : 28, fontWeight: 700,
                  fontFamily: C.dm, color: digits[i] ? C.gold : C.text,
                  background: '#111113',
                  border: `2px solid ${digits[i] ? C.goldBorder : error ? 'rgba(224,92,92,0.5)' : C.border}`,
                  borderRadius: 12, outline: 'none', transition: 'border-color 0.15s',
                }}
              />
            ))}
          </div>

          <div onKeyDown={e => { if (e.key === 'Enter' && !loading) handleReset(); }}>
            <PasswordInput
              label="Nouveau mot de passe"
              value={pwd}
              onChange={e => { setPwd(e.target.value); setError(''); }}
              placeholder="••••••••"
              show={showPwd}
              onToggle={() => setShowPwd(v => !v)}
            />
            <PasswordStrengthBar password={pwd} />
          </div>
          <div onKeyDown={e => { if (e.key === 'Enter' && !loading) handleReset(); }}>
            <PasswordInput
              label="Confirmer le mot de passe"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(''); }}
              placeholder="••••••••"
              show={showPwd}
              onToggle={() => setShowPwd(v => !v)}
            />
          </div>

          <button onClick={handleReset} disabled={loading || code.length !== 6} style={{
            width: '100%', background: (loading || code.length !== 6) ? 'rgba(201,169,110,0.4)' : C.gold,
            border: 'none', color: C.bg, fontFamily: C.dm, fontSize: 15, fontWeight: 700,
            padding: '14px', borderRadius: 10, cursor: (loading || code.length !== 6) ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Réinitialisation...' : 'Réinitialiser mon mot de passe'}
          </button>
        </div>
      )}

      <button onClick={onBack} style={{
        background: 'none', border: 'none', fontFamily: C.dm, fontSize: 13,
        color: C.muted, cursor: 'pointer', padding: 0,
      }}>
        ← Retour à la connexion
      </button>
    </div>
  );
}

// ── Étape 2FA à la connexion (saisie du code TOTP) ───────────────────────────
function TwoFactorLoginStep({ onSubmit, onBack, loading, error }) {
  const [code, setCode] = React.useState('');
  const submit = () => { if (code.length === 6 && !loading) onSubmit(code); };
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
          background: 'rgba(201,169,110,0.1)', border: '2px solid rgba(201,169,110,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
        }}>🔐</div>
      </div>
      <h2 style={{ fontFamily: C.playfair, fontSize: 22, fontWeight: 700, color: C.text, textAlign: 'center', margin: '0 0 8px' }}>
        Vérification en deux étapes
      </h2>
      <p style={{ fontFamily: C.dm, fontSize: 14, color: C.muted, textAlign: 'center', margin: '0 0 24px', lineHeight: 1.6 }}>
        Saisissez le code à 6 chiffres affiché par votre application d'authentification.
      </p>
      {error && (
        <div style={{
          background: 'rgba(224,92,92,0.1)', border: '1px solid rgba(224,92,92,0.3)', color: '#f87171',
          fontFamily: C.dm, fontSize: 13, borderRadius: 10, padding: '10px 14px', marginBottom: 16, textAlign: 'center',
        }}>{error}</div>
      )}
      <input
        value={code}
        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
        placeholder="000000"
        inputMode="numeric"
        autoFocus
        style={{
          width: '100%', boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`,
          color: C.text, fontFamily: C.dm, fontSize: 24, letterSpacing: '0.4em', textAlign: 'center',
          padding: '14px', borderRadius: 12, outline: 'none',
        }}
      />
      <button onClick={submit} disabled={loading || code.length !== 6} style={{
        width: '100%', marginTop: 16, padding: '14px',
        background: (loading || code.length !== 6) ? 'rgba(201,169,110,0.35)' : C.gold,
        border: 'none', color: C.bg, fontFamily: C.dm, fontSize: 15, fontWeight: 700,
        borderRadius: 12, cursor: (loading || code.length !== 6) ? 'not-allowed' : 'pointer',
      }}>{loading ? 'Vérification...' : 'Se connecter'}</button>
      <button onClick={onBack} style={{
        width: '100%', marginTop: 12, padding: '12px', background: 'transparent',
        border: 'none', color: C.muted, fontFamily: C.dm, fontSize: 13, cursor: 'pointer',
      }}>← Retour</button>
    </div>
  );
}

export default function Auth({ navigate, setUser, initialMode, initialType }) {
  const winWidth = useWindowWidth();
  const isMobile = winWidth < 600;
  const [mode, setMode] = React.useState(initialMode || 'login');
  const [accountType, setAccountType] = React.useState(initialType || 'buyer');
  const [form, setForm] = React.useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    company: '',
    phone: '',
    id_card_number: '',
  });
  const [logoFile, setLogoFile] = React.useState(null);
  const [logoPreview, setLogoPreview] = React.useState(null);
  const [errors, setErrors] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [apiError, setApiError] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [blockedInfo, setBlockedInfo] = React.useState(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = React.useState(null);
  const [forgotPassword, setForgotPassword] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState('');
  const [otpStep, setOtpStep] = React.useState(false);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const setField = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.email.includes('@')) e.email = 'Email invalide';
    if (form.password.length < 6) e.password = 'Min. 6 caractères';

    if (mode === 'register') {
      if (form.confirmPassword !== form.password) e.confirmPassword = 'Les mots de passe ne correspondent pas';
      if (!form.name.trim()) e.name = 'Requis';
      const phoneClean = cleanDigits(form.phone);
      if (!phoneClean) e.phone = 'Téléphone requis';
      else {
        const liveErr = validatePhoneLive(form.phone);
        if (liveErr) e.phone = liveErr;
        else if (!PHONE_RE.test(phoneClean)) e.phone = 'Numéro incomplet ou format invalide';
      }

      const cniClean = cleanDigits(form.id_card_number);
      if (!cniClean) e.id_card_number = 'CNI requise';
      else if (!['1','2'].includes(cniClean[0])) e.id_card_number = 'Le numéro doit commencer par 1 (homme) ou 2 (femme)';
      else if (!CNI_RE.test(cniClean)) e.id_card_number = 'Format invalide : 13 ou 17 chiffres requis';
    }
    return e;
  };

  const finishLogin = (res) => {
    setAccessToken(res.data.access);
    setUser(res.data.user);
    navigate(
      res.data.user.user_type === 'seller' ? 'seller-dashboard' :
      res.data.user.user_type === 'admin'  ? 'admin-dashboard'  : 'buyer-dashboard'
    );
  };

  // 2ᵉ étape de connexion : renvoie email+mot de passe + code TOTP.
  const submitOtp = async (otp) => {
    setLoading(true); setApiError('');
    try {
      const res = await authApi.login({ email: form.email.trim(), password: form.password, otp });
      finishLogin(res);
    } catch (err) {
      setApiError(err.response?.data?.detail || 'Code de vérification invalide.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    setApiError('');
    try {
      let res;
      if (mode === 'login') {
        res = await authApi.login({ email: form.email.trim(), password: form.password });
        // 2FA active : on bascule sur l'étape de saisie du code (sans jetons).
        if (res.data.two_factor_required) { setOtpStep(true); return; }
        finishLogin(res);
      } else {
        const [firstName, ...rest] = form.name.trim().split(' ');
        res = await authApi.register({
          email: form.email.trim(),
          password: form.password,
          first_name: firstName,
          last_name: rest.join(' ') || firstName,
          user_type: accountType,
          company: form.company,
          phone: cleanDigits(form.phone),
          id_card_number: cleanDigits(form.id_card_number),
        });
        setPendingVerificationEmail(res.data.email);
      }
    } catch (err) {
      const data = err.response?.data;
      // Compte banni ou suspendu → modale dédiée
      if (err.response?.status === 403 && data?.account_status === 'email_not_verified') {
        setPendingVerificationEmail(data.email);
        return;
      }
      if (err.response?.status === 403 && data?.account_status) {
        setBlockedInfo(data);
        return;
      }
      if (typeof data === 'string') setApiError(data);
      else if (data?.non_field_errors) setApiError(data.non_field_errors[0]);
      else if (data?.email) setApiError(`Email : ${data.email[0]}`);
      else if (data?.company) setApiError(`Nom de vendeur : ${data.company[0]}`);
      else if (data?.phone) setApiError(`Téléphone : ${data.phone[0]}`);
      else if (data?.id_card_number) setApiError(`CNI : ${data.id_card_number[0]}`);
      else if (data?.password) setApiError(`Mot de passe : ${data.password[0]}`);
      else if (data?.detail) setApiError(data.detail);
      else setApiError('Une erreur est survenue. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  // Permet d'envoyer le formulaire avec Entree
  const onKeyDown = (e) => { if (e.key === 'Enter' && !loading) handleSubmit(); };

  if (forgotPassword) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: isMobile ? '24px 12px' : '60px 24px' }}>
        <div style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 20 : 40 }}>
            <Logo size="lg" onClick={() => navigate('home')} />
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: isMobile ? 16 : 24, padding: isMobile ? '24px 16px' : 40 }}>
            <ForgotPasswordStep
              isMobile={isMobile}
              onDone={(msg) => {
                setForgotPassword(false);
                setMode('login');
                setSuccessMsg(msg);
                setApiError('');
              }}
              onBack={() => setForgotPassword(false)}
            />
          </div>
        </div>
      </div>
    );
  }

  if (otpStep) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: isMobile ? '24px 12px' : '60px 24px' }}>
        <div style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 20 : 40 }}>
            <Logo size="lg" onClick={() => navigate('home')} />
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: isMobile ? 16 : 24, padding: isMobile ? '24px 16px' : 40 }}>
            <TwoFactorLoginStep
              loading={loading}
              error={apiError}
              onSubmit={submitOtp}
              onBack={() => { setOtpStep(false); setApiError(''); }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (pendingVerificationEmail) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: isMobile ? '24px 12px' : '60px 24px' }}>
        <div style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 20 : 40 }}>
            <Logo size="lg" onClick={() => navigate('home')} />
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: isMobile ? 16 : 24, padding: isMobile ? '24px 16px' : 40 }}>
            <VerifyEmailStep
              email={pendingVerificationEmail}
              isMobile={isMobile}
              onVerified={async (user) => {
                setUser(user);
                if (logoFile && user.user_type === 'seller') {
                  try { await sellersApi.uploadLogo(logoFile); } catch { /* ignore */ }
                }
                navigate(
                  user.user_type === 'seller' ? 'seller-dashboard' :
                  user.user_type === 'admin'  ? 'admin-dashboard'  : 'buyer-dashboard'
                );
              }}
              onBack={() => setPendingVerificationEmail(null)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: isMobile ? '24px 12px' : '60px 24px' }}>
      {blockedInfo && <BlockedModal info={blockedInfo} onClose={() => navigate('home')} />}
      <div style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 20 : 40 }}>
          <Logo size="lg" onClick={() => navigate('home')} />
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: isMobile ? 16 : 24, padding: isMobile ? '20px 16px' : 40 }}>
          {/* Toggle */}
          <div style={{ display: 'flex', background: '#0e0e10', borderRadius: 12, padding: 4, marginBottom: 32 }}>
            {[['login', 'Connexion'], ['register', 'Créer un compte']].map(([m, label]) => (
              <button key={m} onClick={() => { setMode(m); setErrors({}); setApiError(''); }} style={{
                flex: 1, padding: isMobile ? '10px 6px' : '10px', borderRadius: 10, border: 'none',
                background: mode === m ? '#1e1e21' : 'transparent',
                color: mode === m ? C.text : C.muted,
                fontFamily: C.dm, fontSize: isMobile ? 12 : 14, fontWeight: mode === m ? 600 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}>{label}</button>
            ))}
          </div>

          {/* Account type (register only) */}
          {mode === 'register' && (
            <div style={{ marginBottom: 28 }}>
              <label style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Je suis</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[['buyer', '🛒', 'Acheteur', 'Je cherche un véhicule'], ['seller', '🏷', 'Vendeur', 'Je publie des annonces']].map(([type, icon, title, sub]) => (
                  <button key={type} onClick={() => setAccountType(type)} style={{
                    background: accountType === type ? 'rgba(201,169,110,0.08)' : 'transparent',
                    border: `1px solid ${accountType === type ? C.goldBorder : C.border}`,
                    borderRadius: 12, padding: isMobile ? '12px 10px' : '16px', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{ fontSize: isMobile ? 18 : 22, marginBottom: 4 }}>{icon}</div>
                    <div style={{ fontFamily: C.dm, fontSize: isMobile ? 13 : 14, fontWeight: 600, color: accountType === type ? C.gold : C.text, marginBottom: 2 }}>{title}</div>
                    {!isMobile && <div style={{ fontFamily: C.dm, fontSize: 11, color: C.subtle }}>{sub}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Logo upload — vendeurs seulement */}
          {mode === 'register' && accountType === 'seller' && (
            <div style={{ marginBottom: 28 }}>
              <label style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Logo de votre boutique (optionnel)
              </label>
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 12,
                  background: logoPreview ? 'transparent' : '#18181b',
                  border: `2px dashed ${logoPreview ? C.gold : C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', flexShrink: 0,
                  transition: 'border-color 0.2s',
                }}>
                  {logoPreview
                    ? <img src={logoPreview} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 24 }}>🏪</span>
                  }
                </div>
                <div>
                  <div style={{ fontFamily: C.dm, fontSize: 13, color: logoPreview ? C.gold : C.text, fontWeight: 500 }}>
                    {logoPreview ? 'Logo sélectionné ✓' : 'Cliquez pour ajouter un logo'}
                  </div>
                  <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted, marginTop: 3 }}>JPG, PNG, WebP — max 5 Mo</div>
                </div>
                <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
              </label>
            </div>
          )}

          {successMsg && mode === 'login' && (
            <div style={{
              background: 'rgba(76,175,125,0.1)', border: '1px solid rgba(76,175,125,0.3)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 20,
              fontFamily: C.dm, fontSize: 13, color: '#4caf7d',
            }}>{successMsg}</div>
          )}

          {apiError && (
            <div style={{
              background: 'rgba(224,92,92,0.1)', border: '1px solid rgba(224,92,92,0.3)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 20,
              fontFamily: C.dm, fontSize: 13, color: C.error,
            }}>{apiError}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }} onKeyDown={onKeyDown}>
            {mode === 'register' && (
              <Input
                label={accountType === 'seller' ? 'Nom / Enseigne' : 'Prénom et nom'}
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder={accountType === 'seller' ? 'Premium Motors Dakar' : 'Jean Dupont'}
                error={errors.name}
              />
            )}

            <Input
              label="Adresse email"
              type="email"
              value={form.email}
              onChange={e => setField('email', e.target.value)}
              placeholder="votre@email.com"
              error={errors.email}
            />

            {mode === 'register' && (
              <>
                <Input
                  label="Téléphone"
                  type="tel"
                  value={form.phone}
                  onChange={e => {
                    const val = e.target.value;
                    setForm(f => ({ ...f, phone: val }));
                    const liveErr = validatePhoneLive(val);
                    setErrors(prev => ({ ...prev, phone: liveErr || undefined }));
                  }}
                  placeholder="+221 7X XXX XX XX"
                  error={errors.phone}
                />

                <Input
                  label="Numéro de carte d'identité (CNI)"
                  type="text"
                  value={form.id_card_number}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 17);
                    setForm(f => ({ ...f, id_card_number: digits }));
                    let cniErr = undefined;
                    if (digits.length >= 1 && !['1', '2'].includes(digits[0])) {
                      cniErr = 'Le numéro doit commencer par 1 (homme) ou 2 (femme)';
                    } else if (digits.length > 13 && digits.length < 17) {
                      cniErr = 'Format invalide : 13 ou 17 chiffres requis';
                    } else if (digits.length === 17 || digits.length === 13) {
                      cniErr = undefined;
                    }
                    setErrors(prev => ({ ...prev, id_card_number: cniErr }));
                  }}
                  placeholder="13 ou 17 chiffres"
                  error={errors.id_card_number}
                />
              </>
            )}

            <div>
              <PasswordInput
                label="Mot de passe"
                value={form.password}
                onChange={e => setField('password', e.target.value)}
                placeholder="••••••••"
                error={errors.password}
                show={showPassword}
                onToggle={() => setShowPassword(v => !v)}
              />
              {mode === 'register' && <PasswordStrengthBar password={form.password} />}
              {mode === 'login' && (
                <div style={{ textAlign: 'right', marginTop: 8 }}>
                  <span
                    onClick={() => { setForgotPassword(true); setApiError(''); setErrors({}); }}
                    style={{ fontFamily: C.dm, fontSize: 13, color: C.gold, cursor: 'pointer' }}>
                    Mot de passe oublié ?
                  </span>
                </div>
              )}
            </div>

            {mode === 'register' && (
              <PasswordInput
                label="Confirmer le mot de passe"
                value={form.confirmPassword}
                onChange={e => setField('confirmPassword', e.target.value)}
                placeholder="••••••••"
                error={errors.confirmPassword}
                show={showConfirm}
                onToggle={() => setShowConfirm(v => !v)}
              />
            )}

            <button onClick={handleSubmit} disabled={loading} style={{
              background: loading ? 'rgba(201,169,110,0.5)' : C.gold,
              border: 'none', color: C.bg, fontFamily: C.dm,
              fontSize: 15, fontWeight: 700, padding: '14px', borderRadius: 10,
              cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8,
            }}>
              {loading ? 'Veuillez patienter...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
            </button>
          </div>

          <p style={{ fontFamily: C.dm, fontSize: 13, color: C.subtle, textAlign: 'center', margin: '24px 0 0' }}>
            {mode === 'login' ? "Pas encore de compte ? " : "Déjà un compte ? "}
            <span onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErrors({}); setApiError(''); }}
              style={{ color: C.gold, cursor: 'pointer', fontWeight: 600 }}>
              {mode === 'login' ? "S'inscrire" : "Se connecter"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
