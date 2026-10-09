# Media: photos, galleries and storage

Every event has **one photo album**: one link and QR code (they open the guest gallery), one live wall, and its settings: who may add photos, moderation mode, gallery visibility and download policy. Inside it, photos are sorted into **sub-albums** (folders): one per function, made and named automatically, a General one, and any the host adds. The API issues signed URLs; bytes never pass through it.

## The event album

| Model | What it is |
|---|---|
| `MediaRoom` with `isMain = true` | the album (one per event, by a partial unique index); its settings and QR code |
| `MediaAlbum` | a sub-album: `FUNCTION` (one per function, unique per album), `GENERAL` (exactly one) or `CUSTOM` (the host's), each with `showInGallery` and `showOnWall` |
| `MediaItem.albumId` | the sub-album a photo is in |

`AlbumService.ensure(eventId)` makes the album ready on every read, so nothing has to be set up first: it creates the album and its QR code on first use, adds General and a folder for every function (including functions added later), and keeps each function folder's name in step with its function. A removed function's folder keeps its photos and is marked as such. A function folder takes its function's name (rename the function to rename it), General can be renamed, and neither can be removed. Removing a host folder moves its photos to General, and any photo can be moved to another folder.

**Older events with several albums** are folded in on first read: the oldest album becomes the event album, every other one becomes a folder (or joins its function's folder), its photos move with it, and its QR codes now open the event album, so printed codes keep working. Each fold is audited (`media_room.merged`).

| Route (`/events/:id/…`) | Permission |
|---|---|
| `GET album`, `GET album/qr.svg`, `GET album/sub-albums/:albumId/items` | `media.view` |
| `PATCH album` (name, uploads, moderation, gallery visibility, downloads, live wall), `POST album/wall/rotate` | `media.moderate` |
| `POST album/sub-albums`, `PATCH`/`DELETE album/sub-albums/:albumId` (name, `showInGallery`, `showOnWall`) | `media.moderate` |
| `POST media/:itemId/move`, `POST media/:itemId/moderate` | `media.moderate` |
| `POST album/uploads`, `POST album/uploads/:itemId/complete` | `media.upload` |
| `DELETE media/:itemId` | `media.delete` |

The dashboard's Photos page shows the folders with their photos; members with `media.upload` only (photographers) see the folders and an upload button, nothing else.

## Storage

`packages/storage` wraps any S3-compatible store:

| Environment | Store | Notes |
|---|---|---|
| Production | Cloudflare R2 (`R2_*`) | private bucket; enable bucket CORS for the web and admin origins (PUT, GET) |
| Development | SeaweedFS in Docker (`storage` service, port 9000) | `STORAGE_AUTO_CREATE_BUCKET=true` creates the bucket |

Keys are built by `StorageKeys` and never from user input:

```text
events/<eventId>/original/<itemId>.<ext>      re-encoded original, EXIF removed
events/<eventId>/optimized/<itemId>.webp      max 2048 px
events/<eventId>/thumbnails/<itemId>.webp     max 480 px
videos/<eventId>/generated/<jobId>.mp4|png
templates/assets/<assetId>.<ext>              admin design assets
music/<trackId>.mp3|m4a                       licensed music
```

`R2_ENDPOINT` is what servers use; `R2_PUBLIC_ENDPOINT` is the host in signed URLs handed to browsers. Signed URLs are short-lived (minutes for uploads, about an hour for views). Nothing in the bucket is public.

## Who adds photos

The album link and its QR code are for **viewing**: `/p/<albumCode>` opens the gallery, and nobody uploads with the link alone.

- **The event team** (members with `media.upload`: hosts, co-hosts, photographers, photo managers) always upload, from the dashboard's Photos page.
- **Invited guests** upload only when the host turns on *Invited guests can add photos* (`MediaRoom.uploadsEnabled`, off by default), and only from their own invitation: the invitation's album link carries the guest's token in the URL fragment, and every upload request sends it as `x-bulava-invite`. Without a valid token the API answers `UPLOAD_NEEDS_INVITATION`; with guest uploads off, `UPLOADS_CLOSED`. A guest's upload is signed with their name unless they type another.

`GET /public/media-rooms/:code` tells the page what this visitor may do (`canUpload`, `canViewGallery`). Visitors who cannot upload are sent to the gallery.

## Upload pipeline

```text
Invited guest opens /p/<albumCode>#t=<invitation token>   (the token stays in the URL fragment)
  → POST /public/media-rooms/:code/uploads           folder, type and size checked, quota checked, signed PUT issued
  → browser PUTs the file straight to storage
  → POST /public/media-rooms/:code/uploads/:id/complete
  → MediaItem PROCESSING + media-processing job
  → media-worker: read → validate → auto-rotate → strip EXIF/GPS → re-encode original
                  → optimized WebP + thumbnail → APPROVED or PENDING_MODERATION
```

- **Choosing a folder:** the upload page lists General, the host's folders and the folders of the functions the guest can see, and preselects the function happening now (within a day), otherwise General. `albumId` is optional; a folder from another event or of a function the guest is not invited to is refused (`INVALID_REFERENCE`).
- **The event team:** members with `media.upload` (photographers, photo managers, hosts) upload from the dashboard with `POST /events/:id/album/uploads` and a folder (`albumId` required), then `…/complete`. The file goes through the same checks, quota and worker. Team uploads carry `uploaderUserId` and skip moderation: the worker approves them whatever the moderation mode.
- **Allowed types:** JPEG, PNG and WebP for guest photos (`ALLOWED_UPLOAD_TYPES`). HEIC is not accepted; phones convert when sharing through the browser.
- **Decompression bombs:** sharp refuses images over 100 megapixels. Formats are detected from content, not the file name.
- **Privacy:** the stored original is re-encoded without metadata, so even "original quality" downloads carry no location data.
- **Quotas:** `media.photos.max` per event (plan feature).
- **Abandoned uploads:** items still `UPLOADING` after 24 hours are deleted by the hourly cleanup job.

## Moderation

| Mode | Behaviour |
|---|---|
| `AUTO_APPROVE` | photos appear once processed |
| `MANUAL_APPROVAL` | guest photos wait in the host's Photos tab and the admin moderation queue |
| `AI_ASSISTED` | reserved; currently behaves like manual approval |

The mode applies to guests; the event team's uploads are approved on arrival. Hosts (and members with `media.moderate`) approve, reject, move or delete photos. Deleting removes every rendition from storage.

## Galleries and downloads

The gallery is `/p/<albumCode>/gallery`, one page with a tab per folder. The album link, the printable QR code (`GET /events/:id/album/qr.svg`) and the live wall's QR code all open it. New albums are `PUBLIC` with downloads on: anyone holding the link or QR code sees and downloads the photos (each tile has a download button). Hosts can narrow it:

| Visibility | Who can see the gallery |
|---|---|
| `PUBLIC` (default) | anyone with the album link or QR code |
| `INVITE_ONLY` | guests with a valid invitation (token sent as the `x-bulava-invite` header) |
| `FUNCTION_RESTRICTED` | guests with an invitation; each sees General, the host's folders and the folders of their own functions |
| `PRIVATE` | hosts only |

The host decides per folder whether it appears in the gallery (`showInGallery`) and on the live wall (`showOnWall`); a hidden folder's photos stay in the dashboard. `GET /public/media-rooms/:code/gallery` returns `{ event, albums: [{ id, name, count }], items: [...] }`, listing only folders with photos the viewer may see. The invitation page's gallery section follows the same rules. The album's download policy decides whether guests can download (default yes) and at what quality (optimized by default; originals on request). Download links set `Content-Disposition` with a clean file name.

Hosts choose approved photos for their template (`customization.photoIds`) and place photos in named spots (`customization.photoSlots`: cover, partners, story, closing); the render context turns those into signed URLs for the invitation page and videos. Only approved images of the same event can be chosen.

### Template design assets

Staff-uploaded design assets (painted artwork layers and other licensed images) use the same worker. Registering an image asset queues a `media-processing` job with `{ assetId }`; the worker reads the image (sharp, 100-megapixel limit), records its real size, and writes WebP renditions 1200 and 2400 px wide with transparency kept (`templates/assets/<id>-w<width>.webp`, never upscaled) plus a 480 px console thumbnail. The uploaded original stays untouched as the licensed master. Staff can re-run it from `POST /admin/assets/:id/renditions`. How the renditions are served is in [templates.md](templates.md#painted-artwork).

### Design photos

Photos a host uploads from the Design or Video page go to a hidden room created on first use: *Design photos* (slug `design-photos`, `PRIVATE`, `AUTO_APPROVE`, no QR code, not listed to guests). The flow mirrors guest uploads (`POST /events/:id/media/design-uploads` → signed PUT → `…/complete` → media-worker processing) and the page polls `GET …/design-uploads/:itemId` until the photo is ready, then places it. The routes need `event.update`, count toward the event's photo quota, and store only re-encoded, metadata-free renditions like every other upload.

## Live photo wall

The event album can be shown as a full-screen slideshow on a TV or projector at the venue (spec §94). The host ticks **Live photo wall** on the Photos page and opens or copies its link, and chooses which folders it shows.

- The link is `/wall/<token>`: a 256-bit random token, stored as a SHA-256 hash for lookup and AES-GCM ciphertext so the host can copy it again. **New link** (`POST /events/:id/album/wall/rotate`) rotates it and screens showing the old one stop updating.
- `GET /public/walls/:token` answers only while the wall is on and the event is active or completed. It returns the 40 newest photos that are approved, images, shareable (`PUBLIC` or `EVENT_ONLY` privacy) and in a folder shown on the wall (`showOnWall`), through one-hour signed URLs, plus the gallery link (`galleryUrl`) while the gallery is public. `GET /public/walls/:token/qr.svg` draws that gallery QR on the wall, *Scan to see and download the photos*; uploading is never offered on a public screen.
- The page polls every 8 seconds, keeps each photo's first signed URL (so images are not downloaded again on every poll) and renews them after 40 minutes. Newly shared photos jump the queue and are marked *Just shared*; photos the host rejects or deletes drop off within seconds. Cursor and controls hide when idle, and a button enters full screen.
- For big screens, choose **Approve before showing** so nothing appears before a host has seen it.

## Deletion

Deleting a photo removes its storage objects immediately. Deleting an event soft-deletes it; after `EVENT_RETENTION_DAYS` (default 30) the worker purges the event's photos and videos from storage and deletes the rows. Account deletion anonymizes the user and closes their events.

## Running the worker

```bash
pnpm --filter @bulava/media-worker dev     # MEDIA_WORKER_CONCURRENCY, default 2
```

Health: `GET :4102/health`.
