import React, { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useRental } from "../hooks/useRental";
import { useContract } from "../hooks/useContract";
import { useWeb3 } from "../context/Web3Context";
import api from "../utils/api";
import {
  formatEth, formatTimestamp, formatAddress, timeUntil
} from "../utils/format";
import RentalStatusBadge from "../components/RentalStatusBadge";
import FuelMeter from "../components/FuelMeter";
import { toast } from "react-toastify";
import styles from "./RentalDetailPage.module.css";

export default function RentalDetailPage() {
  const { id }            = useParams();
  const { account }       = useWeb3();
  const { send }          = useContract();
  const { rental, loading, refetch } = useRental(id);

  const [otpInput,      setOtpInput]      = useState("");
  const [fuelPct,       setFuelPct]       = useState("");
  const [fuelFile,      setFuelFile]      = useState(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [ownerOTP,      setOwnerOTP]      = useState(null);

  const isOwner  = account && rental?.owner?.toLowerCase()  === account?.toLowerCase();
  const isRenter = account && rental?.renter?.toLowerCase() === account?.toLowerCase();

  const uploadFuel = async () => {
    if (!fuelFile) { toast.error("Please select a fuel photo"); return null; }
    const fd = new FormData();
    fd.append("file", fuelFile);
    const { data } = await api.post("/ipfs/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.ipfsHash;
  };

  const run = useCallback(async (fn) => {
    setActionLoading(true);
    try { await fn(); refetch(); }
    catch (err) { toast.error(err.reason || err.message || "Transaction failed"); }
    finally { setActionLoading(false); }
  }, [refetch]);

  // ── Owner: approve rental ─────────────────────
  const handleApprove = () => run(() =>
    send("approveRental", [BigInt(id)], {}, "Approving rental")
  );

  // ── Owner: generate OTP ───────────────────────
  const handleGenerateOTP = async () => {
    setActionLoading(true);
    try {
      const { data } = await api.post("/otp/generate", { rentalId: id });
      setOwnerOTP(data);
      toast.success("OTP generated! Show it to the renter.");
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Renter: confirm pickup with OTP + fuel ────
  const handleConfirmPickup = () => run(async () => {
    if (!otpInput) { throw new Error("Enter the OTP"); }
    if (!fuelPct)  { throw new Error("Enter fuel percentage"); }
    const fuelHash = await uploadFuel();
    if (!fuelHash) return;
    await send(
      "confirmPickup",
      [BigInt(id), BigInt(otpInput), fuelHash, parseInt(fuelPct)],
      {},
      "Confirming pickup"
    );
  });

  // ── Renter: initiate return ───────────────────
  const handleInitiateReturn = () => run(() =>
    send("initiateReturn", [BigInt(id)], {}, "Initiating return")
  );

  // ── Owner: confirm return with fuel ──────────
  const handleConfirmReturn = () => run(async () => {
    if (!fuelPct) { throw new Error("Enter return fuel percentage"); }
    const fuelHash = await uploadFuel();
    if (!fuelHash) return;
    await send(
      "confirmReturn",
      [BigInt(id), fuelHash, parseInt(fuelPct)],
      {},
      "Confirming return"
    );
  });

  // ── Anyone: cancel ────────────────────────────
  const handleCancel = () => run(() =>
    send("cancelRental", [BigInt(id), "Cancelled by user"], {}, "Cancelling rental")
  );

  // ── Renter: report no-show ────────────────────
  const handleNoShow = () => run(() =>
    send("reportOwnerNoShow", [BigInt(id)], {}, "Reporting no-show")
  );

  // ── Anyone: flag dispute ──────────────────────
  const handleDispute = () => run(() => {
    if (!disputeReason) throw new Error("Enter a dispute reason");
    return send("flagDispute", [BigInt(id), disputeReason], {}, "Flagging dispute");
  });

  if (loading) return (
    <div className="flex-center" style={{ minHeight: "60vh" }}>
      <span className="spinner" style={{ width: 40, height: 40 }} />
    </div>
  );

  if (!rental) return (
    <div className="flex-center" style={{ minHeight: "60vh" }}>
      <p className="text-muted">Rental not found.</p>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className="page-wrapper">
        <div className={styles.header}>
          <div>
            <div className={styles.titleRow}>
              <h1>Rental #{rental.id}</h1>
              <RentalStatusBadge status={rental.status} />
            </div>
            <p className="text-muted text-sm">Car #{rental.carId}</p>
          </div>
        </div>

        <div className={styles.layout}>
          {/* Left: details */}
          <div className={styles.main}>
            {/* Parties */}
            <div className="card">
              <h3 style={{ marginBottom: 16 }}>Parties</h3>
              <div className={styles.partyRow}>
                <div className={styles.partyItem}>
                  <span className={styles.partyLabel}>Owner</span>
                  <span className={`${styles.partyAddr} ${isOwner ? "text-accent" : ""}`}>
                    {formatAddress(rental.owner)} {isOwner && "(you)"}
                  </span>
                </div>
                <div className={styles.partyItem}>
                  <span className={styles.partyLabel}>Renter</span>
                  <span className={`${styles.partyAddr} ${isRenter ? "text-accent" : ""}`}>
                    {formatAddress(rental.renter)} {isRenter && "(you)"}
                  </span>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="card">
              <h3 style={{ marginBottom: 16 }}>Timeline</h3>
              <div className={styles.timeGrid}>
                <TimeRow label="Rental Start"    value={formatTimestamp(rental.startTime)} />
                <TimeRow label="Rental End"      value={formatTimestamp(rental.endTime)} />
                <TimeRow label="Pickup Window"
                  value={`${formatTimestamp(rental.pickup?.startTime)} → ${formatTimestamp(rental.pickup?.endTime)}`} />
                <TimeRow label="Grace Period"    value="30 minutes after window end" />
              </div>
            </div>

            {/* Fuel */}
            {(rental.pickupFuel?.percentage > 0 || rental.returnFuel?.percentage > 0) && (
              <div className="card">
                <h3 style={{ marginBottom: 20 }}>Fuel Record</h3>
                <div className={styles.fuelRows}>
                  <FuelMeter label="At Pickup"  percentage={rental.pickupFuel?.percentage} />
                  {rental.returnFuel?.percentage > 0 && (
                    <FuelMeter label="At Return" percentage={rental.returnFuel?.percentage} />
                  )}
                </div>
                {rental.pickupFuel?.ipfsHash && (
                  <a
                    href={`https://ipfs.io/ipfs/${rental.pickupFuel.ipfsHash}`}
                    target="_blank" rel="noreferrer"
                    className="text-accent text-sm"
                    style={{ display: "inline-block", marginTop: 12 }}
                  >
                    View pickup photo →
                  </a>
                )}
              </div>
            )}

            {/* Financials */}
            <div className="card">
              <h3 style={{ marginBottom: 16 }}>Financials</h3>
              <div className={styles.finRows}>
                <div className={styles.finRow}>
                  <span className="text-muted text-sm">Total Locked</span>
                  <span className="fw-600">{formatEth(rental.depositPaid)} ETH</span>
                </div>
                <div className={styles.finRow}>
                  <span className="text-muted text-sm">Rental Cost</span>
                  <span>{formatEth(rental.totalCost)} ETH</span>
                </div>
                <div className={styles.finRow}>
                  <span className="text-muted text-sm">Deposit (refundable)</span>
                  <span>
                    {rental.depositPaid && rental.totalCost
                      ? formatEth((BigInt(rental.depositPaid) - BigInt(rental.totalCost)).toString())
                      : "—"} ETH
                  </span>
                </div>
              </div>
            </div>

            {/* Dispute */}
            {rental.disputeReason && (
              <div className="card" style={{ borderColor: "var(--red)" }}>
                <h3 style={{ color: "var(--red)", marginBottom: 8 }}>⚠ Dispute</h3>
                <p className="text-sm">{rental.disputeReason}</p>
              </div>
            )}
          </div>

          {/* Right: actions */}
          <div className={styles.sidebar}>
            <div className="card">
              <h3 style={{ marginBottom: 20 }}>Actions</h3>

              {/* OWNER: Approve */}
              {isOwner && rental.status === "REQUESTED" && (
                <ActionSection title="Approve Rental">
                  <p className="text-muted text-sm">Renter has sent the deposit. Approve to confirm the booking.</p>
                  <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }}
                    onClick={handleApprove} disabled={actionLoading}>
                    {actionLoading ? <span className="spinner" /> : "Approve ✓"}
                  </button>
                </ActionSection>
              )}

              {/* OWNER: Generate OTP */}
              {isOwner && rental.status === "APPROVED" && (
                <ActionSection title="Generate Pickup OTP">
                  <p className="text-muted text-sm">
                    Generate a 7-digit OTP when the renter arrives. Show it to them for verification.
                  </p>
                  <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }}
                    onClick={handleGenerateOTP} disabled={actionLoading}>
                    {actionLoading ? <span className="spinner" /> : "Generate OTP"}
                  </button>
                  {ownerOTP && (
                    <div className={styles.otpDisplay}>
                      <span className={styles.otpLabel}>OTP for Renter</span>
                      <span className={styles.otpCode}>{ownerOTP.otp}</span>
                      <span className="text-muted text-xs">Expires: {new Date(ownerOTP.expiresAt).toLocaleTimeString()}</span>
                    </div>
                  )}
                </ActionSection>
              )}

              {/* RENTER: Confirm Pickup */}
              {isRenter && rental.status === "PICKUP_PENDING" && (
                <ActionSection title="Confirm Pickup">
                  <p className="text-muted text-sm">Enter the OTP the owner gave you, and upload a fuel photo.</p>
                  <div className={styles.actionInputs}>
                    <div className="form-group">
                      <label className="form-label">OTP Code</label>
                      <input type="number" placeholder="7-digit OTP"
                        value={otpInput} onChange={e => setOtpInput(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Fuel Level (%)</label>
                      <input type="number" min={0} max={100} placeholder="e.g. 80"
                        value={fuelPct} onChange={e => setFuelPct(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Fuel Photo</label>
                      <input type="file" accept="image/*"
                        onChange={e => setFuelFile(e.target.files[0])}
                        style={{ padding: 8 }} />
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }}
                    onClick={handleConfirmPickup} disabled={actionLoading}>
                    {actionLoading ? <span className="spinner" /> : "Confirm Pickup →"}
                  </button>
                </ActionSection>
              )}

              {/* RENTER: Report No-Show */}
              {isRenter && rental.status === "PICKUP_PENDING" && (
                <ActionSection title="Owner No-Show?" style={{ marginTop: 16 }}>
                  <p className="text-muted text-sm">
                    If the pickup window has expired and the owner hasn't shown up, report it here.
                  </p>
                  <button className="btn btn-danger btn-sm" style={{ width: "100%", marginTop: 10 }}
                    onClick={handleNoShow} disabled={actionLoading}>
                    Report No-Show
                  </button>
                </ActionSection>
              )}

              {/* RENTER: Initiate Return */}
              {isRenter && rental.status === "ACTIVE" && (
                <ActionSection title="Return Car">
                  <p className="text-muted text-sm">Ready to return the car? Notify the owner.</p>
                  <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }}
                    onClick={handleInitiateReturn} disabled={actionLoading}>
                    {actionLoading ? <span className="spinner" /> : "Initiate Return"}
                  </button>
                </ActionSection>
              )}

              {/* OWNER: Confirm Return */}
              {isOwner && rental.status === "RETURN_PENDING" && (
                <ActionSection title="Confirm Return">
                  <p className="text-muted text-sm">Upload the return fuel photo to finalize the rental.</p>
                  <div className={styles.actionInputs}>
                    <div className="form-group">
                      <label className="form-label">Return Fuel Level (%)</label>
                      <input type="number" min={0} max={100} placeholder="e.g. 60"
                        value={fuelPct} onChange={e => setFuelPct(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Return Fuel Photo</label>
                      <input type="file" accept="image/*"
                        onChange={e => setFuelFile(e.target.files[0])}
                        style={{ padding: 8 }} />
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }}
                    onClick={handleConfirmReturn} disabled={actionLoading}>
                    {actionLoading ? <span className="spinner" /> : "Confirm Return & Settle ✓"}
                  </button>
                </ActionSection>
              )}

              {/* Cancel */}
              {(isOwner || isRenter) &&
               (rental.status === "REQUESTED" || rental.status === "APPROVED") && (
                <ActionSection title="Cancel Rental" style={{ marginTop: 16 }}>
                  <button className="btn btn-danger btn-sm" style={{ width: "100%" }}
                    onClick={handleCancel} disabled={actionLoading}>
                    Cancel Rental
                  </button>
                </ActionSection>
              )}

              {/* Dispute */}
              {(isOwner || isRenter) &&
               (rental.status === "ACTIVE" || rental.status === "RETURN_PENDING") && (
                <ActionSection title="Flag a Dispute" style={{ marginTop: 16 }}>
                  <div className="form-group" style={{ marginTop: 8 }}>
                    <textarea rows={2} placeholder="Describe the dispute…"
                      value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
                      style={{ resize: "vertical" }} />
                  </div>
                  <button className="btn btn-danger btn-sm" style={{ width: "100%", marginTop: 10 }}
                    onClick={handleDispute} disabled={actionLoading}>
                    Flag Dispute
                  </button>
                </ActionSection>
              )}

              {(rental.status === "COMPLETED" || rental.status === "CANCELLED") && (
                <div className={styles.finalState}>
                  <span style={{ fontSize: "2rem" }}>{rental.status === "COMPLETED" ? "✅" : "❌"}</span>
                  <span className="text-muted text-sm">
                    Rental {rental.status === "COMPLETED" ? "completed successfully" : "was cancelled"}.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionSection({ title, children, style }) {
  return (
    <div className={styles.actionSection} style={style}>
      <h4 className={styles.actionTitle}>{title}</h4>
      {children}
    </div>
  );
}

function TimeRow({ label, value }) {
  return (
    <div className={styles.timeRow}>
      <span className="text-muted text-sm" style={{ minWidth: 130 }}>{label}</span>
      <span className="text-sm fw-600">{value}</span>
    </div>
  );
}
