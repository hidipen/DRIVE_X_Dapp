import { useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import { useWeb3 } from "../context/Web3Context";
import { useContract } from "./useContract";

const ROLE_MAP = {
  0: "NONE",
  1: "RENTER",
  2: "OWNER",
  3: "BOTH",
};

const STATUS_MAP = {
  0: "UNVERIFIED",
  1: "VERIFIED",
  2: "BLOCKED",
  3: "REJECTED",
};

const normalizeRole = (role) => {
  if (role === undefined || role === null) return null;
  if (typeof role === "string") return role;
  return ROLE_MAP[Number(role)] || "NONE";
};

const normalizeStatus = (status) => {
  if (status === undefined || status === null) return null;
  if (typeof status === "string") return status;
  return STATUS_MAP[Number(status)] || "UNVERIFIED";
};

export function useUser(walletOverride = null) {
  const { account, error: walletError } = useWeb3();
  const { read, contract } = useContract();

  const wallet = walletOverride || account;

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUser = useCallback(async () => {
    if (!wallet) {
      setUser(null);
      setLoading(false);
      return;
    }

    if (walletError) {
      setUser(null);
      setError(walletError);
      setLoading(false);
      return;
    }

    if (!contract) {
      setUser(null);
      setError(null);
      setLoading(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // =====================================================
      // 1. BLOCKCHAIN = SOURCE OF TRUTH
      // =====================================================

      const chainUser = await read("getUser", [wallet]);

      if (!chainUser || !chainUser.exists) {
        setUser(null);
        return;
      }

      // =====================================================
      // 2. OPTIONAL BACKEND DATA
      // =====================================================

      let backendUser = {};

      try {
        const { data } = await api.get(`/users/${wallet}`);
        backendUser = data || {};
      } catch (err) {
        // Backend data optional
        backendUser = {};
      }

      // =====================================================
      // 3. MERGE BOTH
      // =====================================================

      const role =
        normalizeRole(backendUser.role) ||
        normalizeRole(chainUser.role);

      const status =
        normalizeStatus(backendUser.status) ||
        normalizeStatus(chainUser.status);

      const mergedUser = {
        ...backendUser,
        wallet,
        exists: true,
        role: role || "NONE",
        status: status || "UNVERIFIED",
        isVerified:
          backendUser.isVerified ??
          status === "VERIFIED",
        metadataURI:
          backendUser.metadataURI ||
          chainUser.metadataURI ||
          "",
        reputationScore:
          backendUser.reputationScore ??
          Number(chainUser.reputationScore ?? 0),
        noShowCount:
          backendUser.noShowCount ??
          Number(chainUser.noShowCount ?? 0),
      };

      setUser(mergedUser);

    } catch (err) {
      console.error("Failed to fetch user:", err);

      const msg =
        err.code === "BAD_DATA"
          ? "DriveX contract returned no data. Check that MetaMask is on the deployed network and the contract address is current."
          : err.message || "Failed to fetch user";

      setError(msg);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [wallet, walletError, read, contract]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    user,
    loading,
    error,
    refetch: fetchUser,
  };
}
