import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { useAuth } from "../context/AuthContext";
import styles from "./LandingPage.module.css";

const FEATURES = [
  { icon: "🔑", title: "OTP Pickup Verification",  desc: "7-digit OTP confirms physical car handover. No fake pickups." },
  { icon: "⛽", title: "Fuel Proof on IPFS",        desc: "Pickup and return fuel photos stored immutably. Auto-penalty on mismatch." },
  { icon: "🛡️", title: "Deposit Smart Contract",    desc: "Funds locked on-chain until return confirmed. No middlemen." },
  { icon: "⭐", title: "Reputation System",          desc: "Every interaction updates trust scores. Bad actors get suspended." },
  { icon: "📍", title: "GPS-Based Discovery",       desc: "Find cars near you sorted by distance. Instant booking." },
  { icon: "⚖️", title: "Dispute Resolution",         desc: "Flagged disputes go to admin arbitration with on-chain settlement." },
];

export default function LandingPage() {
  const {
    account,
    connect,
    connecting,
  } = useWeb3();
  const { isAuthenticated, signIn }      = useAuth();
  const navigate                         = useNavigate();

  const [flowLoading, setFlowLoading] = useState(false);

  const handleCTA = async () => {
    setFlowLoading(true);

    try {
      let currentAccount = account;
      let currentSigner = null;
      let currentContract = null;

      // Step 1: Connect wallet if not already connected
      if (!currentAccount) {
        const res = await connect();
        if (!res?.account) {
          setFlowLoading(false);
          return;
        }
        currentAccount = res.account;
        currentSigner = res.signer;
        currentContract = res.contract;
      }

      // Step 2: Check on-chain registration
      try {
        const chainUser = await currentContract.getUser(currentAccount);

        if (!chainUser?.exists) {
          navigate("/register");
          return;
        }
      } catch (err) {
        console.error("Error checking user registration:", err);
        navigate("/register");
        return;
      }

      // Step 3: Auto sign-in for registered users
      if (!isAuthenticated) {
        await signIn(currentSigner, currentAccount);
      }

      navigate("/dashboard");
    } catch (err) {
      console.error("Wallet connection failed:", err);
    } finally {
      setFlowLoading(false);
    }
  };

  const isLoading = connecting || flowLoading;

  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroContent}>
          <div className={styles.heroPill}>Decentralised · Trustless · Transparent</div>
          <h1 className={styles.heroTitle}>
            Peer-to-peer car rental<br />
            <span className={styles.heroAccent}>powered by blockchain</span>
          </h1>
          <p className={styles.heroSub}>
            No hidden fees. No fake pickups. No fuel disputes. DriveX uses smart contracts
            to enforce trust between owners and renters — automatically.
          </p>
          <div className={styles.heroCTAs}>
            {isAuthenticated ? (
              <>
                <Link to="/cars"      className="btn btn-primary btn-lg">Browse Cars</Link>
                <Link to="/dashboard" className="btn btn-secondary btn-lg">Dashboard</Link>
              </>
            ) : (
              <>
                <button className="btn btn-primary btn-lg" onClick={handleCTA} disabled={isLoading}>
                  {isLoading ? <span className="spinner" /> : "Connect Wallet"}
                </button>
                <Link to="/cars" className="btn btn-secondary btn-lg">Browse Cars</Link>
              </>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className={styles.statsStrip}>
          {[
            ["On-Chain",      "Rentals"],
            ["Zero",          "Middlemen"],
            ["Immutable",     "Fuel Proof"],
            ["Auto",          "Settlement"],
          ].map(([top, bot]) => (
            <div key={top} className={styles.stat}>
              <span className={styles.statTop}>{top}</span>
              <span className={styles.statBot}>{bot}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className={styles.features}>
        <div className="page-wrapper">
          <h2 className={styles.sectionTitle}>Built for real-world trust</h2>
          <p className={styles.sectionSub}>
            Every feature is designed to solve a specific fraud or dispute scenario.
          </p>
          <div className={styles.featureGrid}>
            {FEATURES.map((f) => (
              <div key={f.title} className={styles.featureCard}>
                <span className={styles.featureIcon}>{f.icon}</span>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className={styles.howItWorks}>
        <div className="page-wrapper">
          <h2 className={styles.sectionTitle}>How it works</h2>
          <div className={styles.steps}>
            {[
              { n:"01", title:"Register & Verify",  desc:"Submit your driving licence hash. Admin verifies your identity once." },
              { n:"02", title:"Browse & Book",       desc:"Find nearby cars. Select a pickup window and pay deposit on-chain." },
              { n:"03", title:"OTP Handover",        desc:"Owner generates OTP at pickup. Renter confirms on-chain — car is live." },
              { n:"04", title:"Return & Settle",     desc:"Return fuel is captured. Smart contract auto-calculates refund & penalties." },
            ].map((s) => (
              <div key={s.n} className={styles.step}>
                <span className={styles.stepNum}>{s.n}</span>
                <h4 className={styles.stepTitle}>{s.title}</h4>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className={styles.ctaBanner}>
        <div className="page-wrapper">
          <div className={styles.ctaBox}>
            <h2>Ready to drive on-chain?</h2>
            <p>Connect your MetaMask wallet and start renting or listing your car today.</p>
            <Link to="/cars" className="btn btn-primary btn-lg">Get Started →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
