// "Favorite Pharmacies" future enhancement — lets a patient star a
// pharmacy for quicker selection on future prescription requests.

const KEY = "sabi-favorite-pharmacies";
const EVENT = "sabi-favorites-updated";

export function getFavoritePharmacyIds() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  return [];
}

function persist(list) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
  return list;
}

export function subscribeToFavorites(listener) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

export function isFavoritePharmacy(pharmacyId) {
  return getFavoritePharmacyIds().includes(pharmacyId);
}

export function toggleFavoritePharmacy(pharmacyId) {
  const list = getFavoritePharmacyIds();
  const next = list.includes(pharmacyId) ? list.filter((id) => id !== pharmacyId) : [...list, pharmacyId];
  return persist(next);
}
