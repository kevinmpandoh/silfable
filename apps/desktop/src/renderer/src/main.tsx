import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { WorkspaceApp } from "./WorkspaceApp";
import "./workspace.css";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("Renderer root was not found");
}

class RendererErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    console.error("Silfable renderer failed closed.");
  }

  render(): ReactNode {
    return this.state.failed
      ? <StartupFailure message="The interface stopped before it could safely initialize." />
      : this.props.children;
  }
}

function StartupFailure({ message }: { message: string }) {
  return (
    <main className="startupFailure" role="alert">
      <p className="eyebrow">Startup halted</p>
      <h1>Silfable could not open safely.</h1>
      <p>{message}</p>
      <small>Close the application, review the launch log, and try again. No mission was started.</small>
    </main>
  );
}

const bridgeAvailable = "silfable" in window && typeof window.silfable === "object";

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
