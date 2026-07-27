import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";

import api from "../utils/api";
import { useWeb3 } from "./Web3Context";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const {
    signer,
    account,
    initialized: web3Initialized,
  } = useWeb3();

  // =====================================================
  // STATE
  // =====================================================

  const [token, setToken] = useState(() =>
    localStorage.getItem("drivex_token")
  );

  const [loading, setLoading] = useState(false);

  // Helps prevent auth flicker during wallet restore
  const [initialized, setInitialized] = useState(false);

  // =====================================================
  // INITIALIZATION
  // =====================================================

  useEffect(() => {
    setInitialized(web3Initialized);
  }, [web3Initialized]);

  // =====================================================
  // CLEAR STALE TOKEN ON ACCOUNT CHANGE
  // =====================================================

  useEffect(() => {
    if (!account) return;
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (
        payload.wallet &&
        payload.wallet.toLowerCase() !== account.toLowerCase()
      ) {
        // Token belongs to a different wallet — clear it
        localStorage.removeItem("drivex_token");
        setToken(null);
      }
    } catch {
      // Malformed token — clear it
      localStorage.removeItem("drivex_token");
      setToken(null);
    }
  }, [account, token]);

  // =====================================================
  // SIGN IN
  // =====================================================

  const signIn = useCallback(
    async (customSigner = null, customAccount = null) => {
      const s = customSigner || signer;
      const a = customAccount || account;

      if (!s || !a) {
        throw new Error("Wallet not connected");
      }

      setLoading(true);

      try {
        // -------------------------------------------------
        // 1. Get nonce message
        // -------------------------------------------------

        const {
          data: { message },
        } = await api.get(`/auth/nonce/${a}`);

        // -------------------------------------------------
        // 2. User signs nonce
        // -------------------------------------------------

        const signature = await s.signMessage(message);

        // -------------------------------------------------
        // 3. Verify signature and receive JWT
        // -------------------------------------------------

        const {
          data: { token: jwt },
        } = await api.post("/auth/verify", {
          wallet: a,
          signature,
        });

        // -------------------------------------------------
        // 4. Persist token
        // -------------------------------------------------

        localStorage.setItem("drivex_token", jwt);

        setToken(jwt);

        return jwt;

      } catch (err) {
        console.error("Authentication failed:", err);

        localStorage.removeItem("drivex_token");
        setToken(null);

        throw err;

      } finally {
        setLoading(false);
      }
    },
    [signer, account]
  );

  // =====================================================
  // SIGN OUT
  // =====================================================

  const signOut = useCallback(() => {
    localStorage.removeItem("drivex_token");
    setToken(null);
  }, []);

  // =====================================================
  // AUTH VALIDATION
  // =====================================================

  const isAuthenticated = useMemo(() => {
    // Wait until wallet restore finishes
    if (!initialized) return false;

    if (!token || !account) {
      return false;
    }

    try {
      const payload = JSON.parse(
        atob(token.split(".")[1])
      );

      // Validate wallet ownership
      const validWallet =
        payload.wallet &&
        payload.wallet.toLowerCase() ===
          account.toLowerCase();

      if (!validWallet) {
        localStorage.removeItem("drivex_token");
        return false;
      }

      // Optional JWT expiry validation
      if (payload.exp) {
        const now = Date.now() / 1000;

        if (payload.exp < now) {
          localStorage.removeItem("drivex_token");
          return false;
        }
      }

      return true;

    } catch (err) {
      console.error("Invalid auth token:", err);

      localStorage.removeItem("drivex_token");

      return false;
    }
  }, [token, account, initialized]);

  // =====================================================
  // CONTEXT VALUE
  // =====================================================

  const value = {
    token,
    isAuthenticated,
    signIn,
    signOut,
    loading,
    initialized,
  };

  // =====================================================
  // PROVIDER
  // =====================================================

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// =======================================================
// CUSTOM HOOK
// =======================================================

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return ctx;
}

/*
|------------------------------------------------------------------
| AUTH CONTEXT
|------------------------------------------------------------------
|
| Responsibilities:
| - Wallet-based authentication
| - JWT session persistence
| - Nonce signing flow
| - Global auth state
| - Session validation
|
| Authentication Flow:
| 1. Wallet connects
| 2. Backend sends nonce
| 3. User signs nonce
| 4. Backend verifies signature
| 5. JWT returned
| 6. JWT stored locally
|
| Important:
| - Blockchain = registration truth
| - JWT = session authentication
| - MongoDB = auxiliary metadata
|
*/
