import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


/*
|--------------------------------------------------------------------------
| FRONTEND ENTRY POINT
|--------------------------------------------------------------------------
|
| This file is the starting point of the React application.
|
| Responsibilities:
| - Loads global CSS styles
| - Imports the main App component
| - Creates the React rendering root
| - Mounts the entire React app into the HTML div with id="root"
|
| Execution Flow:
| Browser -> index.js -> App.jsx -> Entire Frontend
|
| Important Concepts:
| - ReactDOM connects React with the browser DOM
| - <App /> is the root component of the frontend
| - React.StrictMode helps detect bad React patterns during development
|
| Notes:
| - No business logic should exist here
| - No API calls should exist here
| - This file should stay minimal and focused on bootstrapping the app
|
*/