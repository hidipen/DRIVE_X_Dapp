import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";

export function useOwnerCars(wallet) {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchCars = useCallback(() => {
    if (!wallet) {
      setCars([]);
      return;
    }

    setLoading(true);
    api
      .get(`/users/${wallet}/cars`)
      .then(({ data }) => setCars(data.cars || []))
      .catch(() => setCars([]))
      .finally(() => setLoading(false));
  }, [wallet]);

  useEffect(() => {
    fetchCars();
  }, [fetchCars]);

  useEffect(() => {
    if (!wallet) return undefined;

    const interval = setInterval(fetchCars, 10000);
    return () => clearInterval(interval);
  }, [wallet, fetchCars]);

  return { cars, loading, refetch: fetchCars };
}
