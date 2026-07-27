import React from "react";
import { Link } from "react-router-dom";
import { formatEth, formatAddress } from "../utils/format";
import styles from "./CarCard.module.css";

export default function CarCard({ car }) {
  const metaName = car.metadataURI?.startsWith("ipfs://")
    ? `Car #${car.id}`
    : car.name || `Car #${car.id}`;

  return (
    <div className={styles.card}>
      {/* Image placeholder / IPFS thumbnail */}
      <div className={styles.imgBox}>
        <div className={styles.imgPlaceholder}>
          <span>🚗</span>
        </div>
        {car.status === "AVAILABLE" && (
          <span className={`badge badge-green ${styles.statusBadge}`}>Available</span>
        )}
        {car.status === "RENTED" && (
          <span className={`badge badge-red ${styles.statusBadge}`}>Rented</span>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.header}>
          <h3 className={styles.title}>{metaName}</h3>
          {car.distanceKm !== undefined && (
            <span className={styles.distance}>{car.distanceKm} km away</span>
          )}
        </div>

        <p className={styles.owner}>
          Owner: <span className="text-accent">{formatAddress(car.owner)}</span>
        </p>

        <div className={styles.pricing}>
          <div className={styles.priceItem}>
            <span className={styles.priceLabel}>Per hour</span>
            <span className={styles.priceValue}>{formatEth(car.pricePerHour)} ETH</span>
          </div>
          <div className={styles.priceDivider} />
          <div className={styles.priceItem}>
            <span className={styles.priceLabel}>Deposit</span>
            <span className={styles.priceValue}>{formatEth(car.securityDeposit)} ETH</span>
          </div>
        </div>

        <Link to={`/cars/${car.id}`} className={`btn btn-primary btn-sm ${styles.cta}`}>
          View Details →
        </Link>
      </div>
    </div>
  );
}
