interface PhotoGalleryProps {
  photos: string[];
  onDeletePhoto: (index: number) => void;
  onClearAll: () => void;
}

export default function PhotoGallery({ photos, onDeletePhoto, onClearAll }: PhotoGalleryProps) {
  if (photos.length === 0) {
    return (
      <div className="photo-gallery empty">
        <p className="empty-message">📷 No photos yet. Capture your first photo!</p>
      </div>
    );
  }

  const handleDownload = (photoDataUrl: string, index: number) => {
    const link = document.createElement('a');
    link.href = photoDataUrl;
    link.download = `webcam-effect-${Date.now()}-${index + 1}.png`;
    link.click();
  };

  return (
    <div className="photo-gallery">
      <div className="gallery-header">
        <h2>📸 Photo Gallery ({photos.length})</h2>
        <button className="clear-all-button" onClick={onClearAll}>
          🗑️ Clear All
        </button>
      </div>

      <div className="gallery-grid">
        {photos.map((photo, index) => (
          <div key={index} className="gallery-item">
            <img src={photo} alt={`Captured photo ${index + 1}`} />
            <div className="gallery-item-actions">
              <button
                className="download-button"
                onClick={() => handleDownload(photo, index)}
                title="Download photo"
              >
                💾
              </button>
              <button
                className="delete-button"
                onClick={() => onDeletePhoto(index)}
                title="Delete photo"
              >
                ❌
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
