/** Coalesce high-frequency visual input without losing the latest pointer position. */
export function createLatestFrame<T>(
  apply: (value: T) => void,
  request: (callback: FrameRequestCallback) => number = requestAnimationFrame,
  cancelRequest: (id: number) => void = cancelAnimationFrame,
) {
  let frame: number | null = null;
  let latest: T;
  return {
    schedule(value: T) {
      latest = value;
      if (frame !== null) return;
      frame = request(() => {
        frame = null;
        apply(latest);
      });
    },
    cancel() {
      if (frame !== null) cancelRequest(frame);
      frame = null;
    },
  };
}
