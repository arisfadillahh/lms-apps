'use client';

import { Share2 } from 'lucide-react';
import { useState } from 'react';

export type StoryCompetency = {
  name: string;
  percentage: number;
  description: string;
};

type StoryShareButtonProps = {
  studentName: string;
  reportTitle: string;
  contextLabel: string;
  coachName: string;
  publishedDate: string;
  score: number;
  grade: string;
  performanceLabel: string;
  competencies: StoryCompetency[];
};

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const corner = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + corner, y);
  context.arcTo(x + width, y, x + width, y + height, corner);
  context.arcTo(x + width, y + height, x, y + height, corner);
  context.arcTo(x, y + height, x, y, corner);
  context.arcTo(x, y, x + width, y, corner);
  context.closePath();
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      continue;
    }
    if (currentLine) lines.push(currentLine);
    currentLine = word;
    if (lines.length === maxLines) break;
  }
  if (currentLine && lines.length < maxLines) lines.push(currentLine);

  const consumedWords = lines.join(' ').split(/\s+/).filter(Boolean).length;
  if (consumedWords < words.length && lines.length > 0) {
    let lastLine = lines[lines.length - 1];
    while (lastLine && context.measureText(`${lastLine}...`).width > maxWidth) {
      lastLine = lastLine.split(' ').slice(0, -1).join(' ');
    }
    lines[lines.length - 1] = `${lastLine}...`;
  }

  lines.forEach((line, index) => context.fillText(line, x, y + (index * lineHeight)));
  return y + (lines.length * lineHeight);
}

async function drawLogo(context: CanvasRenderingContext2D) {
  try {
    const response = await fetch('/logo/innovator-camp-logo-light.png');
    const bitmap = await createImageBitmap(await response.blob());
    const width = 190;
    const height = width * (bitmap.height / bitmap.width);
    context.drawImage(bitmap, 72, 74, width, height);
    bitmap.close();
  } catch {
    context.fillStyle = '#22367b';
    context.font = '800 42px Arial, sans-serif';
    context.fillText('clevio', 72, 118);
  }
}

async function createStoryImage(props: StoryShareButtonProps) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas tidak tersedia.');

  context.fillStyle = '#eef7fb';
  context.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);

  context.fillStyle = '#22367b';
  context.fillRect(0, 0, STORY_WIDTH, 540);
  context.fillStyle = '#9dc83b';
  context.fillRect(0, 532, STORY_WIDTH, 8);

  await drawLogo(context);

  context.fillStyle = '#dff2ff';
  context.font = '700 24px Arial, sans-serif';
  context.fillText(props.reportTitle.toUpperCase(), 72, 190);

  context.fillStyle = '#ffffff';
  context.font = '800 57px Arial, sans-serif';
  const nameBottom = drawWrappedText(context, props.studentName, 72, 270, 690, 66, 3);

  context.fillStyle = '#c8d7ee';
  context.font = '600 27px Arial, sans-serif';
  drawWrappedText(context, props.contextLabel, 72, nameBottom + 18, 690, 36, 2);

  context.strokeStyle = '#9dc83b';
  context.lineWidth = 18;
  context.lineCap = 'round';
  context.beginPath();
  context.arc(868, 300, 108, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * Math.min(props.score, 100) / 100));
  context.stroke();

  context.strokeStyle = 'rgba(255,255,255,0.18)';
  context.lineWidth = 18;
  context.beginPath();
  context.arc(868, 300, 108, (-Math.PI / 2) + (Math.PI * 2 * Math.min(props.score, 100) / 100), Math.PI * 1.5);
  context.stroke();

  context.textAlign = 'center';
  context.fillStyle = '#ffffff';
  context.font = '900 68px Arial, sans-serif';
  context.fillText(String(Math.round(props.score)), 868, 305);
  context.fillStyle = '#c8d7ee';
  context.font = '700 18px Arial, sans-serif';
  context.fillText('OVERALL', 868, 342);
  context.textAlign = 'left';

  roundedRect(context, 72, 582, 936, 232, 30);
  context.fillStyle = '#ffffff';
  context.fill();
  context.strokeStyle = '#dbe8f0';
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = '#9dc83b';
  roundedRect(context, 112, 622, 148, 44, 10);
  context.fill();
  context.fillStyle = '#22367b';
  context.font = '800 22px Arial, sans-serif';
  context.fillText(`GRADE ${props.grade}`, 132, 652);

  context.fillStyle = '#152c64';
  context.font = '800 40px Arial, sans-serif';
  context.fillText(props.performanceLabel, 112, 722);
  context.fillStyle = '#60728f';
  context.font = '500 24px Arial, sans-serif';
  context.fillText(`Coach ${props.coachName}  |  ${props.publishedDate}`, 112, 770);

  context.fillStyle = '#00a9ce';
  context.font = '800 22px Arial, sans-serif';
  context.fillText('KOMPETENSI UTAMA', 72, 886);
  context.fillStyle = '#152c64';
  context.font = '800 42px Arial, sans-serif';
  context.fillText('Perkembangan yang menonjol', 72, 940);

  const strongest = [...props.competencies]
    .sort((left, right) => right.percentage - left.percentage)
    .slice(0, 3);

  strongest.forEach((competency, index) => {
    const y = 996 + (index * 190);
    roundedRect(context, 72, y, 936, 158, 24);
    context.fillStyle = '#ffffff';
    context.fill();
    context.strokeStyle = '#dbe8f0';
    context.lineWidth = 2;
    context.stroke();

    context.fillStyle = ['#2563eb', '#00a9ce', '#ff9400'][index];
    roundedRect(context, 104, y + 30, 58, 58, 14);
    context.fill();
    context.fillStyle = '#ffffff';
    context.font = '800 25px Arial, sans-serif';
    context.textAlign = 'center';
    context.fillText(String(index + 1).padStart(2, '0'), 133, y + 68);
    context.textAlign = 'left';

    context.fillStyle = '#152c64';
    context.font = '700 27px Arial, sans-serif';
    drawWrappedText(context, competency.name, 188, y + 57, 610, 32, 2);
    context.textAlign = 'right';
    context.font = '900 34px Arial, sans-serif';
    context.fillText(`${competency.percentage}%`, 962, y + 62);
    context.textAlign = 'left';

    context.fillStyle = '#e8eef4';
    roundedRect(context, 188, y + 111, 774, 10, 5);
    context.fill();
    context.fillStyle = '#00b0d7';
    roundedRect(context, 188, y + 111, 774 * Math.min(competency.percentage, 100) / 100, 10, 5);
    context.fill();
  });

  const takeaway = strongest[0]?.description || 'Terus bertumbuh, berani mencoba, dan konsisten mengembangkan kemampuan terbaikmu.';
  roundedRect(context, 72, 1592, 936, 218, 30);
  context.fillStyle = '#e6f6ea';
  context.fill();
  context.strokeStyle = '#b8dfc2';
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = '#1d8c45';
  context.font = '800 22px Arial, sans-serif';
  context.fillText('CATATAN PERKEMBANGAN', 112, 1644);
  context.fillStyle = '#29405f';
  context.font = '500 25px Arial, sans-serif';
  drawWrappedText(context, takeaway, 112, 1692, 856, 34, 3);

  context.fillStyle = '#6b7e98';
  context.font = '600 21px Arial, sans-serif';
  context.fillText('Clevio Innovator Camp  |  clevio.co', 72, 1864);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Gagal membuat gambar.'))), 'image/png', 1);
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function StoryShareButton(props: StoryShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleShare = async () => {
    setIsSharing(true);
    setFeedback('');
    try {
      const blob = await createStoryImage(props);
      const safeName = props.studentName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'coder';
      const filename = `rapor-${safeName}-story.png`;
      const file = new File([blob], filename, { type: 'image/png' });
      const shareData = {
        files: [file],
        title: `Laporan perkembangan ${props.studentName}`,
        text: `Ringkasan laporan perkembangan ${props.studentName} dari Clevio.`,
      };

      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        setFeedback('Story siap dibagikan.');
      } else {
        downloadBlob(blob, filename);
        setFeedback('Gambar story sudah diunduh.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setFeedback('Gagal menyiapkan story. Silakan coba lagi.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <button
        type="button"
        onClick={handleShare}
        disabled={isSharing}
        className="inline-flex h-11 min-w-36 items-center justify-center gap-2 rounded-lg bg-[#9dc83b] px-5 text-sm font-extrabold text-[#17306b] shadow-sm transition hover:bg-[#add64d] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
      >
        <Share2 size={17} aria-hidden="true" />
        {isSharing ? 'Menyiapkan...' : 'Bagikan'}
      </button>
      <span className="min-h-4 text-xs text-white/70" role="status" aria-live="polite">{feedback}</span>
    </div>
  );
}
