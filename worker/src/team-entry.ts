/**
 * Standalone entry for a team-relay-ONLY deploy (see wrangler.team.jsonc).
 *
 * The full `index.ts` also carries telemetry (D1 + Analytics Engine), which
 * need account features enabled. The relay needs none of that — just the
 * `TeamRoom` Durable Object — so this entry is what a fork deploys when it
 * only wants ad-hoc teams.
 */
import { handleTeam } from "./team";

export { TeamRoom } from "./team";

interface TeamEnv {
  TEAM: DurableObjectNamespace;
}

export default {
  async fetch(req: Request, env: TeamEnv): Promise<Response> {
    const path = new URL(req.url).pathname;
    if (path === "/" || path === "") {
      return new Response("isle team relay: ok\n", {
        headers: { "content-type": "text/plain" },
      });
    }
    if (path.startsWith("/v1/team/")) {
      // handleTeam only touches env.TEAM.
      return handleTeam(req, env as unknown as import("./env").Env, path);
    }
    return new Response(null, { status: 404 });
  },
};
