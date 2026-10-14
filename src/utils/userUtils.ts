import { UserProfile } from '../types';

export function normalizeUserProfile(rawUser: any): UserProfile {
  if (!rawUser || typeof rawUser !== 'object') {
    return {
      email: '',
      nama: 'PDI Man',
      noHp: '',
      kodeAhm: '',
      namaDealer: 'Dealer Honda',
      kodeDealer: '',
      kategori: 'H1-H2-H3',
      kota: 'Bandung',
      sentraDistribusi: 'BAROS',
      role: 'PDI Man',
    };
  }

  const getString = (val: any, fallback = ''): string => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
      if (typeof val.nama === 'string') return val.nama;
      if (typeof val.namaLengkap === 'string') return val.namaLengkap;
      if (typeof val.name === 'string') return val.name;
      if (typeof val.value === 'string') return val.value;
      if (typeof val.label === 'string') return val.label;
      if (typeof val.text === 'string') return val.text;
    }
    return fallback;
  };

  const rawNama =
    getString(rawUser.nama) ||
    getString(rawUser.namaLengkap) ||
    getString(rawUser.name) ||
    'PDI Man';

  return {
    email: getString(rawUser.email),
    nama: rawNama,
    noHp: getString(rawUser.noHp),
    kodeAhm: getString(rawUser.kodeAhm),
    namaDealer: getString(rawUser.namaDealer, 'Dealer Honda'),
    kodeDealer: getString(rawUser.kodeDealer),
    kategori: getString(rawUser.kategori, 'H1-H2-H3'),
    kota: getString(rawUser.kota, 'Bandung'),
    sentraDistribusi: getString(rawUser.sentraDistribusi, 'BAROS'),
    role: getString(rawUser.role, 'PDI Man'),
  };
}
