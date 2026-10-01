# QR codes

Bulava uses QR codes for two things: **the event album** (guests scan to upload) and **event-day check-in** (staff scan a guest's code). Codes are random identifiers stored in `qr_codes`; they reveal nothing about the event or guest on their own.

## Codes

| Type | Encodes | Code | Created |
|---|---|---|---|
| `PHOTO_UPLOAD` | `<guest origin>/p/<code>` (the event's own domain when one is live) | 10 random characters | with the event album, on first use |
| `CHECK_IN` | `${WEB_ORIGIN}/checkin/<code>` | 16 random characters | lazily, one per guest, the first time their invitation is viewed |

Other types in the `QRType` enum (`EVENT`, `FUNCTION`, `GALLERY`, `INVITATION`) are reserved. Codes can be deactivated (`active=false`) and count scans. SVGs are generated server-side with the `qrcode` package (error correction M):

```http
GET /api/v1/events/:id/album/qr.svg                    host download, for printing on table cards
GET /api/v1/public/check-in/:code/qr.svg               shown on the guest's invitation
```

## The album code

Every event has one album and one upload code; scanning it opens `/p/<code>`, where the guest picks a folder. Uploading requires the album to be open for uploads; seeing the gallery follows the album's visibility (see [media.md](media.md)). Codes printed for an event's older albums keep working: when the albums are folded into one, their codes are pointed at the event album. Guests who arrive from their invitation carry their token in the URL fragment (`#t=…`), which browsers never send to servers or in `Referer`; the page passes it to the API in a header.

## Check-in

```text
Guest shows the QR on their invitation page (or a printed card)
  → staff phone scans it → /checkin/<code>
  → staff must be signed in and have guest access to that event
  → GET  /check-in-codes/:code                    which event the code belongs to (signed-in staff only)
  → GET  /events/:id/check-ins/lookup/:code     guest, their functions, headcount limits, prior check-ins
  → POST /events/:id/check-ins                  { code, functionId?, headcount }
  → GET  /events/:id/check-ins/summary          live attendance per function (dashboard refreshes every 10 s)
```

- The code alone grants nothing: the staff member's event permissions are checked on every call, so a leaked code cannot be used to check in or read guest data.
- A guest can only be checked in to functions they are invited to (the same access evaluation as their invitation). The lookup shows staff the guest's attendee limit and RSVP headcount; staff record the actual headcount.
- A second scan returns `ALREADY_CHECKED_IN` with the earlier time, so double scans at a busy gate are harmless. Staff can record a deliberate re-entry (`allowReentry`), which is audited separately.
- `/checkin/*` pages send `no-store`, `noindex` and `no-referrer`.
