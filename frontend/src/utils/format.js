import { ethers } from "ethers";

export const formatEth = (wei) => {
  if (!wei) return "0";
  return parseFloat(ethers.formatEther(wei.toString())).toFixed(4);
};

export const formatAddress = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

export const formatTimestamp = (ts) => {
  if (!ts || ts === 0) return "—";
  return new Date(Number(ts) * 1000).toLocaleString();
};

export const formatDate = (ts) => {
  if (!ts || ts === 0) return "—";
  return new Date(Number(ts) * 1000).toLocaleDateString();
};

export const timeUntil = (ts) => {
  const diff = Number(ts) * 1000 - Date.now();
  if (diff <= 0) return "Expired";
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
};

export const STATUS_COLORS = {
  NONE:           "#6b7280",
  REQUESTED:      "#f59e0b",
  APPROVED:       "#3b82f6",
  PICKUP_PENDING: "#8b5cf6",
  ACTIVE:         "#10b981",
  RETURN_PENDING: "#f97316",
  COMPLETED:      "#22c55e",
  CANCELLED:      "#ef4444",
  DISPUTED:       "#dc2626",
};

export const ROLE_LABELS = {
  NONE:   "None",
  RENTER: "Renter",
  OWNER:  "Owner",
  BOTH:   "Owner & Renter",
};

export const toChainCoord = (val) => Math.round(parseFloat(val) * 1e6);
export const fromChainCoord = (val) => Number(val) / 1e6;
