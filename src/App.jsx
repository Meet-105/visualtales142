import { useState, useEffect, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import './App.css';
import cloudinaryManifest from './photos-manifest.json';

// Static fallback used only if the live Cloudinary listing (Netlify
// function) is unreachable, e.g. during `vite dev` without `netlify dev`.
const manifestPhotos = cloudinaryManifest;

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const UPLOADED_PHOTOS_KEY = 'visualtales142_uploaded_photos';
const LIST_PHOTOS_ENDPOINT = '/.netlify/functions/list-photos';

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
  const [uploadedPhotos, setUploadedPhotos] = useState(() => {
    try {
      const stored = localStorage.getItem(UPLOADED_PHOTOS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [uploadQueue, setUploadQueue] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [basePhotos, setBasePhotos] = useState(manifestPhotos);

  const BASE = import.meta.env.BASE_URL;
  const basePhotoUrls = new Set(basePhotos.map((p) => p.url));
  const displayPhotos = [
    ...uploadedPhotos.filter((p) => !basePhotoUrls.has(p.url)),
    ...basePhotos,
  ];

  const refreshPhotosFromCloudinary = useCallback(async () => {
    try {
      const res = await fetch(LIST_PHOTOS_ENDPOINT);
      if (!res.ok) return;
      const photos = await res.json();
      if (Array.isArray(photos) && photos.length > 0) {
        setBasePhotos(photos);
      }
    } catch {
      // Function unavailable (e.g. local `vite dev`) — keep the static fallback.
    }
  }, []);

  useEffect(() => {
    refreshPhotosFromCloudinary();
  }, [refreshPhotosFromCloudinary]);

  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadQueue(files.map((f) => ({ name: f.name, status: 'pending' })));

    const newPhotos = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadQueue((q) =>
        q.map((item, idx) => (idx === i ? { ...item, status: 'uploading' } : item))
      );
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
          { method: 'POST', body: formData }
        );
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
        const data = await res.json();
        newPhotos.push({ url: data.secure_url, filename: file.name });
        setUploadQueue((q) =>
          q.map((item, idx) => (idx === i ? { ...item, status: 'done' } : item))
        );
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err);
        setUploadQueue((q) =>
          q.map((item, idx) => (idx === i ? { ...item, status: 'error' } : item))
        );
      }
    }

    if (newPhotos.length > 0) {
      setUploadedPhotos((prev) => {
        const merged = [...newPhotos, ...prev];
        localStorage.setItem(UPLOADED_PHOTOS_KEY, JSON.stringify(merged));
        return merged;
      });
      setPersonas([]);
      // Cloudinary indexes new uploads almost instantly — refresh the live
      // listing shortly after so all visitors see it, not just this browser.
      setTimeout(refreshPhotosFromCloudinary, 2000);
    }

    setIsUploading(false);
    e.target.value = '';
    setTimeout(() => setUploadQueue([]), 3000);
  }

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
    for (let i = 0; i < displayPhotos.length; i++) {
      const photo = displayPhotos[i];
      setFaceProgress(`Scanning photo ${i + 1} of ${displayPhotos.length}…`);
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
  }, [activeTab, uploadedPhotos]);

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
          <div className="about-hero glass-card">
            <div className="card-accent" />
            <div className="about-hero-inner">
              <div className="profile-photo">
                <img src={`${BASE}Image_20260806_041229_683.jpeg`} alt="Meet Sukhadiya" />
              </div>
              <div className="about-hero-text">
                <h2>Meet Sukhadiya</h2>
                <p className="about-role">Photographer &amp; Visual Storyteller</p>
                <li>
                  <p>
                  <i>I'm a photographer driven by light, color, and the quiet
                  beauty found in everyday moments. My lens is drawn to nature,
                  architecture, and the candid stories people carry with them.</i>
                </p></li>
                <li>
                <p><i>
                  Every photograph I take is an attempt to freeze a feeling, not
                  just a scene. I believe the best images are the ones that make
                  you pause and feel something you can't quite name.
                </i></p></li>
                <li>
                <p>
                  <i>My work sits at the intersection of everyday realism and
                  dreamlike visual poetry — relying on mobile photography and
                  meticulous Lightroom post-processing to prove that art is
                  defined by perspective, not equipment.</i>
                </p></li>
                <div className="social-links">
                  <a href="https://www.instagram.com/visualtales142/" target="_blank" rel="noopener noreferrer" className="social-link">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    Instagram
                  </a>
                  <a href="https://github.com/Meet-105" target="_blank" rel="noopener noreferrer" className="social-link">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
                    GitHub
                  </a>
                  <a href="mailto:meetsukhadiya1634@gmail.com" className="social-link">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                    Email
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="about-interests">
            <h3 className="interests-title">Core Categories</h3>
            <div className="interests-grid">
              <div className="interest-card glass-card">
                <div className="card-accent" />
                <span className="interest-icon">&#127804;</span>
                <span className="interest-name">Macro &amp; Botanical Art</span>
                <span className="interest-desc">Ultra-close-up shots of floral structures &mdash; Plumeria, Bougainvillea. Freezing the short-lived, delicate details the naked eye usually misses.</span>
              </div>
              <div className="interest-card glass-card">
                <div className="card-accent" />
                <span className="interest-icon">&#128241;</span>
                <span className="interest-name">Fine-Art Mobile</span>
                <span className="interest-desc">Landscapes, street strolls &amp; candid frames captured entirely on smartphone. Professional execution beyond device limitations.</span>
              </div>
              <div className="interest-card glass-card">
                <div className="card-accent" />
                <span className="interest-icon">&#127761;</span>
                <span className="interest-name">Low-Light &amp; Nocturnal</span>
                <span className="interest-desc">Ambient night photography, twilight transitions &amp; nocturnal plant life. Pulling vibrant, rich colors out of deep shadows.</span>
              </div>
            </div>
          </div>

          <div className="about-interests">
            <h3 className="interests-title">Artistic Themes</h3>
            <div className="interests-grid">
              <div className="interest-card glass-card">
                <div className="card-accent" />
                <span className="interest-icon">&#10024;</span>
                <span className="interest-name">Visual Poetry &amp; Chasing Light</span>
                <span className="interest-desc">Tracking how light falls on everyday objects. Soft bokeh, lens flares, sun-drenched frames &amp; atmospheric warmth.</span>
              </div>
              <div className="interest-card glass-card">
                <div className="card-accent" />
                <span className="interest-icon">&#127764;</span>
                <span className="interest-name">Dark Aesthetic &amp; Moody Tones</span>
                <span className="interest-desc">Embracing a deeper, poetic melancholy. Dimmed backgrounds, desaturated secondary colors &amp; cinematic shadows via Lightroom.</span>
              </div>
              <div className="interest-card glass-card">
                <div className="card-accent" />
                <span className="interest-icon">&#8986;</span>
                <span className="interest-name">Fleeting Moments &amp; Timelessness</span>
                <span className="interest-desc">Patience, stillness &amp; the slow growth of nature. A single blooming bud or a water drop evoking peace and mindfulness.</span>
              </div>
            </div>
          </div>

          <div className="about-stats">
            <div className="stat glass-card">
              <span className="stat-number">{displayPhotos.length}</span>
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
              "A single click to make temporary beauty permanent."
            </blockquote>
            <cite>— Visual Tales</cite>
          </div>
        </section>
      )}

      {/* ── Work Tab ── */}
      {activeTab === 'work' && (
        <section className="gallery-section">
          <div className="section-header">
            <h2 className="section-title">All Photos</h2>
            <div className="section-header-actions">
              <span className="photo-count">
                {displayPhotos.length} {displayPhotos.length === 1 ? 'photo' : 'photos'}
              </span>
              <label className={`upload-btn ${isUploading ? 'upload-btn-disabled' : ''}`}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  disabled={isUploading}
                  onChange={handleFilesSelected}
                />
                {isUploading ? 'Uploading…' : '+ Upload Photos'}
              </label>
            </div>
          </div>

          {uploadQueue.length > 0 && (
            <div className="upload-progress glass-card">
              {uploadQueue.map((item, i) => (
                <div key={i} className={`upload-progress-item upload-${item.status}`}>
                  <span className="upload-progress-name">{item.name}</span>
                  <span className="upload-progress-status">{item.status}</span>
                </div>
              ))}
            </div>
          )}

          {displayPhotos.length === 0 && (
            <div className="empty-state glass-card">
              <p>No photos found.</p>
              <p className="empty-hint">
                Add images to <code>src/photos/</code> or use the upload button to get started.
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
              : displayPhotos
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
