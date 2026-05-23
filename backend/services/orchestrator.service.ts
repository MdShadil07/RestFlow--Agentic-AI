import SessionModel, { ISession, ITask, ICognitiveEvent } from '../models/Session';
import agentBus from '../lib/agent-bus';

// Very small heuristic-based orchestrator for demo purposes
const KNOWN_SKILLS = [
  'react', 'javascript', 'typescript', 'node', 'express', 'mongodb', 'css', 'html', 'redux', 'graphql', 'docker', 'kubernetes', 'aws', 'sql', 'python', 'java'
];

const ROADMAP_LIBRARY: Record<string, { title: string; description: string; focusArea: string; category: string; estimatedMinutes: number; priority: number; resources: string[] }[]> = {
  java: [
    {
      title: 'Java language fundamentals',
      description: 'Review OOP, access modifiers, exception handling, generics, and collections basics.',
      focusArea: 'Language core',
      category: 'Foundation',
      estimatedMinutes: 90,
      priority: 1,
      resources: ['https://docs.oracle.com/javase/tutorial/'],
    },
    {
      title: 'JVM internals and memory model',
      description: 'Study heap, stack, garbage collection, class loading, and the Java Memory Model.',
      focusArea: 'Runtime behavior',
      category: 'Foundation',
      estimatedMinutes: 120,
      priority: 1,
      resources: ['https://docs.oracle.com/javase/specs/'],
    },
    {
      title: 'Collections, streams, and lambdas',
      description: 'Practice functional style transformations, comparator usage, and collection trade-offs.',
      focusArea: 'Coding fluency',
      category: 'Coding',
      estimatedMinutes: 90,
      priority: 2,
      resources: ['https://docs.oracle.com/javase/8/docs/api/java/util/stream/package-summary.html'],
    },
    {
      title: 'Concurrency and multithreading',
      description: 'Cover thread safety, synchronization, executors, locks, and concurrent utilities.',
      focusArea: 'Concurrency',
      category: 'Advanced',
      estimatedMinutes: 120,
      priority: 1,
      resources: ['https://docs.oracle.com/javase/tutorial/essential/concurrency/'],
    },
    {
      title: 'Spring and backend APIs',
      description: 'Refresh dependency injection, REST design, validation, and service layering.',
      focusArea: 'Frameworks',
      category: 'Frameworks',
      estimatedMinutes: 100,
      priority: 2,
      resources: ['https://spring.io/guides'],
    },
    {
      title: 'SQL and persistence design',
      description: 'Review schema design, joins, indexing, transactions, and JPA trade-offs.',
      focusArea: 'Data layer',
      category: 'Database',
      estimatedMinutes: 85,
      priority: 2,
      resources: ['https://www.postgresql.org/docs/'],
    },
    {
      title: 'System design interview patterns',
      description: 'Break down caching, queues, scalability, and API boundaries with concrete examples.',
      focusArea: 'Architecture',
      category: 'System Design',
      estimatedMinutes: 130,
      priority: 1,
      resources: ['https://github.com/donnemartin/system-design-primer'],
    },
    {
      title: 'Mock interview and revision loop',
      description: 'Run a timed mock and revisit the weakest topics before the deadline.',
      focusArea: 'Final review',
      category: 'Simulation',
      estimatedMinutes: 75,
      priority: 1,
      resources: ['https://www.pramp.com', 'https://interviewing.io'],
    },
  ],
  general: [
    {
      title: 'Core fundamentals and role mapping',
      description: 'Convert the resume and goal prompt into the high-signal topics that matter most.',
      focusArea: 'Topic discovery',
      category: 'Discovery',
      estimatedMinutes: 75,
      priority: 1,
      resources: ['https://www.indeed.com/career-advice/resumes-cover-letters'],
    },
    {
      title: 'Primary skill gap review',
      description: 'Target the 2-3 biggest knowledge gaps blocking interview readiness.',
      focusArea: 'Gap analysis',
      category: 'Foundation',
      estimatedMinutes: 90,
      priority: 1,
      resources: ['https://www.geeksforgeeks.org/'],
    },
    {
      title: 'Coding and implementation drills',
      description: 'Practice implementation patterns and interview-style problem solving.',
      focusArea: 'Practice',
      category: 'Coding',
      estimatedMinutes: 100,
      priority: 2,
      resources: ['https://leetcode.com'],
    },
    {
      title: 'System design and trade-off thinking',
      description: 'Outline the architecture topics, bottlenecks, and trade-offs to explain clearly.',
      focusArea: 'Architecture',
      category: 'System Design',
      estimatedMinutes: 110,
      priority: 1,
      resources: ['https://github.com/donnemartin/system-design-primer'],
    },
    {
      title: 'Mock interview and wrap-up',
      description: 'Close with a timed simulation and a final revision pass.',
      focusArea: 'Final review',
      category: 'Simulation',
      estimatedMinutes: 80,
      priority: 1,
      resources: ['https://www.pramp.com'],
    },
  ],
};

const MULTI_AGENT_STACK = ['Planner Agent', 'Depth Agent', 'Resource Agent', 'Support Agent'];

type RoleProfileKey = 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'data' | 'devops' | 'qa' | 'product' | 'general';

type CompanyProfileKey = 'startup' | 'enterprise' | 'fintech' | 'healthcare' | 'ecommerce' | 'devtools' | 'ai' | 'consulting' | 'education' | 'general';

const ROLE_PROFILE_LIBRARY: Record<RoleProfileKey, {
  label: string;
  signals: string[];
  focusAreas: string[];
  priorityTopics: string[];
  depthTopics: Record<string, string[]>;
}> = {
  frontend: {
    label: 'Frontend Engineer',
    signals: ['react', 'typescript', 'javascript', 'css', 'html', 'redux', 'graphql', 'frontend', 'ui', 'ux'],
    focusAreas: ['UI architecture', 'state management', 'performance', 'component design'],
    priorityTopics: ['react', 'typescript', 'javascript', 'system design'],
    depthTopics: {
      react: ['component composition', 'state management', 'hooks patterns', 'render performance', 'data fetching', 'form handling'],
      typescript: ['type narrowing', 'generics', 'utility types', 'interfaces vs types', 'strict mode', 'module design'],
      javascript: ['closures', 'event loop', 'async patterns', 'prototype chain', 'ES modules', 'error handling'],
      css: ['layout systems', 'responsive design', 'specificity', 'animations', 'accessibility', 'design tokens'],
      html: ['semantic markup', 'forms', 'ARIA basics', 'document structure', 'media elements', 'validation'],
      redux: ['store design', 'actions and reducers', 'async flows', 'normalized state', 'selectors', 'middleware'],
      graphql: ['schema design', 'queries and mutations', 'pagination', 'caching', 'error handling', 'client patterns'],
      frontend: ['component hierarchy', 'design systems', 'performance budgets', 'testing strategy', 'build pipeline', 'accessibility'],
      ui: ['layout', 'visual hierarchy', 'spacing', 'interaction states', 'microcopy', 'responsive behavior'],
    },
  },
  backend: {
    label: 'Backend Engineer',
    signals: ['node', 'express', 'api', 'rest', 'backend', 'service', 'controller', 'auth', 'sql', 'mongodb'],
    focusAreas: ['API design', 'service boundaries', 'data modeling', 'reliability'],
    priorityTopics: ['backend', 'node', 'sql', 'system design'],
    depthTopics: {
      backend: ['request lifecycle', 'service layering', 'validation', 'error handling', 'authentication', 'observability'],
      node: ['event loop', 'async io', 'streams', 'process model', 'module resolution', 'performance tuning'],
      express: ['routing', 'middleware', 'error flow', 'request parsing', 'security middleware', 'testing'],
      api: ['contract design', 'versioning', 'idempotency', 'pagination', 'rate limiting', 'documentation'],
      rest: ['resource modeling', 'HTTP methods', 'status codes', 'cache semantics', 'validation', 'security'],
      service: ['domain boundaries', 'data flow', 'dependency injection', 'business rules', 'orchestration', 'retries'],
      controller: ['thin controller pattern', 'request validation', 'response shaping', 'auth checks', 'error mapping', 'logging'],
      auth: ['token validation', 'session handling', 'role-based access', 'secret management', 'threat modeling', 'audit logging'],
      sql: ['schema design', 'indexes', 'transactions', 'joins', 'query tuning', 'locking'],
      mongodb: ['document modeling', 'indexes', 'aggregation', 'write concerns', 'query patterns', 'schema trade-offs'],
    },
  },
  fullstack: {
    label: 'Full Stack Engineer',
    signals: ['react', 'typescript', 'node', 'express', 'api', 'sql', 'mongodb', 'frontend', 'backend'],
    focusAreas: ['end-to-end delivery', 'system design', 'frontend quality', 'backend reliability'],
    priorityTopics: ['frontend', 'backend', 'system design', 'sql'],
    depthTopics: {
      frontend: ['component architecture', 'state management', 'performance', 'accessibility', 'testing', 'delivery'],
      backend: ['request lifecycle', 'validation', 'service layers', 'auth', 'logging', 'deployment'],
      system: ['boundaries', 'scalability', 'queues', 'caching', 'data consistency', 'observability'],
      design: ['trade-offs', 'user flows', 'error handling', 'maintainability', 'security', 'performance'],
      sql: ['schema design', 'queries', 'indexes', 'transactions', 'migration strategy', 'reporting'],
    },
  },
  mobile: {
    label: 'Mobile Engineer',
    signals: ['mobile', 'android', 'ios', 'react native', 'flutter', 'kotlin', 'swift'],
    focusAreas: ['app architecture', 'performance', 'state management', 'offline behavior'],
    priorityTopics: ['mobile', 'ui', 'system design', 'testing'],
    depthTopics: {
      mobile: ['navigation', 'state management', 'offline sync', 'performance', 'device APIs', 'release strategy'],
      android: ['activities', 'fragments', 'lifecycle', 'coroutines', 'room', 'view models'],
      ios: ['view controllers', 'swift concurrency', 'combine', 'core data', 'lifecycle', 'architecture'],
    },
  },
  data: {
    label: 'Data Engineer',
    signals: ['python', 'sql', 'spark', 'etl', 'pipeline', 'data', 'warehouse', 'analytics'],
    focusAreas: ['data modeling', 'pipeline reliability', 'query performance', 'orchestration'],
    priorityTopics: ['python', 'sql', 'system design', 'database'],
    depthTopics: {
      python: ['data structures', 'pipelines', 'error handling', 'typing', 'async tasks', 'performance'],
      sql: ['joins', 'window functions', 'indexes', 'transactions', 'query tuning', 'data quality'],
      data: ['ETL design', 'schema evolution', 'observability', 'backfills', 'quality checks', 'lineage'],
      pipeline: ['batch jobs', 'orchestration', 'retries', 'idempotency', 'monitoring', 'failure recovery'],
    },
  },
  devops: {
    label: 'DevOps / Platform Engineer',
    signals: ['docker', 'kubernetes', 'aws', 'ci', 'cd', 'deployment', 'infra', 'terraform', 'observability'],
    focusAreas: ['delivery reliability', 'infrastructure', 'scaling', 'operability'],
    priorityTopics: ['devops', 'docker', 'kubernetes', 'system design'],
    depthTopics: {
      devops: ['release pipelines', 'rollbacks', 'secrets', 'monitoring', 'capacity planning', 'incident response'],
      docker: ['image layering', 'container runtime', 'networking', 'security', 'multi-stage builds', 'debugging'],
      kubernetes: ['pods and deployments', 'services', 'configmaps', 'health checks', 'autoscaling', 'rollouts'],
      aws: ['compute', 'storage', 'networking', 'IAM', 'observability', 'resilience'],
    },
  },
  qa: {
    label: 'QA / Test Engineer',
    signals: ['qa', 'testing', 'automation', 'playwright', 'cypress', 'jest', 'unit test', 'integration test'],
    focusAreas: ['test strategy', 'automation depth', 'coverage', 'release confidence'],
    priorityTopics: ['testing', 'system design', 'frontend', 'backend'],
    depthTopics: {
      testing: ['test pyramid', 'assertion strategy', 'fixtures', 'flaky tests', 'coverage gaps', 'test data'],
      automation: ['selectors', 'reliability', 'parallelism', 'reporting', 'debugging', 'maintenance'],
    },
  },
  product: {
    label: 'Product / PM',
    signals: ['product', 'roadmap', 'stakeholder', 'metrics', 'launch', 'experiment', 'analysis', 'user'],
    focusAreas: ['product thinking', 'metrics', 'prioritization', 'stakeholder alignment'],
    priorityTopics: ['system design', 'product', 'backend', 'frontend'],
    depthTopics: {
      product: ['problem framing', 'metrics', 'prioritization', 'trade-offs', 'stakeholder management', 'launch plan'],
      system: ['scalability', 'reliability', 'decision making', 'constraints', 'trade-offs', 'instrumentation'],
    },
  },
  general: {
    label: 'General Candidate',
    signals: ['goal', 'resume', 'role', 'company'],
    focusAreas: ['topic discovery', 'skill gap analysis', 'practice cadence', 'revision'],
    priorityTopics: ['general', 'system design', 'backend', 'frontend'],
    depthTopics: {
      general: ['core concepts', 'practice patterns', 'trade-offs', 'revision checklist', 'timed mock answers'],
    },
  },
};

const COMPANY_PROFILE_LIBRARY: Record<CompanyProfileKey, {
  label: string;
  signals: string[];
  rounds: string[];
  difficulty: number;
  emphasisTopics: string[];
  focusAreas: string[];
  depthHints: Record<string, string[]>;
}> = {
  startup: {
    label: 'Startup / Growth Company',
    signals: ['startup', 'seed', 'series a', 'series b', 'mvp', 'fast paced', 'ownership'],
    rounds: ['screen', 'hiring manager', 'practical coding', 'system design', 'culture fit'],
    difficulty: 6.6,
    emphasisTopics: ['ownership', 'product sense', 'speed', 'problem solving'],
    focusAreas: ['shipping fast', 'trade-offs', 'end-to-end ownership'],
    depthHints: {
      ownership: ['prioritization', 'scope control', 'decision making', 'delivery', 'communication'],
      speed: ['iteration', 'lean execution', 'pragmatism', 'release cadence', 'feedback loops'],
    },
  },
  enterprise: {
    label: 'Enterprise Company',
    signals: ['enterprise', 'scale', 'compliance', 'reliability', 'platform', 'architecture'],
    rounds: ['recruiter', 'technical screen', 'architecture', 'stakeholder interview', 'bar raiser'],
    difficulty: 7.8,
    emphasisTopics: ['system design', 'reliability', 'scalability', 'observability'],
    focusAreas: ['stability', 'security', 'large-scale systems'],
    depthHints: {
      reliability: ['resilience', 'idempotency', 'rollbacks', 'monitoring', 'incident response'],
      scalability: ['partitioning', 'load handling', 'capacity planning', 'caching', 'data consistency'],
      security: ['auth boundaries', 'least privilege', 'audit logging', 'secrets', 'data protection'],
    },
  },
  fintech: {
    label: 'Fintech Company',
    signals: ['fintech', 'payments', 'bank', 'finance', 'ledger', 'fraud', 'transaction'],
    rounds: ['screen', 'coding', 'system design', 'domain reasoning', 'behavioral'],
    difficulty: 8,
    emphasisTopics: ['security', 'system design', 'transactions', 'reliability'],
    focusAreas: ['secure data flows', 'transaction safety', 'risk awareness'],
    depthHints: {
      security: ['authentication', 'authorization', 'PII handling', 'encryption', 'threat modeling'],
      transactions: ['consistency', 'idempotency', 'retries', 'ledger semantics', 'failure recovery'],
    },
  },
  healthcare: {
    label: 'Healthcare Company',
    signals: ['health', 'healthcare', 'medical', 'patient', 'clinical', 'hipaa'],
    rounds: ['screen', 'coding', 'domain discussion', 'architecture', 'behavioral'],
    difficulty: 7.6,
    emphasisTopics: ['security', 'reliability', 'compliance', 'data privacy'],
    focusAreas: ['privacy', 'safety', 'compliance'],
    depthHints: {
      security: ['access control', 'audit trails', 'PII safety', 'encryption', 'data retention'],
      compliance: ['governance', 'regulatory constraints', 'privacy by design', 'risk management', 'testing'],
    },
  },
  ecommerce: {
    label: 'E-commerce Company',
    signals: ['ecommerce', 'retail', 'catalog', 'checkout', 'cart', 'orders'],
    rounds: ['screen', 'coding', 'feature design', 'system design', 'behavioral'],
    difficulty: 7,
    emphasisTopics: ['frontend', 'backend', 'system design', 'performance'],
    focusAreas: ['conversion', 'performance', 'scale'],
    depthHints: {
      performance: ['page speed', 'bundle size', 'caching', 'search optimization', 'observability'],
      conversion: ['ux clarity', 'latency impact', 'funnel thinking', 'A/B reasoning', 'error handling'],
    },
  },
  devtools: {
    label: 'Developer Tools Company',
    signals: ['devtools', 'developer experience', 'tooling', 'platform', 'sdk', 'cli'],
    rounds: ['screen', 'coding', 'product thinking', 'system design', 'debugging'],
    difficulty: 7.4,
    emphasisTopics: ['frontend', 'system design', 'observability', 'product thinking'],
    focusAreas: ['developer experience', 'debuggability', 'tool quality'],
    depthHints: {
      observability: ['logging', 'metrics', 'tracing', 'debug workflow', 'error reproduction'],
      product: ['developer empathy', 'workflow design', 'trade-offs', 'adoption', 'feedback loops'],
    },
  },
  ai: {
    label: 'AI / ML Company',
    signals: ['ai', 'ml', 'machine learning', 'model', 'llm', 'inference', 'data pipeline'],
    rounds: ['screen', 'coding', 'ml fundamentals', 'system design', 'behavioral'],
    difficulty: 8.2,
    emphasisTopics: ['system design', 'data', 'python', 'performance'],
    focusAreas: ['data quality', 'model serving', 'latency', 'evaluation'],
    depthHints: {
      data: ['pipelines', 'quality checks', 'feature stores', 'versioning', 'reliability'],
      performance: ['latency', 'throughput', 'caching', 'batching', 'resource tuning'],
    },
  },
  consulting: {
    label: 'Consulting / Services Company',
    signals: ['consulting', 'services', 'client', 'delivery', 'stakeholder'],
    rounds: ['screen', 'coding', 'client scenario', 'system design', 'behavioral'],
    difficulty: 6.9,
    emphasisTopics: ['communication', 'problem solving', 'delivery', 'system design'],
    focusAreas: ['client communication', 'delivery quality', 'adaptability'],
    depthHints: {
      communication: ['clarity', 'stakeholder management', 'expectation setting', 'trade-offs', 'status updates'],
      delivery: ['estimation', 'scope', 'risk management', 'quality gates', 'handoff'],
    },
  },
  education: {
    label: 'Education Company',
    signals: ['education', 'learning', 'student', 'classroom', 'edtech'],
    rounds: ['screen', 'coding', 'product thinking', 'system design', 'behavioral'],
    difficulty: 6.8,
    emphasisTopics: ['frontend', 'product thinking', 'system design', 'communication'],
    focusAreas: ['learning experience', 'accessibility', 'scale'],
    depthHints: {
      product: ['learner motivation', 'feedback loops', 'engagement', 'measurements', 'retention'],
      accessibility: ['semantic markup', 'screen readers', 'keyboard navigation', 'contrast', 'forms'],
    },
  },
  general: {
    label: 'General Company',
    signals: [],
    rounds: ['screen', 'coding', 'system design', 'behavioral'],
    difficulty: 6.5,
    emphasisTopics: ['core foundations', 'system design', 'communication'],
    focusAreas: ['alignment', 'foundation', 'practical depth'],
    depthHints: {},
  },
};

type BlueprintItem = { title: string; description: string; focusArea: string; category: string; estimatedMinutes: number; priority: number; resources: string[] };

function normalizeText(value?: string | null) {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokenSet(...values: Array<string | undefined | null>) {
  const tokens = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const token of normalizeText(value).split(/\s+/)) {
      if (token) tokens.add(token);
    }
  }
  return tokens;
}

function inferCompanyProfile(company?: string | null): CompanyProfileKey {
  const normalized = normalizeText(company);
  if (!normalized) return 'general';

  const scores: Record<CompanyProfileKey, number> = {
    startup: 0,
    enterprise: 0,
    fintech: 0,
    healthcare: 0,
    ecommerce: 0,
    devtools: 0,
    ai: 0,
    consulting: 0,
    education: 0,
    general: 1,
  };

  for (const [profile, config] of Object.entries(COMPANY_PROFILE_LIBRARY) as [CompanyProfileKey, (typeof COMPANY_PROFILE_LIBRARY)[CompanyProfileKey]][]) {
    if (profile === 'general') continue;
    for (const signal of config.signals) {
      if (normalized.includes(signal)) scores[profile] += signal.length > 6 ? 3 : 2;
    }
  }

  return (Object.entries(scores).sort((left, right) => right[1] - left[1])[0]?.[0] as CompanyProfileKey) || 'general';
}

function inferExperienceLevel(session: ISession, signals: string[]) {
  const text = normalizeText(`${session.resumeText || ''} ${session.extraContext || ''} ${session.role || ''}`);
  const seniorSignals = ['senior', 'lead', 'principal', 'staff', 'architect', 'manager'];
  const midSignals = ['engineer', 'developer', 'specialist'];
  const juniorSignals = ['intern', 'junior', 'fresher', 'graduate'];
  let score = 0;

  for (const signal of seniorSignals) if (text.includes(signal)) score += 3;
  for (const signal of midSignals) if (text.includes(signal)) score += 1;
  for (const signal of juniorSignals) if (text.includes(signal)) score -= 2;
  if (signals.length > 18) score += 2;
  if ((session.resumeText || '').length > 6000) score += 1;

  if (score >= 4) return 'senior';
  if (score >= 1) return 'mid';
  return 'junior';
}

function inferRoleProfile(session: ISession, resumeSignals: string[]): RoleProfileKey {
  const corpus = tokenSet(session.role, session.company, session.extraContext, session.resumeText, resumeSignals.join(' '));
  const scores: Record<RoleProfileKey, number> = {
    frontend: 0,
    backend: 0,
    fullstack: 0,
    mobile: 0,
    data: 0,
    devops: 0,
    qa: 0,
    product: 0,
    general: 1,
  };

  for (const [profile, config] of Object.entries(ROLE_PROFILE_LIBRARY) as [RoleProfileKey, (typeof ROLE_PROFILE_LIBRARY)[RoleProfileKey]][]) {
    if (profile === 'general') continue;
    for (const signal of config.signals) {
      if (corpus.has(signal)) scores[profile] += 2;
      if (normalizeText(session.role).includes(signal)) scores[profile] += 2;
      if (normalizeText(session.company).includes(signal)) scores[profile] += 1;
    }
  }

  if (scores.frontend > 0 && scores.backend > 0) scores.fullstack += 4;
  if (scores.backend > 0 && scores.data > 0) scores.backend += 1;

  return (Object.entries(scores).sort((left, right) => right[1] - left[1])[0]?.[0] as RoleProfileKey) || 'general';
}

function buildSkillSignals(session: ISession) {
  const resumeTokens = (session.resumeText || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const roleTokens = normalizeText(session.role).split(/\s+/).filter(Boolean);
  const companyTokens = normalizeText(session.company).split(/\s+/).filter(Boolean);
  const goalTokens = normalizeText(session.extraContext).split(/\s+/).filter(Boolean);
  const knownSkillHits = extractSkills(session.resumeText || session.extraContext || '');
  const profile = inferRoleProfile(session, knownSkillHits);
  const profileConfig = ROLE_PROFILE_LIBRARY[profile];
  const companyProfile = inferCompanyProfile(session.company);
  const companyConfig = COMPANY_PROFILE_LIBRARY[companyProfile];

  const frequency = new Map<string, number>();
  for (const token of [...resumeTokens, ...roleTokens, ...companyTokens, ...goalTokens]) {
    if (token.length < 3) continue;
    frequency.set(token, (frequency.get(token) || 0) + 1);
  }

  const highFrequency = [...frequency.entries()].sort((left, right) => right[1] - left[1]).slice(0, 12).map(([token]) => token);
  const focusedSignals = uniqueStrings([
    ...knownSkillHits,
    ...highFrequency,
    ...(profileConfig.signals || []),
    ...(companyConfig.signals || []),
    ...roleTokens.slice(0, 6),
  ]);

  return {
    profile,
    profileLabel: profileConfig.label,
    companyProfile,
    companyLabel: companyConfig.label,
    signals: focusedSignals,
    roleTokens,
    companyTokens,
    resumeTokens: highFrequency,
    priorityTopics: profileConfig.priorityTopics,
    focusAreas: profileConfig.focusAreas,
    experienceLevel: inferExperienceLevel(session, focusedSignals),
  };
}

function makeTopicBlueprint(
  profile: RoleProfileKey,
  companyProfile: CompanyProfileKey,
  signals: string[],
  focusAreas: string[],
  role: string | undefined,
  company: string | undefined,
  experienceLevel: string,
): BlueprintItem[] {
  const profileConfig = ROLE_PROFILE_LIBRARY[profile] || ROLE_PROFILE_LIBRARY.general;
  const companyConfig = COMPANY_PROFILE_LIBRARY[companyProfile] || COMPANY_PROFILE_LIBRARY.general;
  const selectedTopics = uniqueStrings([
    ...profileConfig.priorityTopics,
    ...companyConfig.emphasisTopics,
    ...signals.slice(0, 8),
  ]);

  const dependencyOrder = uniqueStrings([
    ...profileConfig.priorityTopics,
    ...companyConfig.emphasisTopics,
    'system design',
    'backend',
    'frontend',
    'sql',
    'javascript',
    'typescript',
    'react',
    'node',
  ]);
  const dependencyRank = new Map(dependencyOrder.map((topic, index) => [topic, index]));

  const baseBlueprints = selectedTopics
    .map((topic) => {
      const domain = resolveTopicKey(topic, focusAreas.join(' '));
      const template = ROADMAP_LIBRARY[domain] || ROADMAP_LIBRARY.general;
      const top = template[0];
      const relatedFocus = focusAreas[0] || top.focusArea;
      const topicModifier = topic === 'system design' || topic === 'backend' ? 1.18 : topic === 'frontend' ? 1.08 : 1;
      const experienceModifier = experienceLevel === 'senior' ? 1.15 : experienceLevel === 'junior' ? 0.92 : 1;
      const companyModifier = companyProfile === 'enterprise' || companyProfile === 'fintech' ? 1.12 : companyProfile === 'startup' ? 0.96 : 1;
      return {
        title: `${topic.charAt(0).toUpperCase() + topic.slice(1)} for ${role || profileConfig.label}`,
        description: `${top.description} Tailor it to ${company || 'the target company'} and the responsibilities implied by ${role || 'the role'}. This plan assumes a ${experienceLevel} interview depth for ${companyConfig.label.toLowerCase()}.`,
        focusArea: relatedFocus,
        category: top.category,
        estimatedMinutes: Math.max(60, Math.round(top.estimatedMinutes * topicModifier * experienceModifier * companyModifier)),
        priority: topic === 'system design' || topic === 'backend' || companyProfile === 'fintech' ? 1 : top.priority,
        resources: top.resources,
        topic,
      };
    })
    .sort((left, right) => {
      const leftRank = dependencyRank.get(left.topic) ?? 99;
      const rightRank = dependencyRank.get(right.topic) ?? 99;
      if (left.priority !== right.priority) return left.priority - right.priority;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return right.estimatedMinutes - left.estimatedMinutes;
    });

  const uniqueByTopic = new Map<string, BlueprintItem>();
  for (const item of baseBlueprints) {
    if (!uniqueByTopic.has(item.topic)) uniqueByTopic.set(item.topic, item as unknown as BlueprintItem);
  }

  return [...uniqueByTopic.values()].slice(0, 6);
}

const TOPIC_DEEP_DIVE_LIBRARY: Record<string, {
  subtopics: string[];
  notes: string[];
  commonMistakes: string[];
  teachingPrompts: string[];
  resources: string[];
}> = {
  concurrency: {
    subtopics: ['thread lifecycle', 'synchronization primitives', 'deadlocks and starvation', 'volatile and memory visibility', 'executors and thread pools', 'locks, atomics, and concurrent collections'],
    notes: [
      'Start with the mental model: one shared state, many threads, and rules for safe coordination.',
      'Use a concrete race-condition example before explaining the fix.',
      'Compare synchronized blocks, locks, and atomic classes by scope and trade-off.',
    ],
    commonMistakes: [
      'Confusing thread safety with performance.',
      'Skipping deadlock detection and lock ordering.',
      'Talking about concurrency without showing how state is shared.',
    ],
    teachingPrompts: [
      'Explain why this code can fail under contention.',
      'Show the smallest safe synchronization boundary.',
      'Describe what happens when many requests hit the same shared resource.',
    ],
    resources: ['https://docs.oracle.com/javase/tutorial/essential/concurrency/', 'https://www.baeldung.com/java-concurrency'],
  },
  'system-design': {
    subtopics: ['requirements gathering', 'API boundaries', 'caching', 'queues and async flow', 'database scaling', 'trade-offs and failure modes'],
    notes: [
      'Always begin with requirements, scale, and constraints before proposing a design.',
      'Explain one bottleneck and one mitigation for each major subsystem.',
      'Keep the design narrative tied to the user goal and deadline.',
    ],
    commonMistakes: [
      'Jumping to architecture before clarifying requirements.',
      'Over-designing without a scaling justification.',
      'Ignoring failure handling and data consistency.',
    ],
    teachingPrompts: [
      'What breaks first at 10x traffic?',
      'Where would you cache and why?',
      'How do writes remain reliable when a downstream service is slow?',
    ],
    resources: ['https://github.com/donnemartin/system-design-primer', 'https://www.pramp.com'],
  },
  backend: {
    subtopics: ['REST design', 'validation', 'service layering', 'dependency injection', 'authentication boundaries', 'error handling'],
    notes: [
      'Explain why each layer exists and what business rule it owns.',
      'Tie API responses to concrete validation and authorization concerns.',
      'Use one worked example that follows a request from controller to persistence.',
    ],
    commonMistakes: [
      'Mixing transport logic with business rules.',
      'Skipping error paths and validation details.',
      'Failing to explain why the API contract matters.',
    ],
    teachingPrompts: [
      'Walk me through a request from controller to database.',
      'What validation happens before the service layer runs?',
      'How would you explain this endpoint to another engineer?',
    ],
    resources: ['https://spring.io/guides', 'https://www.postgresql.org/docs/'],
  },
  database: {
    subtopics: ['schema design', 'joins', 'indexes', 'transactions', 'isolation levels', 'query trade-offs'],
    notes: [
      'Start from query patterns, then design the schema and indexes around them.',
      'Explain the cost of joins, indexes, and transactional guarantees in plain language.',
      'Show one example of a slow query and how to improve it.',
    ],
    commonMistakes: [
      'Adding indexes without a query reason.',
      'Ignoring transaction boundaries.',
      'Discussing schema without workload context.',
    ],
    teachingPrompts: [
      'Why would this query be slow?',
      'What index would you add and why?',
      'How does the transaction protect data here?',
    ],
    resources: ['https://www.postgresql.org/docs/', 'https://www.geeksforgeeks.org/sql-tutorial/'],
  },
  java: {
    subtopics: ['OOP fundamentals', 'collections', 'generics', 'exception handling', 'JVM memory model', 'garbage collection'],
    notes: [
      'Ground the explanation in how Java actually runs code on the JVM.',
      'Use examples that contrast compile-time generics with runtime type erasure.',
      'Relate collections choices to performance and mutability.',
    ],
    commonMistakes: [
      'Over-focusing on syntax instead of runtime behavior.',
      'Explaining JVM concepts without memory and GC context.',
      'Treating all collection types as interchangeable.',
    ],
    teachingPrompts: [
      'Why choose this collection type?',
      'What happens in memory when this code runs?',
      'How would you prevent this exception?',
    ],
    resources: ['https://docs.oracle.com/javase/tutorial/', 'https://docs.oracle.com/javase/specs/'],
  },
  general: {
    subtopics: ['core concepts', 'practice patterns', 'trade-offs', 'revision checklist', 'timed mock answers'],
    notes: [
      'Keep the topic anchored to the resume and goal prompt.',
      'Prefer small, high-signal study chunks over broad reading.',
      'Use examples and self-explanation after each practice block.',
    ],
    commonMistakes: [
      'Studying topics that do not map to the target role.',
      'Reading without active recall or practice.',
      'Skipping review of weak areas before the deadline.',
    ],
    teachingPrompts: [
      'What is the one thing you want to remember from this topic?',
      'How would you explain this to a peer in two minutes?',
      'Where does this topic show up in your actual interview goal?',
    ],
    resources: ['https://www.indeed.com/career-advice/resumes-cover-letters', 'https://leetcode.com'],
  },
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function resolveTopicKey(title: string, focusArea?: string) {
  const text = `${title} ${focusArea || ''}`.toLowerCase();
  if (/(thread|concurr|parallel|lock|race|executor|async)/.test(text)) return 'concurrency';
  if (/(system design|architecture|cache|queue|scalab|load balanc|distributed)/.test(text)) return 'system-design';
  if (/(spring|backend|rest|api|service|controller|auth)/.test(text)) return 'backend';
  if (/(sql|database|schema|index|join|transaction|persistence|jpa)/.test(text)) return 'database';
  if (/(java|jvm|collections|stream|lambda|generics|oop|gc)/.test(text)) return 'java';
  return 'general';
}

function buildTaskDepth(item: { title: string; focusArea: string; description: string; resources: string[] }, profile: RoleProfileKey, companyProfile: CompanyProfileKey) {
  const key = resolveTopicKey(item.title, item.focusArea);
  const pack = TOPIC_DEEP_DIVE_LIBRARY[key] || TOPIC_DEEP_DIVE_LIBRARY.general;
  const profileConfig = ROLE_PROFILE_LIBRARY[profile] || ROLE_PROFILE_LIBRARY.general;
  const companyConfig = COMPANY_PROFILE_LIBRARY[companyProfile] || COMPANY_PROFILE_LIBRARY.general;
  const baseTerm = normalizeText(item.title).split(/\s+/).filter(Boolean)[0] || item.focusArea;
  const profileSpecific = profileConfig.depthTopics[key] || profileConfig.depthTopics[baseTerm] || [];
  const companySpecific = companyConfig.depthHints[key] || companyConfig.depthHints[baseTerm] || [];
  const titleWords = item.title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3)
    .slice(0, 4);

  const inferredSubtopics = uniqueStrings([
    ...companySpecific,
    ...profileSpecific,
    ...pack.subtopics,
    ...titleWords,
    item.focusArea,
  ]);
  const inferredNotes = uniqueStrings([
    `Connect the explanation back to ${item.focusArea}.`,
    `Tie the topic to ${profileConfig.label.toLowerCase()} interview expectations.`,
    `Emphasize the interview shape used by ${companyConfig.label.toLowerCase()}.`,
    ...pack.notes,
  ]);
  const teachingPrompts = uniqueStrings([
    ...pack.teachingPrompts,
    `Explain how ${item.title.toLowerCase()} appears in the context of ${item.focusArea}.`,
    `What does production-grade implementation of ${item.title.toLowerCase()} require for ${companyConfig.label.toLowerCase()}?`,
  ]);

  return {
    topicKey: key,
    subtopics: inferredSubtopics,
    notes: inferredNotes,
    commonMistakes: pack.commonMistakes,
    teachingPrompts,
    resources: uniqueStrings([...item.resources, ...pack.resources]),
  };
}

function summarizeTasks(tasks: ITask[]) {
  return tasks.slice(0, 5).map((task) => ({
    title: task.title,
    priority: task.priority,
    estimatedMinutes: task.estimatedMinutes,
    focusArea: task.focusArea,
  }));
}

function extractSkills(text?: string): string[] {
  if (!text) return [];
  const lowered = text.toLowerCase();
  const found: string[] = [];
  for (const skill of KNOWN_SKILLS) {
    if (lowered.includes(skill)) found.push(skill);
  }
  return found;
}

function previewText(value: string, limit = 220) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function logOrchestrator(sessionId: string, label: string, payload: Record<string, unknown>) {
  console.log(`[Orchestrator:${sessionId}] ${label}`, JSON.stringify(payload, null, 2));
}

async function recordSessionActivity(sessionId: string, args: { stage: string; message: string; details?: string; progress?: number; status?: ISession['status'] }) {
  const update: Record<string, any> = {
    $push: {
      activityLog: {
        stage: args.stage,
        message: args.message,
        details: args.details,
        createdAt: new Date(),
      },
    },
    $set: {
      currentStep: args.stage,
    },
  };

  if (typeof args.progress === 'number') {
    update.$set.progress = Math.max(0, Math.min(100, Math.round(args.progress)));
  }

  if (args.status) {
    update.$set.status = args.status;
  }

  await SessionModel.updateOne({ _id: sessionId }, update).exec();
}

async function generateTasks(sessionId: string, signals: string[], session: ISession, profile: RoleProfileKey): Promise<ITask[]> {
  const tasks: ITask[] = [];
  const deadline = session.deadline ? new Date(session.deadline) : null;
  const now = new Date();
  const totalDays = deadline ? Math.max(1, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 14;
  const profileConfig = ROLE_PROFILE_LIBRARY[profile] || ROLE_PROFILE_LIBRARY.general;
  const companyProfile = inferCompanyProfile(session.company);
  const experienceLevel = inferExperienceLevel(session, signals);
  const blueprint = makeTopicBlueprint(profile, companyProfile, signals, profileConfig.focusAreas, session.role, session.company, experienceLevel);

  const totalMinutes = blueprint.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const minutesPerDay = Math.max(45, Math.round(totalMinutes / totalDays));

  await recordSessionActivity(sessionId, {
    stage: 'agent-1-planner',
    message: `Planner Agent ranked the highest-value interview topics for the ${profileConfig.label.toLowerCase()} profile.`,
    details: signals.length > 0 ? `Primary signals: ${signals.slice(0, 12).join(', ')}` : 'Signals derived from the role, company, and goal prompt.',
    progress: 48,
  });

  await recordSessionActivity(sessionId, {
    stage: 'agent-2-topic-expansion',
    message: 'Depth Agent expanded each priority task into a detailed topic tree with role-specific subtopics and study notes.',
    details: `${blueprint.length} task blocks | ${minutesPerDay} min/day | ${totalMinutes} total minutes | ${profileConfig.label}`,
    progress: 52,
  });

  blueprint.forEach((item, idx) => {
    const due = new Date(now.getTime() + ((idx + 1) * totalDays * 24 * 60 * 60 * 1000) / Math.max(1, blueprint.length));
    const depth = buildTaskDepth(item, profile);
    tasks.push({
      title: item.title,
      description: item.description,
      resources: depth.resources,
      dueDate: due,
      priority: item.priority,
      category: item.category,
      estimatedMinutes: item.estimatedMinutes,
      focusArea: item.focusArea,
      agent: profileConfig.label,
      contributors: MULTI_AGENT_STACK,
      subtopics: depth.subtopics,
      notes: depth.notes,
      commonMistakes: depth.commonMistakes,
      teachingPrompts: depth.teachingPrompts,
    });
  });

  await recordSessionActivity(sessionId, {
    stage: 'agent-3-resource-curation',
    message: 'Resource Agent attached role-relevant readings, practice references, and coaching notes for each task.',
    details: summarizeTasks(tasks).map((task) => `${task.title} (${task.estimatedMinutes}m)`).join(' | '),
    progress: 74,
  });

  await recordSessionActivity(sessionId, {
    stage: 'agent-4-live-support',
    message: 'Support Agent prepared teaching prompts and quick-help cues for blocked topics.',
    details: tasks[0]?.teachingPrompts?.slice(0, 3).join(' | ') || 'No support prompts generated yet.',
    progress: 82,
  });

  if (signals.length === 0) {
    await recordSessionActivity(sessionId, {
      stage: 'plan-finalization',
      message: 'No direct skill matches were found, so the agent is building a general-purpose interview plan from your goal prompt.',
      progress: 88,
    });
  }

  await recordSessionActivity(sessionId, {
    stage: 'task-blueprint-ready',
    message: `Prepared ${tasks.length} interview task block${tasks.length === 1 ? '' : 's'} with depth, resources, and support prompts.`,
    details: tasks.slice(0, 4).map((task) => `${task.title} (${task.estimatedMinutes}m)`).join(' | '),
    progress: 90,
  });

  return tasks;
}

export async function orchestrateSession(sessionId: string) {
  const session = await SessionModel.findById(sessionId).exec();
  if (!session) throw new Error('Session not found');

  // Initialize shared context
  if (!session.sharedContext) {
    session.sharedContext = {
      cognitiveEvents: [],
    };
  }

  // Emit session.start event to trigger profile agent
  agentBus.emit('session.start', {
    sessionId,
    userId: session.userId,
    resumeText: session.resumeText || '',
    company: session.company,
    role: session.role,
  });

  agentBus.emitCognitiveEvent({
    agent: 'Orchestrator',
    event: 'orchestration.started',
    stage: 'initialization',
    message: 'Session orchestration initiated',
    sessionId,
    confidence: 1,
  });

  const profileSignals = buildSkillSignals(session);

  logOrchestrator(sessionId, 'agent-input', {
    status: session.status,
    progress: session.progress,
    currentStep: session.currentStep,
    company: session.company || null,
    role: session.role || null,
    competency: session.competency || null,
    agents: session.agents || [],
    extraContextPreview: previewText(session.extraContext || ''),
    resumeTextPreview: previewText(session.resumeText || ''),
    inferredProfile: profileSignals.profileLabel,
    topSignals: profileSignals.signals.slice(0, 12),
  });

  try {
    await recordSessionActivity(sessionId, {
      stage: 'analysis-started',
      message: 'Agent orchestration started. Reading the resume context and targeting the requested outcome.',
      details: `Competency: ${session.competency || 'not provided'} | Agents: ${session.agents?.length ? session.agents.join(', ') : 'default set'}`,
      progress: 12,
      status: 'running',
    });

    const skills = profileSignals.signals;

    logOrchestrator(sessionId, 'agent-signal-analysis', {
      count: skills.length,
      skills,
      profile: profileSignals.profile,
      focusAreas: profileSignals.focusAreas,
    });

    agentBus.emitCognitiveEvent({
      agent: 'Orchestrator',
      event: 'profile.signals_analyzed',
      stage: 'skill_analysis',
      message: `Analyzed ${skills.length} skill signals from resume and context`,
      sessionId,
      confidence: 0.85,
      evidence: skills.slice(0, 5),
    });

    await recordSessionActivity(sessionId, {
      stage: 'resume-signals',
      message: skills.length > 0
        ? `Detected ${skills.length} core skill signal${skills.length === 1 ? '' : 's'} from the uploaded context.`
        : 'No explicit technical keywords were detected, so the agent is leaning on the role and goal prompt.',
      details: skills.length > 0 ? skills.join(', ') : session.role || 'goal prompt only',
      progress: 35,
    });

    // fallback: use role keywords
    if (skills.length === 0 && session.role) {
      skills.push(...session.role.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
      await recordSessionActivity(sessionId, {
        stage: 'role-expansion',
        message: 'Expanded the plan using keywords from the target role.',
        details: session.role,
        progress: 45,
      });

      agentBus.emitCognitiveEvent({
        agent: 'Orchestrator',
        event: 'role.expansion_applied',
        stage: 'skill_analysis',
        message: `Applied role-based expansion: ${session.role}`,
        sessionId,
        confidence: 0.75,
      });
    }

    // generate tasks
    await recordSessionActivity(sessionId, {
      stage: 'plan-building',
      message: 'Converting the extracted signals into a prioritized task roadmap.',
      details: `Signal count: ${skills.length} | Goal context length: ${(session.extraContext || '').length}`,
      progress: 58,
    });

    const tasks = await generateTasks(sessionId, skills, session, profileSignals.profile);

    logOrchestrator(sessionId, 'agent-output', {
      taskCount: tasks.length,
      tasks: tasks.slice(0, 5).map((task) => ({
        title: task.title,
        category: task.category,
        agent: task.agent,
        estimatedMinutes: task.estimatedMinutes,
        focusArea: task.focusArea,
        subtopics: task.subtopics?.slice(0, 6),
      })),
    });

    agentBus.emitCognitiveEvent({
      agent: 'Orchestrator',
      event: 'tasks.generated',
      stage: 'task_generation',
      message: `Generated ${tasks.length} prioritized tasks`,
      sessionId,
      confidence: 0.9,
      evidence: tasks.slice(0, 3).map((t) => t.title),
    });

    // Update session with completed state and shared context
    if (!session.sharedContext) {
      session.sharedContext = { cognitiveEvents: [] };
    }

    const latestSession = await SessionModel.findById(sessionId).lean().exec();
    const mergedSharedContext = latestSession?.sharedContext || session.sharedContext;

    await SessionModel.updateOne({ _id: sessionId }, {
      $set: {
        tasks,
        status: 'completed',
        progress: 100,
        currentStep: 'completed',
        sharedContext: mergedSharedContext,
      },
      $push: {
        activityLog: {
          stage: 'completed',
          message: 'Roadmap generated successfully. The session is ready for review.',
          createdAt: new Date(),
        },
      },
    }).exec();

    const updatedSession = await SessionModel.findById(sessionId).lean().exec();
    logOrchestrator(sessionId, 'final-session-state', {
      status: updatedSession?.status || null,
      progress: updatedSession?.progress ?? null,
      currentStep: updatedSession?.currentStep || null,
      activityEntries: Array.isArray(updatedSession?.activityLog) ? updatedSession.activityLog.length : null,
    });

    agentBus.emitCognitiveEvent({
      agent: 'Orchestrator',
      event: 'orchestration.completed',
      stage: 'finalization',
      message: 'Session orchestration completed successfully',
      sessionId,
      confidence: 1,
    });

    agentBus.emit('orchestration.complete', { sessionId });

    return await SessionModel.findById(sessionId).exec();
  } catch (err) {
    console.error(`[Orchestrator:${sessionId}] failed`, err);

    agentBus.emitCognitiveEvent({
      agent: 'Orchestrator',
      event: 'orchestration.failed',
      stage: 'error',
      message: err instanceof Error ? err.message : 'Orchestration failed',
      sessionId,
      confidence: 0,
    });

    await SessionModel.updateOne({ _id: sessionId }, {
      $set: {
        status: 'failed',
        currentStep: 'failed',
      },
      $push: {
        activityLog: {
          stage: 'failed',
          message: err instanceof Error ? err.message : 'The agent encountered an unexpected error while generating the plan.',
          createdAt: new Date(),
        },
      },
    }).exec();
    throw err;
  }
}

export default { orchestrateSession };
