# Stay, travel and seating

Guest logistics for weddings and other multi-day events (spec §52–53): VIP and dietary flags, where each guest stays, how they arrive and leave, and table plans per function. Hosts manage them on the event's **Stay & travel** tab.

## What hosts record

| Item | Model | Notes |
|---|---|---|
| VIP, dietary needs | `Guest.isVip`, `Guest.dietary` | also editable when adding a guest; shown at the check-in desk |
| Stay | `GuestStay` (one per guest) | hotel or home, room and room type, address, map link, check-in and check-out, a note for the guest |
| Arrival, departure | `GuestTravel` (one per direction per guest) | flight, train, car, bus or other; carrier and number; time; airport, station or city; travellers; pickup (or drop) requested; the host's pickup arrangement |
| Seating | `SeatAssignment` (one per guest per function) | table and optional seat |

`PUT /events/:id/guests/:guestId/logistics` edits one guest. Each key present replaces that part, `null` removes it, and an absent key is left alone. Times are entered in the event's time zone and stored in UTC.

## Seating is not access

`SeatAssignment` is deliberately separate from `FunctionGuest`, which is an access row (a direct assignment lets a guest in). A table never grants entry:

- `GET /events/:id/functions/:functionId/seating` lists the guests who can attend (decided by `evaluateFunctionAccess`), plus anyone seated whose access has since changed, marked *No longer invited*.
- `PUT /events/:id/functions/:functionId/seating` replaces the plan for that function; one seat per guest.
- A guest's invitation only shows seats for functions that guest can see.

## What guests see

The invitation shows **Your stay & travel** with the guest's own stay, table per function, arrival and departure, and the host's pickup arrangement. It sits with the entry pass in every template (the `guestInfo` slot), and after the functions in the classic layout. Guests never see anyone else's details.

When the host turns on **Ask guests for their arrival and departure details**, guests can add or change their own travel from the invitation (`POST /public/invitations/:token/travel`). The guest schema has no host-only fields, so a guest cannot change the pickup arrangement; rows they entered are marked *Added by guest*.

## Boards and sheets

- **Guests** tab: search, one card per guest, inline editor.
- **Arrivals & departures**: a day-by-day board in the event's time zone for the transport desk, with pickups highlighted.
- **Seating**: pick a function, type tables and seats, see the tables fill up.
- Downloads (`/events/:id/exports/{travel,stays,seating}.csv`): the transport sheet, the rooming list and the seating chart, with local times and formula-injection-safe cells.

## Event day

The staff check-in page shows the VIP badge, dietary needs, the guest's room and their table and seat for each function.

## Privacy and permissions

- Reading needs `guest.read`; editing needs `guest.write`. Photographers and media managers have neither.
- Removing a guest deletes their stay, travel and seats at once; purging an event removes everything.
- The audit log records which parts changed (`guest.logistics_updated`, `seating.updated`, `guest.travel_submitted`), not the personal details.
