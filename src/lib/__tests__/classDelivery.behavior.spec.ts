import { describe, expect, it } from 'vitest';

import {
  buildClassPreparationMessage,
  renderClassReminderMessage,
} from '@/lib/classDelivery';
import {
  DEFAULT_CLASS_REMINDER_TEMPLATES,
  getClassReminderTemplateCategory,
  resolveClassReminderTemplate,
} from '@/lib/classReminderTemplates';
import { createClassSchema } from '@/lib/validation/admin';

const baseClassInput = {
  name: 'Kelas Uji',
  type: 'EKSKUL' as const,
  coachId: '11111111-1111-4111-8111-111111111111',
  scheduleDay: 'MONDAY',
  scheduleTime: '16:00',
  startDate: '2026-08-31',
};

describe('class delivery behavior', () => {
  it('requires a meeting link for Online and location details for Offline', () => {
    const invalidOnline = createClassSchema.safeParse({ ...baseClassInput, deliveryMode: 'ONLINE' });
    const validOnline = createClassSchema.safeParse({
      ...baseClassInput,
      deliveryMode: 'ONLINE',
      zoomLink: 'https://zoom.us/j/123456',
    });
    const invalidOffline = createClassSchema.safeParse({ ...baseClassInput, deliveryMode: 'OFFLINE' });
    const validOffline = createClassSchema.safeParse({
      ...baseClassInput,
      deliveryMode: 'OFFLINE',
      locationName: 'Rumah Tebih',
      locationAddress: 'Riverside 1 Blok A7 No. 25',
      locationMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Rumah+Tebih',
    });

    expect(invalidOnline.success).toBe(false);
    expect(validOnline.success).toBe(true);
    expect(invalidOffline.success).toBe(false);
    expect(validOffline.success).toBe(true);
  });

  it('defaults the school policy and every Ekskul parent WhatsApp type off and preserves independent selections', () => {
    const defaultResult = createClassSchema.parse({
      ...baseClassInput,
      deliveryMode: 'ONLINE',
      zoomLink: 'https://zoom.us/j/123456',
    });
    const selectedResult = createClassSchema.parse({
      ...baseClassInput,
      deliveryMode: 'ONLINE',
      zoomLink: 'https://zoom.us/j/123456',
      parentWhatsappEnabled: true,
      parentWhatsappClassReminderEnabled: true,
      parentWhatsappAbsenceEnabled: false,
      parentWhatsappMakeupEnabled: true,
      parentWhatsappReportEnabled: true,
      parentWhatsappEventEnabled: false,
    });

    expect([
      defaultResult.parentWhatsappEnabled,
      defaultResult.parentWhatsappClassReminderEnabled,
      defaultResult.parentWhatsappAbsenceEnabled,
      defaultResult.parentWhatsappMakeupEnabled,
      defaultResult.parentWhatsappReportEnabled,
      defaultResult.parentWhatsappEventEnabled,
    ]).toEqual([false, false, false, false, false, false]);
    expect([
      selectedResult.parentWhatsappEnabled,
      selectedResult.parentWhatsappClassReminderEnabled,
      selectedResult.parentWhatsappAbsenceEnabled,
      selectedResult.parentWhatsappMakeupEnabled,
      selectedResult.parentWhatsappReportEnabled,
      selectedResult.parentWhatsappEventEnabled,
    ]).toEqual([true, true, false, true, true, false]);
  });

  it('renders a clean Online parent reminder with the meeting link', () => {
    expect(renderClassReminderMessage({
      template: 'Halo {parent_name}\nCoder: {student_name}\nPukul: {time}\n🔗 Zoom: {zoom_link}',
      parentName: 'Ayah/Bunda',
      studentNames: ['Alya'],
      time: '16.00',
      klass: { delivery_mode: 'ONLINE', zoom_link: 'https://zoom.us/j/123456' },
    })).toBe('Halo Ayah/Bunda\nCoder: Alya\nPukul: 16.00\n🔗 Zoom: https://zoom.us/j/123456');
  });

  it('replaces the Zoom label with real Offline location details', () => {
    expect(renderClassReminderMessage({
      template: 'Halo {parent_name}\nCoder: {student_name}\nPukul: {time}\n🔗 Zoom: {zoom_link}',
      parentName: 'Ayah/Bunda',
      studentNames: ['Alya'],
      time: '16.00',
      klass: {
        delivery_mode: 'OFFLINE',
        location_name: 'Rumah Tebih',
        location_address: 'Riverside 1 Blok A7 No. 25',
        location_maps_url: 'https://maps.google.com/?q=Rumah+Tebih',
      },
    })).toBe(
      'Halo Ayah/Bunda\nCoder: Alya\nPukul: 16.00\n📍 Lokasi: Rumah Tebih\nAlamat: Riverside 1 Blok A7 No. 25\n🗺️ Google Maps: https://maps.google.com/?q=Rumah+Tebih',
    );
  });

  it('gives program-appropriate PWA preparation copy without disabling either program', () => {
    expect(buildClassPreparationMessage({ delivery_mode: 'ONLINE' }))
      .toBe('Siapkan perangkat dan koneksi internet sebelum kelas.');
    expect(buildClassPreparationMessage({ delivery_mode: 'OFFLINE' }))
      .toBe('Cek alamat lokasi kelas di dashboard dan siapkan perjalanan.');
  });

  it('selects and renders separate Online and Offline WhatsApp reminder templates', () => {
    const onlineClass = { name: 'Scratch Online', delivery_mode: 'ONLINE' as const, zoom_link: 'https://zoom.us/j/999' };
    const offlineClass = {
      name: 'Scratch Tatap Muka',
      delivery_mode: 'OFFLINE' as const,
      location_name: 'Rumah Tebih',
      location_address: 'Riverside 1 Blok A7 No. 25',
      location_maps_url: 'https://maps.google.com/?q=Rumah+Tebih',
    };

    expect(getClassReminderTemplateCategory(onlineClass)).toBe('CLASS_REMINDER_ONLINE');
    expect(getClassReminderTemplateCategory(offlineClass)).toBe('CLASS_REMINDER_OFFLINE');

    const onlineMessage = renderClassReminderMessage({
      template: resolveClassReminderTemplate(onlineClass),
      parentName: 'Ayah/Bunda',
      studentNames: ['Alya'],
      time: '16.00',
      klass: onlineClass,
    });
    const offlineMessage = renderClassReminderMessage({
      template: resolveClassReminderTemplate(offlineClass),
      parentName: 'Ayah/Bunda',
      studentNames: ['Alya'],
      time: '16.00',
      klass: offlineClass,
    });

    expect(onlineMessage).toContain('🔗 Link kelas: https://zoom.us/j/999');
    expect(onlineMessage).not.toContain('📍 Lokasi:');
    expect(offlineMessage).toContain('📍 Lokasi: Rumah Tebih');
    expect(offlineMessage).toContain('🗺️ Google Maps: https://maps.google.com/?q=Rumah+Tebih');
    expect(offlineMessage).not.toContain('🔗 Link kelas:');
    expect(DEFAULT_CLASS_REMINDER_TEMPLATES.CLASS_REMINDER_ONLINE.content).not.toBe(DEFAULT_CLASS_REMINDER_TEMPLATES.CLASS_REMINDER_OFFLINE.content);
  });

  it('preserves a customised legacy Online template while never using it for Offline classes', () => {
    const legacy = 'Halo {parent_name}\nJadwal {student_name}\n{zoom_link}';
    expect(resolveClassReminderTemplate({ delivery_mode: 'ONLINE' }, {}, legacy)).toBe(legacy);
    expect(resolveClassReminderTemplate({ delivery_mode: 'OFFLINE' }, {}, legacy)).toBe(DEFAULT_CLASS_REMINDER_TEMPLATES.CLASS_REMINDER_OFFLINE.content);
  });
});
