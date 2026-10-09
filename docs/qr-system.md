# QR codes

Bulava uses QR codes for two things: **the event album** (anyone with it sees and downloads the photos) and **event-day check-in** (staff scan a guest's entry pass, when the host uses passes). Codes are random identifiers stored in `qr_codes`; they reveal nothing about the event or guest on their own.

## Codes

| Type | Encodes | Code | Created |
|---|---|---|---|
| `PHOTO_UPLOAD` | `<guest origin>/p/<code>/gallery` on printed and wall QR codes (the event's own domain when one is live); the album link is `/p/<code>` | 10 random characters | with the event album, on first use |
| `CHECK_IN` | `${WEB_ORIGIN}/checkin/<code>` | 16 random characters | lazily, one per guest, the first time their invitation is viewed while entry passes are on |

Other types in the `QRType` enum (`EVENT`, `FUNCTION`, `GALLERY`, `INVITATION`) are reserved. Codes can be deactivated (`active=false`) and count scans. SVGs are generated server-side with the `qrcode` package (error correction M):

```http
GET /api/v1/events/:id/album/qr.svg                    host download, for printing on table cards
GET /api/v1/public/check-in/:code/qr.svg               shown on the guest's invitation
```

## The album code

Every event has one album and one code. The printed and wall QR codes open the gallery (`/p/<code>/gallery`), where anyone with them sees and downloads the photos while the gallery is public (the default). The code is never enough to upload: the team adds photos from the dashboard, and invited guests from their own invitation when the host allows guest uploads (see [media.md](media.md#who-adds-photos)). Codes printed for an event's older albums keep working: when the albums are folded into one, their codes are pointed at the event album. Guests who arrive from their invitation carry their token in the URL fragment (`#t=…`), which browsers never send to servers or in `Referer`; the page passes it to the API in a header.

## Check-in

Entry with QR passes is the host's choice, off by default: `Event.entryPasses`, switched on the dashboard's Check-in page (`GET`/`PUT /events/:id/check-ins/settings`, `guest.read` to read and `event.update` to change, audited as `checkin.settings_updated`). While it is off, invitations carry no pass and no check-in codes are made.

Staff scan passes with the dashboard's **Scan a pass** (or **Scan the next guest** on the check-in page): the phone's back camera reads the QR code in the browser, with the browser's own `BarcodeDetector` where it exists (Chrome on Android, Edge) and the `jsqr` decoder otherwise (iPhone Safari, Firefox), loaded only when the scanner opens. A QR code that is not an entry pass is reported and scanning goes on; typing the code or link still works.

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
