import { Buffer } from 'node:buffer';

import puppeteer from 'puppeteer-core';

import { reportsDao, rubricsDao } from '@/lib/dao';
import type { RubricSubmissionDetail } from '@/lib/dao/rubricsDao';
import { uploadReportPdf } from '@/lib/storage';

import { renderRubricHtml } from './renderRubricPdf';

export async function generateRubricPdf(submissionId: string) {
  const detail = await rubricsDao.getRubricSubmissionDetail(submissionId);
  if (!detail) {
    throw new Error('Rubric submission not found');
  }

  const payload = buildPdfPayload(detail);
  const html = renderRubricHtml(payload);
  const pdfBuffer = await renderPdfBuffer(html);

  const storagePath = buildStoragePath(detail);
  const pdfUrl = await uploadReportPdf(storagePath, pdfBuffer);
  const report = await reportsDao.upsertPitchingDayReport({
    rubricSubmissionId: submissionId,
    pdfUrl,
    storagePath,
  });

  return { report, pdfUrl, storagePath };
}

function buildPdfPayload(detail: RubricSubmissionDetail) {
  const competenciesJson = detail.template.competencies as unknown;
  const competencies =
    (competenciesJson && typeof competenciesJson === 'object'
      ? (competenciesJson as Record<string, { label: string; descriptions: Record<'A' | 'B' | 'C', string> }>)
      : {}) ?? {};

  const grades = (detail.submission.grades as unknown as Record<string, string>) ?? {};

  return {
    className: detail.class.name,
    classType: detail.class.type,
    coderName: detail.coder.full_name,
    coachName: detail.coach.full_name,
    submittedAt: detail.submission.submitted_at ?? new Date().toISOString(),
    blockName: detail.blockName ?? undefined,
    semesterTag: detail.submission.semester_tag ?? undefined,
    grades,
    competencies,
    positiveCharacters: detail.submission.positive_character_chosen ?? [],
    narrative: detail.submission.narrative ?? '',
  };
}

async function renderPdfBuffer(html: string): Promise<Buffer> {
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ?? process.env.CHROME_BIN ?? process.env.CHROMIUM_PATH;

  if (!executablePath) {
    throw new Error('Missing PUPPETEER_EXECUTABLE_PATH/CHROME_BIN for PDF generation');
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    const baseUrl = process.env.PDF_BASE_URL ?? 'http://localhost';
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('screen');
    await page.evaluate((origin) => {
      const base = document.createElement('base');
      base.href = origin;
      document.head.appendChild(base);
    }, baseUrl);

    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '16mm',
        right: '16mm',
      },
    });
    return Buffer.from(pdfUint8);
  } finally {
    await browser.close();
  }
}

function buildStoragePath(detail: RubricSubmissionDetail): string {
  const classId = detail.class.id;
  const submissionId = detail.submission.id;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `reports/${classId}/${submissionId}-${timestamp}.pdf`;
}
