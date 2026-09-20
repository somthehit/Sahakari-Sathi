import { Request, Response } from 'express';
import { GeoDataService } from '../services/GeoDataService';

const geoDataService = new GeoDataService();

export class GeoController {
  static getTree(_req: Request, res: Response) {
    res.json(geoDataService.getTree());
  }

  static getProvinces(_req: Request, res: Response) {
    res.json(geoDataService.getProvinces());
  }

  static getDistricts(req: Request, res: Response) {
    const province = geoDataService.findProvince(req.params.province);
    if (!province) return res.status(404).json({ error: 'Province not found' });
    res.json(province.districts.map((d) => d.name));
  }

  static getMunicipalities(req: Request, res: Response) {
    const district = geoDataService.findDistrict(
      req.params.province,
      req.params.district
    );
    if (!district) return res.status(404).json({ error: 'District not found' });
    res.json(district.municipalities.map((m) => m.name));
  }

  static getWards(req: Request, res: Response) {
    const municipality = geoDataService.findMunicipality(
      req.params.province,
      req.params.district,
      req.params.municipality
    );
    if (!municipality) return res.status(404).json({ error: 'Municipality not found' });
    res.json(municipality.wards);
  }
}
