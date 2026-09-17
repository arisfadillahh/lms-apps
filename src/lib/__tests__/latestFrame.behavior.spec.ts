import { describe, expect, it, vi } from 'vitest';
import { createLatestFrame } from '../latestFrame';

describe('portfolio pointer frame coalescing', () => {
  function setup() {
    const callbacks = new Map<number, FrameRequestCallback>();
    let id = 0;
    const apply = vi.fn();
    const request = vi.fn((callback: FrameRequestCallback) => {
      callbacks.set(++id, callback);
      return id;
    });
    const cancel = vi.fn((key: number) => { callbacks.delete(key); });
    const controller = createLatestFrame(apply, request, cancel);
    const tick = () => {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback(16));
    };
    return { controller, apply, request, cancel, tick };
  }

  it('renders only the latest position once per frame, then accepts the next frame', () => {
    const { controller, apply, request, tick } = setup();
    controller.schedule({ x: 10, y: 20 });
    controller.schedule({ x: 30, y: 40 });
    expect(request).toHaveBeenCalledTimes(1);
    expect(apply).not.toHaveBeenCalled();
    tick();
    expect(apply).toHaveBeenCalledExactlyOnceWith({ x: 30, y: 40 });
    controller.schedule({ x: 50, y: 60 });
    tick();
    expect(apply).toHaveBeenLastCalledWith({ x: 50, y: 60 });
    expect(apply).toHaveBeenCalledTimes(2);
  });

  it('does not overwrite reset/unmounted state with a queued position', () => {
    const { controller, apply, cancel, tick } = setup();
    controller.schedule({ x: 10, y: 20 });
    controller.cancel();
    controller.cancel();
    tick();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(apply).not.toHaveBeenCalled();
    controller.schedule({ x: 1, y: 2 });
    tick();
    expect(apply).toHaveBeenCalledExactlyOnceWith({ x: 1, y: 2 });
  });
});
