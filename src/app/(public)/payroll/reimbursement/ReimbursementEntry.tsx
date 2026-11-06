'use client';

import { useSyncExternalStore } from 'react';
import ReimbursementForm from './ReimbursementForm';
import { tokenFromFragment } from './reimbursementToken';

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}
const browserFragment = () => window.location.hash;
const serverFragment = () => null;

export default function ReimbursementEntry() {
  // The initial server/hydration snapshot has no token and renders a skeleton.
  const fragment = useSyncExternalStore<string | null>(subscribe, browserFragment, serverFragment);
  const token = fragment === null ? null : tokenFromFragment(fragment);
  return <ReimbursementForm key={fragment ?? 'hydrating'} token={token} />;
}
