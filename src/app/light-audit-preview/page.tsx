import TrialStoryReport from '@/app/trial-report/[token]/TrialStoryReport';
import { REPORT_STORY_LAYOUT_FIX } from '@/app/report/ReportStoryExperience.layoutFix';

const FORCE_LIGHT_STYLES = REPORT_STORY_LAYOUT_FIX.replace(
  '@media (prefers-color-scheme: light)',
  '@media all',
);

export default function LightAuditPreviewPage() {
  return (
    <>
      <TrialStoryReport
        token="preview"
        status="PUBLISHED"
        studentName="Shawn Tangkunei"
        parentName="Parent Shawn"
        coachName="Arya Perdana"
        trialMode="ONLINE"
        trialDate="2026-08-10T10:00:00+07:00"
        recommendedLevel="Innovator"
        basePrice={870000}
        finalPrice={570000}
        discountLabel="Diskon biaya pendaftaran"
        discountAmount={300000}
        invoiceUrl="https://lms.clev.io/invoice/TRIAL-PREVIEW"
        content={{
          highlights: ['Cepat memahami instruksi', 'Aktif mencoba solusi baru'],
          potential: [
            { key: 'engagement_curiosity', name: 'Engagement & Curiosity', status: 'Berkembang Baik', description: 'Aktif mengikuti kegiatan dan menunjukkan rasa ingin tahu.' },
            { key: 'logic_problem_solving', name: 'Logic & Problem Solving', status: 'Menonjol', description: 'Mampu memahami pola dan mencoba solusi secara mandiri.' },
            { key: 'creativity_idea_development', name: 'Creativity & Idea Development', status: 'Berkembang Baik', description: 'Mulai mengembangkan ide dari contoh yang diberikan.' },
          ],
          triedToday: ['Basic Logic', 'Instruksi bertahap', 'Interaksi sederhana', 'Mini Project Trial'],
          strengths: ['Engagement & Curiosity: Berkembang Baik', 'Logic & Problem Solving: Menonjol', 'Creativity & Idea Development: Berkembang Baik'],
          growthOpportunities: ['Lanjutkan ke level Innovator', 'Latihan project rutin akan membantu memperkuat kepercayaan diri.'],
          coachMessage: 'Shawn mengikuti trial dengan fokus dan cepat beradaptasi saat menerima instruksi baru. Ia sudah menunjukkan dasar logika yang baik dan nyaman mencoba command baru.',
          recommendationReasons: ['Sesuai dengan kemampuan dan minat yang terlihat selama trial.'],
        }}
      />
      <style>{FORCE_LIGHT_STYLES}</style>
    </>
  );
}
