import React from 'react';
import { C, Btn, Spinner } from './Shared';
import { carsApi, appointmentsApi } from '../api';

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];

export default function Booking({ carId, sellerId, navigate, user }) {
  const [car, setCar] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [step, setStep] = React.useState(1);
  const [selectedDate, setSelectedDate] = React.useState(null);
  const [selectedTime, setSelectedTime] = React.useState(null);
  const [note, setNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i + 1);
    return d;
  });

  const formatDate = d => d ? `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` : '';
  const toISODate = d => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';

  React.useEffect(() => {
    carsApi.detail(carId)
      .then(r => setCar(r.data))
      .catch(() => navigate('catalogue'))
      .finally(() => setLoading(false));
  }, [carId]);

  const handleConfirm = async () => {
    if (!user) { navigate('auth', { mode: 'login' }); return; }
    setSubmitting(true);
    try {
      await appointmentsApi.create({
        car_id: carId,
        date: toISODate(selectedDate),
        time: selectedTime,
        note,
      });
      setDone(true);
      setStep(4);
    } catch {
      alert('Erreur lors de la réservation. Veuillez réessayer.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div style={{ background: C.bg, minHeight: '100vh', paddingTop: 64 }}><Spinner /></div>;

  const seller = car?.seller;

  const StepIndicator = () => (
    <div className="ac-stepper" style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 48 }}>
      {['Choisir une date', 'Choisir un horaire', 'Confirmer'].map((s, i) => {
        const n = i + 1;
        const active = step === n, done = step > n;
        return (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: done ? C.gold : active ? 'rgba(201,169,110,0.15)' : C.surface,
                border: `2px solid ${done || active ? C.gold : C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: C.dm, fontSize: 14, fontWeight: 700,
                color: done ? C.bg : active ? C.gold : C.subtle,
              }}>{done ? '✓' : n}</div>
              <span style={{ fontFamily: C.dm, fontSize: 12, color: active ? C.gold : C.subtle, whiteSpace: 'nowrap' }}>{s}</span>
            </div>
            {i < 2 && <div style={{ flex: 1, height: 1, background: step > n ? C.gold : C.border, marginBottom: 22, opacity: 0.5 }} />}
          </React.Fragment>
        );
      })}
    </div>
  );

  const Summary = () => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
      {car?.image && (
        <div style={{ height: 140, borderRadius: 10, overflow: 'hidden', marginBottom: 16, background: car.gradient }}>
          <img src={car.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
      <div style={{ fontFamily: C.playfair, fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>
        {car?.make} {car?.model}
      </div>
      <div style={{ fontFamily: C.dm, fontSize: 13, color: C.muted, marginBottom: 20 }}>{car?.year}</div>
      {selectedDate && (
        <div style={{ borderTop: `1px solid ${C.border2}`, paddingTop: 16 }}>
          <div style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rendez-vous</div>
          {selectedDate && <div style={{ fontFamily: C.dm, fontSize: 14, color: C.text, marginBottom: 4 }}>📅 {formatDate(selectedDate)}</div>}
          {selectedTime && <div style={{ fontFamily: C.dm, fontSize: 14, color: C.text, marginBottom: 4 }}>🕐 {selectedTime}</div>}
          {seller && <div style={{ fontFamily: C.dm, fontSize: 14, color: C.text }}>📍 {seller.location}</div>}
        </div>
      )}
    </div>
  );

  if (done) return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingTop: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 24px' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%', background: 'rgba(201,169,110,0.1)',
          border: `2px solid ${C.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', fontSize: 36,
        }}>✓</div>
        <h2 className="ac-h2" style={{ fontFamily: C.playfair, fontSize: 36, color: C.text, marginBottom: 12, fontWeight: 700 }}>Rendez-vous confirmé !</h2>
        <p style={{ fontFamily: C.dm, fontSize: 15, color: C.muted, lineHeight: 1.7, marginBottom: 32 }}>
          Votre essai est réservé le <strong style={{ color: C.text }}>{formatDate(selectedDate)}</strong> à <strong style={{ color: C.text }}>{selectedTime}</strong>.
          Le vendeur vous contactera pour confirmer.
        </p>
        <div className="ac-wrap" style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Btn onClick={() => navigate('buyer-dashboard')}>Mes rendez-vous</Btn>
          <Btn variant="secondary" onClick={() => navigate('catalogue')}>Retour au catalogue</Btn>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingTop: 64 }}>
      <div className="ac-container" style={{ maxWidth: 880, margin: '0 auto', padding: '40px 32px 80px' }}>
        <button onClick={() => navigate('car-detail', { carId })} style={{
          background: 'none', border: 'none', color: C.muted,
          fontFamily: C.dm, fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 32,
        }}>← Retour à l'annonce</button>

        <StepIndicator />

        <div className="ac-split" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32 }}>
          <div>
            {/* Step 1: Date */}
            {step === 1 && (
              <div>
                <h2 className="ac-h2" style={{ fontFamily: C.playfair, fontSize: 32, color: C.text, margin: '0 0 8px' }}>Choisissez une date</h2>
                <p style={{ fontFamily: C.dm, color: C.muted, margin: '0 0 32px' }}>Sélectionnez le jour qui vous convient pour votre essai</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                  {days.map((d, i) => {
                    const sel = selectedDate && d.toDateString() === selectedDate.toDateString();
                    const weekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <button key={i} onClick={() => setSelectedDate(d)} style={{
                        background: sel ? C.gold : 'transparent',
                        border: `1px solid ${sel ? C.gold : C.border}`,
                        borderRadius: 10, padding: '12px 4px', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        opacity: weekend ? 0.4 : 1,
                      }}>
                        <span style={{ fontFamily: C.dm, fontSize: 10, color: sel ? C.bg : C.subtle, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{DAY_NAMES[d.getDay()]}</span>
                        <span style={{ fontFamily: C.playfair, fontSize: 18, fontWeight: 700, color: sel ? C.bg : C.text }}>{d.getDate()}</span>
                        <span style={{ fontFamily: C.dm, fontSize: 10, color: sel ? C.bg : C.subtle }}>{MONTH_NAMES[d.getMonth()]}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: 40 }}>
                  <Btn onClick={() => selectedDate && setStep(2)} disabled={!selectedDate} style={{ padding: '13px 32px' }}>
                    Continuer →
                  </Btn>
                </div>
              </div>
            )}

            {/* Step 2: Time */}
            {step === 2 && (
              <div>
                <h2 className="ac-h2" style={{ fontFamily: C.playfair, fontSize: 32, color: C.text, margin: '0 0 8px' }}>Choisissez un horaire</h2>
                <p style={{ fontFamily: C.dm, color: C.muted, margin: '0 0 32px' }}>{formatDate(selectedDate)}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {TIMES.map(t => {
                    const sel = selectedTime === t;
                    return (
                      <button key={t} onClick={() => setSelectedTime(t)} style={{
                        background: sel ? C.gold : 'transparent',
                        border: `1px solid ${sel ? C.gold : C.border}`,
                        borderRadius: 10, padding: '14px', cursor: 'pointer',
                        fontFamily: C.dm, fontSize: 14, fontWeight: 600,
                        color: sel ? C.bg : C.text,
                      }}>{t}</button>
                    );
                  })}
                </div>
                <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
                  <Btn variant="secondary" onClick={() => setStep(1)} style={{ padding: '13px 24px' }}>← Retour</Btn>
                  <Btn onClick={() => selectedTime && setStep(3)} disabled={!selectedTime} style={{ padding: '13px 32px' }}>
                    Continuer →
                  </Btn>
                </div>
              </div>
            )}

            {/* Step 3: Confirm */}
            {step === 3 && (
              <div>
                <h2 className="ac-h2" style={{ fontFamily: C.playfair, fontSize: 32, color: C.text, margin: '0 0 8px' }}>Confirmer le rendez-vous</h2>
                <p style={{ fontFamily: C.dm, color: C.muted, margin: '0 0 32px' }}>Vérifiez les détails de votre essai</p>

                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, marginBottom: 24 }}>
                  <div className="ac-form-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {[
                      { label: 'Véhicule', val: `${car?.make} ${car?.model} ${car?.year}` },
                      { label: 'Vendeur', val: seller?.name || '—' },
                      { label: 'Date', val: formatDate(selectedDate) },
                      { label: 'Heure', val: selectedTime || '—' },
                      { label: 'Lieu', val: seller?.location || car?.location || '—' },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <div style={{ fontFamily: C.dm, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontFamily: C.dm, fontSize: 14, color: C.text, fontWeight: 500 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 28 }}>
                  <label style={{ fontFamily: C.dm, fontSize: 12, color: C.muted, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Note pour le vendeur (optionnel)
                  </label>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Ex: Je viendrai avec mon mécanicien..."
                    rows={4}
                    style={{
                      width: '100%', background: C.surface, border: `1px solid ${C.border}`,
                      color: C.text, fontFamily: C.dm, fontSize: 14, padding: '13px 16px',
                      borderRadius: 10, outline: 'none', resize: 'vertical',
                    }}
                    onFocus={e => e.target.style.borderColor = C.gold}
                    onBlur={e => e.target.style.borderColor = C.border}
                  />
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <Btn variant="secondary" onClick={() => setStep(2)} style={{ padding: '13px 24px' }}>← Retour</Btn>
                  <Btn onClick={handleConfirm} disabled={submitting} style={{ padding: '13px 32px' }}>
                    {submitting ? 'Confirmation...' : 'Confirmer le rendez-vous'}
                  </Btn>
                </div>
              </div>
            )}
          </div>

          <Summary />
        </div>
      </div>
    </div>
  );
}
