import { apiClient } from '../lib/apiClient';

export interface GeoMunicipality {
  name: string;
  wards: string[];
}

export interface GeoDistrict {
  name: string;
  municipalities: GeoMunicipality[];
}

export interface GeoProvince {
  name: string;
  districts: GeoDistrict[];
}

/**
 * Fetch the full Nepal administrative hierarchy (Province → District → Municipality → Ward)
 * in a single call. Endpoints for individual levels are also available:
 * GET /geo/provinces, /geo/provinces/:p/districts, /geo/provinces/:p/districts/:d/municipalities,
 * /geo/provinces/:p/districts/:d/municipalities/:m/wards
 */
const authHeaders = (token?: string) =>
  token ? { Authorization: `Bearer ${token}` } : undefined;

export const fetchGeoTree = async (token?: string): Promise<GeoProvince[]> => {
  const { data } = await apiClient.get<GeoProvince[]>('/geo', {
    headers: authHeaders(token),
  });
  return data;
};

export const fetchGeoProvinces = async (token?: string): Promise<string[]> => {
  const { data } = await apiClient.get<string[]>('/geo/provinces', {
    headers: authHeaders(token),
  });
  return data;
};

export const fetchGeoDistricts = async (
  province: string,
  token?: string
): Promise<string[]> => {
  const { data } = await apiClient.get<string[]>(
    `/geo/provinces/${encodeURIComponent(province)}/districts`,
    { headers: authHeaders(token) }
  );
  return data;
};

export const fetchGeoMunicipalities = async (
  province: string,
  district: string,
  token?: string
): Promise<string[]> => {
  const { data } = await apiClient.get<string[]>(
    `/geo/provinces/${encodeURIComponent(province)}/districts/${encodeURIComponent(district)}/municipalities`,
    { headers: authHeaders(token) }
  );
  return data;
};

export const fetchGeoWards = async (
  province: string,
  district: string,
  municipality: string,
  token?: string
): Promise<string[]> => {
  const { data } = await apiClient.get<string[]>(
    `/geo/provinces/${encodeURIComponent(province)}/districts/${encodeURIComponent(district)}/municipalities/${encodeURIComponent(municipality)}/wards`,
    { headers: authHeaders(token) }
  );
  return data;
};
