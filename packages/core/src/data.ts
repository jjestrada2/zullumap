export type SlotGeometry = 'polygon' | 'point' | 'line';

export interface NumericSlot {
  slot: string;
  column: string;
  /** Height slots: negative values are an error unless the template allows diverging heights. */
  nonNegative?: boolean;
}

export interface DataSpec {
  geometry: SlotGeometry;
  numeric: NumericSlot[];
}

export interface PreparedData {
  features: GeoFeature[];
  /** Per numeric slot, one value per kept feature; null means "no data". */
  values: Record<string, (number | null)[]>;
  warnings: string[];
}

interface GeoFeature {
  type: 'Feature';
  properties: Record<string, unknown> | null;
  geometry: { type: string; coordinates: unknown } | null;
}

const GEOMETRY_TYPES: Record<SlotGeometry, string[]> = {
  polygon: ['Polygon', 'MultiPolygon'],
  point: ['Point', 'MultiPoint'],
  line: ['LineString', 'MultiLineString'],
};

const WGS84_NAMES = /^(urn:ogc:def:crs:OGC:1\.3:CRS84|urn:ogc:def:crs:EPSG::4326|EPSG:4326|CRS84|WGS84)$/i;

/** Validate a parsed GeoJSON FeatureCollection against a template's slots (plan: mismatch table). */
export function prepareData(input: unknown, spec: DataSpec): PreparedData {
  const fc = input as { type?: string; features?: unknown; crs?: { properties?: { name?: string } } };
  if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    throw new Error('Data must be a GeoJSON FeatureCollection');
  }
  const crsName = fc.crs?.properties?.name;
  if (crsName && !WGS84_NAMES.test(crsName)) {
    throw new Error(`Data uses ${crsName}; zullumap needs WGS84 (EPSG:4326). Reproject it, e.g. ogr2ogr -t_srs EPSG:4326 out.geojson in.geojson`);
  }
  const all = fc.features as GeoFeature[];
  if (all.length === 0) throw new Error('The dataset is empty');

  const warnings: string[] = [];
  const wanted = GEOMETRY_TYPES[spec.geometry];
  const features = all.filter(f => f?.geometry && wanted.includes(f.geometry.type));
  if (features.length === 0) {
    throw new Error(`This template's geometry slot expects ${spec.geometry} data (${wanted.join(' or ')}), but the data has none`);
  }
  const skipped = all.length - features.length;
  if (skipped > 0) warnings.push(`Skipped ${skipped} feature(s) that are not ${spec.geometry}s`);

  for (const f of features) {
    if (!coordinatesInRange(f.geometry!.coordinates)) {
      throw new Error('Coordinates are outside WGS84 longitude/latitude ranges; the data looks projected. Reproject it to EPSG:4326, e.g. ogr2ogr -t_srs EPSG:4326 out.geojson in.geojson');
    }
  }

  const columns = [...new Set(features.flatMap(f => Object.keys(f.properties ?? {})))];
  const values: Record<string, (number | null)[]> = {};
  for (const n of spec.numeric) {
    if (!columns.includes(n.column)) {
      throw new Error(`Column "${n.column}" for the ${n.slot} slot is missing. Available columns: ${columns.join(', ')}`);
    }
    let noData = 0;
    const vals = features.map(f => {
      const v = toNumber(f.properties?.[n.column]);
      if (v === null) noData++;
      return v;
    });
    if (noData === vals.length) throw new Error(`The ${n.slot} slot ("${n.column}") has no numeric values`);
    if (noData > 0) warnings.push(`${noData} value(s) in "${n.column}" are not numbers and are shown as no data`);
    if (n.nonNegative && vals.some(v => v !== null && v < 0)) {
      throw new Error(`The ${n.slot} slot ("${n.column}") has negative values, which this template can't draw as heights`);
    }
    values[n.slot] = vals;
  }
  return { features, values, warnings };
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function coordinatesInRange(c: unknown): boolean {
  if (!Array.isArray(c)) return false;
  if (typeof c[0] === 'number') {
    const [x, y] = c as number[];
    return Math.abs(x!) <= 180 && Math.abs(y!) <= 90;
  }
  return c.every(coordinatesInRange);
}
