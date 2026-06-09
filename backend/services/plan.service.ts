import { supabaseAdmin } from "../integrations/supabase/client.server";
import { GoogleGenerativeAI, Schema, SchemaType as Type } from "@google/generative-ai";

// Calls a generative AI model to get a structured plan back.
export async function generatePlanForUser(payload: {
  resumeText: string;
  targetRole: string;
  company?: string | null;
  interviewDate: string;
  focusAreas?: string[];
  userId: string;
}) {
  const plan = await callPlannerLLM(payload);

  // Insert the goal
  const { data: goal, error: goalErr } = await supabaseAdmin
    .from("interview_goals")
    .insert({
      user_id: payload.userId,
      target_role: payload.targetRole,
      company: payload.company ?? null,
      interview_date: payload.interviewDate,
      focus_areas: payload.focusAreas ?? null,
      notes: plan.summary,
      // resume_id: payload.resumeId ?? null,
    })
    .select()
    .single();
  if (goalErr) throw new Error(goalErr.message);

  // Insert tasks
  const rows = plan.tasks.map((t) => ({
    user_id: payload.userId,
    goal_id: goal.id,
    title: t.title,
    description: t.description,
    category: t.category,
    priority: t.priority,
    estimated_minutes: t.estimated_minutes,
    scheduled_for: t.scheduled_for,
    due_date: t.scheduled_for,
  }));
  const { error: taskErr } = await supabaseAdmin.from("tasks").insert(rows);
  if (taskErr) throw new Error(taskErr.message);

  // Notify
  await supabaseAdmin.from("notifications").insert({
    user_id: payload.userId,
    title: "Your prep plan is ready",
    body: `${plan.tasks.length} tasks scheduled for ${payload.targetRole}`,
    type: "plan_ready",
  });

  return { goalId: goal.id, tasksScheduled: plan.tasks.length };
}

async function callPlannerLLM(payload: {
  resumeText: string;
  targetRole: string;
  company?: string | null;
  interviewDate: string;
  focusAreas?: string[];
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const system = `You are an expert interview coach. Your job is to build a structured, day-by-day preparation plan.
You will be provided with:
- The candidate's resume/skills
- The target role
- The target company (optional)
- The interview date
- Specific focus areas requested (optional)

Rules:
1. Break down the preparation into actionable, specific tasks.
2. Distribute tasks sensibly between now and the interview date.
3. If a company is provided, include company-specific prep (e.g., leadership principles for Amazon).
4. Provide a 1-paragraph summary of the strategy.
5. Provide the structured tasks exactly matching the required schema.`;

  const user = `Build an interview prep plan for:
Role: ${payload.targetRole}
Company: ${payload.company || "Unknown"}
Interview Date: ${payload.interviewDate}
Focus Areas: ${payload.focusAreas?.join(", ") || "None specified"}
Resume/Context: ${payload.resumeText.slice(0, 3000)}`;

  const genAI = new GoogleGenerativeAI(apiKey);
  
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      tasks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING },
            priority: { type: Type.INTEGER },
            estimated_minutes: { type: Type.INTEGER },
            scheduled_for: { type: Type.STRING, description: "ISO date string" }
          },
          required: ["title", "description", "category", "priority", "estimated_minutes", "scheduled_for"]
        }
      }
    },
    required: ["summary", "tasks"]
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

      console.log("[PlanService] Gemini response", {
        summaryPreview: typeof args.summary === "string" ? args.summary.slice(0, 240) : "",
        taskCount: Array.isArray(args.tasks) ? args.tasks.length : 0,
        taskTitles: Array.isArray(args.tasks) ? args.tasks.slice(0, 5).map((task: any) => task.title) : [],
      });

      return args as {
        summary: string;
        tasks: Array<{
          title: string;
          description: string;
          category: string;
          priority: number;
          estimated_minutes: number;
          scheduled_for: string;
        }>;
      };
    } catch (error) {
      lastError = error;
      console.warn(`[PlanService] Attempt ${attempt} failed:`, error);
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.error("[PlanService] All retry attempts failed. Gemini SDK error:", lastError);
  throw new Error("The Agent is currently busy or offline. Please try again in a few moments.");
}
