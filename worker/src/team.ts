/**
 * Ephemeral team rooms (G6). One Durable Object per 6-char invite code,
 * addressed by `idFromName(code)`. Everything is in the WebSocket
 * attachments — no storage, no timers — so an idle room costs nothing and a
 * closed room simply evicts. Mirrors IsleLiveMap's TeamRelay contract
 * (create / join / heartbeat / roster) without SignalR: plain JSON frames.
 *
 * Frames in:  {op:"hello", name}
 *             {op:"tele", seq, x, y, z, heading, hp, hunger, thirst, species, server}
 *             {op:"ping"}
 * Frames out: {op:"welcome", memberId, code, max, heartbeatMs}
 *             {op:"roster", code, members:[{memberId, name, online, ageMs, tele}]}
 *             {op:"error", reason}
 */
import type { Env } from "./env";
import { json, num, str } from "./util";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
const CODE_LEN = 6;
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
const MAX_MEMBERS = 10;
const HEARTBEAT_MS = 10_000;
/** No frame for this long -> the socket is dropped from the room. */
const STALE_MS = 30_000;
/** Roster broadcasts are coalesced to at most this often. */
const ROSTER_MIN_GAP_MS = 100;

interface Attachment {
  memberId: string;
  code: string;
  name: string;
  lastSeen: number;
  tele: Tele | null;
}

interface Tele {
  seq: number;
  x: number;
  y: number;
  z: number;
  heading: number | null;
  hp: number | null;
  hunger: number | null;
  thirst: number | null;
  species: string | null;
  server: string | null;
}

function makeCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LEN));
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

/** Router entry: `/v1/team/new` (POST) and `/v1/team/ws` (GET, upgrade). */
export async function handleTeam(req: Request, env: Env, path: string): Promise<Response> {
  if (path === "/v1/team/new" && req.method === "POST") {
    return json({ code: makeCode() });
  }
  if (path === "/v1/team/ws" && req.method === "GET") {
    const code = (new URL(req.url).searchParams.get("code") || "").toUpperCase();
    if (!CODE_RE.test(code)) return json({ error: "bad_code" }, 400);
    if (req.headers.get("Upgrade") !== "websocket") return json({ error: "expected_ws" }, 426);
    const id = env.TEAM.idFromName(code);
    return env.TEAM.get(id).fetch(req);
  }
  return new Response(null, { status: 404 });
}

export class TeamRoom implements DurableObject {
  private lastRoster = 0;
  private lastPrune = 0;
  private rosterTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly state: DurableObjectState) {}

  async fetch(req: Request): Promise<Response> {
    const code = (new URL(req.url).searchParams.get("code") || "").toUpperCase();
    const sockets = this.state.getWebSockets();
    if (sockets.length >= MAX_MEMBERS) {
      return new Response("room full", { status: 409 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);
    // Members identify themselves in the first "hello" frame; until then the
    // attachment has an empty name so the roster skips it and a silent socket
    // is still pruned by lastSeen.
    server.serializeAttachment({
      memberId: crypto.randomUUID().slice(0, 8),
      code,
      name: "",
      lastSeen: Date.now(),
      tele: null,
    } satisfies Attachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== "string") return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const att = ws.deserializeAttachment() as Attachment;
    att.lastSeen = Date.now();

    switch (msg.op) {
      case "hello": {
        att.name = str(msg.name, 24) ?? "?";
        ws.serializeAttachment(att);
        ws.send(
          JSON.stringify({
            op: "welcome",
            memberId: att.memberId,
            code: att.code,
            max: MAX_MEMBERS,
            heartbeatMs: HEARTBEAT_MS,
          }),
        );
        break;
      }
      case "tele": {
        att.tele = {
          seq: num(msg.seq, 0, 2_000_000_000),
          x: finite(msg.x),
          y: finite(msg.y),
          z: finite(msg.z),
          heading: optFinite(msg.heading),
          hp: optPct(msg.hp),
          hunger: optPct(msg.hunger),
          thirst: optPct(msg.thirst),
          species: str(msg.species, 32),
          server: str(msg.server, 48),
        };
        ws.serializeAttachment(att);
        break;
      }
      case "ping":
        ws.serializeAttachment(att);
        break;
      // Transient relayed events — a contact ping (P3) or a shared waypoint
      // (P4). Not stored; just fan out to everyone else, tagged with sender.
      case "mark":
      case "wp": {
        ws.serializeAttachment(att);
        const out = JSON.stringify({
          op: msg.op,
          from: att.name,
          name: str(msg.name, 40),
          x: finite(msg.x),
          y: finite(msg.y),
          at: Date.now(),
        });
        for (const other of this.state.getWebSockets()) {
          if (other !== ws) {
            try {
              other.send(out);
            } catch {
              /* dropped */
            }
          }
        }
        return;
      }
      default:
        return;
    }

    this.pruneStale();
    this.scheduleRoster();
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    try {
      ws.close();
    } catch {
      /* already closed */
    }
    this.scheduleRoster();
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    return this.webSocketClose(ws);
  }

  private pruneStale(): void {
    const now = Date.now();
    // Runs off every inbound frame; the check itself is O(members) deserialize,
    // so rate-limit it — STALE_MS is 30 s, a 2 s granularity is plenty.
    if (now - this.lastPrune < 2_000) return;
    this.lastPrune = now;
    for (const ws of this.state.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att && now - att.lastSeen > STALE_MS) {
        try {
          ws.close(1000, "stale");
        } catch {
          /* ignore */
        }
      }
    }
  }

  private scheduleRoster(): void {
    if (this.rosterTimer) return;
    const wait = Math.max(0, ROSTER_MIN_GAP_MS - (Date.now() - this.lastRoster));
    this.rosterTimer = setTimeout(() => {
      this.rosterTimer = null;
      this.broadcastRoster();
    }, wait);
  }

  private broadcastRoster(): void {
    this.lastRoster = Date.now();
    const now = Date.now();
    const sockets = this.state.getWebSockets();
    const members = sockets
      .map((ws) => ws.deserializeAttachment() as Attachment | null)
      .filter((a): a is Attachment => !!a && a.name !== "")
      .map((a) => ({
        memberId: a.memberId,
        name: a.name,
        online: now - a.lastSeen <= HEARTBEAT_MS * 2,
        ageMs: now - a.lastSeen,
        tele: a.tele,
      }));
    const frame = JSON.stringify({ op: "roster", members });
    for (const ws of sockets) {
      try {
        ws.send(frame);
      } catch {
        /* dropped mid-send */
      }
    }
  }
}

const finite = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const optFinite = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const optPct = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : null;
