import React, { useMemo, useState, useEffect } from "react";
import api from "../utils/api";
import { useWeb3 } from "../context/Web3Context";
import { formatAddress } from "../utils/format";
import { toast } from "react-toastify";
import styles from "./AdminPage.module.css";

const REQUEST_COPY = {
  user: {
    label: "User Verification",
    approve: "Approve User",
    reject: "Reject User",
  },
  car: {
    label: "Car Verification",
    approve: "Approve Car",
    reject: "Reject Car",
  },
};

export default function AdminPage() {
  const { account } = useWeb3();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [pendingCars, setPendingCars] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const [disputeId, setDisputeId] = useState("");
  const [favouredParty, setFavouredParty] = useState("");
  const [renterShare, setRenterShare] = useState(50);

  const requests = useMemo(() => {
    const users = pendingUsers.map((u) => ({
      id: `user:${u.wallet}`,
      type: "user",
      title: `${u.roleLabel || "User"} request`,
      subtitle: u.wallet,
      submittedBy: u.wallet,
      metadata: u.metadata,
      metadataUrl: u.metadataUrl,
      docs: u.docs || [],
      raw: u,
    }));

    const cars = pendingCars.map((c) => {
      const name = [c.metadata?.make, c.metadata?.model]
        .filter(Boolean)
        .join(" ");

      return {
        id: `car:${c.id}`,
        type: "car",
        title: name || `Car #${c.id}`,
        subtitle: `Owner ${formatAddress(c.owner)}`,
        submittedBy: c.owner,
        metadata: c.metadata,
        metadataUrl: c.metadataUrl,
        docs: c.docs || [],
        raw: c,
      };
    });

    return [...users, ...cars];
  }, [pendingUsers, pendingCars]);

  const selectedRequest =
    requests.find((request) => request.id === selectedId) ||
    requests[0] ||
    null;

  const loadData = React.useCallback(() => {
    api.get("/admin/stats").then(({ data }) => setStats(data)).catch(() => {});
    api.get("/admin/pending-users").then(({ data }) => setPendingUsers(data.users || [])).catch(() => {});
    api.get("/admin/pending-cars").then(({ data }) => setPendingCars(data.cars || [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedId && !requests.some((request) => request.id === selectedId)) {
      setSelectedId(requests[0]?.id || null);
    }
  }, [requests, selectedId]);

  const openConfirm = (action, request) => {
    setRejectReason("");
    setConfirm({ action, request });
  };

  const closeConfirm = () => {
    if (loading) return;
    setConfirm(null);
    setRejectReason("");
  };

  const runConfirmedAction = async () => {
    if (!confirm) return;

    const { action, request } = confirm;
    if (action === "reject" && !rejectReason.trim()) {
      toast.error("Please enter a rejection reason.");
      return;
    }

    setLoading(true);

    try {
      if (request.type === "user") {
        if (action === "approve") {
          await api.post("/admin/verify-user", { wallet: request.raw.wallet });
          toast.success("User approved. Their profile will update shortly.");
        } else {
          await api.post("/admin/reject-user", {
            wallet: request.raw.wallet,
            reason: rejectReason.trim(),
          });
          toast.success("User rejected.");
        }
      }

      if (request.type === "car") {
        if (action === "approve") {
          await api.post("/admin/verify-car", {
            carId: request.raw.id,
            ownerWallet: request.raw.owner,
          });
          toast.success("Car approved. Renters can see it once the chain confirms.");
        } else {
          await api.post("/admin/reject-car", {
            carId: request.raw.id,
            ownerWallet: request.raw.owner,
            reason: rejectReason.trim(),
          });
          toast.success("Car rejected.");
        }
      }

      setConfirm(null);
      setRejectReason("");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDispute = async () => {
    setLoading(true);
    try {
      await api.post("/admin/resolve-dispute", {
        rentalId: disputeId,
        favouredParty,
        renterShare,
      });
      toast.success(`Dispute #${disputeId} resolved`);
      setDisputeId("");
      setFavouredParty("");
      setRenterShare(50);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className="page-wrapper">
        <div className={styles.header}>
          <div>
            <h1>Admin Dashboard</h1>
            <p className="text-muted text-sm">Review new user and car verification requests.</p>
          </div>
          <span className={styles.wallet}>{account}</span>
        </div>

        {stats && (
          <div className={styles.statsGrid}>
            <StatCard label="New Requests" value={requests.length} />
            <StatCard label="Total Cars" value={stats.totalCars} />
            <StatCard label="Total Rentals" value={stats.totalRentals} />
          </div>
        )}

        <section className={styles.reviewSurface}>
          <div className={styles.requestPane}>
            <div className={styles.sectionTitle}>
              <span>New Requests</span>
              <span className={styles.count}>{requests.length}</span>
            </div>

            {requests.length === 0 ? (
              <div className={styles.emptyState}>
                <strong>No new requests</strong>
                <span>Pending user and car documents will appear here.</span>
              </div>
            ) : (
              <div className={styles.requestList}>
                {requests.map((request) => (
                  <button
                    key={request.id}
                    className={`${styles.requestItem} ${
                      selectedRequest?.id === request.id ? styles.selected : ""
                    }`}
                    onClick={() => setSelectedId(request.id)}
                  >
                    <span className={styles.requestType}>{REQUEST_COPY[request.type].label}</span>
                    <strong>{request.title}</strong>
                    <span>{request.subtitle}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.detailPane}>
            {selectedRequest ? (
              <RequestDetails
                request={selectedRequest}
                onApprove={() => openConfirm("approve", selectedRequest)}
                onReject={() => openConfirm("reject", selectedRequest)}
                loading={loading}
              />
            ) : (
              <div className={styles.emptyState}>
                <strong>Select a request</strong>
                <span>Uploaded documents and metadata will be shown here.</span>
              </div>
            )}
          </div>
        </section>

        <section className={styles.disputeCard}>
          <h2>Resolve Dispute</h2>
          <p className="text-muted text-sm">
            Settle a disputed rental and split funds according to the review outcome.
          </p>

          <div className={styles.disputeGrid}>
            <label className="form-group">
              <span className="form-label">Rental ID</span>
              <input
                placeholder="e.g. 3"
                value={disputeId}
                onChange={(e) => setDisputeId(e.target.value)}
              />
            </label>

            <label className="form-group">
              <span className="form-label">Favoured Party Address</span>
              <input
                placeholder="0x..."
                value={favouredParty}
                onChange={(e) => setFavouredParty(e.target.value)}
              />
            </label>

            <label className="form-group">
              <span className="form-label">Renter Share: {renterShare}%</span>
              <input
                type="range"
                min={0}
                max={100}
                value={renterShare}
                onChange={(e) => setRenterShare(Number(e.target.value))}
              />
            </label>
          </div>

          <button
            className="btn btn-primary btn-sm"
            disabled={loading || !disputeId || !favouredParty}
            onClick={handleDispute}
          >
            Resolve Dispute
          </button>
        </section>
      </div>

      {confirm && (
        <ConfirmModal
          confirm={confirm}
          rejectReason={rejectReason}
          setRejectReason={setRejectReason}
          loading={loading}
          onCancel={closeConfirm}
          onConfirm={runConfirmedAction}
        />
      )}
    </div>
  );
}

function RequestDetails({ request, onApprove, onReject, loading }) {
  const copy = REQUEST_COPY[request.type];
  const metadata = request.metadata || {};
  const details =
    request.type === "car"
      ? [
          ["Make", metadata.make],
          ["Model", metadata.model],
          ["Year", metadata.year],
          ["Color", metadata.color],
          ["Description", metadata.description],
        ]
      : [
          ["Role", request.raw.roleLabel],
          ["Wallet", request.raw.wallet],
          ["Registered", metadata.registeredAt ? new Date(metadata.registeredAt).toLocaleString() : null],
        ];

  return (
    <>
      <div className={styles.detailHeader}>
        <div>
          <span className={styles.requestType}>{copy.label}</span>
          <h2>{request.title}</h2>
          <p>{request.submittedBy}</p>
        </div>
        <div className={styles.actions}>
          <button className="btn btn-primary btn-sm" disabled={loading} onClick={onApprove}>
            {copy.approve}
          </button>
          <button className="btn btn-danger btn-sm" disabled={loading} onClick={onReject}>
            {copy.reject}
          </button>
        </div>
      </div>

      <div className={styles.detailGrid}>
        {details
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className={styles.detailItem}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
      </div>

      <div className={styles.docsHeader}>
        <h3>Uploaded Documents</h3>
        {request.metadataUrl && (
          <a href={request.metadataUrl} target="_blank" rel="noreferrer">
            Raw Metadata
          </a>
        )}
      </div>

      {request.docs.length === 0 ? (
        <div className={styles.emptyState}>
          <strong>No document links found</strong>
          <span>Open raw metadata to inspect the uploaded file references.</span>
        </div>
      ) : (
        <div className={styles.docsGrid}>
          {request.docs.map((doc) => (
            <a key={`${doc.label}:${doc.cid}`} className={styles.docTile} href={doc.url} target="_blank" rel="noreferrer">
              <span>{doc.label}</span>
              <strong>{doc.cid}</strong>
            </a>
          ))}
        </div>
      )}
    </>
  );
}

function ConfirmModal({
  confirm,
  rejectReason,
  setRejectReason,
  loading,
  onCancel,
  onConfirm,
}) {
  const copy = REQUEST_COPY[confirm.request.type];
  const isReject = confirm.action === "reject";
  const title = isReject ? copy.reject : copy.approve;

  return (
    <div className={styles.modalBackdrop} role="presentation">
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2>{title}</h2>
        <p className="text-muted text-sm">
          Confirm this action for {confirm.request.title}. The result will be written on-chain.
        </p>

        {isReject && (
          <label className="form-group">
            <span className="form-label">Rejection Reason</span>
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why the request is being rejected"
            />
          </label>
        )}

        <div className={styles.modalActions}>
          <button className="btn btn-ghost btn-sm" disabled={loading} onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`btn ${isReject ? "btn-danger" : "btn-primary"} btn-sm`}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? <span className="spinner" /> : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className={styles.statCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
