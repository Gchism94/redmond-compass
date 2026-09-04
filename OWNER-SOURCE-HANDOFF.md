# Main-site owner workflow and app mirror

`redmondcompass.com` remains the authoritative place for business-directory records. The
app is a read model: it mirrors published business data from the main site's public
`listBusinessesPublic` function every six hours.

## Owner workflow

1. New businesses begin at `https://list.redmondcompass.com/claim-page`.
2. Existing owners change business name, address, contact details, hours, and identity
   images in `https://redmondcompass.com/dashboard` (or through the main site's emailed
   owner-edit link).
3. New events use `https://redmondcompass.com/submit-event`; new business posts use
   `https://redmondcompass.com/submit-post`; classes are managed in
   `https://redmondcompass.com/dashboard`.
4. The app mirrors businesses at `47 */6 * * *` UTC and approved events, posts, and
   classes at `37 */6 * * *` UTC. Owners should allow up to six hours after approval.

In app-only mode, `/manage/edit` is a handoff rather than a second editor. It opens the
main-site dashboard and provides a copyable packet of the current app details. This is the
safe path for a field that exists in the app but is missing from the main site.

The app-only owner dashboard and every legacy app content-editor URL now hand off to these
main-site routes. Authenticated browser roles have no insert, update, or delete grants on
`bulletins`, `events`, or `business_classes`; only the service-role mirror can change them.
Existing app-authored rows are preserved read-only.

## What the business mirror retains

All public, non-ranking fields currently exposed by the main site are retained, including:

- primary and additional categories, subtype/tags, descriptions, address visibility,
  contact details, hours and hours-location label;
- primary identity image, headshot, videos, social profiles, specials, licensing, and
  additional locations;
- referral metadata and the authoritative record's update timestamp.

`featured` is intentionally not mirrored. It is a ranking flag, and the app's equal-ranking
contract excludes paid or editorial placement from directory ordering.

Fields that the public function does not expose cannot be mirrored until the owner grants a
server-side Base44/GHL read contract. Never scrape a signed-in owner page or put an owner
credential in browser code.

## Read-only parity audit

Run:

```bash
npm run audit:business-parity
```

It compares the current public main-site feed with published app rows and reports:

- duplicate main-site records;
- businesses missing hours everywhere;
- fields where the main site is blank but the app has a usable value;
- source-only and app-only records.

The audit never writes either system. Apply corrections through the owner's existing
main-site workflow, then rerun the audit after the next mirror refresh.

## Current correction packet (2026-09-03)

- 147 published main-site rows represent 146 unique businesses.
- The current field-level correction queue is empty: no useful app value is missing from
  its matching main-site record.
- The duplicate is **Rowdy Ranch Boutique and Resale**; keep
  `6a8744e461ea895c906123b1` and merge/remove `6a2444453a236808d4a7438b` upstream.
- 32 unique main-site businesses have no usable hours in either system. The all-days-closed
  placeholder shape is not counted as a schedule. These records need owner-supplied hours
  or an explicit appointment/variable-hours statement.
