import { useState, useEffect, useCallback } from 'react';
import * as faceapi from 'face-api.js';
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

const DISTANCE_THRESHOLD = 0.45;

function clusterFaces(detections) {
  const groups = [];
  for (const det of detections) {
    const desc = Array.from(det.descriptor);
    let bestGroup = null;
    let bestDist = DISTANCE_THRESHOLD;
    for (const group of groups) {
      // Must match ALL existing faces in the group (strict)
      const distances = group.descriptors.map((d) =>
        faceapi.euclideanDistance(d, desc)
      );
      const maxDist = Math.max(...distances);
      // Only join if the face is close to EVERY member
      if (maxDist < DISTANCE_THRESHOLD && maxDist < bestDist) {
        bestDist = maxDist;
        bestGroup = group;
      }
    }
    if (bestGroup) {
      bestGroup.photos.push(det);
      bestGroup.descriptors.push(desc);
    } else {
      groups.push({
        descriptors: [desc],
        photos: [det],
      });
    }
  }
  return groups;
}

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState('about');
  const [lightbox, setLightbox] = useState(null);
  const [personas, setPersonas] = useState([]);
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [faceLoading, setFaceLoading] = useState(false);
  const [faceProgress, setFaceProgress] = useState('');
  const [modelsLoaded, setModelsLoaded] = useState(false);

  const BASE = import.meta.env.BASE_URL;

  const loadModels = useCallback(async () => {
    if (modelsLoaded) return;
    const MODEL_URL = `${BASE}models`;
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    setModelsLoaded(true);
  }, [modelsLoaded, BASE]);

  function resizeForDetection(img, maxDim = 1200) {
    const { width, height } = img;
    if (width <= maxDim && height <= maxDim) return img;
    const scale = maxDim / Math.max(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  async function scanFaces() {
    setFaceLoading(true);
    setFaceProgress('Loading face recognition models…');
    await loadModels();

    const detections = [];
    for (let i = 0; i < allPhotos.length; i++) {
      const photo = allPhotos[i];
      setFaceProgress(`Scanning photo ${i + 1} of ${allPhotos.length}…`);
      try {
        const img = await faceapi.fetchImage(photo.url);
        const input = resizeForDetection(img);
        const results = await faceapi
          .detectAllFaces(input)
          .withFaceLandmarks()
          .withFaceDescriptors();
        for (const r of results) {
          const box = r.detection.box;
          // Crop face with padding for a nice avatar
          const pad = Math.max(box.width, box.height) * 0.5;
          const sx = Math.max(0, box.x - pad);
          const sy = Math.max(0, box.y - pad);
          const sw = Math.min(input.width || img.width, box.width + pad * 2);
          const sh = Math.min(input.height || img.height, box.height + pad * 2);
          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = 128;
          cropCanvas.height = 128;
          const cctx = cropCanvas.getContext('2d');
          cctx.drawImage(input, sx, sy, sw, sh, 0, 0, 128, 128);
          detections.push({
            photoUrl: photo.url,
            filename: photo.filename,
            descriptor: r.descriptor,
            box,
            faceThumb: cropCanvas.toDataURL('image/jpeg', 0.85),
          });
        }
      } catch (err) {
        console.warn(`Skipped ${photo.filename}:`, err);
      }
    }

    setFaceProgress('Grouping faces…');
    const groups = clusterFaces(detections);
    setPersonas(
      groups
        .filter((g) => g.photos.length > 0)
        .map((g, i) => ({
          id: i,
          label: `Person ${i + 1}`,
          thumbUrl: g.photos[0].faceThumb,
          photos: g.photos,
        }))
    );
    setFaceLoading(false);
    setFaceProgress('');
  }

  useEffect(() => {
    if (activeTab === 'work' && personas.length === 0 && !faceLoading) {
      scanFaces();
    }
  }, [activeTab]);

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

          {/* ── People Section ── */}
          {faceLoading && (
            <div className="persona-loading glass-card">
              <div className="spinner" />
              <p>{faceProgress}</p>
            </div>
          )}

          {!faceLoading && personas.length > 0 && (
            <div className="personas-inline">
              <h3 className="personas-inline-title">
                People
                {selectedPersona && (
                  <button className="back-btn" onClick={() => setSelectedPersona(null)}>
                    Show all photos
                  </button>
                )}
              </h3>
              <div className="persona-row">
                {personas.map((p) => (
                  <div
                    key={p.id}
                    className={`persona-chip ${selectedPersona?.id === p.id ? 'persona-chip-active' : ''}`}
                    onClick={() => setSelectedPersona(selectedPersona?.id === p.id ? null : p)}
                  >
                    <div className="persona-avatar">
                      <img src={p.thumbUrl} alt={p.label} />
                    </div>
                    <span className="persona-chip-label">{p.label}</span>
                    <span className="persona-chip-count">{p.photos.length}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Photo Grid ── */}
          <div className="photo-grid">
            {(selectedPersona
              ? selectedPersona.photos.map((det) => ({ url: det.photoUrl, filename: det.filename }))
              : allPhotos
            ).map((photo, i) => (
              <div
                key={i}
                className="photo-item"
                onClick={() => setLightbox(photo)}
              >
                <img src={photo.url} alt={photo.filename} loading="lazy" />
                <div className="photo-overlay">
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
