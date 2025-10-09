// components/Header.jsx
export default function Header() {
  return (
    <header className="navbar">
      <div className="nav-inner">
        <div className="brand">
          <div className="brand-badge">🛒</div>
          <span>BiPi Chile</span>
        </div>
        <nav className="nav-links">
          <a href="/">Inicio</a>
          <a href="/productos">Productos</a>
        </nav>
      </div>
    </header>
  );
}
