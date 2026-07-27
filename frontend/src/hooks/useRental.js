import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";

export function useRental(rentalId) {
  const [rental,  setRental]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const fetch = useCallback(() => {
    if (!rentalId) return;
    setLoading(true);
    api
      .get(`/rentals/${rentalId}`)
      .then(({ data }) => setRental(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [rentalId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { rental, loading, error, refetch: fetch };
}

export function useUserRentals(wallet) {
  const [rentalIds, setRentalIds] = useState([]);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    if (!wallet) return;
    setLoading(true);
    api
      .get(`/users/${wallet}/rentals`)
      .then(({ data }) => setRentalIds(data.rentalIds || []))
      .catch(() => setRentalIds([]))
      .finally(() => setLoading(false));
  }, [wallet]);

  return { rentalIds, loading };
}


/*
|--------------------------------------------------------------------------
| RENTAL DATA FETCHING HOOKS
|--------------------------------------------------------------------------
|
| This file provides reusable hooks for fetching rental-related data
| from the backend API.
|
| Responsibilities:
| - Fetch single rental details
| - Fetch rentals belonging to a wallet/user
| - Manage loading and error states
| - Provide reusable API-fetching logic for pages/components
|
| Architecture:
| Frontend Component -> useRental hook -> Backend API -> Database
|
| Hooks:
|
| useRental(rentalId):
| - Fetches detailed information for a single rental
| - Automatically refetches when rentalId changes
| - Exposes loading/error/refetch states
|
| useUserRentals(wallet):
| - Fetches rental IDs associated with a wallet
| - Used for user rental dashboards/history
|
| Important Concepts:
| - useEffect triggers automatic data fetching
| - useCallback memoizes fetch functions
| - Backend APIs are used instead of direct blockchain queries
|
| Blockchain vs Backend:
| - Blockchain handles trust + transactions
| - Backend handles indexed/queryable rental data
|
| Notes:
| - This file manages API data fetching ONLY
| - No blockchain transactions occur here
| - Helps keep pages/components cleaner
| - Future owner/renter/admin hooks may follow this same pattern
|
*/