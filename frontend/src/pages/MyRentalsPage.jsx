import React from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { useUserRentals } from "../hooks/useRental";
import RentalCard from "../components/RentalCard";
import styles from "./MyRentalsPage.module.css";

export default function MyRentalsPage() {
  const { account }         = useWeb3();
  const { rentalIds, loading } = useUserRentals(account);

  return (
    <div className={styles.page}>
      <div className="page-wrapper">
        <div className={styles.header}>
          <h1>My Rentals</h1>
          <p className="text-muted">{rentalIds.length} total rental{rentalIds.length !== 1 ? "s" : ""}</p>
        </div>

        {loading ? (
          <div className="flex-center" style={{ padding: "80px 0" }}>
            <span className="spinner" style={{ width: 36, height: 36 }} />
          </div>
        ) : rentalIds.length === 0 ? (
          <div className={styles.empty}>
            <span>📋</span>
            <h3>No rentals yet</h3>
            <p className="text-muted">Browse available cars and make your first booking.</p>
            <Link to="/cars" className="btn btn-primary">Browse Cars</Link>
          </div>
        ) : (
          <div className={styles.list}>
            {[...rentalIds].reverse().map((id) => (
              <RentalCard key={id} rentalId={id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
