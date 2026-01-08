import { describe, expect, it } from 'vitest';

import { generateNarrative } from '@/lib/rubrics/narrative';

describe('generateNarrative', () => {
  it('includes coder name, class, strengths, and grade descriptions', () => {
    const narrative = generateNarrative({
      coderName: 'Alice',
      className: 'Weekly Robotics',
      competencies: {
        teamwork: {
          label: 'Teamwork',
          descriptions: {
            A: 'Collaborates excellently',
            B: 'Collaborates well',
            C: 'Needs encouragement',
          },
        },
      },
      grades: {
        teamwork: 'A',
      },
      positiveCharacters: ['Resilient', 'Creative'],
    });

    expect(narrative).toContain('Alice');
    expect(narrative).toContain('Weekly Robotics');
    expect(narrative).toContain('Resilient');
    expect(narrative).toContain('Teamwork: A');
    expect(narrative).toContain('Collaborates excellently');
  });
});
