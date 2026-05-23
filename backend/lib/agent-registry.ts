import { initializeProfileAgent } from '../agents/profile.agent';
import { initializeCompanyAgent } from '../agents/company.agent';
import { initializeResearchAgent } from '../agents/research.agent';

export const AGENTS = {
  profile: {
    name: 'ProfileAgent',
    description: 'Analyzes user resume and extracts skills, experience, and knowledge gaps',
    initialize: initializeProfileAgent,
  },
  company: {
    name: 'CompanyAgent',
    description: 'Analyzes company-specific interview patterns and requirements',
    initialize: initializeCompanyAgent,
  },
  research: {
    name: 'ResearchAgent',
    description: 'Builds company and role specific research packs for preparation guidance',
    initialize: initializeResearchAgent,
  },
  planning: {
    name: 'PlanningAgent',
    description: 'Creates prioritized task roadmap based on user profile and company requirements',
    initialize: async () => console.log('[PlanningAgent] Placeholder initialized'),
  },
  gap: {
    name: 'GapAgent',
    description: 'Identifies skill gaps and creates targeted learning recommendations',
    initialize: async () => console.log('[GapAgent] Placeholder initialized'),
  },
  scheduling: {
    name: 'SchedulingAgent',
    description: 'Creates adaptive study schedule considering energy, capacity, and deadlines',
    initialize: async () => console.log('[SchedulingAgent] Placeholder initialized'),
  },
  resource: {
    name: 'ResourceAgent',
    description: 'Curates and ranks learning resources based on profile and gaps',
    initialize: async () => console.log('[ResourceAgent] Placeholder initialized'),
  },
  mock: {
    name: 'MockAgent',
    description: 'Conducts mock interviews and evaluates communication and correctness',
    initialize: async () => console.log('[MockAgent] Placeholder initialized'),
  },
  progress: {
    name: 'ProgressAgent',
    description: 'Tracks readiness and identifies weak topics needing reinforcement',
    initialize: async () => console.log('[ProgressAgent] Placeholder initialized'),
  },
};

export async function initializeAllAgents(): Promise<void> {
  console.log('[AgentRegistry] Initializing all agents...');

  for (const [key, agent] of Object.entries(AGENTS)) {
    try {
      await agent.initialize();
      console.log(`[AgentRegistry] ✓ ${agent.name} initialized`);
    } catch (error) {
      console.error(`[AgentRegistry] ✗ ${agent.name} failed to initialize:`, error);
    }
  }

  console.log('[AgentRegistry] All agents initialized');
}

export function getAgent(name: string) {
  return Object.values(AGENTS).find((agent) => agent.name === name);
}
