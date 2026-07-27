import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useWeb3 } from "../context/Web3Context";
import { isAdminWallet } from "../utils/admin";

export default function AdminRoute() {
  const { account } = useWeb3();

  if (!isAdminWallet(account)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
