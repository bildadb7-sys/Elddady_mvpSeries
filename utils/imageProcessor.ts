
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
      //    so watermarks stay visually consistent across portrait/landscape/square images
      const shortSide = Math.min(img.width, img.height);

      // Brand font: ~4% of the shorter side (min 20px, max 120px)
      const brandFontSize = Math.min(120, Math.max(20, Math.floor(shortSide * 0.04)));
      // Handle font: 60% of brand size
      const handleFontSize = Math.floor(brandFontSize * 0.6);
      // Margin: 2.5% of shorter side (min 10px)
      const margin = Math.max(10, Math.floor(shortSide * 0.025));

      // 3. Configure text style
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'right';

      // Position: bottom-right with proportional margin
      const x = canvas.width - margin;

      // 4. Draw user handle first (lower line) if provided
      let handleLineHeight = 0;
      if (userHandle) {
        const handle = userHandle.startsWith('@') ? userHandle : `@${userHandle}`;
        ctx.font = `italic ${handleFontSize}px 'Brush Script MT', 'Segoe Script', 'Apple Chancery', cursive`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.50)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 1;

        const handleY = canvas.height - margin;
        ctx.strokeText(handle, x, handleY);
        ctx.fillText(handle, x, handleY);
        handleLineHeight = handleFontSize + Math.floor(handleFontSize * 0.25);
      }

      // 5. Draw "Elddady" brand name (upper line)
      ctx.font = `bold ${brandFontSize}px 'Brush Script MT', 'Segoe Script', 'Apple Chancery', cursive`;
      // Elddady system orange (#E86C44) at 45% opacity
      ctx.fillStyle = 'rgba(232, 108, 68, 0.45)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.lineWidth = 1;

      const brandY = canvas.height - margin - handleLineHeight;
      ctx.strokeText('Elddady', x, brandY);
      ctx.fillText('Elddady', x, brandY);

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
