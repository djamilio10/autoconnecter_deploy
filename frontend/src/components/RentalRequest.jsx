import React from 'react';
import { C, Btn, Spinner } from './Shared';
import { carsApi, rentalApi } from '../api';

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function toISO(d) {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDate(d) {
  if (!d) return '';
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}
function isBlocked(d, blocked) {
  const iso = toISO(d);
  return blocked.some(b => iso >= b.start_date && iso < b.end_date);
}

function Card({ children, style }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, ...style }}>
      {children}
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{ fontFamily: C.dm, fontSize: 11, fontWeight: 700, color: C.subtle, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </div>
  );
}

export default function RentalRequest({ carId, navigate, user }) {
  const [car, setCar] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [blocked, setBlocked] = React.useState([]);
  const [startDate, setStartDate] = React.useState(null);
  const [endDate, setEndDate] = React.useState(null);
  const [message, setMessage] = React.useState('');
  const [step, setStep] = React.useState(1); // 1=dates 2=recap 3=done
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [calMonth, setCalMonth] = React.useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });

  React.useEffect(() => {
    if (!user) { navigate('auth', { mode: 'login' }); return; }
    Promise.all([
      carsApi.detail(carId),
      rentalApi.availability(carId),
    ]).then(([carRes, availRes]) => {
      setCar(carRes.data);
      setBlocked(availRes.data.blocked_dates || []);
    }).catch(() => navigate('catalogue')).finally(() => setLoading(false));
  }, [carId]);

  const today = new Date(); today.setHours(0,0,0,0);

  // Build calendar grid for calMonth
  const buildCalendar = () => {
    const year = calMonth.getFullYear(), month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));
    return cells;
  };

  const handleDayClick = (d) => {
    if (!d) return;
    if (d < today) return;
    if (isBlocked(d, blocked)) return;
    if (!startDate || (startDate && endDate)) {
      setStartDate(d); setEndDate(null);
    } else {
      if (d < startDate) { setStartDate(d); setEndDate(null); return; }
      // Check no blocked day in range
      let cur = new Date(startDate); cur.setDate(cur.getDate() + 1);
      let hasBlock = false;
      while (cur <= d) {
        if (isBlocked(cur, blocked)) { hasBlock = true; break; }
        cur.setDate(cur.getDate() + 1);
      }
      if (hasBlock) { setError('Des dates dans cet intervalle sont déjà réservées.'); return; }
      setError('');
      setEndDate(d);
    }
  };

  const inRange = (d) => {
    if (!d || !startDate || !endDate) return false;
    return d > startDate && d < endDate;
  };

  const nbDays = startDate && endDate ? Math.max(1, Math.ceil((endDate - startDate) / 86400000)) : 0;
  const totalPrice = car && car.rental_price_per_day ? (nbDays * parseFloat(car.rental_price_per_day)).toFixed(0) : null;

  const handleConfirm = async () => {
    if (!startDate || !endDate) { setError('Sélectionnez les dates.'); return; }
    setSubmitting(true);
    try {
      await rentalApi.create({
        car_id: carId,
        start_date: toISO(startDate),
        end_date: toISO(endDate),
        renter_message: message,
      });
      setStep(3);
    } catch (e) {
      setError(e.response?.data?.error || 'Erreur lors de la demande. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ background: C.bg, minHeight: '100vh', paddingTop: 64 }}><Spinner /></div>;

  const seller = car?.seller;
  const cells = buildCalendar();

  // Step 3 — success
  if (step === 3) return (
    <div style={{ background: C.bg, minHeight: '100vh', paddingTop: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 480, width: '100%', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(201,169,110,0.12)', border: `2px solid ${C.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 32 }}>✓</div>
        <div style={{ fontFamily: C.dm, fontSize: 26, fontWeight: 700, color: C.text, marginBottom: 12 }}>Demande envoyée !</div>
        <div style={{ fontFamily: C.dm, fontSize: 15, color: C.muted, lineHeight: 1.7, marginBottom: 32 }}>
          Le vendeur <strong style={{ color: C.text }}>{seller?.name}</strong> a reçu votre demande de location.<br />
          Il va vous contacter pour confirmer et vous préciser les documents à apporter.
        </div>
        <div style={{ background: 'rgba(201,169,110,0.06)', border: `1px solid ${C.goldBorder}`, borderRadius: 12, padding: '16px 20px', marginBottom: 32, textAlign: 'left' }}>
          <div style={{ fontFamily: C.dm, fontSize: 13, color: C.gold, fontWeight: 600, marginBottom: 8 }}>Documents généralement demandés</div>
          {(car?.rental_required_docs?.length > 0 ? car.rental_required_docs : ['Permis de conduire valide', 'Carte d\'identité (CIN)', 'Caution / dépôt de garantie']).map((doc, i) => (
            <div key={i} style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, display: 'flex', gap: 8, marginBottom: 4 }}>
              <span style={{ color: C.gold }}>•</span> {doc}
            </div>
          ))}
        </div>
        <div className="ac-wrap" style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Btn onClick={() => navigate('buyer-dashboard')} variant="secondary">Mes locations</Btn>
          <Btn onClick={() => navigate('car-detail', { carId })}>Retour à l'annonce</Btn>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ background: C.bg, minHeight: '100vh', paddingTop: 64 }}>
      <div className="ac-container" style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <button onClick={() => navigate('car-detail', { carId })} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontFamily: C.dm, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 32 }}>
          ← Retour à l'annonce
        </button>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: C.dm, fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Location</div>
          <div style={{ fontFamily: C.dm, fontSize: 28, fontWeight: 700, color: C.text }}>{car?.make} {car?.model} {car?.year}</div>
          <div style={{ fontFamily: C.dm, fontSize: 14, color: C.muted, marginTop: 4 }}>Chez {seller?.name} · {car?.location}</div>
        </div>

        <div className="ac-split" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>

          {/* Left: Calendar + note */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Step indicators */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 4 }}>
              {['Choisir les dates', 'Confirmer'].map((s, i) => {
                const n = i + 1;
                const active = step === n, done = step > n;
                return (
                  <React.Fragment key={i}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: done ? C.gold : active ? 'rgba(201,169,110,0.15)' : C.surface, border: `2px solid ${done || active ? C.gold : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: C.dm, fontSize: 13, fontWeight: 700, color: done ? C.bg : active ? C.gold : C.subtle }}>
                        {done ? '✓' : n}
                      </div>
                      <span style={{ fontFamily: C.dm, fontSize: 11, color: active ? C.gold : C.subtle }}>{s}</span>
                    </div>
                    {i < 1 && <div style={{ flex: 1, height: 1, background: step > n ? C.gold : C.border, marginBottom: 20, opacity: 0.5, marginTop: 16 }} />}
                  </React.Fragment>
                );
              })}
            </div>

            {step === 1 && (
              <Card>
                {/* Calendar nav */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <button onClick={() => { const d = new Date(calMonth); d.setMonth(d.getMonth()-1); setCalMonth(d); }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, cursor: 'pointer', padding: '6px 12px', fontFamily: C.dm }}>‹</button>
                  <span style={{ fontFamily: C.dm, fontSize: 15, fontWeight: 600, color: C.text }}>
                    {MONTH_NAMES[calMonth.getMonth()]} {calMonth.getFullYear()}
                  </span>
                  <button onClick={() => { const d = new Date(calMonth); d.setMonth(d.getMonth()+1); setCalMonth(d); }} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, cursor: 'pointer', padding: '6px 12px', fontFamily: C.dm }}>›</button>
                </div>

                {/* Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
                  {DAY_NAMES.map(d => <div key={d} style={{ textAlign: 'center', fontFamily: C.dm, fontSize: 11, fontWeight: 700, color: C.subtle, padding: '4px 0' }}>{d}</div>)}
                </div>

                {/* Day cells */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                  {cells.map((d, i) => {
                    if (!d) return <div key={i} />;
                    const isPast = d < today;
                    const isB = isBlocked(d, blocked);
                    const isStart = startDate && toISO(d) === toISO(startDate);
                    const isEnd = endDate && toISO(d) === toISO(endDate);
                    const inR = inRange(d);
                    const disabled = isPast || isB;
                    let bg = 'transparent', color = disabled ? C.subtle : C.text, border = 'transparent';
                    if (isB) { bg = 'rgba(239,68,68,0.1)'; color = '#ef4444'; }
                    if (isStart || isEnd) { bg = C.gold; color = C.bg; }
                    else if (inR) { bg = 'rgba(201,169,110,0.15)'; border = `1px solid ${C.goldBorder}`; }
                    return (
                      <div key={i} onClick={() => !disabled && handleDayClick(d)} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: bg, border: `1px solid ${border}`, color, fontFamily: C.dm, fontSize: 13, cursor: disabled ? 'default' : 'pointer', opacity: isPast ? 0.3 : 1, transition: 'all 0.15s', position: 'relative' }}
                        onMouseEnter={e => !disabled && !isStart && !isEnd && !inR && (e.currentTarget.style.background = 'rgba(201,169,110,0.08)')}
                        onMouseLeave={e => !isStart && !isEnd && !inR && (e.currentTarget.style.background = isB ? 'rgba(239,68,68,0.1)' : 'transparent')}>
                        {d.getDate()}
                        {isB && <div style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#ef4444' }} />}
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 16, display: 'flex', gap: 16, fontFamily: C.dm, fontSize: 12, color: C.muted }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: C.gold, display: 'inline-block' }} />Sélectionné</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(239,68,68,0.3)', display: 'inline-block' }} />Indisponible</span>
                </div>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <Label>Récapitulatif de la demande</Label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: C.dm, fontSize: 14 }}>
                    <span style={{ color: C.muted }}>Véhicule</span>
                    <span style={{ color: C.text, fontWeight: 600 }}>{car?.make} {car?.model} {car?.year}</span>
                  </div>
                  <div style={{ height: 1, background: C.border }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: C.dm, fontSize: 14 }}>
                    <span style={{ color: C.muted }}>Date de début</span>
                    <span style={{ color: C.text }}>{fmtDate(startDate)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: C.dm, fontSize: 14 }}>
                    <span style={{ color: C.muted }}>Date de fin</span>
                    <span style={{ color: C.text }}>{fmtDate(endDate)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: C.dm, fontSize: 14 }}>
                    <span style={{ color: C.muted }}>Durée</span>
                    <span style={{ color: C.text }}>{nbDays} jour{nbDays > 1 ? 's' : ''}</span>
                  </div>
                  {totalPrice && <>
                    <div style={{ height: 1, background: C.border }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: C.dm, fontSize: 15, fontWeight: 700 }}>
                      <span style={{ color: C.muted }}>Montant estimé</span>
                      <span style={{ color: C.gold }}>{parseInt(totalPrice).toLocaleString()} FCFA</span>
                    </div>
                    {car?.rental_deposit && <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: C.dm, fontSize: 13 }}>
                      <span style={{ color: C.muted }}>Caution</span>
                      <span style={{ color: C.text }}>{parseInt(car.rental_deposit).toLocaleString()} FCFA</span>
                    </div>}
                  </>}
                </div>

                {car?.rental_required_docs?.length > 0 && (
                  <div style={{ marginTop: 20, background: 'rgba(201,169,110,0.06)', border: `1px solid ${C.goldBorder}`, borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontFamily: C.dm, fontSize: 12, fontWeight: 700, color: C.gold, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Documents à apporter</div>
                    {car.rental_required_docs.map((doc, i) => (
                      <div key={i} style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, display: 'flex', gap: 8, marginBottom: 4 }}>
                        <span style={{ color: C.gold }}>•</span> {doc}
                      </div>
                    ))}
                  </div>
                )}

                {message && (
                  <div style={{ marginTop: 16 }}>
                    <Label>Votre message</Label>
                    <div style={{ fontFamily: C.dm, fontSize: 14, color: C.muted, fontStyle: 'italic' }}>"{message}"</div>
                  </div>
                )}
              </Card>
            )}

            {/* Message optionnel */}
            {step === 1 && startDate && endDate && (
              <Card>
                <Label>Message au vendeur (optionnel)</Label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Précisez vos besoins ou posez une question au vendeur..." rows={3} style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontFamily: C.dm, fontSize: 14, resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
              </Card>
            )}

            {error && <div style={{ fontFamily: C.dm, fontSize: 13, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px' }}>{error}</div>}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12 }}>
              {step === 2 && <Btn variant="secondary" onClick={() => setStep(1)}>← Modifier</Btn>}
              {step === 1 && (
                <Btn onClick={() => { if (!startDate || !endDate) { setError('Sélectionnez une date de début et de fin.'); return; } if (nbDays < (car?.rental_min_days || 1)) { setError(`Durée minimale : ${car?.rental_min_days} jour(s).`); return; } setError(''); setStep(2); }} disabled={!startDate || !endDate}>
                  Suivant →
                </Btn>
              )}
              {step === 2 && (
                <Btn onClick={handleConfirm} disabled={submitting}>
                  {submitting ? 'Envoi...' : 'Envoyer la demande'}
                </Btn>
              )}
            </div>
          </div>

          {/* Right: car summary + pricing */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 84 }}>
            <Card>
              {car?.image && <img src={car.image} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 10, marginBottom: 16 }} />}
              <div style={{ fontFamily: C.dm, fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>{car?.make} {car?.model}</div>
              <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, marginBottom: 16 }}>{car?.year} · {car?.fuel} · {car?.transmission}</div>
              {car?.rental_price_per_day && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  <span style={{ fontFamily: C.dm, fontSize: 22, fontWeight: 800, color: C.gold }}>{parseInt(car.rental_price_per_day).toLocaleString()}</span>
                  <span style={{ fontFamily: C.dm, fontSize: 13, color: C.muted }}>FCFA / jour</span>
                </div>
              )}
              {car?.rental_deposit && (
                <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted }}>Caution : {parseInt(car.rental_deposit).toLocaleString()} FCFA</div>
              )}
              {car?.rental_min_days > 1 && (
                <div style={{ fontFamily: C.dm, fontSize: 12, color: C.subtle, marginTop: 6 }}>Durée minimale : {car.rental_min_days} jours</div>
              )}
              <div style={{ height: 1, background: C.border, margin: '16px 0' }} />
              <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, marginBottom: 4, fontWeight: 600 }}>{seller?.name}</div>
              {seller?.phone && <div style={{ fontFamily: C.dm, fontSize: 13, color: C.subtle }}>{seller.phone}</div>}
            </Card>

            {(startDate || endDate) && (
              <Card style={{ background: 'rgba(201,169,110,0.05)', borderColor: C.goldBorder }}>
                <Label>Votre sélection</Label>
                <div style={{ fontFamily: C.dm, fontSize: 13, color: C.text, marginBottom: 4 }}>
                  <span style={{ color: C.muted }}>Départ :</span> {startDate ? fmtDate(startDate) : '—'}
                </div>
                <div style={{ fontFamily: C.dm, fontSize: 13, color: C.text, marginBottom: startDate && endDate ? 12 : 0 }}>
                  <span style={{ color: C.muted }}>Retour :</span> {endDate ? fmtDate(endDate) : '—'}
                </div>
                {nbDays > 0 && totalPrice && (
                  <>
                    <div style={{ height: 1, background: C.goldBorder, margin: '10px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: C.dm, fontSize: 14, fontWeight: 700 }}>
                      <span style={{ color: C.muted }}>{nbDays}j × {parseInt(car?.rental_price_per_day).toLocaleString()} FCFA</span>
                      <span style={{ color: C.gold }}>{parseInt(totalPrice).toLocaleString()} FCFA</span>
                    </div>
                  </>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
