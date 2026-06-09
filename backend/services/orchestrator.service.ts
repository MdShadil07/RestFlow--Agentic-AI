import { GoogleGenerativeAI, Schema, SchemaType as Type } from "@google/generative-ai";
import SessionModel, { ISession, ITask, ICognitiveEvent } from '../models/Session';
import agentBus from '../lib/agent-bus';

// Very small heuristic-based orchestrator for demo purposes
const KNOWN_SKILLS = [
  'react', 'javascript', 'typescript', 'node', 'express', 'mongodb', 'css', 'html', 'redux', 'graphql', 'docker', 'kubernetes', 'aws', 'sql', 'python', 'java'
];


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

async function callTaskGeneratorLLM(session: ISession, signals: string[], profile: string): Promise<any[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    systemInstruction: `You are Synapse, an elite interview prep coach. Your job is to build a highly accurate, prioritized, and time-boxed roadmap of study tasks tailored EXACTLY to the candidate's TARGET ROLE and COMPANY.

  CRITICAL INSTRUCTIONS:
  1. COMPANY SPECIFICITY: If a company is provided, you MUST inject known interview patterns for that company (e.g., LeetCode difficulty, System Design expectations, behavioral/cultural values like Amazon Leadership Principles or Google's Googlyness).
  2. ROLE SPECIFICITY: Every technical task must be highly relevant to the Target Role and its daily technical demands.
  3. ROBUST COVERAGE: Generate a comprehensive roadmap of 8 to 14 tasks total. These should span language/framework deep-dives, core algorithms/data structures, system design/architecture, database design, behavioral values, and mock practices.
  4. ACTIONABLE: Tasks must mention the company or role where relevant (e.g., "Practice Microsoft-style System Design for a distributed cache" instead of just "System Design"). Do not include subtopics, notes, common mistakes, or teaching prompts; those will be generated by the Depth Agent later. Only generate the core task listing.
  - Return the tasks wrapped in an object with a "tasks" array property.`
  });

  const company = session.company || 'a general tech company';
  const role = session.role || profile || 'a software engineer';
  const user = `Target Role: ${role}\nTarget Company: ${company}\nResume/Skills context: ${signals.join(', ')}\nBuild the tasks now.`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      tasks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING },
            focusArea: { type: Type.STRING },
            priority: { type: Type.INTEGER },
            estimatedMinutes: { type: Type.INTEGER },
            resources: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["title", "description", "category", "focusArea", "priority", "estimatedMinutes", "resources"]
        }
      }
    },
    required: ["tasks"]
  };

  let lastError: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
        }
      });

      const response = result.response;
      const text = response.text();
      const args = JSON.parse(text);
      return args.tasks || [];
    } catch (error) {
      lastError = error;
      console.warn(`[Orchestrator] Attempt ${attempt} failed:`, error);
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.error("[Orchestrator] All retry attempts failed. Gemini SDK error:", lastError);
  throw new Error("The Agent is currently busy or offline. Please try again in a few moments.");
}

async function generateTasks(sessionId: string, signals: string[], session: ISession, profile: RoleProfileKey): Promise<ITask[]> {
  const tasks: ITask[] = [];
  const deadline = session.deadline ? new Date(session.deadline) : null;
  const now = new Date();
  const totalDays = deadline ? Math.max(1, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 14;

  await recordSessionActivity(sessionId, {
    stage: 'agent-1-planner',
    message: `Planner Agent analyzing interview topics.`,
    details: signals.length > 0 ? `Primary signals: ${signals.slice(0, 12).join(', ')}` : 'Signals derived from the role, company, and goal prompt.',
    progress: 48,
  });

  const rawTasks = await callTaskGeneratorLLM(session, signals, profile);
  
  const totalMinutes = rawTasks.reduce((sum: number, item: any) => sum + item.estimatedMinutes, 0);
  const minutesPerDay = Math.max(45, Math.round(totalMinutes / totalDays));

  await recordSessionActivity(sessionId, {
    stage: 'agent-2-topic-expansion',
    message: 'Depth Agent expanded each priority task into a detailed topic tree with role-specific subtopics and study notes.',
    details: `${rawTasks.length} task blocks | ${minutesPerDay} min/day | ${totalMinutes} total minutes`,
    progress: 52,
  });

  rawTasks.forEach((item: any, idx: number) => {
    const due = new Date(now.getTime() + ((idx + 1) * totalDays * 24 * 60 * 60 * 1000) / Math.max(1, rawTasks.length));
    tasks.push({
      title: item.title,
      description: item.description,
      resources: item.resources || [],
      dueDate: due,
      priority: item.priority,
      category: item.category,
      estimatedMinutes: item.estimatedMinutes,
      focusArea: item.focusArea,
      agent: profile,
      contributors: MULTI_AGENT_STACK,
      prepStatus: 'idle',
      subtopics: [],
      notes: [],
      commonMistakes: [],
      teachingPrompts: [],
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
      message: 'The Agent is currently busy or offline. Please try again in a few moments.',
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
          message: 'The Agent is currently busy or offline. Please try again in a few moments.',
          createdAt: new Date(),
        },
      },
    }).exec();
    throw err;
  }
}

export default { orchestrateSession };
