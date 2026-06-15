# CHANGELOG - Home Body Content Separation Only

## Scope
Corrected files only. No shop, discount, cart, review, analytics, menu, product, authentication, or backend files changed.

## Files Modified
| File | Change | Effect |
|---|---|---|
| `script.js` | Separated Home hero/banner title from editable body content rendering | Prevents the hero title such as “Premium Furniture” from repeating again in the body |
| `public/script.js` | Same frontend fix for deployed/public build | Keeps Railway/public deployment consistent |

## Behavior After Fix
- The Home page title/subtitle fields continue to control the banner/hero content.
- The Home page body field controls a separate editable body section.
- The body section no longer automatically repeats the title as a heading.
- If body content is empty, the separate body section is hidden.
- Existing Shop by Room boxes remain unchanged.
