export default function Weather() {
  return (
        <div style={{ minHeight: "100vh", background: "#b8b2b2ff" }}>
      <header className="topbar">
  <span className="topbar-left-text">Dette er et skoleprosjekt</span>
  <nav className="topbar-nav">
    <Link className="topbar-item" href="/">Home</Link>
    <Link className="topbar-item" href="/search">Search</Link>
    <Link className="topbar-item" href="/settings">Settings</Link>
    <Link className="topbar-item" href="/profile">Profile</Link>
  </nav>
</header>

      <h1>Vaer</h1>
      <p>Se dagens og ukens vaermelding her.</p>
    </div>
  );
}
