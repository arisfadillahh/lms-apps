type InlinePropertySnapshot = {
  value: string;
  priority: string;
};

export const DOCUMENT_SCROLL_LOCK_CLASS = 'document-scroll-locked';

function captureProperty(element: HTMLElement, property: string): InlinePropertySnapshot {
  return {
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  };
}

function restoreProperty(element: HTMLElement, property: string, snapshot: InlinePropertySnapshot) {
  if (snapshot.value) {
    element.style.setProperty(property, snapshot.value, snapshot.priority);
    return;
  }

  element.style.removeProperty(property);
}

export function lockDocumentScroll() {
  const html = document.documentElement;
  const body = document.body;
  const properties = ['overflow', 'overflow-x', 'overflow-y', 'overscroll-behavior'] as const;
  const htmlSnapshot = new Map(properties.map((property) => [property, captureProperty(html, property)]));
  const bodySnapshot = new Map(properties.map((property) => [property, captureProperty(body, property)]));

  html.classList.add(DOCUMENT_SCROLL_LOCK_CLASS);
  body.classList.add(DOCUMENT_SCROLL_LOCK_CLASS);
  html.style.setProperty('overflow', 'hidden', 'important');
  html.style.setProperty('overflow-x', 'hidden', 'important');
  html.style.setProperty('overflow-y', 'hidden', 'important');
  html.style.setProperty('overscroll-behavior', 'none', 'important');
  body.style.setProperty('overflow', 'hidden', 'important');
  body.style.setProperty('overflow-x', 'hidden', 'important');
  body.style.setProperty('overflow-y', 'hidden', 'important');
  body.style.setProperty('overscroll-behavior', 'none', 'important');

  return () => {
    html.classList.remove(DOCUMENT_SCROLL_LOCK_CLASS);
    body.classList.remove(DOCUMENT_SCROLL_LOCK_CLASS);
    properties.forEach((property) => {
      restoreProperty(html, property, htmlSnapshot.get(property)!);
      restoreProperty(body, property, bodySnapshot.get(property)!);
    });
  };
}
