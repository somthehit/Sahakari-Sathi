/**
 * Geo Data Service
 * Loads the Nepal administrative hierarchy (Province → District → Municipality → Ward)
 * from assets/geo_location_en.json and exposes it normalized for API consumption.
 *
 * The source JSON keys contain artifacts ("Koshi Province", " Aathrai Tribeni Rural
 * Municipality", double spaces, etc.) that are stripped here so callers get clean names.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export interface GeoWard {
  ward: string;
}

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

const normalize = (value: string): string => value.replace(/\s+/g, ' ').trim();

const stripProvinceSuffix = (name: string): string =>
  normalize(name).replace(/\s+Province$/i, '');

const loadTree = (): GeoProvince[] => {
  const filePath = join(process.cwd(), 'assets', 'geo_location_en.json');
  const raw = JSON.parse(
    readFileSync(filePath, 'utf-8')
  ) as Record<string, Record<string, Record<string, string[]>>>;

  return Object.keys(raw).map((provinceKey) => {
    const districts = raw[provinceKey];
    return {
      name: stripProvinceSuffix(provinceKey),
      districts: Object.keys(districts).map((districtKey) => ({
        name: normalize(districtKey),
        municipalities: Object.keys(districts[districtKey]).map((muniKey) => ({
          name: normalize(muniKey),
          wards: districts[districtKey][muniKey].map(normalize).filter(Boolean),
        })),
      })),
    };
  });
};

export class GeoDataService {
  private tree: GeoProvince[];

  constructor() {
    this.tree = loadTree();
  }

  getTree(): GeoProvince[] {
    return this.tree;
  }

  getProvinces(): string[] {
    return this.tree.map((p) => p.name);
  }

  findProvince(name: string): GeoProvince | undefined {
    const needle = normalize(name).toLowerCase();
    return this.tree.find((p) => p.name.toLowerCase() === needle);
  }

  findDistrict(province: string, district: string): GeoDistrict | undefined {
    const p = this.findProvince(province);
    if (!p) return undefined;
    const needle = normalize(district).toLowerCase();
    return p.districts.find((d) => d.name.toLowerCase() === needle);
  }

  findMunicipality(
    province: string,
    district: string,
    municipality: string
  ): GeoMunicipality | undefined {
    const d = this.findDistrict(province, district);
    if (!d) return undefined;
    const needle = normalize(municipality).toLowerCase();
    return d.municipalities.find((m) => m.name.toLowerCase() === needle);
  }
}
