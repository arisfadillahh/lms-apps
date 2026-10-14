import type { ImgHTMLAttributes } from 'react';

// Only the local fixture replaces Next's optimizer; production keeps next/image.
export default function FixtureImage({ priority: _priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) {
  return <img {...props} />;
}
