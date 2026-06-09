import agentBus from '../lib/agent-bus';
import SessionModel, { IResearchContext } from '../models/Session';
import { GoogleGenerativeAI, Schema, SchemaType as Type } from "@google/generative-ai";

async function generateResearchWithLLM(company: string | undefined, role: string | undefined): Promise<IResearchContext> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const companyLabel = company || 'a general tech company';
  const roleLabel = role || 'a software engineer';

  const system = `You are a specialized Research AI Agent for technical interviews.
Your job is to generate a highly accurate, company-specific and role-specific research pack for a candidate applying to ${companyLabel} as a ${roleLabel}.

Rules:
- Be highly specific to the company's known interview processes (e.g., if Amazon, mention Leadership Principles; if Google, mention Googlyness and heavy algorithmic focus).
- Be highly specific to the role (e.g., if Frontend, focus on React/DOM/Performance; if Backend, focus on distributed systems, databases, APIs).
- Provide a structured response exactly matching the required JSON schema.
- priorityTopics should contain 5-8 short, punchy topic names.
- interviewRounds should list the typical 4-6 rounds for this company/role.
- fiveMonthQuestionTrend should contain exactly 5 elements, representing 5 months of trends (Month 5 to Month 1).`;

  const user = `Generate the research pack for Company: ${companyLabel}, Role: ${roleLabel}.`;

  const genAI = new GoogleGenerativeAI(apiKey);
  
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      companyProfile: { type: Type.STRING },
      roleProfile: { type: Type.STRING },
      companySummary: { type: Type.STRING, description: "1-2 sentences summarizing the company's engineering culture and interview style." },
      roleSummary: { type: Type.STRING, description: "1-2 sentences summarizing what is expected from this role at this company." },
      prepGuidelines: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "3 actionable guidelines for preparation."
      },
      priorityTopics: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "5-8 top priority topics to study."
      },
      interviewRounds: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "Typical interview rounds."
      },
      interviewExperiences: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "3 common interview experiences reported by candidates."
      },
      fiveMonthQuestionTrend: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING, description: "e.g., Month 5" },
            focus: { type: Type.STRING },
            dsaQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            hrQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            systemDesignQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            otherQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            interviewExperienceNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["label", "focus", "dsaQuestions", "hrQuestions", "systemDesignQuestions", "otherQuestions", "interviewExperienceNotes"]
        }
      },
      sourceNotes: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "List of inferred sources, e.g., ['Glassdoor recent data', 'Company engineering blog']"
      }
    },
    required: [
      "companyProfile", "roleProfile", "companySummary", "roleSummary",
      "prepGuidelines", "priorityTopics", "interviewRounds", "interviewExperiences",
      "fiveMonthQuestionTrend", "sourceNotes"
    ]
  };

  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    systemInstruction: system
  });

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
      return args as IResearchContext;
    } catch (error) {
      lastError = error;
      console.warn(`[ResearchAgent] Attempt ${attempt} failed:`, error);
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.error("[ResearchAgent] All retry attempts failed. Gemini SDK error:", lastError);
  throw new Error("The Agent is currently busy or offline. Please try again in a few moments.");
}

export async function runResearchAgentForSession(sessionId: string): Promise<IResearchContext> {
  try {
    const session = await SessionModel.findById(sessionId);
    if (!session) throw new Error('Session not found');

    agentBus.emitCognitiveEvent({
      agent: 'ResearchAgent',
      event: 'analysis.started',
      stage: 'research.analyzed',
      message: `Research Agent starting analysis for ${session.company || 'the company'} and ${session.role || 'the role'}`,
      sessionId,
      confidence: 1,
    });

    const researchContext = await generateResearchWithLLM(session.company, session.role);

    if (!session.sharedContext) {
      session.sharedContext = { cognitiveEvents: [] };
    }
    session.sharedContext.researchContext = researchContext;
    await session.save();

    agentBus.emitCognitiveEvent({
      agent: 'ResearchAgent',
      event: 'analysis.completed',
      stage: 'research.analyzed',
      message: `Generated AI research pack for ${session.company || 'the company'} and ${session.role || 'the role'}`,
      sessionId,
      confidence: 0.9,
      evidence: researchContext.priorityTopics.slice(0, 5),
    });

    agentBus.emit('research.analyzed', {
      sessionId,
      companyProfile: researchContext.companyProfile,
      roleProfile: researchContext.roleProfile,
      priorityTopics: researchContext.priorityTopics,
    });

    return researchContext;
  } catch (error) {
    console.error('[ResearchAgent] Error building research context:', error);
    const isAgentOffline = error instanceof Error && error.message.includes('busy or offline');
    const msg = isAgentOffline ? error.message : 'The Agent is currently busy or offline. Please try again in a few moments.';
    agentBus.emitCognitiveEvent({
      agent: 'ResearchAgent',
      event: 'analysis.failed',
      stage: 'error',
      message: msg,
      sessionId,
      confidence: 0,
    });
    throw new Error(msg);
  }
}

export async function initializeResearchAgent() {
  console.log('[ResearchAgent] Initialized and ready for on-demand research requests');
}
