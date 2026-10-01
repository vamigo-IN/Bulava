# Localization

`packages/localization` holds the language registry, translation catalogs, and locale-aware formatting. No UI string is hard-coded: components call `t('invitation.youAreInvited')`.

## Languages

Initial registry: English, Hindi, Hinglish (`hi-Latn`), Marathi, Gujarati, Punjabi, Bengali, Tamil, Telugu, Kannada, Malayalam, Odia, Assamese and Urdu (RTL). The DB `languages` table is seeded from the registry and decides which languages are enabled at runtime.

Each language defines its script, text direction, `Intl` locale, native numbering system, and a fallback language. For example, `mr` falls back to `hi` and then `en`.

To add a language:

1. Add a `LANGUAGES` entry.
2. Add a catalog in `src/catalogs/`, which may be partial.
3. Run the seed.

Application code does not change.

## Catalogs

- `en.ts` is the source of truth. Its keys define the `MessageKey` type, so a missing key is a compile error.
- Other catalogs are partial and fall back through `fallbackChain(code)`.
- Guest-facing strings are complete in Hindi and partially covered in Hinglish. Host-dashboard strings fall back to English.
- DB overrides (`translations` table) are layered over bundled catalogs through `createTranslator(language, overrides)`. The admin UI for editing them is planned.
- Placeholders use `{name}` syntax.

> Hindi and Hinglish strings were machine-authored and must be reviewed by native speakers before launch. Catalogs for the other 11 languages are still to be written.

## Dates and times

- Timestamps are stored in UTC and rendered in `Event.timezone`.
- `formatEventDate`, `formatEventDateWithWeekday` and `formatEventTime` use `Intl` with Latin digits by default. `nativeDigits: true` gives, for example, `१५ दिसंबर २०२६`. A 12-hour clock is the default.
- Hosts type wall-clock times in the event's zone. `zonedWallTimeToUtcIso` converts them, handling DST for NRI guests abroad, and `utcToZonedWallTime` converts back for editing.

## Fonts

The web and admin apps load every template font family through `next/font` (Playfair Display, Cormorant Garamond, Great Vibes, Poppins, Noto Sans, Noto Serif, Noto Sans Devanagari, Noto Serif Devanagari, Tiro Devanagari Hindi) and expose them as CSS variables the template engine reads; browsers only download a file when text uses it. The video worker loads the same families through `@remotion/google-fonts`. Other scripts use system fonts for now. The planned font registry maps each script to Noto families for Gujarati, Gurmukhi, Bengali, Tamil, Telugu, Kannada, Malayalam, Odia and Nastaliq. Template fonts declare their script coverage, and renderers verify glyph coverage (see [templates.md](templates.md)).

## Where the language comes from

| Surface | Language |
|---|---|
| Guest invitation page and WhatsApp message | `Guest.preferredLanguage`, else `Event.language` |
| Invalid or expired invitation page | English and Hindi together, since the guest is unknown |
| Host dashboard | English (user locale switching planned) |
| Public event page and registration form | `Event.language` |
| Admin console | English, from its own catalog in `apps/admin/src/lib/i18n.ts` (no hard-coded strings in components) |
