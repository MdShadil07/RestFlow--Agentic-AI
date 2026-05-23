import SessionModel, { ITask, IResearchContext } from '../models/Session';

function buildPreparationSteps(task: ITask, context: string, research?: IResearchContext): string[] {
  const title = task.title.toLowerCase();
  const subtopics = task.subtopics?.slice(0, 5) || [];
  const notes = task.notes?.slice(0, 3) || [];
  const prompts = task.teachingPrompts?.slice(0, 3) || [];
  const researchGuidelines = research?.prepGuidelines?.slice(0, 3) || [];
  const researchQuestions = research?.fiveMonthQuestionTrend?.flatMap((month) => [
    ...(month.dsaQuestions || []),
    ...(month.hrQuestions || []),
    ...(month.systemDesignQuestions || []),
    ...(month.otherQuestions || []),
  ]).slice(0, 4) || [];
  const steps = [
    `Review the task goal: ${task.title}`,
    `Extract the high-signal concepts from ${title.includes('mock') ? 'interview practice' : 'the task topic'}.`,
    subtopics.length > 0 ? `Cover the topic tree: ${subtopics.join(' -> ')}.` : 'Break the topic into foundations, practice, and review checkpoints.',
    researchGuidelines.length > 0 ? `Use company-specific research guidance: ${researchGuidelines.join(' | ')}.` : 'Cross-check the plan against the uploaded resume and target role.',
    researchQuestions.length > 0 ? `Practice the latest interview question patterns: ${researchQuestions.join(' | ')}.` : 'Create a short execution checklist and evidence-based review notes.',
    notes.length > 0 ? `Apply the coaching notes: ${notes.join(' ')}.` : 'Use the support prompts to self-check weak spots before moving on.',
    prompts.length > 0 ? `Use live-teaching prompts to self-test: ${prompts.join(' | ')}.` : 'Use the support prompts to self-check weak spots before moving on.',
  ];

  if (context) {
    steps.splice(1, 0, 'Cross-check the plan against the uploaded resume and target role.');
  }

  return steps;
}

export async function generateTaskPreparation(sessionId: string, taskIndex: number) {
  const session = await SessionModel.findById(sessionId).exec();
  if (!session) throw new Error('Session not found');

  const task = session.tasks?.[taskIndex];
  if (!task) throw new Error('Task not found');

  const context = session.resumeText || session.extraContext || '';
  const researchContext = session.sharedContext?.researchContext;
  const research = session.sharedContext?.researchContext;
  const summary = research
    ? `A company-specific preparation package for ${task.title} grounded in ${research.companyProfile} and ${research.roleProfile}.`
    : `A full preparation package for ${task.title} focused on your role, deadline, and available context.`;
  const steps = buildPreparationSteps(task, context, researchContext);

  await SessionModel.updateOne(
    { _id: sessionId },
    {
      $set: {
        [`tasks.${taskIndex}.prepStatus`]: 'completed',
        [`tasks.${taskIndex}.prepSummary`]: summary,
        [`tasks.${taskIndex}.prepSteps`]: steps,
      },
      $push: {
        activityLog: {
          stage: 'task-preparation',
          message: `Generated full preparation for ${task.title}.`,
          details: steps.join(' | '),
          createdAt: new Date(),
        },
      },
    }
  ).exec();

  return {
    taskIndex,
    prepStatus: 'completed',
    prepSummary: summary,
    prepSteps: steps,
  };
}