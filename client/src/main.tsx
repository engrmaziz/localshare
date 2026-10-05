import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AuthGate } from "./components/AuthGate.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { applyTheme } from "./lib/theme.ts";
import { ToastProvider } from "./lib/toast.tsx";
import "./index.css";

applyTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <AuthGate>
          <App />
        </AuthGate>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
);
