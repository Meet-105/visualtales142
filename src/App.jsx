import { useState } from 'react';
import './App.css'; 

// Vite reads all images from src/photos/ (any depth) at build time.
const photoFiles = import.meta.glob('/src/photos/**/*.{jpg,jpeg,png,webp}', { eager: true });

const allPhotos = Object.keys(photoFiles).map((path) => {
  const filename = path.split('/').pop();
  return {
    url: photoFiles[path].default,
    filename,
  };
});

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState('about');
  const [lightbox, setLightbox] = useState(null);

  return (
    <div className="portfolio-container">
      {/* ── Animated background glow ── */}
      <div className="bg-glow" />

      {/* ── Hero ── */}
      <header className="hero">
        <div className="hero-badge">EST. 2024</div>
        <div className="hero-content">
          <p className="hero-eyebrow">
            <span className="eyebrow-line" />
            Visual Tales
            <span className="eyebrow-line" />
          </p>
          <h1>Meet's Photography</h1>
          <div className="hero-divider">
            <span className="diamond" />
          </div>
          <p className="hero-tagline">
            Capturing moments, crafting stories — one frame at a time.
          </p>
        </div>

        <nav className="tabs">
          <button
            className={activeTab === 'about' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('about')}
          >
            <span className="tab-icon">&#9671;</span> About
          </button>
          <button
            className={activeTab === 'work' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('work')}
          >
            <span className="tab-icon">&#9670;</span> Work
          </button>
        </nav>
      </header>

      {/* ── About Tab ── */}
      {activeTab === 'about' && (
        <section className="about-section">
          <div className="about-card glass-card">
            <div className="card-accent" />
            <h2>The Story Behind the Lens</h2>
            <p>
              I'm Meet Sukhadiya, a photographer driven by light, color, and the quiet
              beauty found in everyday moments. My lens is drawn to nature,
              architecture, and the candid stories people carry with them.
            </p>
            <p>
              Every photograph I take is an attempt to freeze a feeling, not
              just a scene. I believe the best images are the ones that make
              you pause and feel something you can't quite name.
            </p>
          </div>

          <div className="about-interests glass-card">
            <div className="card-accent" />
            <h3>What I Shoot</h3>
            <div className="interest-tags">
              <span className="tag">Nature</span>
              <span className="tag">Portraits</span>
              <span className="tag">Architecture</span>
              <span className="tag">Street</span>
              <span className="tag">Travel</span>
              <span className="tag">Golden Hour</span>
            </div>
          </div>

          <div className="about-stats">
            <div className="stat glass-card">
              <span className="stat-number">{allPhotos.length}</span>
              <span className="stat-label">Photos</span>
            </div>
            <div className="stat glass-card">
              <span className="stat-number">&infin;</span>
              <span className="stat-label">Stories</span>
            </div>
            <div className="stat glass-card">
              <span className="stat-number">1</span>
              <span className="stat-label">Passion</span>
            </div>
          </div>

          <div className="about-quote">
            <blockquote>
              "Photography is the story I fail to put into words."
            </blockquote>
            <cite>— Destin Sparks</cite>
          </div>
        </section>
      )}

      {/* ── Work Tab ── */}
      {activeTab === 'work' && (
        <section className="gallery-section">
          <div className="section-header">
            <h2 className="section-title">All Photos</h2>
            <span className="photo-count">
              {allPhotos.length} {allPhotos.length === 1 ? 'photo' : 'photos'}
            </span>
          </div>

          {allPhotos.length === 0 && (
            <div className="empty-state glass-card">
              <p>No photos found.</p>
              <p className="empty-hint">
                Add images to <code>src/photos/</code> to get started.
              </p>
            </div>
          )}

          <div className="photo-grid">
            {allPhotos.map((photo, i) => (
              <div
                key={i}
                className="photo-item"
                onClick={() => setLightbox(photo)}
              >
                <img src={photo.url} alt={photo.filename} loading="lazy" />
                <div className="photo-overlay">
                  <span className="photo-name">{photo.filename}</span>
                  <span className="photo-view">Click to expand &#8599;</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Lightbox ── */}
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>&times;</button>
          <img src={lightbox.url} alt={lightbox.filename} />
        </div>
      )}

      {/* ── Footer ── */}
      <footer>
        <div className="footer-divider">
          <span className="diamond" />
        </div>
        <p>&copy; {new Date().getFullYear()} Visual Tales - All rights reserved.</p>
        <p className="footer-sub">Built with passion & light.</p>
      </footer>
    </div>
  );
}
