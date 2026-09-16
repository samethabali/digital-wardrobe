import type { LocationInput } from '../../shared/api';
import type { LocationSearchResult } from '../../shared/turkeyLocations';

/** Kesin koordinatı bilinen yerler koordinatla, ilçesi yaklaşık olanlar il/ilçe adıyla gönderilir (sunucu netleştirir). */
export function locationInputFor(loc: LocationSearchResult): LocationInput {
  if (loc.approximate && loc.district) return { type: 'place', province: loc.province, district: loc.district };
  return { type: 'coords', lat: loc.lat, lon: loc.lon, label: loc.label };
}
