import Link from "next/link";

export default function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar-warning">Dette er et skoleprosjekt</div>
      <nav className="topbar-nav">
        <div className="topbar-links">
          <Link className="topbar-item" href="/">
            Home
          </Link>
          <Link className="topbar-item" href="/search">
            Search
          </Link>
          <Link className="topbar-item" href="/settings">
            Settings
          </Link>
          <Link className="topbar-item" href="/profile">
            Profile
          </Link>
        </div>
        <div className="topbar-auth">
          <Link className="topbar-item" href="/login">
            Logg inn
          </Link>
          <Link className="topbar-item" href="/signup">
            Registrer deg
          </Link>
        </div>
      </nav>
    </header>
  );
}
