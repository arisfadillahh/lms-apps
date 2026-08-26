export const DEFAULT_CLASS_LOCATION = {
  name: 'Clevio Coder Camp Bukit Golf (Rumah Tebih)',
  address: 'Bukit Golf Cibubur, Riverside 1 Blok A7 No. 25, Bojong Nangka, Gunung Putri, Bogor',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Clevio+Coder+Camp+Bukit+Golf+Cibubur+Riverside+1+Blok+A7%2F25',
} as const;

export type ClassDeliveryDetails = {
  delivery_mode?: 'ONLINE' | 'OFFLINE' | null;
  zoom_link?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  location_maps_url?: string | null;
};

export function getClassDeliveryMode(klass: ClassDeliveryDetails | null | undefined): 'ONLINE' | 'OFFLINE' {
  return klass?.delivery_mode === 'OFFLINE' ? 'OFFLINE' : 'ONLINE';
}

export function buildClassAccessDetails(klass: ClassDeliveryDetails): string {
  if (getClassDeliveryMode(klass) === 'ONLINE') {
    return klass.zoom_link?.trim() || 'Link kelas belum diatur';
  }

  const locationName = klass.location_name?.trim() || 'Lokasi kelas belum diatur';
  const address = klass.location_address?.trim();
  const mapsUrl = klass.location_maps_url?.trim();
  return [
    `📍 Lokasi: ${locationName}`,
    address ? `Alamat: ${address}` : null,
    mapsUrl ? `🗺️ Google Maps: ${mapsUrl}` : null,
  ].filter(Boolean).join('\n');
}

export function buildClassPreparationMessage(klass: ClassDeliveryDetails): string {
  return getClassDeliveryMode(klass) === 'OFFLINE'
    ? 'Cek alamat lokasi kelas di dashboard dan siapkan perjalanan.'
    : 'Siapkan perangkat dan koneksi internet sebelum kelas.';
}

export function renderClassReminderMessage(input: {
  template: string;
  parentName: string;
  studentNames: string[];
  time: string;
  klass: ClassDeliveryDetails;
}): string {
  const accessDetails = buildClassAccessDetails(input.klass);
  let template = input.template;

  if (getClassDeliveryMode(input.klass) === 'OFFLINE') {
    template = template.replace(
      /(?:🔗\s*)?(?:link\s+)?zoom\s*:\s*\{zoom_link\}|di\s*:\s*\{zoom_link\}/gi,
      accessDetails,
    );
  }

  return template
    .replaceAll('{parent_name}', input.parentName)
    .replaceAll('{student_name}', input.studentNames.join(', '))
    .replaceAll('{time}', input.time)
    .replaceAll('{zoom_link}', accessDetails)
    .replaceAll('{class_access}', accessDetails)
    .replaceAll('{delivery_mode}', getClassDeliveryMode(input.klass) === 'OFFLINE' ? 'Offline' : 'Online')
    .replaceAll('{location_name}', input.klass.location_name?.trim() || '-')
    .replaceAll('{location_address}', input.klass.location_address?.trim() || '-')
    .replaceAll('{maps_url}', input.klass.location_maps_url?.trim() || '-');
}
