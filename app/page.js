export default function Home() {
  const APP = process.env.NEXT_PUBLIC_BIPI_NAME || 'BiPi Chile';
  const CONTACT = process.env.NEXT_PUBLIC_BIPI_CONTACT || 'bipichile2025@gmail.com';

  return (
    <main>
      {/* Título superior */}
      <h1 style={{
        fontSize: '2rem',
        fontWeight: '800',
        color: '#1E3A8A',
        textAlign: 'center',
        marginBottom: '30px'
      }}>
        Bienvenido a {APP}
      </h1>

      {/* Banner principal */}
      <section className="hero">
        <div className="hero-center">
          <div className="hero-badge">
            <span style={{ fontSize: '1.7rem' }}>🛒</span>
            <strong style={{ fontSize: '1.3rem' }}>{APP}</strong>
          </div>
          <h1>Compara precios y ahorra 💰</h1>
          <p>
            Encuentra los mejores precios de supermercados en la Región del Biobío — todo en un solo lugar.
          </p>
          <a href="/productos" className="hero-btn">
            🛍️ Ver productos
          </a>
        </div>
      </section>

      {/* Texto informativo */}
      <section style={{ textAlign: 'center', marginTop: '40px' }}>
        <p style={{ fontSize: '1rem', color: '#374151', maxWidth: '700px', margin: '0 auto' }}>
          Tu comparador de precios de supermercados en Chile. Compara productos esenciales
          como arroz, aceite, fideos, papel higiénico y más entre Lider, Jumbo, Unimarc y Santa Isabel.
        </p>

        <h3 style={{ fontWeight: '700', marginTop: '30px' }}>
          Tiendas conectadas a {APP}:
        </h3>

        <ul style={{
          listStyleType: 'disc',
          textAlign: 'left',
          margin: '20px auto',
          paddingLeft: '40px',
          maxWidth: '300px'
        }}>
          <li><a href="https://www.jumbo.cl" target="_blank" rel="noopener noreferrer">Jumbo</a> <span style={{ color: '#6b7280' }}>(jumbo)</span></li>
          <li><a href="https://www.lider.cl" target="_blank" rel="noopener noreferrer">Líder</a> <span style={{ color: '#6b7280' }}>(lider)</span></li>
          <li><a href="https://www.santaisabel.cl" target="_blank" rel="noopener noreferrer">Santa Isabel</a> <span style={{ color: '#6b7280' }}>(santa-isabel)</span></li>
          <li><a href="https://www.unimarc.cl" target="_blank" rel="noopener noreferrer">Unimarc</a> <span style={{ color: '#6b7280' }}>(unimarc)</span></li>
        </ul>

        <p style={{ color: '#6b7280', marginTop: '20px' }}>
          Contacto: {CONTACT}
        </p>
      </section>
    </main>
  );
}
