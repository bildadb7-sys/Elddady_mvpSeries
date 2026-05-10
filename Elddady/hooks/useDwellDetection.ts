
import { useEffect, useRef } from 'react';

/**
 * useDwellDetection
 * Triggers a callback when the target element is visible in the viewport
 * for longer than the specified threshold.
 * 
 * @param callback - Function to execute when dwell is detected
 * @param thresholdMs - Duration in ms (default 3000ms)
 * @param visibilityThreshold - Intersection Observer threshold (default 0.7 or 70%)
 */
export const useDwellDetection = (
  callback: () => void,
  thresholdMs: number = 3000,
  visibilityThreshold: number = 0.7
) => {
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Element is visible
            if (!hasTriggeredRef.current && !timerRef.current) {
              timerRef.current = setTimeout(() => {
                hasTriggeredRef.current = true; // Prevent multiple triggers for same view
                callback();
              }, thresholdMs);
            }
          } else {
            // Element left viewport, cancel timer
            if (timerRef.current) {
              clearTimeout(timerRef.current);
              timerRef.current = null;
            }
          }
        });
      },
      { threshold: visibilityThreshold }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) observer.unobserve(currentRef);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [callback, thresholdMs, visibilityThreshold]);

  return ref;
};
