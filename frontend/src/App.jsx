import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { Web3Provider } from "./context/Web3Context";
import { AuthProvider } from "./context/AuthContext";

import Navbar          from "./components/Navbar";
import ProtectedRoute  from "./components/ProtectedRoute";
import AdminRoute      from "./components/AdminRoute";

import LandingPage     from "./pages/LandingPage";
import RegisterPage    from "./pages/RegisterPage";
import DashboardPage   from "./pages/DashboardPage";
import CarsPage        from "./pages/CarsPage";
import CarDetailPage   from "./pages/CarDetailPage";
import RegisterCarPage from "./pages/RegisterCarPage";
import RentalDetailPage from "./pages/RentalDetailPage";
import MyRentalsPage   from "./pages/MyRentalsPage";
import AdminPage       from "./pages/AdminPage";

export default function App() {
  return (
    <Web3Provider>
      <AuthProvider>
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/"              element={<LandingPage />} />
            <Route path="/register"      element={<RegisterPage />} />
            <Route path="/cars"          element={<CarsPage />} />
            <Route path="/cars/:id"      element={<CarDetailPage />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard"          element={<DashboardPage />} />
              <Route path="/my-rentals"         element={<MyRentalsPage />} />
              <Route path="/rentals/:id"        element={<RentalDetailPage />} />
              <Route path="/register-car"       element={<RegisterCarPage />} />
              <Route element={<AdminRoute />}>
                <Route path="/admin"            element={<AdminPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <ToastContainer position="bottom-right" theme="dark" />
      </AuthProvider>
    </Web3Provider>
  );
}

/*
|--------------------------------------------------------------------------
| MAIN FRONTEND APPLICATION SHELL
|--------------------------------------------------------------------------
|
| This file defines the overall frontend structure of the application.
|
| Responsibilities:
| - Wraps the app with global providers (Web3 + Auth)
| - Enables React Router navigation
| - Defines all frontend routes/pages
| - Protects authenticated routes using ProtectedRoute
| - Mounts persistent UI components like Navbar
| - Enables global toast notifications
|
| Architecture:
| index.js -> App.jsx -> Routes -> Pages -> Components
|
| Important Concepts:
| - BrowserRouter enables SPA routing
| - Route maps URL paths to React pages
| - ProtectedRoute restricts access to authenticated users
| - Context Providers create global shared state
| - ToastContainer enables app-wide notifications
|
| Public Routes:
| - Landing page
| - Car browsing
| - Registration
|
| Protected Routes:
| - Dashboard
| - Rentals
| - Car registration
| - Admin dashboard
|
| Notes:
| - Navbar persists across all pages
| - Unknown routes redirect to homepage
| - Future role-based access control will likely expand here
|
*/
