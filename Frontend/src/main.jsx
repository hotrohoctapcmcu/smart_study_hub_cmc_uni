import "./styles/variables.css";
import "./styles/index.css";
import "./styles/design-system.css";
import "./styles/workspace-pages.css";
import "./styles/hub-refresh.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
