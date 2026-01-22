// ============================================
// Cloudflare Worker Entry Point
// Feedback Triage Copilot
// ============================================

import { handleRequest } from './router';
import { TriageWorkflow } from './workflow';
import type { Env } from './types';

// Export the Workflow class
export { TriageWorkflow };

// Main fetch handler
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        return handleRequest(request, env);
    },
};
