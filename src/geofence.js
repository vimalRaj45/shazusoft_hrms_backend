import { runtimeSettings } from './config.js';

/**
 * Calculates the great-circle distance between two points on the Earth (in meters)
 * using the Haversine formula.
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Validates whether user coordinates fall within the office geofence radius.
 */
export function verifyGeofence(userLat, userLng) {
  if (userLat === undefined || userLng === undefined || isNaN(userLat) || isNaN(userLng)) {
    return {
      inside: false,
      distanceMeters: null,
      officeCoords: {
        lat: runtimeSettings.officeLatitude,
        lng: runtimeSettings.officeLongitude,
        radius: runtimeSettings.officeRadiusMeters
      },
      message: 'Invalid or missing GPS coordinates.'
    };
  }

  const distance = calculateDistanceMeters(
    userLat,
    userLng,
    runtimeSettings.officeLatitude,
    runtimeSettings.officeLongitude
  );

  const inside = distance <= runtimeSettings.officeRadiusMeters;

  return {
    inside,
    distanceMeters: distance,
    allowedRadiusMeters: runtimeSettings.officeRadiusMeters,
    officeCoords: {
      lat: runtimeSettings.officeLatitude,
      lng: runtimeSettings.officeLongitude,
      radius: runtimeSettings.officeRadiusMeters
    },
    message: inside
      ? `Within office geofence (${distance}m from center).`
      : `Outside office geofence (${distance}m away, max allowed ${runtimeSettings.officeRadiusMeters}m).`
  };
}
