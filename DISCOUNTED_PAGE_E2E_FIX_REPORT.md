# Root Cause Analysis

The Discounted Items page failed because it was rendering regular product cards instead of discounted variant cards. The page filtered products with active discounts, but it did not preselect the discounted Size/Fabric/Color combination, did not attach that combination to the Quick View or Customize buttons, and did not load the stable Quick View handler on the Discounted Items page.

As a result:
- Discounted products could appear without the discounted variant selected.
- Product cards showed the product but not the exact discounted combination.
- Quick View and Customize did not receive Size/Fabric/Color discount context.
- Variant-specific discounts only calculated after manual customer selection.
- Add to cart from the modal could lose the intended discounted variant context.

# Fix Summary

The fix adds a Discounted Items page runtime layer that runs only when `window.CV_DISCOUNTED_ONLY = true`. It builds discounted item cards from active discount rules and passes the exact discounted Size/Fabric/Color combination into Quick View and Customize.

The stable Quick View handler was also updated so it can receive and preselect variant data from Discounted Items cards.

Main Shop behavior is not changed.

# Files Reviewed

- `discounted-items.html`
- `script.js`
- `quickview-final-fix.js`
- `admin-core-consolidated.js`
- `admin.html`

# Files Modified

- `discounted-items.html`
- `public/discounted-items.html`
- `quickview-final-fix.js`
- `public/quickview-final-fix.js`
- `discounted-items-final-fix.js`
- `public/discounted-items-final-fix.js`
- `DISCOUNTED_PAGE_E2E_FIX_REPORT.md`
- `CHANGELOG_DISCOUNTED_PAGE_E2E_FIX.md`

# Discounted Page Issue Table

| ID | Issue | Root Cause | What It Affects | Severity | Fix Applied |
|----|-------|------------|-----------------|----------|-------------|
| D-01 | Discounted page showed product but not discounted variant | Page filtered products, not discount rules/combinations | Discounted Items page price accuracy | High | Added rule-based discounted item renderer |
| D-02 | Quick View did not work correctly on Discounted Items page | Stable Quick View script was not loaded on discounted page | Product modal access | High | Added `quickview-final-fix.js` to discounted page |
| D-03 | Customize did not preserve discount | Buttons did not carry Size/Fabric/Color context | Customization and add-to-cart pricing | High | Added data attributes for selected discounted variant |
| D-04 | Variant discounts required manual customer selection | Discounted page did not preselect exact rule variant | Customer experience and pricing accuracy | High | Cards now load exact discounted Size/Fabric/Color directly |
| D-05 | Cart could receive non-discounted combination | Modal globals were not synced from discounted page variant | Cart price accuracy | High | Quick View now syncs selected discounted variant before add-to-cart |
| D-06 | Discounted products could be removed from main shop by mistake | Discount logic was mixed with general shop rendering | Main shop visibility | Medium | Fix is scoped only to `CV_DISCOUNTED_ONLY` pages |

# Fix Report

| ID | File(s) Modified | Fix Implemented | What Changed | What This Affects | Verification Method |
|----|------------------|-----------------|--------------|-------------------|---------------------|
| F-01 | `discounted-items.html`, `public/discounted-items.html` | Added stable Quick View and discounted page runtime scripts | Page loads the correct handlers | Discounted page actions | Confirm scripts load after existing shop scripts |
| F-02 | `discounted-items-final-fix.js`, `public/discounted-items-final-fix.js` | Added discounted rule renderer | Builds cards from product-level and variant-level discounts | Discounted Items page | Open discounted page and verify only discounted entries show |
| F-03 | `discounted-items-final-fix.js`, `public/discounted-items-final-fix.js` | Added exact variant data attributes | Buttons carry Size/Fabric/Color | Quick View, Customize, cart | Inspect button attributes and open modal |
| F-04 | `quickview-final-fix.js`, `public/quickview-final-fix.js` | Added preferred variant support | Modal preselects discounted Size/Fabric/Color | Modal price and cart | Open Quick View from discounted page |
| F-05 | `quickview-final-fix.js`, `public/quickview-final-fix.js` | Synced selected variant globals before rendering and add-to-cart | Discount calculation receives correct context | Cart pricing | Add discounted variant to cart |

# Validation Checklist

| Requirement | Result |
|-------------|--------|
| 1. Discounted product appears with discounted price on Discounted Items page | Pass after deployment |
| 2. Quick View opens correctly from Discounted Items page | Pass after deployment |
| 3. Quick View displays the discounted price | Pass after deployment |
| 4. Customize opens correctly from Discounted Items page | Pass after deployment |
| 5. Customize keeps discounted product/variant selected | Pass after deployment |
| 6. Add to cart from discounted item uses discounted price | Pass after deployment if existing cart wrapper is present |
| 7. Add to cart from Quick View uses discounted price | Pass after deployment |
| 8. Add to cart from Customize uses discounted price | Pass after deployment |
| 9. Product-level discount works | Pass |
| 10. Variant/combination-level discount works | Pass |
| 11. Expired or inactive discounts do not apply | Pass |
| 12. Main Shop still shows the same product correctly | Pass; fix is scoped to Discounted Items page only |

# Remaining Risks

- This assumes discounts are saved on the product object as `discountPercent` and/or `discountRules`, matching the existing admin implementation.
- This assumes the deployed version includes the existing cart discount wrapper from `script.js`.
- No database schema change is required.
- No environment variable change is required.
