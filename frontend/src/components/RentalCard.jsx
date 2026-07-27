import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../utils/api";
import RentalStatusBadge from "./RentalStatusBadge";
import { formatEth, formatTimestamp } from "../utils/format";
import styles from "./RentalCard.module.css";

export default function RentalCard({ rentalId }) {
  const [rental, setRental] = useState(null);

  useEffect(() => {
    api.get(`/rentals/${rentalId}`)
      .then(({ data }) => setRental(data))
      .catch(() => {});
  }, [rentalId]);

  if (!rental) return (
    <div className={styles.skeleton}>
      <span className="spinner" style={{ width: 18, height: 18 }} />
    </div>
  );

  return (
    <Link to={`/rentals/${rentalId}`} className={styles.card}>
      <div className={styles.left}>
        <div className={styles.idBadge}>#{rental.id}</div>
        <div className={styles.info}>
          <div className={styles.carLine}>
            Car <span className="text-accent">#{rental.carId}</span>
          </div>
          <div className="text-muted text-sm">
            Start: {formatTimestamp(rental.startTime)} — End: {formatTimestamp(rental.endTime)}
          </div>
        </div>
      </div>

      <div className={styles.right}>
        <RentalStatusBadge status={rental.status} />
        <div className="text-muted text-sm">{formatEth(rental.depositPaid)} ETH locked</div>
        <span className={styles.arrow}>→</span>
      </div>
    </Link>
  );
}
