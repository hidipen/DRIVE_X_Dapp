import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ethers } from "ethers";
import { useContract } from "../hooks/useContract";
import { useWeb3 } from "../context/Web3Context";
import { useAuth } from "../context/AuthContext";
import api, { uploadApi } from "../utils/api";
import { toast } from "react-toastify";
import styles from "./RegisterPage.module.css";

const ROLES = [
  { value: 1, label: "Renter",       desc: "I want to rent cars from owners." },
  { value: 2, label: "Owner",        desc: "I want to list my car for others." },
  { value: 3, label: "Both",         desc: "I want to rent and list cars." },
];

export default function RegisterPage() {
  const { account }       = useWeb3();
  const { isAuthenticated, signIn } = useAuth();
  const { send, read }    = useContract();
  const navigate          = useNavigate();
  const [searchParams]    = useSearchParams();

  // Detect ?upgrade=renter (Owner adding Renter role)
  const isUpgradeMode = searchParams.get("upgrade") === "renter";

  const [step,    setStep]    = useState(isUpgradeMode ? 3 : 1);
  const [loading, setLoading] = useState(false);
  const [form,    setForm]    = useState({
    role:          isUpgradeMode ? 1 : null,  // Pre-set to Renter for upgrade
    licenseNumber: "",
    docFile:       null,
    selfieFile:    null,
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Redirect to landing if wallet is not connected
  useEffect(() => {
    if (!isUpgradeMode && !account) {
      navigate("/", { replace: true });
    }
  }, [isUpgradeMode, account, navigate]);

  // In upgrade mode, auto-sign-in if needed
  useEffect(() => {
    if (isUpgradeMode && account && !isAuthenticated) {
      signIn().catch((err) => {
        console.error("Auto sign-in failed:", err);
        toast.error("Please sign in first.");
        navigate("/dashboard");
      });
    }
  }, [isUpgradeMode, account, isAuthenticated, signIn, navigate]);

  useEffect(() => {
    if (isUpgradeMode || !account || !isAuthenticated) return;

    let cancelled = false;

    read("getUser", [account])
      .then((user) => {
        if (!cancelled && user?.exists) {
          navigate("/dashboard");
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isUpgradeMode, account, isAuthenticated, read, navigate]);

  // Step 1: Ensure wallet is connected + signed in
  const handleConnectStep = async () => {
    try {
      if (!account) {
        toast.error("Please connect your wallet first.");
        return;
      }

      if (!isAuthenticated) {
        await signIn();
      }

      // Check blockchain registration
      const user = await read("getUser", [account]);

      if (user && user.exists) {
        // If already registered but not in upgrade mode, redirect
        if (!isUpgradeMode) {
          toast.info("You are already registered.");
          navigate("/dashboard");
          return;
        }
      }

      setStep(2);

    } catch (err) {
      console.error(err);
      toast.error(err.message || "Authentication failed");
    }
  };

  const handleRoleStep = () => {
    if (!form.role) { toast.error("Please select a role"); return; }
    setStep(3);
  };

  // Step 3: Conditional upload + register on-chain
  const handleRegister = async (e) => {
    e.preventDefault();
    
    setLoading(true);
    const progressToast = toast.loading(
      isUpgradeMode ? "Adding Renter role…" : "Starting registration…"
    );

    try {
      // 0. Check if user already exists
      const user = await read("getUser", [account]);
      const isExistingUser = user && user.exists;
      const currentRole = isExistingUser ? Number(user.role) : 0;
      
      let newRole = form.role;

      if (isExistingUser) {
        if (currentRole === 3 || currentRole === form.role) {
           toast.update(progressToast, {
             render: `You are already registered with the ${ROLES.find(r=>r.value === currentRole)?.label || "selected"} role.`,
             type: "info", isLoading: false, autoClose: 4000,
           });
           setLoading(false);
           return;
        }
        // Upgrade to Both
        if ((currentRole === 1 && form.role === 2) || (currentRole === 2 && form.role === 1)) {
          newRole = 3;
        }
      }

      let metaURI = "";
      let licenseHash = "";

      // Renter or Both roles need license docs
      if (form.role === 1 || form.role === 3) {
        if (!form.licenseNumber.trim()) { toast.error("License number required"); toast.dismiss(progressToast); setLoading(false); return; }
        if (!form.docFile) { toast.error("Please upload your licence document"); toast.dismiss(progressToast); setLoading(false); return; }
        if (!form.selfieFile) { toast.error("Please upload a selfie for verification"); toast.dismiss(progressToast); setLoading(false); return; }

        // 1. Upload docs to IPFS
        toast.update(progressToast, { render: "Uploading driving licence to IPFS…", isLoading: true });
        let docData;
        try {
          const fdDoc = new FormData(); fdDoc.append("file", form.docFile);
          const res = await uploadApi.post("/ipfs/upload", fdDoc, { headers: { "Content-Type": "multipart/form-data" } });
          docData = res.data;
        } catch (uploadErr) {
          const msg = uploadErr.code === "ECONNABORTED"
            ? "Licence upload timed out. Please try a smaller file or try again."
            : uploadErr.response?.data?.error || "Failed to upload licence document";
          toast.update(progressToast, { render: msg, type: "error", isLoading: false, autoClose: 6000 });
          setLoading(false);
          return;
        }

        toast.update(progressToast, { render: "Uploading selfie to IPFS…", isLoading: true });
        let selfieData;
        try {
          const fdSelfie = new FormData(); fdSelfie.append("file", form.selfieFile);
          const res = await uploadApi.post("/ipfs/upload", fdSelfie, { headers: { "Content-Type": "multipart/form-data" } });
          selfieData = res.data;
        } catch (uploadErr) {
          const msg = uploadErr.code === "ECONNABORTED"
            ? "Selfie upload timed out. Please try a smaller file or try again."
            : uploadErr.response?.data?.error || "Failed to upload selfie";
          toast.update(progressToast, { render: msg, type: "error", isLoading: false, autoClose: 6000 });
          setLoading(false);
          return;
        }

        // 2. Create metadata JSON
        toast.update(progressToast, { render: "Saving metadata to IPFS…", isLoading: true });
        try {
          const meta = { 
            licenseDoc: docData.ipfsHash, 
            selfieDoc: selfieData.ipfsHash, 
            wallet: account, 
            registeredAt: Date.now() 
          };
          const { data: metaData } = await uploadApi.post("/ipfs/upload-json", { data: meta, name: "user-meta" });
          metaURI = metaData.ipfsHash;
        } catch (metaErr) {
          toast.update(progressToast, { render: "Failed to save metadata. Please try again.", type: "error", isLoading: false, autoClose: 6000 });
          setLoading(false);
          return;
        }

        // 3. Hash license
        licenseHash = ethers.keccak256(ethers.toUtf8Bytes(form.licenseNumber.trim().toUpperCase()));
      }

      // =====================================================
      // 4. REGISTER / UPDATE USER ON-CHAIN
      // =====================================================
      // Dismiss our progress toast — send() manages its own toast lifecycle
      toast.dismiss(progressToast);

      let tx;
      try {
        if (isExistingUser) {
          tx = await send(
            "updateUserRole",
            [licenseHash, metaURI, newRole],
            {},
            isUpgradeMode ? "Adding Renter role on-chain" : "Updating user role on-chain"
          );
        } else {
          tx = await send(
            "registerUser",
            [licenseHash, metaURI, newRole],
            {},
            "Registering user on-chain"
          );
        }
      } catch (txErr) {
        console.error("Blockchain transaction failed:", txErr);
        // send() already showed its own error toast, just stop loading
        setLoading(false);
        return;
      }

      // =====================================================
      // VERIFY USER EXISTS ON-CHAIN
      // =====================================================

      // Small delay for state propagation (local node is near-instant)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      let registered = false;
      for (let i = 0; i < 3; i++) {
        try {
          const updatedUser = await read("getUser", [account]);
          if (updatedUser?.exists) {
            registered = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (err) {
          console.error("Verification retry failed:", err);
        }
      }

      // =====================================================
      // FINAL RESULT
      // =====================================================
      if (!registered) {
        toast.warning("Transaction succeeded but state is still syncing. Redirecting…");
      } else {
        toast.success(
          isUpgradeMode ? "Renter role added successfully! 🎉" : "Registration successful! 🎉"
        );
      }

      navigate("/dashboard");
    } catch (err) {
      console.error("Registration error:", err);
      toast.error(err.reason || err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Step labels for the indicator ──────────

  const stepLabels = isUpgradeMode
    ? ["Verify Identity", "Register"]
    : ["Connect Wallet", "Select Role", "Details & Register"];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>{isUpgradeMode ? "Register as a Renter" : "Create Account"}</h1>
          <p className="text-muted">
            {isUpgradeMode
              ? "Add the Renter role to your account — we need to verify your driving license."
              : "Join DriveX — the trustless P2P car rental platform"
            }
          </p>
        </div>

        {/* Step indicator */}
        {!isUpgradeMode && (
          <div className={styles.steps}>
            {stepLabels.map((label, i) => (
              <div key={label} className={`${styles.stepItem} ${step > i + 1 ? styles.done : ""} ${step === i + 1 ? styles.active : ""}`}>
                <div className={styles.stepCircle}>{step > i + 1 ? "✓" : i + 1}</div>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Step 1 — only for normal registration */}
        {!isUpgradeMode && step === 1 && (
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Connect your wallet</h3>
            <p className="text-muted" style={{ marginBottom: 24 }}>
              DriveX uses wallet-based authentication. You'll sign a message to prove ownership — no password needed.
            </p>
            {account ? (
              <div className={styles.walletConnected}>
                <span className={styles.dot} />
                <span style={{ fontFamily: "monospace" }}>{account}</span>
              </div>
            ) : (
              <p className="text-muted">No wallet connected.</p>
            )}
            <button
              className="btn btn-primary"
              style={{ marginTop: 24, width: "100%" }}
              onClick={handleConnectStep}
              disabled={!account}
            >
              {account ? "Continue →" : "Connect MetaMask first"}
            </button>
          </div>
        )}

        {/* Step 2: Role Selection — only for normal registration */}
        {!isUpgradeMode && step === 2 && (
          <div className="card">
            <h3 style={{ marginBottom: 20 }}>I want to…</h3>
            <div className={styles.roleGrid}>
              {ROLES.map((r) => (
                <div
                  key={r.value}
                  className={`${styles.roleCard} ${form.role === r.value ? styles.roleSelected : ""}`}
                  onClick={() => set("role", r.value)}
                >
                  <span className={styles.roleLabel}>{r.label}</span>
                  <span className={styles.roleDesc}>{r.desc}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 24 }} onClick={handleRoleStep}>
              Continue →
            </button>
          </div>
        )}

        {/* Step 3: Docs & Register */}
        {step === 3 && (
          <form className="card" onSubmit={handleRegister}>
            <h3 style={{ marginBottom: 20 }}>
              {isUpgradeMode ? "Renter Verification" : "Registration Details"}
            </h3>

            {(form.role === 1 || form.role === 3) ? (
              <>
                <p className="text-muted" style={{ marginBottom: 20 }}>
                  {isUpgradeMode
                    ? "To add the Renter role, we need to verify your driving license and identity."
                    : "To rent cars, we need to verify your driving license and identity."
                  }
                </p>
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label">Driving License Number</label>
                  <input
                    type="text"
                    placeholder="e.g. DL-1234567890"
                    value={form.licenseNumber}
                    onChange={(e) => set("licenseNumber", e.target.value)}
                    required
                  />
                  <span className="form-hint">This is hashed and stored on-chain. We never store raw license data.</span>
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label">Upload Driving Licence</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => set("docFile", e.target.files[0])}
                    required
                    style={{ padding: "8px" }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label className="form-label">Upload Selfie</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => set("selfieFile", e.target.files[0])}
                    required
                    style={{ padding: "8px" }}
                  />
                  <span className="form-hint">Please upload a clear selfie for identity verification.</span>
                </div>
              </>
            ) : (
              <div style={{ marginBottom: 24 }}>
                <p className="text-muted">
                  You are registering as an Owner only. You don't need to upload any identity documents right now.
                  You will provide car registration and insurance documents when you list a car.
                </p>
              </div>
            )}

            <button className="btn btn-primary" style={{ width: "100%" }} type="submit" disabled={loading}>
              {loading
                ? <><span className="spinner" /> {isUpgradeMode ? "Adding Role…" : "Registering…"}</>
                : isUpgradeMode
                  ? "Add Renter Role →"
                  : "Register on Blockchain →"
              }
            </button>

            {isUpgradeMode && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: "100%", marginTop: 12 }}
                onClick={() => navigate("/dashboard")}
              >
                ← Back to Dashboard
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
