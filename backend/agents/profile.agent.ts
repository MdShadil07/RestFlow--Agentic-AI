import agentBus from '../lib/agent-bus';
import SessionModel, { ISharedSessionContext, IUserProfile } from '../models/Session';

const SKILL_KEYWORDS = {
  frontend: ['React', 'Vue', 'Angular', 'TypeScript', 'JavaScript', 'CSS', 'HTML', 'Next.js', 'Svelte', 'Tailwind'],
  backend: ['Node.js', 'Express', 'Python', 'Django', 'Java', 'Spring Boot', 'Go', 'Rust', 'C#', '.NET'],
  database: ['MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'SQL', 'NoSQL', 'Firebase', 'DynamoDB', 'Elasticsearch'],
  devops: ['Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'CI/CD', 'Jenkins', 'GitHub Actions', 'Terraform'],
  tools: ['Git', 'REST', 'GraphQL', 'Postman', 'Figma', 'Jira', 'Linux', 'Docker', 'AWS'],
  data: ['Python', 'SQL', 'R', 'Pandas', 'NumPy', 'TensorFlow', 'Machine Learning', 'Data Analysis', 'Statistics'],
};

function extractSkills(text: string): { skills: string[]; confidence: Map<string, number> } {
  const skills = new Map<string, number>();
  const textLower = text.toLowerCase();

  Object.values(SKILL_KEYWORDS).forEach((skillList) => {
    skillList.forEach((skill) => {
      const regex = new RegExp(`\\b${skill.toLowerCase()}\\b`, 'gi');
      const matches = text.match(regex) || [];
      if (matches.length > 0) {
        const confidence = Math.min(1, 0.3 + matches.length * 0.15);
        skills.set(skill, confidence);
      }
    });
  });

  return {
    skills: Array.from(skills.keys()),
    confidence: skills,
  };
}

function sanitizeKey(key: string): string {
  return key.replace(/\./g, '__dot__');
}

function mapToObject(map: Map<string, number>): { [k: string]: number } {
  const obj: { [k: string]: number } = {};
  for (const [k, v] of map.entries()) {
    obj[sanitizeKey(k)] = v;
  }
  return obj;
}

function assessExperienceLevel(text: string): string {
  const yearsMatch = text.match(/(\d+)\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/i);
  const years = yearsMatch ? parseInt(yearsMatch[1], 10) : 0;

  if (years >= 5) return 'senior';
  if (years >= 2) return 'mid-level';
  if (years >= 1) return 'junior';
  return 'entry-level';
}

function detectWeaknesses(skills: string[]): string[] {
  const weaknesses: string[] = [];

  if (!skills.some((s) => SKILL_KEYWORDS.frontend.some((fw) => s.toLowerCase().includes(fw.toLowerCase())))) {
    weaknesses.push('Frontend development');
  }
  if (!skills.some((s) => SKILL_KEYWORDS.backend.some((bw) => s.toLowerCase().includes(bw.toLowerCase())))) {
    weaknesses.push('Backend development');
  }
  if (!skills.some((s) => SKILL_KEYWORDS.database.some((dw) => s.toLowerCase().includes(dw.toLowerCase())))) {
    weaknesses.push('Database design');
  }
  if (!skills.some((s) => SKILL_KEYWORDS.devops.some((dw) => s.toLowerCase().includes(dw.toLowerCase())))) {
    weaknesses.push('DevOps & deployment');
  }

  return weaknesses;
}

export async function initializeProfileAgent() {
  agentBus.on('session.start', async (payload) => {
    try {
      agentBus.emitCognitiveEvent({
        agent: 'ProfileAgent',
        event: 'analysis.started',
        stage: 'profile.analyze',
        message: 'Beginning user profile analysis',
        sessionId: payload.sessionId,
        confidence: 1,
      });

      const session = await SessionModel.findById(payload.sessionId);
      if (!session) {
        agentBus.emitCognitiveEvent({
          agent: 'ProfileAgent',
          event: 'analysis.failed',
          stage: 'profile.analyze',
          message: 'Session not found',
          sessionId: payload.sessionId,
          confidence: 0,
        });
        return;
      }

      const resumeText = session.resumeText || '';
      const extraContext = session.extraContext || '';
      const fullText = `${resumeText}\n${extraContext}`;

      // Extract skills
      const { skills, confidence } = extractSkills(fullText);
      agentBus.emitCognitiveEvent({
        agent: 'ProfileAgent',
        event: 'skills.extracted',
        stage: 'skill_extraction',
        message: `Extracted ${skills.length} skills from resume`,
        sessionId: payload.sessionId,
        confidence: 0.8,
        evidence: skills.slice(0, 5),
      });

      // Assess experience
      const experienceLevel = assessExperienceLevel(fullText);
      agentBus.emitCognitiveEvent({
        agent: 'ProfileAgent',
        event: 'experience.assessed',
        stage: 'skill_extraction',
        message: `Identified experience level: ${experienceLevel}`,
        sessionId: payload.sessionId,
        confidence: 0.7,
      });

      // Detect weaknesses
      const weaknesses = detectWeaknesses(skills);
      agentBus.emitCognitiveEvent({
        agent: 'ProfileAgent',
        event: 'gaps.detected',
        stage: 'skill_extraction',
        message: `Identified ${weaknesses.length} knowledge gaps`,
        sessionId: payload.sessionId,
        confidence: 0.75,
        evidence: weaknesses,
      });

      // Detect strengths
      const strengths = skills.slice(0, 5);

      // Build user profile
      const userProfile: IUserProfile = {
        skills,
        skillConfidence: mapToObject(confidence),
        weaknesses,
        strengths,
        experienceLevel,
        resumeQuality: Math.min(1, (skills.length / 15) * 0.5 + (fullText.length / 5000) * 0.5),
      };

      // Update session with profile
      if (!session.sharedContext) {
        session.sharedContext = {
          cognitiveEvents: [],
        };
      }
      session.sharedContext.userProfile = userProfile;

      await session.save();

      agentBus.emitCognitiveEvent({
        agent: 'ProfileAgent',
        event: 'analysis.completed',
        stage: 'profile.analyzed',
        message: 'User profile analysis complete',
        sessionId: payload.sessionId,
        confidence: 0.9,
        evidence: [
          `Skills: ${skills.length}`,
          `Level: ${experienceLevel}`,
          `Gaps: ${weaknesses.length}`,
        ],
      });

      // Emit profile analyzed event
      agentBus.emit('profile.analyzed', {
        sessionId: payload.sessionId,
        skills,
        skillConfidence: mapToObject(confidence),
        weaknesses,
        strengths,
      });
    } catch (error) {
      console.error('[ProfileAgent] Error analyzing profile:', error);
      agentBus.emitCognitiveEvent({
        agent: 'ProfileAgent',
        event: 'analysis.failed',
        stage: 'error',
        message: `Profile analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        sessionId: payload.sessionId,
        confidence: 0,
      });
    }
  });

  console.log('[ProfileAgent] Initialized and listening for session.start events');
}
