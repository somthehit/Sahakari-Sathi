/**
 * Nepal Geo Data Utilities
 * Parses geo_location_en.json into cascading Province → District → Municipality lists.
 */
import geoRaw from '../../assets/geo_location_en.json';

// Type: { [province]: { [district]: string[] } }
type GeoJson = Record<string, Record<string, string[]>>;
const geo = geoRaw as unknown as GeoJson;

export interface GeoProvince {
  name: string;
}

export interface GeoDistrict {
  name: string;
}

export interface GeoMunicipality {
  name: string;
}

/** All province names */
export const getProvinces = (): GeoProvince[] =>
  Object.keys(geo).map((name) => ({ name }));

/** Districts for a given province name */
export const getDistricts = (provinceName: string): GeoDistrict[] => {
  const prov = geo[provinceName];
  if (!prov) return [];
  return Object.keys(prov).map((name) => ({ name }));
};

/** Municipalities for a given province + district */
export const getMunicipalities = (
  provinceName: string,
  districtName: string,
): GeoMunicipality[] => {
  const prov = geo[provinceName];
  if (!prov) return [];
  const dist = prov[districtName];
  if (!dist) return [];
  return dist.map((name) => ({ name: name.trim() }));
};
