"use client";

import { useEffect, useState } from "react";

export default function CabinWeather({ location }) {
  const [temp, setTemp] = useState(null);

  useEffect(() => {
    if (!location) return;
    async function fetchWeather() {
      const res = await fetch(`/api/search?q=${encodeURIComponent(location)}`);
      const locations = await res.json();
      if (locations.length > 0) {
        const loc = locations[0];
        const weatherRes = await fetch(
          `/api/vaer?lat=${loc.lat}&lon=${loc.lon}`,
        );
        const data = await weatherRes.json();
        setTemp(data?.current?.temperature ?? null);
      }
    }
    fetchWeather();
  }, [location]);

  if (temp === null) return <span>🌡️ ...</span>;
  return <span>🌡️ {temp}°C</span>;
}
