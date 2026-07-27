import React from "react";

const STATUS_CONFIG = {
  NONE:           { label: "None",           cls: "badge-gray"   },
  REQUESTED:      { label: "Requested",      cls: "badge-yellow" },
  APPROVED:       { label: "Approved",       cls: "badge-blue"   },
  PICKUP_PENDING: { label: "Pickup Pending", cls: "badge-purple" },
  ACTIVE:         { label: "Active",         cls: "badge-green"  },
  RETURN_PENDING: { label: "Return Pending", cls: "badge-orange" },
  COMPLETED:      { label: "Completed",      cls: "badge-green"  },
  CANCELLED:      { label: "Cancelled",      cls: "badge-red"    },
  DISPUTED:       { label: "Disputed",       cls: "badge-red"    },
};

export default function RentalStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.NONE;
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>;
}
