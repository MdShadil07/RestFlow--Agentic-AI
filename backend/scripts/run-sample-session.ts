import dotenv from 'dotenv';
import path from 'path';
import '../config/database';
import SessionModel, { unsanitizeSkillConfidence } from '../models/Session';
import { initializeAllAgents } from '../lib/agent-registry';
import agentBus from '../lib/agent-bus';
import { processSessionPayload } from '../services/session-processing.service';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  await initializeAllAgents();

  const session = await SessionModel.create({
    userId: '6a0ff00dee2c1a9cace4a951',
    resumeText: [
      'Professional Summary: Full-stack software engineer focused on React, Node.js, TypeScript, MongoDB, SQL, Redis, and system reliability.',
      'Projects: built an online banking system, optimized database queries, and implemented queue-based background processing.',
      'Experience: Java backend internship, React frontend work, and interview preparation for software developer roles.',
    ].join('\n'),
    extraContext: 'Preparing for Microsoft software developer role in 6 months with strong DSA, HR, system design, and role-specific interview preparation.',
    company: 'Microsoft',
    role: 'Software Developer',
    competency: 'intermediate',
    agents: ['Curator Agent', 'Schedule Agent'],
  } as any);

  const researchCompleted = new Promise<void>((resolve) => {
    const handler = (payload: { sessionId: string }) => {
      if (payload.sessionId === session._id.toString()) {
        agentBus.off('research.analyzed', handler as any);
        resolve();
      }
    };
    agentBus.on('research.analyzed', handler as any);
  });

  await processSessionPayload({ sessionId: session._id.toString(), fileName: null, localPath: null });
  await researchCompleted;

  const stored = await SessionModel.findById(session._id).lean().exec();
  const userProfile = stored?.sharedContext?.userProfile;
  const researchContext = stored?.sharedContext?.researchContext;
  const companyContext = stored?.sharedContext?.companyContext;

  console.log('\n[Sample Verification] sessionId=', session._id.toString());
  console.log('[Sample Verification] userProfile=', JSON.stringify({
    ...userProfile,
    skillConfidence: unsanitizeSkillConfidence(userProfile?.skillConfidence),
  }, null, 2));
  console.log('[Sample Verification] companyContext=', JSON.stringify(companyContext, null, 2));
  console.log('[Sample Verification] researchContext=', JSON.stringify(researchContext, null, 2));
  console.log('[Sample Verification] top tasks=', JSON.stringify((stored?.tasks || []).slice(0, 5).map((task: any) => ({
    title: task.title,
    priority: task.priority,
    subtopics: task.subtopics,
  })), null, 2));

  process.exit(0);
}

main().catch((error) => {
  console.error('[Sample Verification] failed:', error);
  process.exit(1);
});
