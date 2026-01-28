import Link from "next/link";

export default function TopBar() {
  return (
    <header className="topbar">
      <nav className="topbar-nav">
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
      </nav>
    </header>
  );
}
