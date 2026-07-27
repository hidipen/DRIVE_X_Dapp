import React, { useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import CarCard from "../components/CarCard";
import styles from "./CarsPage.module.css";

export default function CarsPage() {
  const [cars,    setCars]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [lat,     setLat]     = useState("");
  const [lng,     setLng]     = useState("");
  const [radius,  setRadius]  = useState(50);
  const [locating,setLocating]= useState(false);

  const fetchCars = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (lat && lng) { params.set("lat", lat); params.set("lng", lng); params.set("radius", radius); }
      const { data } = await api.get(`/cars?${params}`);
      setCars(data.cars || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [lat, lng, radius]);

  useEffect(() => { fetchCars(); }, [fetchCars]);

  const autoLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => setLocating(false)
    );
  };

  return (
    <div className={styles.page}>
      <div className="page-wrapper">
        <div className={styles.header}>
          <div>
            <h1>Browse Cars</h1>
            <p className="text-muted">{cars.length} car{cars.length !== 1 ? "s" : ""} available</p>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          <div className={styles.locationRow}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Latitude</label>
              <input type="number" placeholder="e.g. 28.6139" value={lat} onChange={e => setLat(e.target.value)} step="0.0001" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Longitude</label>
              <input type="number" placeholder="e.g. 77.2090" value={lng} onChange={e => setLng(e.target.value)} step="0.0001" />
            </div>
            <div className="form-group" style={{ width: 120 }}>
              <label className="form-label">Radius (km)</label>
              <input type="number" min={1} max={500} value={radius} onChange={e => setRadius(e.target.value)} />
            </div>
            <div className={styles.filterActions}>
              <button className="btn btn-ghost btn-sm" onClick={autoLocate} disabled={locating} title="Use my location">
                {locating ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "📍 Locate Me"}
              </button>
              <button className="btn btn-primary btn-sm" onClick={fetchCars}>Search</button>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex-center" style={{ padding: "80px 0" }}>
            <span className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : cars.length === 0 ? (
          <div className={styles.empty}>
            <span>🚗</span>
            <h3>No cars found</h3>
            <p className="text-muted">Try expanding your search radius or remove location filters.</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {cars.map((car) => <CarCard key={car.id} car={car} />)}
          </div>
        )}
      </div>
    </div>
  );
}
