import type { Json } from '@/types/supabase';

export type TrialCompetencyKey =
  | 'engagement_curiosity'
  | 'logic_problem_solving'
  | 'creativity_idea_development'
  | 'independence_learning_confidence'
  | 'communication_following_instructions';

export type TrialRubric = Record<TrialCompetencyKey, 1 | 2 | 3 | 4>;

export type TrialParentReportContent = {
  highlights: string[];
  potential: Array<{
    key: TrialCompetencyKey;
    name: string;
    status: string;
    description: string;
  }>;
  triedToday: string[];
  strengths: string[];
  growthOpportunities: string[];
  coachMessage: string;
  recommendationReasons: string[];
};

export const TRIAL_COMPETENCIES: Array<{
  key: TrialCompetencyKey;
  name: string;
  coachDescription: string;
  internalLevels: Record<1 | 2 | 3 | 4, string>;
  parentDescriptions: Record<1 | 2 | 3 | 4, string>;
}> = [
  {
    key: 'engagement_curiosity',
    name: 'Engagement & Curiosity',
    coachDescription: 'Menilai keterlibatan, antusiasme, dan rasa ingin tahu anak selama mengikuti aktivitas trial.',
    internalLevels: {
      1: 'Mulai Mengenal',
      2: 'Mulai Tertarik',
      3: 'Aktif Mengeksplorasi',
      4: 'Sangat Antusias',
    },
    parentDescriptions: {
      1: 'Ananda sedang mulai mengenal ritme belajar project dan akan semakin nyaman saat diberi arahan bertahap.',
      2: 'Ananda mulai menunjukkan ketertarikan dan dapat mengikuti aktivitas dengan arahan Coach.',
      3: 'Ananda aktif mengikuti aktivitas, bertanya, mencoba, atau mengeksplorasi bagian project.',
      4: 'Ananda menunjukkan rasa ingin tahu yang kuat, aktif mencoba hal baru, dan menikmati proses eksplorasi.',
    },
  },
  {
    key: 'logic_problem_solving',
    name: 'Logic & Problem Solving',
    coachDescription: 'Menilai cara anak memahami masalah, mencoba solusi, dan merespons petunjuk dari Coach.',
    internalLevels: {
      1: 'Dengan Pendampingan Intensif',
      2: 'Dengan Arahan',
      3: 'Cukup Mandiri',
      4: 'Eksploratif',
    },
    parentDescriptions: {
      1: 'Ananda sedang membangun kemampuan problem solving dan akan terbantu melalui latihan project secara bertahap.',
      2: 'Ananda mulai memahami hubungan instruksi dan hasil program saat mendapatkan clue atau arahan.',
      3: 'Ananda mulai dapat memahami masalah dan mencoba solusi sendiri pada beberapa bagian aktivitas.',
      4: 'Ananda aktif mencoba beberapa pendekatan dan menunjukkan kemampuan problem solving yang kuat.',
    },
  },
  {
    key: 'creativity_idea_development',
    name: 'Creativity & Idea Development',
    coachDescription: 'Menilai kemampuan anak mengembangkan ide, memodifikasi contoh, dan membuat pilihan kreatif.',
    internalLevels: {
      1: 'Mengikuti Contoh',
      2: 'Mulai Memodifikasi',
      3: 'Mengembangkan Ide',
      4: 'Sangat Eksploratif',
    },
    parentDescriptions: {
      1: 'Ananda nyaman mengikuti contoh yang diberikan dan mulai membangun dasar untuk mengembangkan ide berikutnya.',
      2: 'Ananda mulai melakukan perubahan sederhana pada project sebagai langkah awal personalisasi karya.',
      3: 'Ananda mulai menambahkan ide atau pilihan kreatifnya sendiri dalam proses membuat project.',
      4: 'Ananda aktif mengembangkan konsep dan mencoba variasi berdasarkan idenya sendiri.',
    },
  },
  {
    key: 'independence_learning_confidence',
    name: 'Independence & Learning Confidence',
    coachDescription: 'Menilai kemandirian anak saat belajar serta kepercayaan dirinya ketika mencoba hal baru.',
    internalLevels: {
      1: 'Didampingi',
      2: 'Mulai Mandiri',
      3: 'Cukup Mandiri',
      4: 'Mandiri & Percaya Diri',
    },
    parentDescriptions: {
      1: 'Ananda belajar paling nyaman dengan pendampingan langkah demi langkah dan mulai membangun percaya diri.',
      2: 'Ananda dapat mengerjakan beberapa bagian sendiri setelah mendapatkan arahan dari Coach.',
      3: 'Ananda mampu melanjutkan sebagian besar aktivitas dengan sedikit bantuan.',
      4: 'Ananda aktif mengambil inisiatif dan percaya diri mencoba langkah berikutnya.',
    },
  },
  {
    key: 'communication_following_instructions',
    name: 'Communication & Following Instructions',
    coachDescription: 'Menilai kemampuan anak memahami instruksi, berkomunikasi, dan merespons arahan Coach.',
    internalLevels: {
      1: 'Sedang Beradaptasi',
      2: 'Mulai Mengikuti',
      3: 'Responsif',
      4: 'Sangat Responsif',
    },
    parentDescriptions: {
      1: 'Ananda sedang beradaptasi dengan pola pembelajaran dan instruksi Coach.',
      2: 'Ananda dapat mengikuti instruksi dengan pengulangan atau bantuan ringan.',
      3: 'Ananda dapat memahami arahan dan memberikan respons dengan baik.',
      4: 'Ananda aktif berkomunikasi, memahami instruksi, dan dapat menjelaskan proses atau idenya.',
    },
  },
];

export const QUICK_OBSERVATION_OPTIONS = [
  'Antusias mencoba hal baru',
  'Berani mengeksplorasi',
  'Cepat memahami instruksi',
  'Aktif bertanya',
  'Teliti saat mengerjakan project',
  'Memiliki ide kreatif',
  'Tidak mudah menyerah',
  'Nyaman bekerja mandiri',
  'Senang membuat atau memodifikasi project',
  'Menunjukkan ketertarikan pada coding',
  'Menunjukkan ketertarikan pada game',
  'Menunjukkan ketertarikan pada desain/creative technology',
] as const;

export const RECOMMENDATION_TAG_OPTIONS = [
  'Siap melanjutkan ke level rekomendasi',
  'Sesuai ketertarikan anak',
  'Cocok untuk mengembangkan potensi yang terlihat',
  'Cocok untuk melatih problem solving',
  'Cocok untuk mengembangkan kreativitas',
  'Cocok untuk meningkatkan kemandirian belajar',
] as const;

const PARENT_STATUS: Record<1 | 2 | 3 | 4, string> = {
  1: 'Sedang Dibangun',
  2: 'Mulai Berkembang',
  3: 'Berkembang Baik',
  4: 'Menonjol',
};

export function parseTrialRubric(value: Json | null | undefined): Partial<TrialRubric> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    TRIAL_COMPETENCIES.flatMap((competency) => {
      const numeric = Number(source[competency.key]);
      return numeric >= 1 && numeric <= 4
        ? [[competency.key, numeric as 1 | 2 | 3 | 4]]
        : [];
    }),
  ) as Partial<TrialRubric>;
}

export function isCompleteTrialRubric(value: Partial<TrialRubric>): value is TrialRubric {
  return TRIAL_COMPETENCIES.every((competency) => {
    const rating = value[competency.key];
    return rating === 1 || rating === 2 || rating === 3 || rating === 4;
  });
}

export function getParentStatus(rating: 1 | 2 | 3 | 4) {
  return PARENT_STATUS[rating];
}

export function buildTrialParentReportContent(input: {
  rubric: TrialRubric;
  quickObservations: string[];
  personalizedObservation: string;
  recommendationTags: string[];
  triedToday?: string[];
}): TrialParentReportContent {
  const potential = TRIAL_COMPETENCIES.map((competency) => {
    const rating = input.rubric[competency.key];
    return {
      key: competency.key,
      name: competency.name,
      status: getParentStatus(rating),
      description: competency.parentDescriptions[rating],
    };
  });

  const strengths = potential
    .filter((item) => item.status === 'Menonjol' || item.status === 'Berkembang Baik')
    .slice(0, 3)
    .map((item) => item.name);

  const fallbackStrengths = input.quickObservations.slice(0, 3);
  const growthOpportunities = potential
    .filter((item) => item.status === 'Sedang Dibangun' || item.status === 'Mulai Berkembang')
    .slice(0, 2)
    .map((item) => item.description);

  return {
    highlights: input.quickObservations.slice(0, 3),
    potential,
    triedToday: input.triedToday?.length
      ? input.triedToday
      : [
          'Basic Logic: memecahkan puzzle coding level 1-10 di Blockly.',
          'Instruksi bertahap: menyusun perintah sesuai urutan untuk melihat hasilnya.',
          'Interaksi sederhana: mencoba respons dan aksi dasar dalam project.',
          'Mini Project Trial: menggabungkan logika, instruksi, dan ide menjadi karya kecil.',
        ],
    strengths: strengths.length ? strengths : fallbackStrengths,
    growthOpportunities: growthOpportunities.length
      ? growthOpportunities
      : ['Dengan latihan project secara rutin, Ananda dapat terus memperkuat kepercayaan diri dan cara berpikir kreatif.'],
    coachMessage: input.personalizedObservation,
    recommendationReasons: input.recommendationTags,
  };
}
