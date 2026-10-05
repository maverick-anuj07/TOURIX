import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config.js';

export const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);

/**
 * Fetch verified places from Supabase
 */
export async function fetchPlacesFromSupabase(category = null) {
  try {
    let query = supabase.from('places').select('*');
    if (category && category !== 'All') {
      query = query.ilike('category', category);
    }
    const { data, error } = await query;
    if (error) {
      console.warn('Supabase fetch places error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Supabase network error:', err);
    return null;
  }
}

/**
 * Save registered tourist profile to Supabase
 */
export async function saveTouristToSupabase(userProfile) {
  try {
    const { data, error } = await supabase.from('tourists').insert([{
      name: userProfile.name,
      phone: userProfile.phone,
      role: userProfile.role || 'tourist',
      emergency_contact: userProfile.emergencyContact,
      pace: userProfile.pace || 'balanced',
      interests: userProfile.interests || [],
      verified: !!userProfile.verified
    }]).select();

    if (error) console.warn('Supabase save tourist error:', error);
    return data ? data[0] : null;
  } catch (err) {
    console.warn('Failed to save tourist profile:', err);
    return null;
  }
}

/**
 * Dispatch SOS alert to Supabase
 */
export async function sendSOSToSupabase(sosData) {
  try {
    const { data, error } = await supabase.from('sos_alerts').insert([{
      id: `SOS-${Date.now()}`,
      user_name: sosData.userName || 'Anonymous Tourist',
      emergency_contact: sosData.emergencyContact,
      latitude: sosData.lat,
      longitude: sosData.lng,
      status: 'ACTIVE'
    }]).select();

    if (error) console.warn('Supabase SOS alert error:', error);
    return data ? data[0] : null;
  } catch (err) {
    console.warn('Failed to send SOS alert to Supabase:', err);
    return null;
  }
}

/**
 * Save AI Itinerary to Supabase
 */
export async function saveItineraryToSupabase(itineraryData) {
  try {
    const { data, error } = await supabase.from('itineraries').insert([{
      title: itineraryData.title || 'Nashik Tour Itinerary',
      user_id: itineraryData.userId || 'guest',
      hours: itineraryData.hours,
      preference: itineraryData.preference,
      stops: itineraryData.stops,
      safety_briefing: itineraryData.safetyBriefing
    }]).select();

    if (error) console.warn('Supabase save itinerary error:', error);
    return data ? data[0] : null;
  } catch (err) {
    console.warn('Failed to save itinerary to Supabase:', err);
    return null;
  }
}
