/**
 * TOURIX — Real Tourism Image Provider Architecture
 * Resolves authentic destination imagery for Indian tourist places, heritage sites, spiritual temples, & restaurants.
 */

export const DESTINATION_IMAGES = {
  // --- NASHIK ---
  'trimbakeshwar': 'https://images.unsplash.com/photo-1627894483216-2138af692e32?q=80&w=1200&auto=format&fit=crop', // Trimbakeshwar temple / Brahmagiri
  'sula': 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?q=80&w=1200&auto=format&fit=crop', // Vineyard sunset
  'panchavati': 'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?q=80&w=1200&auto=format&fit=crop', // River ghats / Ramkund
  'pandavleni': 'https://images.unsplash.com/photo-1600011689032-8b628b8a8747?q=80&w=1200&auto=format&fit=crop', // Rock-cut Buddhist caves
  'harihar': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop', // Steep rock fortress
  'kalsubai': 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1200&auto=format&fit=crop', // Mountain peak
  'saptashrungi': 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?q=80&w=1200&auto=format&fit=crop', // Cliff temple
  'muktidham': 'https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=1200&auto=format&fit=crop', // Marble templeComplex
  'sadhana-misal': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?q=80&w=1200&auto=format&fit=crop', // Maharashtrian misal & food
  'panchavati-gaurav': 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?q=80&w=1200&auto=format&fit=crop', // Thali dining

  // --- PUNE ---
  'shaniwar-wada': 'https://images.unsplash.com/photo-1599661046289-e31897846e41?q=80&w=1200&auto=format&fit=crop', // Shaniwar Wada Fort Pune
  'aga-khan-palace': 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?q=80&w=1200&auto=format&fit=crop', // Aga Khan Palace Pune
  'vaishali-pune': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=1200&auto=format&fit=crop', // South Indian breakfast & cafe

  // --- MUMBAI ---
  'gateway-of-india': 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?q=80&w=1200&auto=format&fit=crop', // Gateway of India Mumbai
  'marine-drive': 'https://images.unsplash.com/photo-1567157577867-05ccb1388e66?q=80&w=1200&auto=format&fit=crop', // Marine Drive Queen's Necklace
  'leopold-cafe': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop', // Historic cafe & dining

  // --- HERO & FEATURED BANNER ---
  'hero-banner': 'https://images.unsplash.com/photo-1564507592333-c60657eea523?q=80&w=1200&auto=format&fit=crop', // Heritage Palace/Fort Architecture
};

export const CATEGORY_FALLBACK_IMAGES = {
  'Spiritual': 'https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=1200&auto=format&fit=crop',
  'Heritage': 'https://images.unsplash.com/photo-1599661046289-e31897846e41?q=80&w=1200&auto=format&fit=crop',
  'Adventure': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop',
  'Nature': 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1200&auto=format&fit=crop',
  'Vineyards': 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?q=80&w=1200&auto=format&fit=crop',
  'Food': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?q=80&w=1200&auto=format&fit=crop',
  'Culture': 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?q=80&w=1200&auto=format&fit=crop',
  'Shopping': 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=1200&auto=format&fit=crop',
};

export class PlaceImageProvider {
  static getImageUrl(place) {
    if (!place) return CATEGORY_FALLBACK_IMAGES['Heritage'];
    if (place.image && place.image.startsWith('http')) return place.image;
    if (DESTINATION_IMAGES[place.id]) return DESTINATION_IMAGES[place.id];

    // Fuzzy matching by place name or subcategory
    const nameLower = (place.name || '').toLowerCase();
    if (nameLower.includes('trimbak')) return DESTINATION_IMAGES['trimbakeshwar'];
    if (nameLower.includes('sula')) return DESTINATION_IMAGES['sula'];
    if (nameLower.includes('shaniwar')) return DESTINATION_IMAGES['shaniwar-wada'];
    if (nameLower.includes('gateway')) return DESTINATION_IMAGES['gateway-of-india'];
    if (nameLower.includes('marine')) return DESTINATION_IMAGES['marine-drive'];
    if (nameLower.includes('aga khan')) return DESTINATION_IMAGES['aga-khan-palace'];
    if (nameLower.includes('cave') || nameLower.includes('leni')) return DESTINATION_IMAGES['pandavleni'];
    if (nameLower.includes('misal')) return DESTINATION_IMAGES['sadhana-misal'];
    if (nameLower.includes('fort') || nameLower.includes('peak')) return DESTINATION_IMAGES['harihar'];

    return CATEGORY_FALLBACK_IMAGES[place.category] || CATEGORY_FALLBACK_IMAGES['Heritage'];
  }
}
