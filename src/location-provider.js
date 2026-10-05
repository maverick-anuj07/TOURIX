/**
 * TOURIX — Location Provider Architecture & Single Canonical User Record Database
 * Supports SimulatedLocationProvider for demonstration and RealLocationProvider for production GPS/backend.
 */

export const DEMO_MEMBERS_MASTER = {
  ANUJ001: {
    id: 'ANUJ001',
    name: 'Anuj',
    age: 20,
    phone: '+91 98765 43210',
    role: 'Tourist / Current User',
    status: 'Online',
    photo: 'https://ui-avatars.com/api/?name=Anuj&background=0f766e&color=fff',
    isYou: true,
    speed: 0.00003, // smooth walking speed
  },
  ADITI002: {
    id: 'ADITI002',
    name: 'Aditi',
    age: 21,
    phone: '+91 98765 43211',
    role: 'Tourist',
    status: 'Online',
    photo: 'https://ui-avatars.com/api/?name=Aditi&background=d97706&color=fff',
    isYou: false,
    speed: 0.00004,
  },
  OMKAR003: {
    id: 'OMKAR003',
    name: 'Omkar',
    age: 22,
    phone: '+91 98765 43212',
    role: 'Tourist',
    status: 'Online',
    photo: 'https://ui-avatars.com/api/?name=Omkar&background=2563eb&color=fff',
    isYou: false,
    speed: 0.00001, // stationary/slow
  },
  HASTI004: {
    id: 'HASTI004',
    name: 'Hasti',
    age: 20,
    phone: '+91 98765 43213',
    role: 'Tourist',
    status: 'Online',
    photo: 'https://ui-avatars.com/api/?name=Hasti&background=7c3aed&color=fff',
    isYou: false,
    speed: 0.000035,
  },
  PALAK005: {
    id: 'PALAK005',
    name: 'Palak',
    age: 21,
    phone: '+91 98765 43214',
    role: 'Tourist',
    status: 'Online',
    photo: 'https://ui-avatars.com/api/?name=Palak&background=db2777&color=fff',
    isYou: false,
    speed: 0.00002,
  },
  MAVERICK006: {
    id: 'MAVERICK006',
    name: 'Maverick',
    age: 23,
    phone: '+91 98765 43215',
    role: 'Tourist / Assistant',
    status: 'Online',
    photo: 'https://ui-avatars.com/api/?name=Maverick&background=059669&color=fff',
    isYou: false,
    speed: 0.00003,
  },
};

export const CITIES_CONFIG = {
  Nashik: {
    name: 'Nashik',
    center: { lat: 20.0063, lng: 73.7910 },
    description: 'Wine Capital & Spiritual Heritage Hub',
  },
  Pune: {
    name: 'Pune',
    center: { lat: 18.5204, lng: 73.8567 },
    description: 'Cultural Capital of Maharashtra',
  },
  Mumbai: {
    name: 'Mumbai',
    center: { lat: 18.9220, lng: 72.8347 },
    description: 'Financial Capital & Coastal Metropolis',
  },
};

export function getRegisteredUsersDb() {
  try {
    const raw = localStorage.getItem('tourix_users_db');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function saveRegisteredUserRecord(userRecord) {
  try {
    const db = getRegisteredUsersDb();
    db[userRecord.id] = userRecord;
    localStorage.setItem('tourix_users_db', JSON.stringify(db));
  } catch (e) {
    console.warn('Failed saving user record:', e);
  }
}

export function resolveMemberProfile(id) {
  const registeredDb = getRegisteredUsersDb();
  if (registeredDb[id]) {
    return registeredDb[id];
  }
  return DEMO_MEMBERS_MASTER[id] || {
    id,
    name: id,
    age: 22,
    phone: '+91 98765 00000',
    role: 'Tourist',
    status: 'Online',
    photo: `https://ui-avatars.com/api/?name=${encodeURIComponent(id)}&background=0f766e&color=fff`,
    isYou: false,
  };
}

export class SimulatedLocationProvider {
  constructor(cityName = 'Nashik') {
    this.cityName = cityName;
    this.cityCenter = CITIES_CONFIG[cityName]?.center || CITIES_CONFIG.Nashik.center;
    this.isSimulating = true;
    this.listeners = [];
    this.stepCount = 0;
    this.memberOffsets = {
      ANUJ001: { dLat: 0.0, dLng: 0.0, angle: 0 },
      ADITI002: { dLat: 0.00005, dLng: 0.00004, angle: 0.8 },
      OMKAR003: { dLat: -0.00004, dLng: 0.00003, angle: 2.1 },
      HASTI004: { dLat: 0.00003, dLng: -0.00005, angle: 3.5 },
      PALAK005: { dLat: -0.00005, dLng: -0.00004, angle: 4.8 },
      MAVERICK006: { dLat: 0.00002, dLng: 0.00006, angle: 5.9 },
    };
    this.timer = null;
    this.startSimulation();
  }

  setCity(cityName) {
    if (CITIES_CONFIG[cityName]) {
      this.cityName = cityName;
      this.cityCenter = CITIES_CONFIG[cityName].center;
      this.stepCount = 0;
      this.resetMemberOffsets();
      this.notifyListeners();
    }
  }

  resetMemberOffsets() {
    this.memberOffsets = {
      ANUJ001: { dLat: 0.0, dLng: 0.0, angle: 0 },
      ADITI002: { dLat: 0.00005, dLng: 0.00004, angle: 0.8 },
      OMKAR003: { dLat: -0.00004, dLng: 0.00003, angle: 2.1 },
      HASTI004: { dLat: 0.00003, dLng: -0.00005, angle: 3.5 },
      PALAK005: { dLat: -0.00005, dLng: -0.00004, angle: 4.8 },
      MAVERICK006: { dLat: 0.00002, dLng: 0.00006, angle: 5.9 },
    };
  }

  startSimulation() {
    if (!this.timer) {
      this.isSimulating = true;
      this.timer = setInterval(() => this.tick(), 2500);
    }
  }

  pauseSimulation() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isSimulating = false;
  }

  resetSimulation() {
    this.resetMemberOffsets();
    this.stepCount = 0;
    this.notifyListeners();
  }

  tick() {
    if (!this.isSimulating) return;
    this.stepCount++;

    // Smooth deterministic movement vectors around city center
    Object.keys(this.memberOffsets).forEach((id) => {
      const meta = resolveMemberProfile(id);
      if (!meta) return;
      const offset = this.memberOffsets[id];
      offset.angle += 0.15;
      const moveRadius = meta.speed || 0.00003;
      offset.dLat += Math.sin(offset.angle) * moveRadius * 0.3;
      offset.dLng += Math.cos(offset.angle) * moveRadius * 0.3;
    });

    this.notifyListeners();
  }

  getMemberLocations(memberIds = ['ANUJ001', 'ADITI002', 'OMKAR003', 'HASTI004', 'PALAK005', 'MAVERICK006']) {
    return memberIds.map((id) => {
      const profile = resolveMemberProfile(id);

      let offset = this.memberOffsets[id];
      if (!offset) {
        const hash = hashString(id);
        offset = {
          dLat: ((hash % 10) - 5) * 0.00002,
          dLng: (((hash >> 2) % 10) - 5) * 0.00002,
          angle: 0,
        };
        this.memberOffsets[id] = offset;
      }

      const lat = this.cityCenter.lat + offset.dLat;
      const lng = this.cityCenter.lng + offset.dLng;

      return {
        ...profile,
        lat: round6(lat),
        lng: round6(lng),
        lastUpdatedSecondsAgo: Math.max(1, (this.stepCount % 5) + 1),
        cityName: this.cityName,
      };
    });
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notifyListeners() {
    this.listeners.forEach((listener) => listener(this.getMemberLocations()));
  }
}

function round6(val) {
  return Math.round(val * 1000000) / 1000000;
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
