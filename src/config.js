/**
 * TOURIX — Nashik Configuration Constants
 */
export const CONFIG = {
  city: 'Nashik',
  district: 'Nashik',
  state: 'Maharashtra',
  country: 'India',

  // Nashik center coordinates (Panchavati area)
  defaultCenter: { lat: 20.0063, lng: 73.7910 },
  defaultZoom: 13,

  // Map tile layer (OpenStreetMap — free, no API key)
  tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution: '&copy; OpenStreetMap contributors',

  // Supabase (from env with production fallback)
  supabaseUrl: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) || 'https://bwnkfzzipsikvqnvdunu.supabase.co',
  supabaseAnonKey: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || 'sb_publishable_4CSpiBQZIi-EF-_11dXrUQ_bIa_9UcH',

  // Backend API
  apiUrl: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:8000',

  // Authentication Provider (forced to backend for instant on-screen OTPs)
  authProvider: 'backend',

  // Emergency helplines — Official Nashik District Government numbers
  emergencyHelplines: [
    { id: 'police', name: 'Police Control Room', number: '100', icon: 'fa-shield-halved' },
    { id: 'women', name: 'Women Helpline', number: '1091', icon: 'fa-venus' },
    { id: 'child', name: 'Child Helpline', number: '1098', icon: 'fa-child' },
    { id: 'cyber', name: 'Cyber Crime', number: '1930', icon: 'fa-laptop-code' },
    { id: 'disaster', name: 'District Disaster Management', number: '1077', icon: 'fa-house-crack' },
    { id: 'citizen', name: 'Citizen Call Center', number: '18001208040', icon: 'fa-phone' },
  ],

  // Category icon mapping
  categoryIcons: {
    'Heritage': 'fa-landmark',
    'Spiritual': 'fa-place-of-worship',
    'Nature': 'fa-leaf',
    'Adventure': 'fa-person-hiking',
    'Food': 'fa-utensils',
    'Culture': 'fa-masks-theater',
    'Vineyards': 'fa-wine-glass',
    'Shopping': 'fa-bag-shopping',
    'Wellness': 'fa-spa',
    'Photography': 'fa-camera',
    'Agritourism': 'fa-wheat-awn',
    'Museum': 'fa-building-columns',
    'Fort': 'fa-chess-rook',
    'Waterfall': 'fa-water',
  },

  // Category color mapping
  categoryColors: {
    'Heritage': { bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
    'Spiritual': { bg: '#fce7f3', text: '#be185d', border: '#f9a8d4' },
    'Nature': { bg: '#d1fae5', text: '#059669', border: '#a7f3d0' },
    'Adventure': { bg: '#ffedd5', text: '#ea580c', border: '#fed7aa' },
    'Food': { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
    'Culture': { bg: '#e0e7ff', text: '#4f46e5', border: '#c7d2fe' },
    'Vineyards': { bg: '#f3e8ff', text: '#7c3aed', border: '#d8b4fe' },
    'Shopping': { bg: '#ecfeff', text: '#0891b2', border: '#a5f3fc' },
    'Wellness': { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
    'Photography': { bg: '#fdf4ff', text: '#a21caf', border: '#f0abfc' },
  },

  // Group separation threshold (meters)
  separationThresholdMeters: 10,

  // Default Prototype Demo Group
  demoGroupName: 'Tourix Demo Group',
  demoGroupCode: 'TOURIX6',
  demoGroupMembers: [
    { id: 'anuj', name: 'Anuj', phone: '+919876543210', role: 'Tourist / Current User', lat: 20.0063, lng: 73.7910, isYou: true, photo: 'https://ui-avatars.com/api/?name=Anuj&background=0f766e&color=fff' },
    { id: 'aditi', name: 'Aditi', phone: '+919876543211', role: 'Tourist', lat: 20.00635, lng: 73.79105, isYou: false, photo: 'https://ui-avatars.com/api/?name=Aditi&background=d97706&color=fff' },
    { id: 'omkar', name: 'Omkar', phone: '+919876543212', role: 'Tourist', lat: 20.0064, lng: 73.7911, isYou: false, photo: 'https://ui-avatars.com/api/?name=Omkar&background=2563eb&color=fff' },
    { id: 'hasti', name: 'Hasti', phone: '+919876543213', role: 'Tourist', lat: 20.00625, lng: 73.79095, isYou: false, photo: 'https://ui-avatars.com/api/?name=Hasti&background=7c3aed&color=fff' },
    { id: 'palak', name: 'Palak', phone: '+919876543214', role: 'Tourist', lat: 20.0062, lng: 73.7909, isYou: false, photo: 'https://ui-avatars.com/api/?name=Palak&background=db2777&color=fff' },
    { id: 'maverick', name: 'Maverick', phone: '+919876543215', role: 'Tourist / Assistant', lat: 20.00615, lng: 73.79085, isYou: false, photo: 'https://ui-avatars.com/api/?name=Maverick&background=059669&color=fff' },
  ],

  // Risk zone demo data
  demoRiskZones: [
    {
      id: 'rz-1',
      type: 'flood_hazard',
      severity: 'medium',
      lat: 20.0040,
      lng: 73.7600,
      radius: 500,
      description: 'Godavari downstream — potential water surge during heavy rainfall',
      recommended_action: 'Take western highway bypass corridor',
      source: 'Nashik District Disaster Management',
      is_demo: true,
    },
    {
      id: 'rz-2',
      type: 'trek_difficulty',
      severity: 'high',
      lat: 19.8860,
      lng: 73.6790,
      radius: 300,
      description: 'Harihar Fort — steep rock-cut staircase, advanced difficulty',
      recommended_action: 'Attempt only with proper gear and during daylight',
      source: 'Maharashtra Tourism advisory',
      is_demo: true,
    },
  ],
};
