'use client';

import { useEffect, useMemo, useState } from 'react';

type JourneyBlock = {
  blockId: string;
  name: string;
  status: 'UPCOMING' | 'CURRENT' | 'COMPLETED';
  startDate: string;
  endDate: string;
  orderIndex: number | null;
};

type JourneyCourse = {
  classId: string;
  name: string;
  completedBlocks: number;
  totalBlocks: number | null;
  journeyBlocks: JourneyBlock[];
};

type JourneyMapProps = {
  courses: JourneyCourse[];
};

const STATUS_STYLE = {
  COMPLETED: {
    dot: '#16a34a',
    dotBorder: '#0f9a3f',
    pillBg: 'rgba(22, 163, 74, 0.12)',
    pillText: '#166534',
  },
  CURRENT: {
    dot: '#2563eb',
    dotBorder: '#1d4ed8',
    pillBg: 'rgba(37, 99, 235, 0.12)',
    pillText: '#1d4ed8',
  },
  UPCOMING: {
    dot: '#94a3b8',
    dotBorder: '#64748b',
    pillBg: 'rgba(148, 163, 184, 0.16)',
    pillText: '#475569',
  },
} as const;

const STATUS_LABEL: Record<JourneyBlock['status'], string> = {
  COMPLETED: 'Selesai',
  CURRENT: 'Sedang berjalan',
  UPCOMING: 'Menunggu',
};

export default function JourneyMap({ courses }: JourneyMapProps) {
  if (courses.length === 0) {
    return null;
  }

  return (
    <section style={sectionStyle}>
      <h2 style={sectionHeadingStyle}>Learning Journey</h2>
      <p style={sectionSubheadingStyle}>
        Ikuti peta perjalanan belajarmu. Blok yang sudah selesai berwarna hijau, blok saat ini berwarna biru.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {courses.map((course) => (
          <CourseJourney key={course.classId} course={course} />
        ))}
      </div>
    </section>
  );
}

function CourseJourney({ course }: { course: JourneyCourse }) {
  const blocks = course.journeyBlocks;
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const progressPercent = useMemo(() => {
    if (blocks.length === 0) return 0;
    const progressUnits = blocks.reduce((acc, block, index) => {
      if (block.status === 'COMPLETED') {
        return index + 1;
      }
      if (block.status === 'CURRENT') {
        return index + 0.6;
      }
      return acc;
    }, 0);
    return Math.min(100, (progressUnits / Math.max(blocks.length, 1)) * 100);
  }, [blocks]);

  const rowMinWidth = Math.max(blocks.length * 220, 640);

  return (
    <article style={courseCardStyle}>
      <header style={courseHeaderStyle}>
        <div>
          <h3 style={courseTitleStyle}>{course.name}</h3>
          <p style={courseSubtitleStyle}>
            {course.completedBlocks}/{course.totalBlocks ?? course.journeyBlocks.length} blocks completed
          </p>
        </div>
      </header>

      <div style={mapWrapperStyle}>
        <div style={{ minWidth: `${rowMinWidth}px` }}>
          <div style={trackWrapperStyle}>
            <div style={trackBaseStyle} />
            <div
              style={{
                ...trackProgressStyle,
                width: animate ? `${progressPercent}%` : '0%',
              }}
            />
          </div>

          <div style={{ ...nodesRowStyle, minWidth: `${rowMinWidth}px` }}>
            {blocks.map((block, index) => (
              <JourneyNode
                key={`${course.classId}-${block.blockId}-${index}`}
                block={block}
                index={index}
                isLast={index === blocks.length - 1}
              />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function JourneyNode({ block, index, isLast }: { block: JourneyBlock; index: number; isLast: boolean }) {
  const palette = STATUS_STYLE[block.status];
  const isCurrent = block.status === 'CURRENT';

  return (
    <div style={nodeColumnStyle}>
      <div style={nodeMarkerWrapperStyle}>
        <div
          style={{
            ...nodeDotStyle,
            background: palette.dot,
            borderColor: palette.dotBorder,
            animation: isCurrent ? 'journey-pulse 1400ms ease-out infinite' : undefined,
          }}
        >
          {block.orderIndex != null ? block.orderIndex + 1 : index + 1}
        </div>
        {!isLast ? (
          <div style={nodeConnectorStyle}>
            <div
              style={{
                height: '100%',
                width: '100%',
                background:
                  block.status === 'COMPLETED'
                    ? 'linear-gradient(90deg, #22c55e 0%, #2563eb 100%)'
                    : 'rgba(148, 163, 184, 0.4)',
              }}
            />
          </div>
        ) : null}
      </div>

      <div style={nodeCardStyle}>
        <span
          style={{
            ...nodeStatusBadgeStyle,
            background: palette.pillBg,
            color: palette.pillText,
          }}
        >
          {STATUS_LABEL[block.status]}
        </span>
        <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>{block.name}</strong>
        <span style={{ fontSize: '0.75rem', color: '#475569' }}>
          {new Date(block.startDate).toLocaleDateString()} – {new Date(block.endDate).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '0.85rem',
  border: '1px solid #e5e7eb',
  padding: '1.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 600,
  color: '#0f172a',
};

const sectionSubheadingStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#64748b',
};

const courseCardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '0.8rem',
  padding: '1.15rem',
  background: '#f8fafc',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.1rem',
};

const courseHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  flexWrap: 'wrap',
  gap: '0.75rem',
};

const courseTitleStyle: React.CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 600,
  color: '#0f172a',
};

const courseSubtitleStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#64748b',
};

const mapWrapperStyle: React.CSSProperties = {
  overflowX: 'auto',
  paddingBottom: '0.5rem',
};

const trackWrapperStyle: React.CSSProperties = {
  position: 'relative',
  height: '6px',
  background: 'transparent',
  margin: '0 0 2.5rem 0',
  borderRadius: '999px',
};

const trackBaseStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: '#e2e8f0',
  borderRadius: '999px',
};

const trackProgressStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'linear-gradient(90deg, #2563eb 0%, #22c55e 100%)',
  borderRadius: '999px',
  transition: 'width 900ms ease',
};

const nodesRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '1.5rem',
  padding: '0 0.5rem',
  minWidth: 'min(960px, 100%)',
};

const nodeColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.75rem',
  minWidth: '180px',
  flex: 1,
};

const nodeMarkerWrapperStyle: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
};

const nodeDotStyle: React.CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '999px',
  borderWidth: '4px',
  borderStyle: 'solid',
  color: '#ffffff',
  fontWeight: 700,
  fontSize: '0.85rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'transform 300ms ease, box-shadow 300ms ease',
} as const;

const nodeConnectorStyle: React.CSSProperties = {
  position: 'absolute',
  right: '-50%',
  top: '50%',
  transform: 'translateY(-50%)',
  height: '4px',
  width: '100%',
  borderRadius: '999px',
  overflow: 'hidden',
};

const nodeCardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid rgba(148, 163, 184, 0.3)',
  borderRadius: '0.75rem',
  padding: '0.85rem',
  boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  width: '100%',
};

const nodeStatusBadgeStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  padding: '0.2rem 0.6rem',
  borderRadius: '999px',
  fontSize: '0.7rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

// Pulse animation for current node
const pulseKeyframes = `
  @keyframes journey-pulse {
    0% { box-shadow: 0 0 0 0 rgba(37,99,235,0.4); }
    70% { box-shadow: 0 0 0 18px rgba(37,99,235,0); }
    100% { box-shadow: 0 0 0 0 rgba(37,99,235,0); }
  }
`;

if (typeof document !== 'undefined' && !document.getElementById('journey-pulse-style')) {
  const style = document.createElement('style');
  style.id = 'journey-pulse-style';
  style.innerHTML = pulseKeyframes;
  document.head.appendChild(style);
}
