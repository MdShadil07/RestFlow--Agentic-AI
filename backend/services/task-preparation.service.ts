import { GoogleGenerativeAI, Schema, SchemaType as Type } from "@google/generative-ai";
import SessionModel, { ITask, IResearchContext } from '../models/Session';

async function callPreparationLLM(
  task: ITask,
  session: any,
  context: string,
  research?: IResearchContext
): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    systemInstruction: `You are the Depth AI Agent, a master technical interviewer and subject matter expert. Your job is to analyze a single preparation task for a candidate applying to a company and role, and generate a highly detailed, comprehensive study guide.
  
  Guidelines:
  1. ACCURACY & COVERAGE: List all possible subtopics to master, including both core concepts and lower-probability/edge-case topics that might be asked. For example, if the task is OOP, include standard principles (inheritance, polymorphism) as well as advanced patterns (decorator, dependency injection), memory models (JVM heaps, heap vs stack), runtime behaviors, performance tuning, and language-specific implementation edge cases.
  2. COMPANY & ROLE ALIGNMENT: Ground your guide in the company's known interview styles (e.g. Microsoft's focus on code quality, testing, data structure details, scalability, and algorithms). Incorporate the provided research context if available.
  3. ACTIONABLE DETAILS: Provide exactly 5-8 subtopics, 3-5 comprehensive notes, 3-5 common mistakes candidates make, and 3-5 interactive teaching/self-test prompts.
  4. Return the response exactly matching the required JSON schema.`
  });

  const userPrompt = `Task Title: ${task.title}
  Task Description: ${task.description || "None"}
  Target Company: ${session.company || "Unknown"}
  Target Role: ${session.role || "Unknown"}
  Candidate Profile/Skills: ${context}
  ${research ? `Company Research Context:\n- Summary: ${research.companySummary}\n- Priority Topics: ${research.priorityTopics.join(', ')}\n- Rounds: ${research.interviewRounds.join(', ')}` : ""}`;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      prepSummary: { type: Type.STRING, description: "A comprehensive 2-3 paragraph coaching summary/guide on this topic for the target company/role." },
      prepSteps: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 actionable preparation steps/checkpoints for this topic." },
      subtopics: { type: Type.ARRAY, items: { type: Type.STRING }, description: "5-8 detailed subtopics to master, including edge cases." },
      notes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 key conceptual notes and coach tips." },
      commonMistakes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 common mistakes candidates make on this topic." },
      teachingPrompts: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 interactive questions or practice prompts to self-test." }
    },
    required: ["prepSummary", "prepSteps", "subtopics", "notes", "commonMistakes", "teachingPrompts"]
  };

  let lastError: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
        }
      });

      const response = result.response;
      const text = response.text();
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      console.warn(`[PreparationAgent] Attempt ${attempt} failed:`, error);
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.error("[PreparationAgent] All retry attempts failed. Gemini SDK error:", lastError);
  throw new Error("The Agent is currently busy or offline. Please try again in a few moments.");
}

export async function generateTaskPreparation(sessionId: string, taskIndex: number) {
  const session = await SessionModel.findById(sessionId).exec();
  if (!session) throw new Error('Session not found');

  const task = session.tasks?.[taskIndex];
  if (!task) throw new Error('Task not found');

  // Mark task status as running while agent is working
  await SessionModel.updateOne(
    { _id: sessionId },
    { $set: { [`tasks.${taskIndex}.prepStatus`]: 'running' } }
  ).exec();

  try {
    const context = session.resumeText || session.extraContext || '';
    const research = session.sharedContext?.researchContext;

    const prepData = await callPreparationLLM(task, session, context, research);

    await SessionModel.updateOne(
      { _id: sessionId },
      {
        $set: {
          [`tasks.${taskIndex}.prepStatus`]: 'completed',
          [`tasks.${taskIndex}.prepSummary`]: prepData.prepSummary,
          [`tasks.${taskIndex}.prepSteps`]: prepData.prepSteps,
          [`tasks.${taskIndex}.subtopics`]: prepData.subtopics,
          [`tasks.${taskIndex}.notes`]: prepData.notes,
          [`tasks.${taskIndex}.commonMistakes`]: prepData.commonMistakes,
          [`tasks.${taskIndex}.teachingPrompts`]: prepData.teachingPrompts,
        },
        $push: {
          activityLog: {
            stage: 'task-preparation',
            message: `Generated deep-dive preparation for ${task.title}.`,
            details: `Subtopics: ${prepData.subtopics.join(', ')}`,
            createdAt: new Date(),
          },
        },
      }
    ).exec();

    return {
      taskIndex,
      prepStatus: 'completed',
      prepSummary: prepData.prepSummary,
      prepSteps: prepData.prepSteps,
      subtopics: prepData.subtopics,
      notes: prepData.notes,
      commonMistakes: prepData.commonMistakes,
      teachingPrompts: prepData.teachingPrompts,
    };
  } catch (err) {
    await SessionModel.updateOne(
      { _id: sessionId },
      { $set: { [`tasks.${taskIndex}.prepStatus`]: 'failed' } }
    ).exec();
    throw err;
  }
}