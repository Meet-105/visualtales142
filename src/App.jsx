import { useState } from 'react';
import './App.css'; 

// Vite automatically reads all images in these subfolders at build time.
// Expected folder structure: src/photos/Category/Subcategory/image.jpg
// Example: src/photos/People/JohnDoe/portrait.jpg
const photoFiles = import.meta.glob('/src/photos/*/*/*.{jpg,jpeg,png}', { eager: true });

const allPhotos = Object.keys(photoFiles).map((path) => {
  const pathParts = path.split('/');
  return {
    url: photoFiles[path].default,
    category: pathParts[pathParts.length - 3],    // e.g., 'Nature' or 'People'
    subcategory: pathParts[pathParts.length - 2], // e.g., 'Flowers' or 'Face1'
    filename: pathParts[pathParts.length - 1]
  };
});

export default function Portfolio() {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);

  const categories = [...new Set(allPhotos.map(p => p.category))];
  
  let displayedPhotos = allPhotos;
  if (activeTab === 'categories' && selectedCategory) {
    displayedPhotos = allPhotos.filter(p => p.category === selectedCategory);
    if (selectedSubcategory) {
      displayedPhotos = displayedPhotos.filter(p => p.subcategory === selectedSubcategory);
    }
  }

  return (
    <div className="portfolio-container">
      <header>
        <h1>Meet's Photography Portfolio</h1>
        <section className="about-section">
          <h2>About Me</h2>
          <p>Professional Photographer.</p>
        </section>
      </header>

      <div className="tabs">
        <button className={activeTab === 'all' ? 'active' : ''} onClick={() => { setActiveTab('all'); setSelectedCategory(null); setSelectedSubcategory(null); }}>
          All Photos
        </button>
        <button className={activeTab === 'categories' ? 'active' : ''} onClick={() => setActiveTab('categories')}>
          Categories
        </button>
      </div>

      {activeTab === 'categories' && (
        <div className="filters">
          <div className="category-row">
            {categories.map(cat => (
              <button key={cat} className={selectedCategory === cat ? 'active' : ''} onClick={() => { setSelectedCategory(cat); setSelectedSubcategory(null); }}>
                {cat}
              </button>
            ))}
          </div>

          {selectedCategory && (
            <div className="subcategory-row">
              {[...new Set(allPhotos.filter(p => p.category === selectedCategory).map(p => p.subcategory))].map(sub => (
                <button key={sub} className={selectedSubcategory === sub ? 'active' : ''} onClick={() => setSelectedSubcategory(sub)}>
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {displayedPhotos.length === 0 && (
        <div className="empty-state">
          <p>No photos found. Add photos to src/photos/Category/Subcategory/</p>
        </div>
      )}

      <div className="photo-grid">
        {displayedPhotos.map((photo, i) => (
          <div key={i} className="photo-item">
            <img src={photo.url} alt={photo.filename} loading="lazy" />
            <div className="photo-overlay">
                <span>{photo.subcategory}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
