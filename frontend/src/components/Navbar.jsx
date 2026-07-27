import React, { useState } from "react";
import {
  Link,
  NavLink,
  useNavigate,
} from "react-router-dom";

import { useWeb3 } from "../context/Web3Context";
import { useAuth } from "../context/AuthContext";
import { useUser } from "../hooks/useUser";

import { formatAddress } from "../utils/format";
import { isAdminWallet } from "../utils/admin";

import styles from "./Navbar.module.css";

export default function Navbar() {
  // =====================================================
  // CONTEXTS
  // =====================================================

  const {
    account,
    connect,
    contract,
    disconnect,
    connecting,
    error: walletError,
  } = useWeb3();

  const {
    isAuthenticated,
    signIn,
    signOut,
    initialized,
  } = useAuth();

  const { user } = useUser(
    isAuthenticated ? account : null
  );

  const isAdmin = isAdminWallet(account);

  const navigate = useNavigate();

  // Local loading state for the connect + sign-in flow
  const [flowLoading, setFlowLoading] = useState(false);

  // =====================================================
  // WAIT FOR AUTH RESTORE
  // =====================================================

  if (!initialized) {
    return (
      <nav className={styles.nav}>
        <div className={styles.inner}>

          {/* Logo */}

          <Link
            to="/"
            className={styles.logo}
          >
            <span className={styles.logoIcon}>
              ⬡
            </span>

            Drive
            <span className={styles.accent}>
              X
            </span>
          </Link>

          {/* Loading */}

          <div className={styles.actions}>
            <span className="spinner" />
          </div>
        </div>
      </nav>
    );
  }

  // =====================================================
  // CONNECT → CHECK REGISTRATION → AUTO SIGN-IN
  // =====================================================

  const handleConnect = async () => {
    setFlowLoading(true);

    try {
      // Connect wallet via MetaMask
      const res = await connect();

      if (!res?.account) {
        setFlowLoading(false);
        return;
      }

      // Check on-chain registration
      let registered = false;

      if (res.contract) {
        try {
          const chainUser = await res.contract.getUser(res.account);
          registered = Boolean(chainUser?.exists);
        } catch (err) {
          console.error("Registration check failed:", err);
        }
      }

      if (!registered) {
        // Not registered → redirect to registration
        navigate("/register");
        setFlowLoading(false);
        return;
      }

      // Registered → auto sign-in (nonce + signature)
      try {
        await signIn(res.signer, res.account);
        navigate("/dashboard");
      } catch (err) {
        console.error("Auto sign-in failed:", err);
      }

    } catch (err) {
      console.error("Wallet connection failed:", err);
    } finally {
      setFlowLoading(false);
    }
  };

  // =====================================================
  // DISCONNECT WALLET (full cleanup)
  // =====================================================

  const handleDisconnect = () => {
    signOut();
    disconnect();
    navigate("/");
  };

  // =====================================================
  // RENDER
  // =====================================================

  const isLoading = connecting || flowLoading;

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>

        {/* ================================================= */}
        {/* LOGO */}
        {/* ================================================= */}

        <Link
          to="/"
          className={styles.logo}
        >
          <span className={styles.logoIcon}>
            ⬡
          </span>

          Drive
          <span className={styles.accent}>
            X
          </span>
        </Link>

        {/* ================================================= */}
        {/* NAVIGATION LINKS */}
        {/* ================================================= */}

        <div className={styles.links}>

          {/* Browse Cars — always visible */}
          <NavLink
            to="/cars"
            className={({ isActive }) =>
              isActive
                ? styles.activeLink
                : styles.link
            }
          >
            Browse Cars
          </NavLink>

          {/* Role-based links — only when authenticated */}
          {isAuthenticated && (
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  isActive
                    ? styles.activeLink
                    : styles.link
                }
              >
                Dashboard
              </NavLink>

              <NavLink
                to="/my-rentals"
                className={({ isActive }) =>
                  isActive
                    ? styles.activeLink
                    : styles.link
                }
              >
                My Rentals
              </NavLink>

              {(user?.role === "OWNER" ||
                user?.role === "BOTH") && (
                <NavLink
                  to="/register-car"
                  className={({ isActive }) =>
                    isActive
                      ? styles.activeLink
                      : styles.link
                  }
                >
                  List Car
                </NavLink>
              )}

              {isAdmin && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    isActive
                      ? styles.activeLink
                      : styles.link
                  }
                >
                  Admin
                </NavLink>
              )}
            </>
          )}
        </div>

        {/* ================================================= */}
        {/* WALLET AREA */}
        {/* ================================================= */}

        <div className={styles.actions}>
          {walletError && (
            <span className={styles.errorChip}>
              {walletError}
            </span>
          )}

          {/* NOT CONNECTED — show Connect Wallet button */}

          {!account || !isAuthenticated ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleConnect}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="spinner" />
              ) : (
                "Connect Wallet"
              )}
            </button>
          ) : (

            /* CONNECTED + AUTHENTICATED — show wallet chip + Disconnect */

            <div className={styles.walletGroup}>

              <div className={styles.walletChip}>
                <span className={styles.dot} />

                {formatAddress(account)}
              </div>

              <button
                className="btn btn-ghost btn-sm"
                onClick={handleDisconnect}
              >
                Disconnect Wallet
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
