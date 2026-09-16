import React from 'react';
import { MapPin, Navigation, Search, ChevronRight, Check } from 'lucide-react';
import type { LocationInput } from '../../../shared/api';
import {
  TURKISH_PROVINCES,
  searchTurkishLocations,
  findClosestProvince,
  LocationSearchResult,
} from '../../../shared/turkeyLocations';
import { locationInputFor } from '../../services/location';
import Sheet from '../ui/Sheet';
import { Button, Chip, cx } from '../ui/primitives';
import { Input } from '../ui/fields';
import { useNotification } from '../../contexts/NotificationContext';
import { useIsDesktop } from '../../hooks/useMediaQuery';

const POPULAR_LOCATIONS: LocationSearchResult[] = [
  { label: 'Kadıköy, İstanbul', province: 'İstanbul', district: 'Kadıköy', lat: 40.9788, lon: 29.0827 },
  { label: 'İstanbul', province: 'İstanbul', lat: 41.0138, lon: 28.9497 },
  { label: 'Ankara', province: 'Ankara', lat: 39.9208, lon: 32.8541 },
  { label: 'İzmir', province: 'İzmir', lat: 38.4188, lon: 27.1287 },
  { label: 'Bursa', province: 'Bursa', lat: 40.1822, lon: 29.0611 },
  { label: 'Antalya', province: 'Antalya', lat: 36.8841, lon: 30.7056 },
];

interface Props {
  label: string;
  value?: LocationInput | string;
  onChange: (location: LocationInput, label: string) => void;
  className?: string;
  /** chip: satır içi küçük düğme; field: form alanı genişliğinde */
  variant?: 'chip' | 'field';
}

export default function LocationPicker({ label, onChange, className, variant = 'field' }: Props) {
  const { notify } = useNotification();
  const isDesktop = useIsDesktop();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [selectedProvinceId, setSelectedProvinceId] = React.useState<number | null>(null);
  const [detectingGps, setDetectingGps] = React.useState(false);

  const searchResults = React.useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    return searchTurkishLocations(q, 8);
  }, [query]);

  const select = (loc: LocationSearchResult) => {
    onChange(locationInputFor(loc), loc.label);
    setOpen(false);
    setQuery('');
    setSelectedProvinceId(null);
  };

  const handleGps = () => {
    if (!navigator.geolocation) return;
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDetectingGps(false);
        const { latitude: lat, longitude: lon } = pos.coords;
        const closest = findClosestProvince(lat, lon);
        const display = closest ? `${closest.name} (GPS)` : 'Mevcut Konum';
        onChange({ type: 'coords', lat, lon, label: display }, display);
        setOpen(false);
      },
      (err) => {
        setDetectingGps(false);
        notify(err.code === err.PERMISSION_DENIED
          ? 'Konum izni verilmedi. Tarayıcı ayarlarından izin verebilir ya da listeden seçebilirsin.'
          : 'Konumun bulunamadı. Listeden seçebilirsin.', 'info');
      },
      { timeout: 8000 },
    );
  };

  const selectedProvince = selectedProvinceId ? TURKISH_PROVINCES.find(p => p.id === selectedProvinceId) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx(
          'inline-flex items-center gap-2 rounded-2xl bg-surface-2 border border-transparent hover:border-line font-semibold text-ink transition-colors text-left',
        variant === 'field' ? 'w-full h-12 px-4 text-[15px]' : 'h-10 px-3.5 text-[13px]',
          className,
        )}
      >
        <MapPin className="w-4 h-4 text-accent shrink-0" />
        <span className={cx('truncate', variant === 'chip' && 'max-w-[180px]')}>{label || 'Konum seç'}</span>
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Konum Seç"
        subtitle="Hava durumuna göre kombin önerisi için şehir veya ilçe seç"
        width="md"
      >
        <div className="space-y-4 pt-1">
          {/* Arama */}
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="İl veya ilçe ara (örn. Kadıköy, Bodrum, Ankara)..."
            leading={<Search className="w-4 h-4" />}
            autoFocus={isDesktop}
          />

          {/* GPS Butonu */}
          {'geolocation' in navigator && (
            <Button
              variant="secondary"
              block
              onClick={handleGps}
              loading={detectingGps}
              icon={<Navigation className="w-4 h-4 text-accent" />}
              className="justify-start text-sm h-11"
            >
              Mevcut Konumumu Kullan (GPS)
            </Button>
          )}

          {/* Arama Sonuçları */}
          {query.trim().length >= 2 ? (
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3 px-1">Arama Sonuçları</p>
              {searchResults.length === 0 ? (
                <p className="text-sm text-ink-3 py-3 px-1">Eşleşen il veya ilçe bulunamadı.</p>
              ) : (
                searchResults.map(loc => (
                  <button
                    key={`${loc.province}-${loc.district || ''}-${loc.label}`}
                    type="button"
                    onClick={() => select(loc)}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-surface-2 text-left transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-4 h-4 text-ink-3 shrink-0" />
                      <span className="text-sm font-semibold text-ink">{loc.label}</span>
                    </div>
                    {label === loc.label && <Check className="w-4 h-4 text-accent" />}
                  </button>
                ))
              )}
            </div>
          ) : (
            <>
              {/* Popüler Şehirler */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3 px-1 mb-2">Popüler Şehirler</p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_LOCATIONS.map(loc => (
                    <Chip
                      key={loc.label}
                      selected={label === loc.label}
                      onClick={() => select(loc)}
                    >
                      {loc.label}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* Tüm İller ve İlçeler */}
              <div className="pt-2 border-t border-line">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3 px-1 mb-2">
                  {selectedProvince ? `${selectedProvince.name} İlçeleri` : 'Tüm İller'}
                </p>

                {selectedProvince ? (
                  <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                    <button
                      type="button"
                      onClick={() => setSelectedProvinceId(null)}
                      className="text-xs text-accent font-semibold p-1 hover:underline mb-1 inline-block"
                    >
                      ← İllere Geri Dön
                    </button>
                    {/* İl Merkezi */}
                    <button
                      type="button"
                      onClick={() => select({ label: selectedProvince.name, province: selectedProvince.name, lat: selectedProvince.lat, lon: selectedProvince.lon })}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-2 text-left text-sm font-bold text-ink"
                    >
                      <span>{selectedProvince.name} (Tümü / Merkez)</span>
                    </button>
                    {/* İlçeler */}
                    {selectedProvince.districts.map(dist => {
                      const itemLabel = `${dist}, ${selectedProvince.name}`;
                      return (
                        <button
                          key={dist}
                          type="button"
                          onClick={() => select({ label: itemLabel, province: selectedProvince.name, district: dist, lat: selectedProvince.lat, lon: selectedProvince.lon, approximate: true })}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-surface-2 text-left text-sm text-ink"
                        >
                          <span>{dist}</span>
                          {label === itemLabel && <Check className="w-4 h-4 text-accent" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-60 overflow-y-auto pr-1">
                    {TURKISH_PROVINCES.map(prov => (
                      <button
                        key={prov.id}
                        type="button"
                        onClick={() => setSelectedProvinceId(prov.id)}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-left text-xs font-semibold text-ink transition-colors"
                      >
                        <span className="truncate">{prov.name}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-ink-3 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}
