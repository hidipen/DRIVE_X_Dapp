import React from "react";
import { Link, useNavigate } from "react-router-dom";

import { useWeb3 } from "../context/Web3Context";
import { useAuth } from "../context/AuthContext";
import { useUser } from "../hooks/useUser";
import { useUserRentals } from "../hooks/useRental";
import { useOwnerCars } from "../hooks/useCars";

import { formatAddress } from "../utils/format";

import RentalStatusBadge from "../components/RentalStatusBadge";

import styles from "./DashboardPage.module.css";

const ROLE_LABELS = {
  NONE: "None",
  RENTER: "Renter",
  OWNER: "Owner",
  BOTH: "Owner & Renter",
};

export default function DashboardPage() {
  const { account, disconnect } = useWeb3();

  const {
    signOut,
    initialized,
    isAuthenticated,
  } = useAuth();

  const {
    user,
    loading,
    error,
    refetch,
  } = useUser();

  const { rentalIds } = useUserRentals(account);
  const shouldLoadOwnerCars =
    user?.role === "OWNER" || user?.role === "BOTH";
  const { cars: ownerCars, loading: ownerCarsLoading } =
    useOwnerCars(shouldLoadOwnerCars ? account : null);

  const [activeTab, setActiveTab] =
    React.useState("renter");

  const navigate = useNavigate();

  // =====================================================
  // AUTO-SWITCH OWNER TAB
  // =====================================================

  React.useEffect(() => {
    if (
      user &&
      user.role === "OWNER" &&
      activeTab === "renter"
    ) {
      setActiveTab("owner");
    }
  }, [user, activeTab]);

  React.useEffect(() => {
    if (!user || user.status !== "UNVERIFIED") return undefined;

    const interval = setInterval(() => {
      refetch();
    }, 8000);

    return () => clearInterval(interval);
  }, [user, refetch]);

  // =====================================================
  // WAIT FOR AUTH + WALLET RESTORE
  // =====================================================

  if (!initialized || loading) {
    return (
      <div
        className="flex-center"
        style={{ minHeight: "60vh" }}
      >
        <span
          className="spinner"
          style={{ width: 40, height: 40 }}
        />
      </div>
    );
  }

  // =====================================================
  // PROTECTED ROUTE
  // =====================================================

  if (!account || !isAuthenticated) {
    return (
      <div className={styles.page}>
        <div className="page-wrapper">
          <div className={styles.notRegistered}>
            <span style={{ fontSize: "3rem" }}>
              🔒
            </span>

            <h2>Authentication Required</h2>

            <p className="text-muted">
              Please connect your wallet and
              sign in.
            </p>

            <Link
              to="/"
              className="btn btn-primary btn-lg"
            >
              Go Home →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // ERROR STATE
  // =====================================================

  if (error) {
    return (
      <div className={styles.page}>
        <div className="page-wrapper">
          <div
            className={styles.notRegistered}
            style={{
              color: "var(--red)",
            }}
          >
            <span style={{ fontSize: "3rem" }}>
              ⚠️
            </span>

            <h2>Error Loading Dashboard</h2>

            <p className="text-muted">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // USER NOT REGISTERED
  // =====================================================

  if (!user) {
    return (
      <div className={styles.page}>
        <div className="page-wrapper">
          <div className={styles.notRegistered}>
            <span style={{ fontSize: "3rem" }}>
              👤
            </span>

            <h2>
              You're not registered yet
            </h2>

            <p className="text-muted">
              Create your DriveX account
              to start renting or listing
              cars.
            </p>

            <Link
              to="/register"
              className="btn btn-primary btn-lg"
            >
              Register Now →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // SAFE FALLBACKS
  // =====================================================

  const reputationScore =
    user.reputationScore ?? 0;

  const noShowCount =
    user.noShowCount ?? 0;

  const status =
    user.status ?? "UNVERIFIED";

  const reputationColor =
    reputationScore >= 80
      ? "var(--accent)"
      : reputationScore >= 50
        ? "var(--yellow)"
        : "var(--red)";

  // =====================================================
  // DASHBOARD
  // =====================================================

  return (
    <div className={styles.page}>
      <div className="page-wrapper">

        {/* HERO */}

        <div className={styles.hero}>
          <div>
            <h1>Welcome back</h1>

            <p
              className="text-muted"
              style={{
                fontFamily: "monospace",
              }}
            >
              {formatAddress(account)}
            </p>
          </div>

          <div className={styles.heroBtns}>

            {user.role === "RENTER" && (
              <Link
                to="/register"
                className="btn btn-secondary"
              >
                Upgrade to Owner
              </Link>
            )}

            {user.role === "OWNER" && (
              <button
                className="btn btn-secondary"
                onClick={() =>
                  navigate("/register")
                }
              >
                Upgrade to Renter
              </button>
            )}

            <button
              className="btn btn-ghost"
              onClick={() => {
                signOut();
                disconnect();
                navigate("/");
              }}
            >
              Disconnect Wallet
            </button>
          </div>
        </div>

        {/* STATUS CARDS */}

        <div className={styles.statsGrid}>

          <div className="card">
            <span className={styles.cardLabel}>
              Account Status
            </span>

            <div className={styles.cardValue}>
              <span
                className={`badge ${status === "VERIFIED"
                  ? "badge-green"
                  : status === "BLOCKED"
                    ? "badge-red"
                    : "badge-yellow"
                  }`}
              >
                {status}
              </span>
            </div>
          </div>

          <div className="card">
            <span className={styles.cardLabel}>
              Role
            </span>

            <div
              className={styles.cardValue}
              style={{
                color: "var(--blue)",
                fontFamily:
                  "var(--font-display)",
                fontWeight: 700,
              }}
            >
              {ROLE_LABELS[user.role] ||
                user.role}
            </div>
          </div>

          <div className="card">
            <span className={styles.cardLabel}>
              Reputation Score
            </span>

            <div className={styles.cardValue}>
              <span
                style={{
                  color: reputationColor,
                  fontFamily:
                    "var(--font-display)",
                  fontWeight: 800,
                  fontSize: "1.6rem",
                }}
              >
                {reputationScore}
              </span>

              <span className="text-muted text-sm">
                {" "}
                / 200
              </span>
            </div>
          </div>

          <div className="card">
            <span className={styles.cardLabel}>
              No-Show Count
            </span>

            <div className={styles.cardValue}>
              <span
                style={{
                  color:
                    noShowCount > 0
                      ? "var(--red)"
                      : "var(--accent)",

                  fontFamily:
                    "var(--font-display)",

                  fontWeight: 800,
                  fontSize: "1.6rem",
                }}
              >
                {noShowCount}
              </span>
            </div>
          </div>
        </div>

        {/* VERIFICATION NOTICE */}

        {status === "UNVERIFIED" && (
          <div className={styles.notice}>
            <span>⏳</span>

            <div>
              <strong>
                Verification Pending
              </strong>

              <p className="text-muted text-sm">
                Your documents are under
                review. You can browse
                cars but cannot book until
                verified.
              </p>
            </div>
          </div>
        )}

        {/* REJECTED NOTICE */}

        {status === "REJECTED" && (
          <div
            className={styles.notice}
            style={{
              background:
                "rgba(255, 68, 68, 0.1)",

              border:
                "1px solid var(--red)",
            }}
          >
            <span>❌</span>

            <div>
              <strong>
                Verification Rejected
              </strong>

              <p className="text-muted text-sm">
                Your documents were
                rejected. Please check
                your notifications.
              </p>
            </div>
          </div>
        )}

        {/* BOTH ROLE TABS */}

        {user.role === "BOTH" && (
          <div
            className={styles.tabs}
            style={{
              display: "flex",
              gap: "16px",
              marginBottom: "24px",
              borderBottom:
                "1px solid var(--border)",
            }}
          >
            <button
              className={`btn btn-ghost ${activeTab === "renter"
                ? "active"
                : ""
                }`}
              style={{
                borderBottom:
                  activeTab === "renter"
                    ? "2px solid var(--accent)"
                    : "none",

                borderRadius: 0,
              }}
              onClick={() =>
                setActiveTab("renter")
              }
            >
              Renter Dashboard
            </button>

            <button
              className={`btn btn-ghost ${activeTab === "owner"
                ? "active"
                : ""
                }`}
              style={{
                borderBottom:
                  activeTab === "owner"
                    ? "2px solid var(--accent)"
                    : "none",

                borderRadius: 0,
              }}
              onClick={() =>
                setActiveTab("owner")
              }
            >
              Owner Dashboard
            </button>
          </div>
        )}

        {/* RENTER VIEW */}

        {activeTab === "renter" &&
          (user.role === "RENTER" ||
            user.role === "BOTH") && (
            <div className={styles.section}>

              <div
                className={
                  styles.sectionHeader
                }
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",

                  alignItems: "center",
                }}
              >
                <h2>
                  Renter Dashboard
                </h2>

                <Link
                  to="/cars"
                  className="btn btn-primary"
                >
                  Browse Cars
                </Link>
              </div>

              <h3
                style={{
                  marginTop: 24,
                  marginBottom: 16,
                }}
              >
                My Rentals
              </h3>

              {rentalIds.length === 0 ? (
                <div className={styles.empty}>
                  <span>📋</span>

                  <p className="text-muted">
                    No rentals yet. Start
                    by browsing available
                    cars.
                  </p>
                </div>
              ) : (
                <div
                  className={
                    styles.rentalList
                  }
                >
                  {rentalIds
                    .slice(-5)
                    .reverse()
                    .map((id) => (
                      <RentalRow
                        key={id}
                        rentalId={id}
                        viewAs="renter"
                        account={account}
                      />
                    ))}

                  <Link
                    to="/my-rentals"
                    className="btn btn-ghost btn-sm"
                    style={{
                      alignSelf: "center",
                      marginTop: 16,
                    }}
                  >
                    View all rentals →
                  </Link>
                </div>
              )}
            </div>
          )}

        {/* OWNER VIEW */}

        {activeTab === "owner" &&
          (user.role === "OWNER" ||
            user.role === "BOTH") && (
            <div className={styles.section}>

              <div
                className={
                  styles.sectionHeader
                }
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",

                  alignItems: "center",
                }}
              >
                <h2>
                  Owner Dashboard
                </h2>

                <Link
                  to="/register-car"
                  className="btn btn-primary"
                >
                  List a New Car
                </Link>
              </div>

              <h3
                style={{
                  marginTop: 24,
                  marginBottom: 16,
                }}
              >
                My Car Listings
              </h3>

              {ownerCarsLoading ? (
                <div className="flex-center" style={{ padding: "32px 0" }}>
                  <span className="spinner" />
                </div>
              ) : ownerCars.length === 0 ? (
                <div className={styles.empty}>
                  <span>🚗</span>

                  <p className="text-muted">
                    You have not listed any cars yet.
                  </p>
                </div>
              ) : (
                <div className={styles.carList}>
                  {ownerCars.map((car) => (
                    <div key={car.id} className={styles.carRow}>
                      <span className="text-muted text-sm">
                        Car #{car.id}
                      </span>

                      <span className={styles.carMeta}>
                        {car.metadataURI}
                      </span>

                      <span
                        className={`badge ${car.status === "AVAILABLE"
                          ? "badge-green"
                          : car.status === "REJECTED"
                            ? "badge-red"
                            : "badge-yellow"
                          }`}
                      >
                        {car.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <h3
                style={{
                  marginTop: 32,
                  marginBottom: 16,
                }}
              >
                My Car Rentals
              </h3>

              {rentalIds.length === 0 ? (
                <div className={styles.empty}>
                  <span>📋</span>

                  <p className="text-muted">
                    None of your cars have
                    been rented yet.
                  </p>
                </div>
              ) : (
                <div
                  className={
                    styles.rentalList
                  }
                >
                  {rentalIds
                    .slice(-5)
                    .reverse()
                    .map((id) => (
                      <RentalRow
                        key={id}
                        rentalId={id}
                        viewAs="owner"
                        account={account}
                      />
                    ))}

                  <Link
                    to="/my-rentals"
                    className="btn btn-ghost btn-sm"
                    style={{
                      alignSelf: "center",
                      marginTop: 16,
                    }}
                  >
                    View all rentals →
                  </Link>
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
}

function RentalRow({
  rentalId,
  viewAs,
  account,
}) {
  const [rental, setRental] =
    React.useState(null);

  React.useEffect(() => {
    import("../utils/api").then(
      ({ default: api }) =>
        api
          .get(`/rentals/${rentalId}`)
          .then(({ data }) =>
            setRental(data)
          )
          .catch(() => { })
    );
  }, [rentalId]);

  if (!rental) return null;

  // Filter views

  if (
    viewAs === "renter" &&
    rental.renter.toLowerCase() !==
    account.toLowerCase()
  ) {
    return null;
  }

  if (
    viewAs === "owner" &&
    rental.owner.toLowerCase() !==
    account.toLowerCase()
  ) {
    return null;
  }

  return (
    <Link
      to={`/rentals/${rentalId}`}
      className={styles.rentalRow}
    >
      <span className="text-muted text-sm">
        #{rentalId}
      </span>

      <span>
        Car #{rental.carId}
      </span>

      <RentalStatusBadge
        status={rental.status}
      />

      <span
        className="text-muted text-sm"
        style={{ marginLeft: "auto" }}
      >
        →
      </span>
    </Link>
  );
}
