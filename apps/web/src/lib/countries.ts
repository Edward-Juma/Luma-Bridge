/** [lat, lng] used for globe markers. Names come from Intl.DisplayNames so we don't ship a table. */
export const COUNTRY_COORDS: Record<string, [number, number]> = {
  KE: [-1.29, 36.82], UG: [0.35, 32.58], TZ: [-6.8, 39.28], RW: [-1.95, 30.06], ET: [9.03, 38.74], SO: [2.05, 45.32], SS: [4.85, 31.58],
  NG: [6.52, 3.38], GH: [5.6, -0.19], ZA: [-26.2, 28.04], ZW: [-20.15, 28.58], ZM: [-15.4, 28.3], MW: [-13.96, 33.77], SN: [14.7, -17.45],
  EG: [30.04, 31.24], MA: [33.57, -7.59], SD: [15.5, 32.56], CD: [-4.32, 15.31], CM: [3.85, 11.5], CI: [5.35, -4.0],
  IN: [25.6, 85.1], NP: [28.2, 83.99], BD: [23.8, 90.4], PK: [24.86, 67.0], LK: [6.93, 79.86], AF: [34.5, 69.2],
  JO: [31.95, 35.93], LB: [33.89, 35.5], SY: [33.51, 36.28], YE: [15.35, 44.2], IQ: [33.3, 44.4], TR: [41.0, 28.98],
  PH: [14.6, 121.0], ID: [-6.2, 106.8], VN: [21.0, 105.8], TH: [13.75, 100.5], MM: [16.8, 96.15], KH: [11.56, 104.9],
  BR: [-8.05, -34.9], CO: [4.7, -74.07], PE: [-12.05, -77.04], MX: [19.43, -99.13], HT: [18.54, -72.34], VE: [10.5, -66.9], GT: [14.63, -90.5],
  UA: [50.45, 30.52], US: [40.7, -74.0], GB: [51.5, -0.12], DE: [52.5, 13.4],
};

export const COUNTRY_CODES = [
  'AF','AL','DZ','AO','AR','AM','AU','AZ','BD','BJ','BO','BA','BW','BR','BF','BI','KH','CM','CA','CF','TD','CL','CN','CO','CD','CG','CR','CI','HR','CU','CY','EC','EG','SV','ER','ET','FJ','GA','GM','GE','GH','GT','GN','GW','HT','HN','IN','ID','IQ','IL','JM','JO','KZ','KE','KG','LA','LB','LS','LR','LY','MG','MW','MY','ML','MR','MX','MD','MN','ME','MA','MZ','MM','NA','NP','NI','NE','NG','PK','PS','PA','PG','PY','PE','PH','RW','SN','RS','SL','SO','ZA','SS','LK','SD','SR','SZ','SY','TJ','TZ','TH','TL','TG','TN','TR','TM','UG','UA','UZ','VE','VN','YE','ZM','ZW',
] as const;

const dn = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
export const countryName = (code: string) => {
  try {
    return dn?.of(code) ?? code;
  } catch {
    return code;
  }
};
export const flag = (code: string) =>
  code.length === 2 ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : '🌍';

export const countryOptions = () =>
  [...COUNTRY_CODES].map((c) => ({ code: c as string, name: countryName(c) })).sort((a, b) => a.name.localeCompare(b.name));
