import React from "react";
import styles from "./FuelMeter.module.css";

export default function FuelMeter({ percentage, label }) {
  const pct   = Math.min(100, Math.max(0, Number(percentage) || 0));
  const color = pct >= 50 ? "var(--accent)" : pct >= 25 ? "var(--yellow)" : "var(--red)";

  return (
    <div className={styles.wrapper}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className={styles.value} style={{ color }}>{pct}%</span>
    </div>
  );
}
