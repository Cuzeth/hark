import { INBOX_ACTIVITY_KINDS, type InboxActivityDto } from "@hark/contracts";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { type AuthedEnv, requireAuth } from "../middleware";

const PAGE_SIZE = 20;
const MAX_PAGE = 1_000_000;
const FILTERS = ["all", ...INBOX_ACTIVITY_KINDS] as const;
type ActivityFilter = (typeof FILTERS)[number];

interface ActivityFeedRow {
  id: string;
  kind: "notification" | "live_activity" | "response";
  sourceName: string;
  sourceImageUrl: string | null;
  title: string;
  detail: string | null;
  url: string | null;
  result: string | null;
  status: string | null;
  deliveredCount: number | null;
  error: string | null;
  createdAt: number;
  total: number;
}

export const activityFeedRoute = new Hono<AuthedEnv>().use("*", requireAuth).get("/", async (c) => {
  const requestedFilter = c.req.query("filter") ?? "all";
  if (!FILTERS.includes(requestedFilter as ActivityFilter)) {
    return c.json({ error: "Invalid activity filter" }, 400);
  }
  const filter = requestedFilter as ActivityFilter;
  const requestedPage = Number.parseInt(c.req.query("page") ?? "0", 10);
  if (!Number.isFinite(requestedPage) || requestedPage < 0 || requestedPage > MAX_PAGE) {
    return c.json({ error: "Invalid activity page" }, 400);
  }
  const requestedPageSize = Number.parseInt(c.req.query("pageSize") ?? String(PAGE_SIZE), 10);
  if (!Number.isFinite(requestedPageSize) || requestedPageSize < 1 || requestedPageSize > 100) {
    return c.json({ error: "Invalid activity page size" }, 400);
  }
  const pageSize = requestedPageSize;
  const userId = c.get("user").id;
  const filterClause = filter === "all" ? sql`1 = 1` : sql`kind = ${filter}`;
  const offset = requestedPage * pageSize;

  const rows = db.all(sql`
    select
      id,
      kind,
      source_name as sourceName,
      source_image_url as sourceImageUrl,
      title,
      detail,
      url,
      result,
      status,
      delivered_count as deliveredCount,
      error,
      created_at as createdAt,
      count(*) over () as total
    from (
      select
        'event:' || e.id as id,
        'notification' as kind,
        s.title as source_name,
        coalesce(e.image_url, s.image_url) as source_image_url,
        e.title as title,
        e.body as detail,
        e.url as url,
        null as result,
        e.status as status,
        e.delivered_count as delivered_count,
        e.error as error,
        e.created_at as created_at
      from event e
      inner join service s on s.id = e.service_id
      where s.user_id = ${userId}

      union all

      select
        'notification:' || n.id as id,
        'notification' as kind,
        t.name as source_name,
        n.image_url as source_image_url,
        n.title as title,
        n.body as detail,
        n.url as url,
        null as result,
        case when n.accepted_count > 0 then 'accepted' else 'no_devices' end as status,
        n.accepted_count as delivered_count,
        null as error,
        n.created_at as created_at
      from agent_notification n
      inner join api_token t on t.id = n.requester_token_id
      where n.user_id = ${userId}

      union all

      select
        'response:' || i.id as id,
        'response' as kind,
        coalesce(s.title, t.name, i.title) as source_name,
        coalesce(i.image_url, s.image_url) as source_image_url,
        i.title as title,
        i.prompt as detail,
        i.url as url,
        case i.status
          when 'approved' then 'Approved'
          when 'denied' then 'Denied'
          when 'yes' then 'Yes'
          when 'no' then 'No'
          else 'Replied'
        end as result,
        null as status,
        null as delivered_count,
        null as error,
        i.responded_at as created_at
      from interaction i
      left join api_token t on t.id = i.requester_token_id
      left join service s on s.id = i.requester_service_id
      where i.user_id = ${userId}
        and i.status in ('approved', 'denied', 'yes', 'no', 'replied')
        and i.responded_at is not null

      union all

      select
        'live_activity:' || o.id as id,
        'live_activity' as kind,
        coalesce(s.title, t.name, 'Hark') as source_name,
        s.image_url as source_image_url,
        coalesce(
          json_extract(o.props, '$.title'),
          json_extract(a.props, '$.title'),
          'Live Activity'
        ) as title,
        coalesce(
          json_extract(o.props, '$.status'),
          json_extract(a.props, '$.status')
        ) as detail,
        null as url,
        case o.event
          when 'start' then 'Started'
          when 'end' then 'Completed'
          else 'Updated'
        end as result,
        null as status,
        null as delivered_count,
        null as error,
        o.created_at as created_at
      from live_activity_operation o
      inner join live_activity a on a.id = o.activity_id
      left join api_token t on t.id = o.requester_token_id
      left join service s on s.id = o.requester_service_id
      where a.user_id = ${userId}
        and a.interaction_id is null
    ) feed
    where ${filterClause}
    order by created_at desc, id desc
    limit ${pageSize}
    offset ${offset}
  `) as ActivityFeedRow[];

  const items: InboxActivityDto[] = rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    sourceName: row.sourceName,
    sourceImageUrl: row.sourceImageUrl,
    title: row.title,
    detail: row.detail,
    url: row.url,
    result: row.result,
    status: row.status,
    deliveredCount: row.deliveredCount,
    error: row.error,
    createdAt: new Date(row.createdAt).toISOString(),
  }));

  return c.json({
    items,
    page: requestedPage,
    pageSize,
    total: rows[0]?.total ?? 0,
  });
});
