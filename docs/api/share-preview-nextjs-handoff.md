# Share Preview + Auth-Gated Clickthrough Handoff (Next.js)

## What was implemented in backend

A new public, safe metadata endpoint has been added for crawlers and Next.js metadata generation:

- `GET /api/public/share/:entity/:id`
- Supported `entity`: `feed`, `ping`, `wave`, `comment`
- Response shape:

```json
{
  "type": "ping",
  "id": 58,
  "title": "Internet connectivity issues in library",
  "description": "The WiFi in the library has been unstable...",
  "imageUrl": "https://res.cloudinary.com/.../image.jpg",
  "canonicalUrl": "https://app.echo-ng.com/feed/58"
}
```

Strict safety model:
- Public-safe fields only (`title`, short `description`, optional image, canonical URL)
- No auth required
- No user-private data
- Cached server-side for 5 minutes

Legacy alias endpoints were also added for compatibility:
- `GET /api/public/feed/:id/metadata`
- `GET /api/public/comments/:id/metadata`
- `GET /api/public/pings/:id/metadata`
- `GET /api/public/waves/:id/metadata`

These return the same payload format as `/api/public/share/:entity/:id`.

## Next.js integration plan

Use a dedicated share route that bots can crawl and users can click.

Recommended public URL format:
- `/share/feed/:id`
- `/share/comment/:id`
- (optional) `/share/ping/:id`, `/share/wave/:id`

Behavior:
1. `generateMetadata` fetches backend metadata endpoint and emits OpenGraph/Twitter tags.
2. Page checks auth session:
- Not logged in: redirect to login with `next` param.
- Logged in: redirect to canonical app URL (usually `/feed/:id` + optional comment hash).

## Example implementation (App Router)

### 1) `app/share/[entity]/[id]/page.tsx`

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth"; // Replace with your auth/session getter

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
const WEB_BASE = process.env.NEXT_PUBLIC_APP_URL || "https://app.echo-ng.com";

type ShareMeta = {
  type: "ping" | "wave" | "comment";
  id: number;
  title: string;
  description: string;
  imageUrl: string | null;
  canonicalUrl: string;
};

async function fetchShareMeta(entity: string, id: string): Promise<ShareMeta | null> {
  if (!API_BASE) return null;

  const res = await fetch(`${API_BASE}/api/public/share/${entity}/${id}`, {
    // Bots and server-side metadata can use cached data.
    next: { revalidate: 300 },
  });

  if (!res.ok) return null;
  return (await res.json()) as ShareMeta;
}

export async function generateMetadata(
  { params }: { params: Promise<{ entity: string; id: string }> }
): Promise<Metadata> {
  const { entity, id } = await params;
  const data = await fetchShareMeta(entity, id);

  if (!data) {
    return {
      title: "Echo",
      description: "Community feedback on Echo",
    };
  }

  const absoluteCanonical = data.canonicalUrl.startsWith("http")
    ? data.canonicalUrl
    : `${WEB_BASE}${data.canonicalUrl}`;

  return {
    title: data.title,
    description: data.description,
    alternates: { canonical: absoluteCanonical },
    openGraph: {
      title: data.title,
      description: data.description,
      url: absoluteCanonical,
      type: "article",
      images: data.imageUrl ? [{ url: data.imageUrl }] : [],
    },
    twitter: {
      card: data.imageUrl ? "summary_large_image" : "summary",
      title: data.title,
      description: data.description,
      images: data.imageUrl ? [data.imageUrl] : [],
    },
  };
}

export default async function SharePage(
  { params }: { params: Promise<{ entity: string; id: string }> }
) {
  const { entity, id } = await params;
  const session = await auth();
  const data = await fetchShareMeta(entity, id);

  if (!data) {
    redirect("/404");
  }

  const canonical = new URL(data.canonicalUrl, WEB_BASE);
  const targetPath = `${canonical.pathname}${canonical.hash}`;

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(targetPath)}`);
  }

  redirect(targetPath);
}
```

### 2) Middleware exclusion rule (important)

If your Next.js middleware currently forces auth globally, make sure it excludes `/share/:entity/:id`.

Example matcher strategy:
- Exclude: `/share/:path*`
- Keep auth on your actual app pages (for example `/feed/:id`)

Reason:
- Crawlers should receive the share page metadata, not a login page metadata.

## Notes for current URL issues

- Existing `/feed/58` links can continue to be the destination URL.
- Existing comment links should share via `/share/comment/:id`; backend resolves canonical URL to parent feed with comment hash (`/feed/:pingId#comment-:commentId`).

## Quick verification checklist

1. Open `https://app.echo-ng.com/share/feed/58` in browser while logged out:
- Should redirect to login page.

2. Inspect page source for share URL (or use a link debugger):
- Should include `og:title`, `og:description`, and `og:image` if available.

3. Open same share URL while logged in:
- Should redirect to canonical content URL (`/feed/:id`).

4. Test comment share URL:
- `https://app.echo-ng.com/share/comment/11`
- Should resolve to a feed canonical URL with a comment anchor.

## Backend file references

- Route + aliases: `src/routes/publicRoutes.ts`
- Controller logic: `src/controllers/publicController.ts`
- Validation schemas: `src/schemas/publicSchemas.ts`
