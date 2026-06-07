
/**
 * Elddady Image Processing Utility
 * Handles client-side watermarking and optimization
 */

/**
 * Applies a branded watermark to an image file.
 * Uses a script-style font with dynamic sizing based on the uploaded media dimensions.
 * Displays "Elddady" brand name and the uploader's handle.
 *
 * @param file The original image file from an input field
 * @param userHandle The handle of the uploading user (e.g. "@ciber_crack")
 * @returns A promise that resolves to a watermarked JPEG Blob
 */
export const applyWatermark = (file: File, userHandle?: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      // Create canvas at native image resolution
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject(new Error("Failed to get canvas context"));
      }

      // 1. Draw original image
      ctx.drawImage(img, 0, 0);

      // 2. Calculate dynamic sizing based on the shorter dimension
      // This ensures consistent visual scale regardless of absolute pixel dimensions
      const shortSide = Math.min(img.width, img.height);
      const brandFontSize = Math.max(16, Math.floor(shortSide * 0.04)); // 4% of shorter side
      const handleFontSize = Math.max(10, Math.floor(brandFontSize * 0.6)); // 60% of brand size
      const marginX = Math.max(16, Math.floor(shortSide * 0.04)); // 4% margin from edge
      const marginY = Math.max(8, Math.floor(shortSide * 0.02)); // 2% margin from bottom edge

      // 3. Configure text style
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'right';

      // Position: bottom-right with proportional margin
      const x = canvas.width - marginX;

      // 4. Draw user handle first (lower line) if provided
      let handleLineHeight = 0;
      if (userHandle) {
        const handle = userHandle.startsWith('@') ? userHandle : `@${userHandle}`;
        ctx.font = `bold ${handleFontSize}px 'Lastica', sans-serif`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)'; // High opacity black
        
        // Whitish shadow for the handle
        ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
        ctx.shadowBlur = Math.max(4, Math.floor(handleFontSize * 0.15));
        ctx.shadowOffsetX = Math.max(1, Math.floor(handleFontSize * 0.05));
        ctx.shadowOffsetY = Math.max(1, Math.floor(handleFontSize * 0.05));

        const handleY = canvas.height - marginY;
        ctx.fillText(handle, x, handleY);
        handleLineHeight = handleFontSize + Math.floor(handleFontSize * 0.5);
      }

      // 5. Draw "ELDDADY" brand name (upper line)
      ctx.font = `bold ${brandFontSize}px 'HK MODULAR', sans-serif`;
      ctx.fillStyle = 'rgba(232, 108, 68, 0.95)'; // High opacity brand orange (#E86C44)
      
      // Advanced industrial shadow for maximum clarity on any background
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = Math.max(4, Math.floor(brandFontSize * 0.15));
      ctx.shadowOffsetX = Math.max(2, Math.floor(brandFontSize * 0.05));
      ctx.shadowOffsetY = Math.max(2, Math.floor(brandFontSize * 0.05));

      const brandY = canvas.height - marginY - handleLineHeight;
      ctx.fillText('ELDDADY', x, brandY);

      // 6. Export as high-quality JPEG
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        },
        'image/jpeg',
        0.9 // 90% quality for optimization
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for watermarking"));
    };

    img.src = url;
  });
};
