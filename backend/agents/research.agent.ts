import agentBus from '../lib/agent-bus';
import SessionModel, { IResearchContext } from '../models/Session';

const COMPANY_GUIDE_LIBRARY: Record<string, {
  companySummary: string;
  prepGuidelines: string[];
  priorityTopics: string[];
  interviewExperiences: string[];
  sourceNotes: string[];
}> = {
  faang: {
    companySummary: 'Large-scale product teams usually screen for algorithmic fluency, clean communication, and system thinking under pressure.',
    prepGuidelines: [
      'Front-load DSA with timed practice and explain trade-offs out loud.',
      'Practice system design with scaling, failure modes, and observability in every answer.',
      'Prepare crisp behavioral stories that show ownership, conflict resolution, and impact.',
    ],
    priorityTopics: ['DSA', 'system design', 'behavioral', 'product sense', 'resume deep dive'],
    interviewExperiences: [
      'Candidates often report two or more coding rounds followed by a deeper design or behavioral discussion.',
      'Interviewers frequently probe how you debug, communicate, and recover from mistakes.',
      'Strong experiences mention clear trade-off reasoning and structured problem solving.',
    ],
    sourceNotes: ['company pattern library', 'role alignment signals', 'resume extraction summary'],
  },
  enterprise: {
    companySummary: 'Enterprise teams emphasize reliability, maintainability, architecture, and the ability to work inside existing systems.',
    prepGuidelines: [
      'Focus on clean API boundaries, design patterns, and deployment safety.',
      'Be ready to talk about transactions, monitoring, and production support.',
      'Show how you collaborate, document, and de-risk changes.',
    ],
    priorityTopics: ['architecture', 'backend', 'testing', 'deployment', 'behavioral'],
    interviewExperiences: [
      'Candidates usually describe a practical coding round and an architecture-focused follow-up.',
      'Ownership stories and production-quality thinking matter more than flashy solutions.',
      'Experience discussions often include stability, documentation, and cross-team communication.',
    ],
    sourceNotes: ['company pattern library', 'role alignment signals', 'resume extraction summary'],
  },
  startup: {
    companySummary: 'Startup interviews tend to be practical, product-aware, and broad enough to cover shipping speed plus code quality.',
    prepGuidelines: [
      'Demonstrate end-to-end delivery and the ability to ship with incomplete information.',
      'Expect a mix of product thinking, implementation, and quick debugging questions.',
      'Keep behavioral answers short, specific, and impact-oriented.',
    ],
    priorityTopics: ['full stack', 'product thinking', 'ship fast', 'debugging', 'behavioral'],
    interviewExperiences: [
      'Many candidates report take-home or live build tasks with fast follow-up discussion.',
      'Interviewers look for practical judgment and the ability to prioritize under ambiguity.',
      'Your project stories should clearly show business impact and iteration speed.',
    ],
    sourceNotes: ['company pattern library', 'role alignment signals', 'resume extraction summary'],
  },
  fintech: {
    companySummary: 'Fintech interviews usually increase the bar on correctness, data integrity, security, and edge-case handling.',
    prepGuidelines: [
      'Prepare for SQL, concurrency, and transactional consistency questions.',
      'Explain failure handling, idempotency, and auditability in design answers.',
      'Be explicit about money movement, validation, and security boundaries.',
    ],
    priorityTopics: ['SQL', 'concurrency', 'system design', 'security', 'behavioral'],
    interviewExperiences: [
      'Candidates often mention hard correctness checks and detailed follow-up on production safety.',
      'The interviewer may push on edge cases, race conditions, and rollback behavior.',
      'Communication around risk is as important as the final solution.',
    ],
    sourceNotes: ['company pattern library', 'role alignment signals', 'resume extraction summary'],
  },
  general: {
    companySummary: 'The preparation plan is built from the role signal, resume depth, and inferred interview style for the target company.',
    prepGuidelines: [
      'Balance technical depth with a tight explanation of your projects.',
      'Cover the role fundamentals before expanding into edge cases and trade-offs.',
      'Use recent mock answers to tighten speed, clarity, and confidence.',
    ],
    priorityTopics: ['DSA', 'system design', 'role fundamentals', 'behavioral', 'projects'],
    interviewExperiences: [
      'General interview patterns usually combine coding, communication, and project discussion.',
      'Strong candidates show a repeatable framework for solving unfamiliar problems.',
      'You should be able to explain both what you built and why you made those choices.',
    ],
    sourceNotes: ['company pattern library', 'role alignment signals', 'resume extraction summary'],
  },
};

function normalizeText(value?: string | null) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function inferCompanyProfile(company?: string | null): keyof typeof COMPANY_GUIDE_LIBRARY {
  const normalized = normalizeText(company);
  if (!normalized) return 'general';

  if (/google|facebook|amazon|apple|netflix|microsoft|meta/.test(normalized)) return 'faang';
  if (/fintech|finance|trading|payment|blockchain|crypto/.test(normalized)) return 'fintech';
  if (/enterprise|corp|bank|fortune|consult/i.test(normalized)) return 'enterprise';
  if (/startup|seed|series|growth/.test(normalized)) return 'startup';
  return 'general';
}

function inferRoleProfile(role?: string | null) {
  const normalized = normalizeText(role);
  if (/software developer|software engineer|sde/.test(normalized)) return 'fullstack';
  if (/backend|server|api|microservice/.test(normalized)) return 'backend';
  if (/frontend|ui|web|react/.test(normalized)) return 'frontend';
  if (/full stack|fullstack/.test(normalized)) return 'fullstack';
  if (/data|ml|analytics|python/.test(normalized)) return 'data';
  if (/devops|sre|infra|platform/.test(normalized)) return 'devops';
  if (/android|ios|mobile/.test(normalized)) return 'mobile';
  return 'general';
}

function buildQuestionTrend(companyProfile: keyof typeof COMPANY_GUIDE_LIBRARY, roleProfile: string, priorityTopics: string[]) {
  const roleLabel = roleProfile === 'fullstack' ? 'full stack' : roleProfile;
  return Array.from({ length: 5 }, (_, index) => {
    const monthNumber = 5 - index;
    const topicA = priorityTopics[index % priorityTopics.length] || 'DSA';
    const topicB = priorityTopics[(index + 1) % priorityTopics.length] || 'behavioral';

    return {
      label: `Month ${monthNumber}`,
      focus: `${companyProfile.toUpperCase()} interview trend for ${roleLabel}`,
      dsaQuestions: [
        `Solve a ${topicA} problem under time pressure and explain the complexity clearly.`,
        `Walk through a medium-hard array or tree problem and describe your approach before coding.`,
      ],
      hrQuestions: [
        `Tell me about a time you had to learn ${topicB} quickly to unblock delivery.`,
        `Describe a project you owned end-to-end and the trade-offs you made.`,
      ],
      systemDesignQuestions: [
        `Design a scalable ${topicA} workflow for a ${roleLabel} team.`,
        `How would you reduce latency, improve reliability, and monitor failures?`,
      ],
      otherQuestions: [
        `Explain one resume project in depth and where it would fail in production.`,
        `What would you improve if you had two more weeks on the same project?`,
      ],
      interviewExperienceNotes: [
        'Interviewers often follow up on your first answer with edge-case pressure tests.',
        'A clear structure and a calm explanation consistently matter more than memorized wording.',
      ],
    };
  });
}

function buildResearchContext(company: string | undefined, role: string | undefined) {
  const companyProfile = inferCompanyProfile(company);
  const roleProfile = inferRoleProfile(role);
  const guide = COMPANY_GUIDE_LIBRARY[companyProfile];
  const roleLabel = role || 'the target role';
  const priorityTopics = Array.from(new Set([...
    guide.priorityTopics,
    ...(roleProfile === 'backend' ? ['APIs', 'SQL', 'system design'] : []),
    ...(roleProfile === 'frontend' ? ['React', 'UI architecture', 'performance'] : []),
    ...(roleProfile === 'fullstack' ? ['frontend', 'backend', 'system design'] : []),
    ...(roleProfile === 'data' ? ['SQL', 'pipelines', 'analytics'] : []),
    ...(roleProfile === 'devops' ? ['deployment', 'reliability', 'observability'] : []),
    ...(roleProfile === 'mobile' ? ['mobile architecture', 'performance', 'platform APIs'] : []),
  ])).slice(0, 8);

  const interviewRounds = [
    'resume screen',
    'coding round',
    'deep technical round',
    'system design or architecture',
    'behavioral / HR',
  ];

  const context: IResearchContext = {
    companyProfile,
    roleProfile,
    companySummary: guide.companySummary,
    roleSummary: `Preparation is tailored for ${roleLabel} responsibilities with emphasis on ${priorityTopics.slice(0, 3).join(', ')}.`,
    prepGuidelines: guide.prepGuidelines,
    priorityTopics,
    interviewRounds,
    interviewExperiences: guide.interviewExperiences,
    fiveMonthQuestionTrend: buildQuestionTrend(companyProfile, roleProfile, priorityTopics),
    sourceNotes: guide.sourceNotes,
  };

  return context;
}

export async function initializeResearchAgent() {
  agentBus.on('company.analyzed', async (payload) => {
    try {
      const session = await SessionModel.findById(payload.sessionId);
      if (!session) return;

      const researchContext = buildResearchContext(session.company, session.role);

      if (!session.sharedContext) {
        session.sharedContext = { cognitiveEvents: [] };
      }
      session.sharedContext.researchContext = researchContext;
      await session.save();

      agentBus.emitCognitiveEvent({
        agent: 'ResearchAgent',
        event: 'analysis.completed',
        stage: 'research.analyzed',
        message: `Built research pack for ${session.company || 'the company'} and ${session.role || 'the role'}`,
        sessionId: payload.sessionId,
        confidence: 0.9,
        evidence: researchContext.priorityTopics.slice(0, 5),
      });

      agentBus.emit('research.analyzed', {
        sessionId: payload.sessionId,
        companyProfile: researchContext.companyProfile,
        roleProfile: researchContext.roleProfile,
        priorityTopics: researchContext.priorityTopics,
      });
    } catch (error) {
      console.error('[ResearchAgent] Error building research context:', error);
      agentBus.emitCognitiveEvent({
        agent: 'ResearchAgent',
        event: 'analysis.failed',
        stage: 'error',
        message: `Research analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sessionId: payload.sessionId,
        confidence: 0,
      });
    }
  });

  console.log('[ResearchAgent] Initialized and listening for company.analyzed events');
}
