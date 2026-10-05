import React from "react";
export default class PortalErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error("Doctor portal rendering error", error); }
  render() { return this.state.failed ? <main className="dp-session-page"><h1>This page couldn't load</h1><p>Your saved records are still available. Reload the page to try again.</p><button className="dp-btn dp-btn-primary" onClick={() => window.location.reload()}>Reload Portal</button></main> : this.props.children; }
}
