import EventEmitter from 'events';

export interface CognitiveEventPayload {
  agent: string;
  event: string;
  stage: string;
  message: string;
  confidence?: number;
  evidence?: string[];
  sessionId?: string;
  timestamp?: Date;
}

export interface AgentBusEvents {
  'session.start': { sessionId: string; userId: string; resumeText: string; company?: string; role?: string };
  'profile.analyze': { sessionId: string; resumeText: string; extraContext?: string };
  'profile.analyzed': { sessionId: string; skills: string[]; skillConfidence: { [skill: string]: number }; weaknesses: string[]; strengths: string[] };
  'company.analyze': { sessionId: string; company: string; role: string };
  'company.analyzed': { sessionId: string; focusAreas: string[]; difficulty: number };
  'research.analyzed': { sessionId: string; companyProfile: string; roleProfile: string; priorityTopics: string[] };
  'gap.detected': { sessionId: string; gaps: Map<string, number> };
  'tasks.generate': { sessionId: string; profile: string; focusAreas: string[] };
  'tasks.generated': { sessionId: string; taskCount: number };
  'resources.curate': { sessionId: string; taskIds: string[] };
  'resources.curated': { sessionId: string; resourceCount: number };
  'schedule.update': { sessionId: string };
  'schedule.updated': { sessionId: string };
  'orchestration.complete': { sessionId: string };
  'cognitive.event': CognitiveEventPayload;
}

class AgentBus extends EventEmitter {
  private sessionEventLog: Map<string, CognitiveEventPayload[]> = new Map();

  override emit<K extends keyof AgentBusEvents>(
    event: K,
    payload: AgentBusEvents[K]
  ): boolean {
    console.log(`[AgentBus] Event: ${String(event)}`, payload);
    return super.emit(event, payload);
  }

  override on<K extends keyof AgentBusEvents>(
    event: K,
    listener: (payload: AgentBusEvents[K]) => void | Promise<void>
  ): this {
    return super.on(event, listener);
  }

  override once<K extends keyof AgentBusEvents>(
    event: K,
    listener: (payload: AgentBusEvents[K]) => void | Promise<void>
  ): this {
    return super.once(event, listener);
  }

  emitCognitiveEvent(payload: CognitiveEventPayload): void {
    if (payload.sessionId) {
      if (!this.sessionEventLog.has(payload.sessionId)) {
        this.sessionEventLog.set(payload.sessionId, []);
      }
      this.sessionEventLog.get(payload.sessionId)!.push({
        ...payload,
        timestamp: payload.timestamp || new Date(),
      });
    }

    console.log(
      `[CognitiveEvent:${payload.sessionId}] ${payload.agent}/${payload.event} → ${payload.stage}: ${payload.message}${
        payload.confidence ? ` (confidence: ${(payload.confidence * 100).toFixed(0)}%)` : ''
      }`
    );

    this.emit('cognitive.event', payload);
  }

  getCognitiveHistory(sessionId: string): CognitiveEventPayload[] {
    return this.sessionEventLog.get(sessionId) || [];
  }

  clearCognitiveHistory(sessionId: string): void {
    this.sessionEventLog.delete(sessionId);
  }
}

const agentBus = new AgentBus();

export default agentBus;
export { AgentBus };
