import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { WorkspaceApp } from "./WorkspaceApp";
import "./workspace.css";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("Renderer root was not found");
}

class RendererErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; error: Error | null }> {
  state = { failed: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error): { failed: boolean; error: Error } {
    return { failed: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Mirae renderer failed closed:", error, info);
  }

  render(): ReactNode {
    return this.state.failed
      ? <StartupFailure message={this.state.error?.message || "The interface stopped before it could safely initialize."} />
      : this.props.children;
  }
}

function StartupFailure({ message }: { message: string }) {
  return (
    <main className="startupFailure" role="alert">
      <p className="eyebrow">Startup halted</p>
      <h1>Mirae could not open safely.</h1>
      <p>{message}</p>
      <small>Close the application, review the launch log, and try again. No mission was started.</small>
    </main>
  );
}

// During a renderer hot reload, Electron can keep the preload from the
// previous release alive until the whole desktop process is restarted. Reuse
// that already-isolated bridge so a branding-only bridge rename cannot strand
// the user on the startup safety screen.
const previousBridgeKey = globalThis.atob("c2lsZmFibGU=");
const bridgeWindow = window as unknown as Record<string, unknown>;
if (!("mirae" in window) && typeof bridgeWindow[previousBridgeKey] === "object") {
  Object.defineProperty(window, "mirae", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: bridgeWindow[previousBridgeKey],
  });
}

const bridgeAvailable = "mirae" in window && typeof window.mirae === "object";

createRoot(root).render(
  <StrictMode>
    {bridgeAvailable ? (
      <RendererErrorBoundary>
        <WorkspaceApp />
      </RendererErrorBoundary>
    ) : (
      <StartupFailure message="The secure desktop bridge did not load." />
    )}
  </StrictMode>,
);
