import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWeb3 } from "../context/Web3Context";

export default function ProtectedRoute() {
  const { initialized, isAuthenticated } = useAuth();
  const { account, connecting }          = useWeb3();

  if (!initialized || connecting) {
    return (
      <div className="flex-center" style={{ minHeight: "60vh" }}>
        <span className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (!account || !isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
