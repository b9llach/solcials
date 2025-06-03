interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

// Get image dimensions from a File object
export function getImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        aspectRatio: img.naturalWidth / img.naturalHeight
      });
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = URL.createObjectURL(file);
  });
}

// Get image dimensions from a URL
export function getImageDimensionsFromUrl(url: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        aspectRatio: img.naturalWidth / img.naturalHeight
      });
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

// Calculate responsive image dimensions
export function calculateResponsiveDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight?: number
): { width: number; height: number } {
  const aspectRatio = originalWidth / originalHeight;
  
  let width = Math.min(originalWidth, maxWidth);
  let height = width / aspectRatio;
  
  if (maxHeight && height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }
  
  return { width: Math.round(width), height: Math.round(height) };
}

// Get image orientation
export function getImageOrientation(aspectRatio: number): 'landscape' | 'portrait' | 'square' {
  if (aspectRatio > 1.1) return 'landscape';
  if (aspectRatio < 0.9) return 'portrait';
  return 'square';
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Check if image needs compression
export function shouldCompressImage(file: File, maxSizeBytes: number = 5 * 1024 * 1024): boolean {
  return file.size > maxSizeBytes;
}

// Get optimal display CSS classes based on image orientation
export function getImageDisplayClasses(aspectRatio: number): {
  containerClass: string;
  imageClass: string;
} {
  const orientation = getImageOrientation(aspectRatio);
  
  switch (orientation) {
    case 'landscape':
      return {
        containerClass: 'flex justify-center items-center',
        imageClass: 'w-full h-auto max-h-[300px] sm:max-h-[400px]'
      };
    case 'portrait':
      return {
        containerClass: 'flex justify-center items-center',
        imageClass: 'h-full w-auto max-w-full max-h-[400px] sm:max-h-[500px]'
      };
    case 'square':
      return {
        containerClass: 'flex justify-center items-center',
        imageClass: 'w-auto h-auto max-w-full max-h-[350px] sm:max-h-[450px]'
      };
    default:
      return {
        containerClass: 'flex justify-center items-center',
        imageClass: 'w-auto h-auto max-w-full max-h-[300px] sm:max-h-[400px]'
      };
  }
} 