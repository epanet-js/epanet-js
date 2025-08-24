export interface UserLocation {
  latitude: number;
  longitude: number;
}

export function getUserLocation(): UserLocation | null {
  if (typeof window === "undefined") {
    return null;
  }

  const body = document.body;
  const dataAttribute = body.getAttribute("data-user-location");

  if (!dataAttribute) {
    return null;
  }

  try {
    const parsed = JSON.parse(dataAttribute) as UserLocation;
    return parsed;
  } catch {
    return null;
  }
}
