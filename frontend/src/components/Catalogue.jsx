import React from 'react';
import { C, CarCard, Spinner } from './Shared';
import { carsApi } from '../api';

const inputStyle = {
  background: '#111113', border: `1px solid ${C.border}`, color: C.text,
  fontFamily: C.dm, fontSize: 13, padding: '9px 14px',
  borderRadius: 8, width: '100%', outline: 'none',
};
const labelStyle = { fontFamily: C.dm, fontSize: 12, color: C.muted, marginBottom: 6, display: 'block', letterSpacing: '0.05em', textTransform: 'uppercase' };

export default function Catalogue({ navigate, favorites, onToggleFavorite, platformSettings = {} }) {
  const [cars, setCars] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [sellerSearch, setSellerSearch] = React.useState('');
  const [filters, setFilters] = React.useState({ fuel: '', transmission: '', minPrice: '', maxPrice: '', maxMileage: '' });
  const [sort, setSort] = React.useState('recent');

  const fetchCars = React.useCallback(() => {
    setLoading(true);
    const params = { sort };
    if (search) params.q = search;
    if (sellerSearch) params.seller = sellerSearch;
    if (filters.fuel) params.fuel = filters.fuel;
    if (filters.transmission) params.transmission = filters.transmission;
    if (filters.minPrice) params.min_price = filters.minPrice;
    if (filters.maxPrice) params.max_price = filters.maxPrice;
    if (filters.maxMileage) params.max_mileage = filters.maxMileage;

    carsApi.list(params)
      .then(r => setCars(r.data))
      .catch(() => setCars([]))
      .finally(() => setLoading(false));
  }, [search, sellerSearch, filters, sort]);

  React.useEffect(() => {
    const t = setTimeout(fetchCars, 300);
    return () => clearTimeout(t);
  }, [fetchCars]);

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const resetAll = () => { setSearch(''); setSellerSearch(''); setFilters({ fuel: '', transmission: '', minPrice: '', maxPrice: '', maxMileage: '' }); };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingTop: 64 }}>
      {/* Header */}
      <div className="ac-page-header" style={{ borderBottom: `1px solid ${C.border2}`, padding: '40px 32px 32px', maxWidth: 1280, margin: '0 auto' }}>
        <h1 className="ac-h1" style={{ fontFamily: C.playfair, fontSize: 42, color: C.text, margin: '0 0 8px', fontWeight: 700 }}>Catalogue</h1>
        <p style={{ fontFamily: C.dm, color: C.muted, margin: 0 }}>
          {loading ? 'Chargement...' : `${cars.length} véhicule${cars.length !== 1 ? 's' : ''} disponible${cars.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="ac-container ac-split-flex" style={{ maxWidth: 1280, margin: '0 auto', padding: '32px', display: 'flex', gap: 32 }}>
        {/* Sidebar */}
        <div className="ac-side" style={{ width: 260, flexShrink: 0 }}>
          <div style={{ position: 'sticky', top: 80, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
            <h3 style={{ fontFamily: C.dm, fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 24px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Filtres</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={labelStyle}>Rechercher</label>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Marque, modèle..." style={inputStyle}
                  onFocus={e => e.target.style.borderColor = C.gold}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
              </div>

              <div>
                <label style={labelStyle}>Vendeur</label>
                <input value={sellerSearch} onChange={e => setSellerSearch(e.target.value)}
                  placeholder="Nom du vendeur..." style={inputStyle}
                  onFocus={e => e.target.style.borderColor = C.gold}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
                {sellerSearch && (
                  <div style={{ fontFamily: C.dm, fontSize: 11, color: C.gold, marginTop: 5 }}>
                    Annonces de "{sellerSearch}"
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Carburant</label>
                <select value={filters.fuel} onChange={e => setFilter('fuel', e.target.value)} style={{ ...inputStyle }}>
                  <option value="">Tous</option>
                  {['Essence', 'Diesel', 'Hybride', 'Électrique'].map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Boîte de vitesses</label>
                <select value={filters.transmission} onChange={e => setFilter('transmission', e.target.value)} style={{ ...inputStyle }}>
                  <option value="">Toutes</option>
                  {['Automatique', 'Manuelle'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Prix min (FCFA)</label>
                <input type="number" value={filters.minPrice} onChange={e => setFilter('minPrice', e.target.value)}
                  placeholder="0 FCFA" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = C.gold}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
              </div>

              <div>
                <label style={labelStyle}>Prix max (FCFA)</label>
                <input type="number" value={filters.maxPrice} onChange={e => setFilter('maxPrice', e.target.value)}
                  placeholder="130 000 000 FCFA" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = C.gold}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
              </div>

              <div>
                <label style={labelStyle}>Kilométrage max</label>
                <input type="number" value={filters.maxMileage} onChange={e => setFilter('maxMileage', e.target.value)}
                  placeholder="200 000 km" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = C.gold}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
              </div>

              <button onClick={resetAll} style={{
                background: 'none', border: `1px solid ${C.border}`, color: C.muted,
                fontFamily: C.dm, fontSize: 13, padding: '9px', borderRadius: 8, cursor: 'pointer',
              }}
                onMouseEnter={e => { e.target.style.color = C.text; e.target.style.borderColor = C.faint; }}
                onMouseLeave={e => { e.target.style.color = C.muted; e.target.style.borderColor = C.border; }}
              >Réinitialiser les filtres</button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div style={{ flex: 1 }}>
          {/* Sort bar */}
          <div className="ac-wrap" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24, gap: 8 }}>
            {[['recent', 'Plus récents'], ['price-asc', 'Prix ↑'], ['price-desc', 'Prix ↓'], ['mileage', 'Kilométrage']].map(([val, label]) => (
              <button key={val} onClick={() => setSort(val)} style={{
                background: sort === val ? C.goldDim : 'transparent',
                border: `1px solid ${sort === val ? C.goldBorder : C.border}`,
                color: sort === val ? C.gold : C.muted,
                fontFamily: C.dm, fontSize: 13, padding: '7px 14px',
                borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
              }}>{label}</button>
            ))}
          </div>

          {loading ? <Spinner /> : cars.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: C.faint, fontFamily: C.dm }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>◎</div>
              <p style={{ fontSize: 18, margin: 0 }}>Aucun résultat</p>
              <p style={{ fontSize: 14, marginTop: 8 }}>Essayez de modifier vos filtres</p>
            </div>
          ) : (
            <div className="ac-cards-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
              {cars.map(car => (
                <CarCard
                  key={car.id}
                  car={car}
                  seller={car.seller}
                  onClick={() => navigate('car-detail', { carId: car.id })}
                  isFavorite={favorites.includes(car.id)}
                  onToggleFavorite={onToggleFavorite}
                  premiumEnabled={platformSettings.premium_enabled}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
