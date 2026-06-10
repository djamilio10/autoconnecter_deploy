import React from 'react';
import { C } from './Shared';
import { sellersApi } from '../api';

// ── Étoiles ───────────────────────────────────────────────────────────────────
function Stars({ value, interactive = false, onChange }) {
  const [hovered, setHovered] = React.useState(0);
  const display = interactive ? (hovered || value) : value;

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          onClick={() => interactive && onChange?.(i)}
          onMouseEnter={() => interactive && setHovered(i)}
          onMouseLeave={() => interactive && setHovered(0)}
          style={{
            fontSize: interactive ? 24 : 14,
            color: i <= display ? '#F59E0B' : C.border,
            cursor: interactive ? 'pointer' : 'default',
            transition: 'color 0.1s',
          }}
        >★</span>
      ))}
    </div>
  );
}

export default function Reviews({ sellerId, carId, user }) {
  const [reviews, setReviews] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [rating, setRating] = React.useState(5);
  const [comment, setComment] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);

  const load = React.useCallback(() => {
    sellersApi.reviews(sellerId)
      .then(r => setReviews(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sellerId]);

  React.useEffect(() => { load(); }, [load]);

  const alreadyReviewed = user && reviews.some(r => r.reviewer_name === (user.first_name + ' ' + user.last_name).trim() || false);

  const handleSubmit = async () => {
    if (!comment.trim()) { setError('Veuillez écrire un commentaire.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await sellersApi.addReview(sellerId, { rating, comment: comment.trim(), car: carId || null });
      setSuccess(true);
      setShowForm(false);
      setComment('');
      setRating(5);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'envoi.');
    }
    setSubmitting(false);
  };

  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  return (
    <div style={{ marginTop: 48 }}>
      {/* Titre */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2 style={{ fontFamily: C.playfair, fontSize: 22, fontWeight: 700, color: C.text }}>
            Avis des acheteurs
          </h2>
          {avgRating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Stars value={Math.round(parseFloat(avgRating))} />
              <span style={{ fontFamily: C.dm, fontSize: 14, color: C.gold, fontWeight: 700 }}>{avgRating}</span>
              <span style={{ fontFamily: C.dm, fontSize: 13, color: C.muted }}>({reviews.length} avis)</span>
            </div>
          )}
        </div>
        {user && user.user_type === 'buyer' && !alreadyReviewed && !showForm && !success && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              background: C.goldDim, border: `1px solid ${C.goldBorder}`,
              color: C.gold, fontFamily: C.dm, fontSize: 13, fontWeight: 600,
              padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
            }}
          >+ Laisser un avis</button>
        )}
      </div>

      {success && (
        <div style={{ background: 'rgba(76,175,125,0.1)', border: '1px solid rgba(76,175,125,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontFamily: C.dm, fontSize: 13, color: '#4caf7d' }}>
          ✓ Votre avis a été publié. Merci !
        </div>
      )}

      {/* Formulaire avis */}
      {showForm && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px', marginBottom: 24 }}>
          <div style={{ fontFamily: C.dm, fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 16 }}>Votre note</div>
          <Stars value={rating} interactive onChange={setRating} />
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Décrivez votre expérience avec ce vendeur..."
            rows={4}
            style={{
              width: '100%', background: '#18181b', border: `1px solid ${C.border}`,
              color: C.text, fontFamily: C.dm, fontSize: 14,
              padding: '12px 14px', borderRadius: 10, outline: 'none',
              resize: 'vertical', marginTop: 16, boxSizing: 'border-box',
            }}
            onFocus={e => { e.target.style.borderColor = C.gold; }}
            onBlur={e => { e.target.style.borderColor = C.border; }}
          />
          {error && <p style={{ fontFamily: C.dm, fontSize: 12, color: C.error, marginTop: 6 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={handleSubmit} disabled={submitting} style={{
              background: submitting ? 'rgba(201,169,110,0.4)' : C.gold,
              border: 'none', color: C.bg, padding: '10px 22px', borderRadius: 10,
              fontFamily: C.dm, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14,
            }}>
              {submitting ? 'Envoi...' : 'Publier'}
            </button>
            <button onClick={() => { setShowForm(false); setError(''); }} style={{
              background: 'none', border: `1px solid ${C.border}`, color: C.muted,
              padding: '10px 22px', borderRadius: 10, fontFamily: C.dm, cursor: 'pointer', fontSize: 14,
            }}>Annuler</button>
          </div>
        </div>
      )}

      {/* Liste des avis */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px', fontFamily: C.dm, fontSize: 13, color: C.muted }}>Chargement...</div>
      ) : reviews.length === 0 ? (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
          padding: '32px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⭐</div>
          <div style={{ fontFamily: C.dm, fontSize: 14, color: C.muted }}>
            Aucun avis pour ce vendeur. Soyez le premier à en laisser un !
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {reviews.map(r => (
            <div key={r.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', background: '#27272A',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: C.dm, fontSize: 13, fontWeight: 700, color: C.muted,
                  }}>{r.reviewer_initials || '?'}</div>
                  <div>
                    <div style={{ fontFamily: C.dm, fontSize: 14, fontWeight: 600, color: C.text }}>{r.reviewer_name}</div>
                    <Stars value={r.rating} />
                  </div>
                </div>
                <div style={{ fontFamily: C.dm, fontSize: 12, color: C.muted }}>
                  {new Date(r.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
              {r.comment && (
                <p style={{ fontFamily: C.dm, fontSize: 14, color: C.text, lineHeight: 1.6, margin: 0 }}>{r.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
