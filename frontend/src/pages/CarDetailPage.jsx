import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import api from "../utils/api";
import { useContract } from "../hooks/useContract";
import { useWeb3 } from "../context/Web3Context";
import { useAuth } from "../context/AuthContext";
import { useUser } from "../hooks/useUser";
import { formatEth, formatAddress, toChainCoord } from "../utils/format";
import { toast } from "react-toastify";
import styles from "./CarDetailPage.module.css";

export default function CarDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { account } = useWeb3();
  const { isAuthenticated } = useAuth();
  const { user } = useUser();
  const { send } = useContract();

  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  // Booking form state
  const [pickupStart, setPickupStart] = useState("");
  const [pickupEnd, setPickupEnd] = useState("");
  const [rentalStart, setRentalStart] = useState("");
  const [rentalEnd, setRentalEnd] = useState("");

  useEffect(() => {
    api.get(`/cars/${id}`)
      .then(({ data }) => setCar(data))
      .catch(() => toast.error("Car not found"))
      .finally(() => setLoading(false));
  }, [id]);

  const toUnix = (s) => Math.floor(new Date(s).getTime() / 1000);

  const calcTotal = () => {
    if (!car || !rentalStart || !rentalEnd) return null;
    const hours = Math.max(1, Math.ceil((toUnix(rentalEnd) - toUnix(rentalStart)) / 3600));
    const cost = BigInt(car.pricePerHour) * BigInt(hours);
    const deposit = BigInt(car.securityDeposit);
    return { hours, cost, deposit, total: cost + deposit };
  };

  const pricing = calcTotal();

  const handleBook = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) { toast.error("Please sign in first"); return; }
    if (!user || user.status !== "VERIFIED") { toast.error("Your account must be verified to book"); return; }
    if (!pricing) { toast.error("Please fill all time fields"); return; }

    setBooking(true);
    try {
      await send(
        "createRentalRequest",
        [
          BigInt(id),
          BigInt(toUnix(rentalStart)),
          BigInt(toUnix(rentalEnd)),
          BigInt(toUnix(pickupStart)),
          BigInt(toUnix(pickupEnd)),
        ],
        { value: pricing.total },
        "Creating rental request"
      );
      toast.success("Rental requested! Waiting for owner approval.");
      navigate("/my-rentals");
    } catch (err) {
      toast.error(err.reason || err.message || "Booking failed");
    } finally {
      setBooking(false);
    }
  };

  if (loading) return (
    <div className="flex-center" style={{ minHeight: "60vh" }}>
      <span className="spinner" style={{ width: 40, height: 40 }} />
    </div>
  );

  if (!car) return (
    <div className="flex-center" style={{ minHeight: "60vh" }}>
      <p className="text-muted">Car not found.</p>
    </div>
  );

  const isOwner = account && car.owner.toLowerCase() === account.toLowerCase();

  return (
    <div className={styles.page}>
      <div className="page-wrapper">
        <div className={styles.layout}>
          {/* Left: car details */}
          <div className={styles.main}>
            <div className={styles.imgBox}>
              <div className={styles.imgPlaceholder}>🚗</div>
              <span className={`badge ${car.status === "AVAILABLE" ? "badge-green" : "badge-red"} ${styles.statusBadge}`}>
                {car.status}
              </span>
            </div>

            <div className="card" style={{ marginTop: 20 }}>
              <div className={styles.detailHeader}>
                <div>
                  <h1 className={styles.carTitle}>Car #{car.id}</h1>
                  <p className="text-muted text-sm">
                    Owner: <span className="text-accent">{formatAddress(car.owner)}</span>
                  </p>
                </div>
                <div className={styles.priceBlock}>
                  <span className={styles.priceMain}>{formatEth(car.pricePerHour)} ETH</span>
                  <span className="text-muted text-sm">/ hour</span>
                </div>
              </div>

              <div className="divider" />

              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Security Deposit</span>
                  <span className={styles.metaValue}>{formatEth(car.securityDeposit)} ETH</span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Location</span>
                  <span className={styles.metaValue}>
                    {car.lat !== undefined ? `${car.lat.toFixed(4)}, ${car.lng.toFixed(4)}` : "—"}
                  </span>
                </div>
                {car.distanceKm !== undefined && (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Distance</span>
                    <span className={styles.metaValue}>{car.distanceKm} km away</span>
                  </div>
                )}
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Metadata (IPFS)</span>
                  <a href={`https://ipfs.io/ipfs/${car.metadataURI?.replace("ipfs://", "")}`}
                    target="_blank" rel="noreferrer" className="text-accent text-sm">
                    View →
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Right: booking form */}
          <div className={styles.sidebar}>
            {isOwner ? (
              <div className="card">
                <h3>This is your car</h3>
                <p className="text-muted text-sm" style={{ marginTop: 8 }}>
                  You can manage availability and view rentals from your dashboard.
                </p>
              </div>
            ) : car.status !== "AVAILABLE" ? (
              <div className="card">
                <h3>Not Available</h3>
                <p className="text-muted text-sm" style={{ marginTop: 8 }}>
                  This car is currently {car.status.toLowerCase()}.
                </p>
              </div>
            ) : (
              <form className="card" onSubmit={handleBook}>
                <h3 style={{ marginBottom: 20 }}>Book this car</h3>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Rental Start</label>
                  <input type="datetime-local" value={rentalStart}
                    onChange={e => setRentalStart(e.target.value)} required />
                </div>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Rental End</label>
                  <input type="datetime-local" value={rentalEnd}
                    onChange={e => setRentalEnd(e.target.value)} required />
                </div>

                <div className="divider" />

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Pickup Window Start</label>
                  <input type="datetime-local" value={pickupStart}
                    onChange={e => setPickupStart(e.target.value)} required />
                </div>
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label">Pickup Window End</label>
                  <input type="datetime-local" value={pickupEnd}
                    onChange={e => setPickupEnd(e.target.value)} required />
                  <span className="form-hint">You must arrive within this window to receive the OTP.</span>
                </div>

                {pricing && (
                  <div className={styles.pricingBreakdown}>
                    <div className={styles.pricingRow}>
                      <span className="text-muted text-sm">Rental ({pricing.hours}h × {formatEth(car.pricePerHour)} ETH)</span>
                      <span>{formatEth(pricing.cost.toString())} ETH</span>
                    </div>
                    <div className={styles.pricingRow}>
                      <span className="text-muted text-sm">Security Deposit</span>
                      <span>{formatEth(pricing.deposit.toString())} ETH</span>
                    </div>
                    <div className="divider" style={{ margin: "10px 0" }} />
                    <div className={styles.pricingRow}>
                      <span className="fw-600">Total</span>
                      <span className={styles.totalPrice}>{formatEth(pricing.total.toString())} ETH</span>
                    </div>
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  style={{ width: "100%", marginTop: 16 }}
                  type="submit"
                  disabled={booking || !isAuthenticated}
                >
                  {!isAuthenticated ? "Connect Wallet to Book" :
                    booking ? <><span className="spinner" /> Booking…</> :
                      "Request Rental →"}
                </button>

                {!isAuthenticated && (
                  <p className="text-muted text-sm" style={{ textAlign: "center", marginTop: 8 }}>
                    Connect your wallet to book this car.
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
