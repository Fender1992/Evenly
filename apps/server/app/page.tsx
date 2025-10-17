/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Evenly Server</h1>
      <p>API server for Evenly expense splitting app</p>
      <div style={{ marginTop: '2rem' }}>
        <h2>Status</h2>
        <p>✅ Server is running</p>
      </div>
      <div style={{ marginTop: '1rem' }}>
        <h3>API Endpoints (will be implemented in Phase 3)</h3>
        <ul>
          <li>POST /api/auth/callback</li>
          <li>POST /api/plaid/link-token</li>
          <li>POST /api/plaid/exchange</li>
          <li>POST /api/plaid/webhook</li>
          <li>GET /api/household/:id/summary</li>
          <li>POST /api/rules</li>
          <li>POST /api/settlements</li>
          <li>POST /api/splits/recompute</li>
        </ul>
      </div>
    </main>
  );
}
