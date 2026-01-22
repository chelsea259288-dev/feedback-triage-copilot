// ============================================
// Mock Data Generator for Feedback Triage Copilot
// ============================================

import type { IngestRequest } from './types';

/**
 * Generate 50+ mock feedback entries covering:
 * - Multiple sources (discord, github, support, twitter)
 * - Multiple products (workers, d1, workflows, r2, ai-search, etc.)
 * - Multiple categories (Bug, Docs, UX, Feature, Performance)
 * - Intentional duplicates (same URL, similar content)
 */
export function generateMockFeedback(): IngestRequest[] {
    const feedback: IngestRequest[] = [];
    
    // Helper to generate timestamps over past 7 days
    const randomDate = () => {
        const daysAgo = Math.floor(Math.random() * 7);
        const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        return date.toISOString();
    };

    // Category 1: Workers Deployment Issues (with duplicates)
    const workersDeploy = {
        title: 'Wrangler deploy fails with timeout error',
        body: 'When I run wrangler deploy, it times out after 30 seconds with no clear error message. This has been happening consistently for the past 2 days. My worker size is about 1.5MB.',
        product_hint: 'workers',
    };
    
    feedback.push(
        { ...workersDeploy, source: 'github', url: 'https://github.com/cloudflare/workers-sdk/issues/12345', created_at: randomDate() },
        { ...workersDeploy, source: 'discord', created_at: randomDate() },  // Duplicate content, no URL
        { ...workersDeploy, source: 'support', created_at: randomDate() },  // Another duplicate
        { title: 'Deploy timeout on wrangler', body: 'Deployment keeps timing out, very frustrating', source: 'twitter', product_hint: 'workers', created_at: randomDate() },  // Similar theme
    );

    // Category 2: D1 Documentation & Features
    feedback.push(
        { title: 'D1 missing full-text search documentation', body: 'I need to implement full-text search in D1 but can\'t find any documentation. LIKE queries are too slow for my use case. Are there any plans to support FTS?', source: 'discord', product_hint: 'd1', created_at: randomDate() },
        { title: 'D1 migration guide is confusing', body: 'The migration documentation doesn\'t explain how to handle schema changes in production. Do I need to version migrations? What happens if a migration fails?', source: 'github', url: 'https://github.com/cloudflare/workers-sdk/issues/23456', product_hint: 'd1', created_at: randomDate() },
        { title: 'D1 local vs remote differences', body: 'My queries work fine locally but fail in production. The error messages are different and I can\'t debug remotely.', source: 'support', product_hint: 'd1', created_at: randomDate() },
        { title: 'Love D1 performance!', body: 'Just migrated from PostgreSQL to D1 and the latency improvement is amazing. Great product!', source: 'twitter', product_hint: 'd1', created_at: randomDate() },
    );

    // Category 3: Workflows Issues
    feedback.push(
        { title: 'Workflows instance state not persisting', body: 'My workflow steps return state but when I query the instance later, the state is gone. Is there a TTL I\'m not aware of?', source: 'discord', product_hint: 'workflows', created_at: randomDate() },
        { title: 'Workflow retry logic unclear', body: 'The documentation says workflows auto-retry, but how many times? What\'s the backoff strategy? Can I configure this?', source: 'github', url: 'https://github.com/cloudflare/workers-sdk/issues/34567', product_hint: 'workflows', created_at: randomDate() },
        { title: 'Can\'t debug failed workflow steps', body: 'When a workflow step fails, the error message is truncated. I need full stack traces to debug properly.', source: 'support', product_hint: 'workflows', created_at: randomDate() },
        { title: 'Workflows pricing is confusing', body: 'The pricing page doesn\'t clearly explain how workflow steps are billed. Do I pay per step execution or per workflow instance?', source: 'discord', product_hint: 'workflows', created_at: randomDate() },
    );

    // Category 4: R2 Storage
    feedback.push(
        { title: 'R2 upload large files timeout', body: 'Uploading files > 100MB to R2 consistently fails with timeout errors. Is there a size limit or recommended chunking strategy?', source: 'github', url: 'https://github.com/cloudflare/workers-sdk/issues/45678', product_hint: 'r2', created_at: randomDate() },
        { title: 'R2 dashboard is slow', body: 'The R2 dashboard takes forever to load when I have 10k+ objects. Can we get pagination or search?', source: 'support', product_hint: 'r2', created_at: randomDate() },
        { title: 'R2 pricing calculator needed', body: 'It\'s hard to estimate R2 costs without a calculator. AWS S3 has one, would be helpful for migration planning.', source: 'discord', product_hint: 'r2', created_at: randomDate() },
    );

    // Category 5: AI Search (meta!)
    feedback.push(
        { title: 'AI Search indexing is too slow', body: 'I uploaded 1000 documents to R2 and AI Search took 30 minutes to index them. Is this expected?', source: 'discord', product_hint: 'ai-search', created_at: randomDate() },
        { title: 'AI Search not finding obvious matches', body: 'I have a document with "Cloudflare Workers" and searched for "Workers" but got no results. Is the index working?', source: 'support', product_hint: 'ai-search', created_at: randomDate() },
        { title: 'AI Search pricing unclear', body: 'The pricing page doesn\'t show AI Search costs. How much per query? Per document indexed?', source: 'twitter', product_hint: 'ai-search', created_at: randomDate() },
        { title: 'Can AI Search index JSON files?', body: 'All examples show markdown and text files. What about JSON or CSV? Do I need to convert them first?', source: 'github', url: 'https://github.com/cloudflare/workers-sdk/issues/56789', product_hint: 'ai-search', created_at: randomDate() },
    );

    // Category 6: Workers AI
    feedback.push(
        { title: 'Workers AI Llama 3 is very slow', body: 'The Llama 3.3 model takes 5-10 seconds per request. Is there a faster model for simple classification tasks?', source: 'discord', product_hint: 'workers-ai', created_at: randomDate() },
        { title: 'Workers AI token limits too low', body: 'I hit the token limit trying to analyze customer support tickets. Can the limit be increased or made configurable?', source: 'support', product_hint: 'workers-ai', created_at: randomDate() },
        { title: 'Workers AI embeddings are great!', body: 'Just built a semantic search feature using Workers AI embeddings + Vectorize. Super easy to use, thanks!', source: 'twitter', product_hint: 'workers-ai', created_at: randomDate() },
    );

    // Category 7: Pages & Deployment
    feedback.push(
        { title: 'Pages build failing with no logs', body: 'My Pages build fails but the logs are empty. How do I debug this?', source: 'github', url: 'https://github.com/cloudflare/workers-sdk/issues/67890', product_hint: 'pages', created_at: randomDate() },
        { title: 'Pages preview deployments amazing', body: 'The preview deployment feature is game-changing for our team. We can review every PR before merging!', source: 'twitter', product_hint: 'pages', created_at: randomDate() },
        { title: 'Pages environment variables confusion', body: 'I set env vars in the dashboard but they\'re not available in my build. Do I need to restart something?', source: 'discord', product_hint: 'pages', created_at: randomDate() },
    );

    // Category 8: Durable Objects
    feedback.push(
        { title: 'Durable Objects cold start very slow', body: 'New DO instances take 2-3 seconds to respond. This impacts UX significantly. Any optimization tips?', source: 'support', product_hint: 'durable-objects', created_at: randomDate() },
        { title: 'Durable Objects WebSocket example needed', body: 'The docs show simple examples but I need a real-world WebSocket chat room example with DO.', source: 'github', url: 'https://github.com/cloudflare/workers-sdk/issues/78901', product_hint: 'durable-objects', created_at: randomDate() },
    );

    // Category 9: KV Performance
    feedback.push(
        { title: 'KV write latency high in Asia', body: 'KV writes from our Asia servers take 200-300ms. Is this expected? We need < 100ms.', source: 'support', product_hint: 'kv', created_at: randomDate() },
        { title: 'KV list operation too slow', body: 'Listing keys in KV with 100k+ entries times out. Need pagination or streaming support.', source: 'discord', product_hint: 'kv', created_at: randomDate() },
    );

    // Category 10: Vectorize
    feedback.push(
        { title: 'Vectorize dimension limit is too low', body: 'I need to use 4096-dim embeddings but Vectorize only supports up to 1536. Any plans to increase this?', source: 'github', url: 'https://github.com/cloudflare/workers-sdk/issues/89012', product_hint: 'vectorize', created_at: randomDate() },
        { title: 'Vectorize upsert batch size', body: 'What\'s the maximum batch size for vector upserts? The docs don\'t specify.', source: 'discord', product_hint: 'vectorize', created_at: randomDate() },
    );

    // Category 11: General / Mixed
    feedback.push(
        { title: 'Dashboard UI redesign looks great', body: 'The new dashboard UI is much cleaner and faster. Love the dark mode!', source: 'twitter', created_at: randomDate() },
        { title: 'Wrangler update broke my CI', body: 'After updating to wrangler 4.x, our CI pipeline fails. Can we get better migration guides?', source: 'github', url: 'https://github.com/cloudflare/workers-sdk/issues/90123', product_hint: 'workers', created_at: randomDate() },
        { title: 'Amazing developer experience overall', body: 'Been using Cloudflare products for 6 months. The DX is leagues ahead of AWS. Keep it up!', source: 'twitter', created_at: randomDate() },
        { title: 'API rate limits are unclear', body: 'I keep hitting rate limits but don\'t know what the actual limits are. Can this be documented better?', source: 'support', created_at: randomDate() },
        { title: 'Need Terraform provider improvements', body: 'The Terraform provider is missing support for newer products like Workflows and AI Search.', source: 'github', url: 'https://github.com/cloudflare/terraform-provider-cloudflare/issues/1234', created_at: randomDate() },
    );

    // Add more to reach 50+
    feedback.push(
        { title: 'Workers analytics dashboard feature request', body: 'Would love to see request latency percentiles (p50, p95, p99) in the analytics dashboard.', source: 'discord', product_hint: 'workers', created_at: randomDate() },
        { title: 'Stream integration with Workers', body: 'Can Stream be used directly from Workers? Need to transcode uploaded videos.', source: 'support', product_hint: 'stream', created_at: randomDate() },
        { title: 'Images transformation pricing is great', body: 'Switched from Imgix to Cloudflare Images and saving 70% on costs. Amazing!', source: 'twitter', product_hint: 'images', created_at: randomDate() },
        { title: 'WAF custom rules UI is confusing', body: 'The WAF custom rules builder has a steep learning curve. More examples would help.', source: 'discord', product_hint: 'waf', created_at: randomDate() },
        { title: 'Turnstile better than reCAPTCHA', body: 'Switched to Turnstile from Google reCAPTCHA. Users love the non-intrusive experience!', source: 'twitter', product_hint: 'turnstile', created_at: randomDate() },
        { title: 'Queues message retention', body: 'What\'s the maximum message retention period for Queues? Can\'t find this in docs.', source: 'github', url: 'https://github.com/cloudflare/workers-sdk/issues/11111', product_hint: 'queues', created_at: randomDate() },
        { title: 'Hyperdrive connection pooling issues', body: 'Hyperdrive connections to my Postgres database keep timing out during high load.', source: 'support', product_hint: 'hyperdrive', created_at: randomDate() },
        { title: 'DNS propagation is instant', body: 'Updated DNS records and they propagated globally in under 10 seconds. Incredible!', source: 'twitter', product_hint: 'dns', created_at: randomDate() },
    );

    return feedback;
}
