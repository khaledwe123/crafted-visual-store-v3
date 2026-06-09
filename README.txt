Crafted Visual Advanced Static E-commerce Website

New features:
- Admin can attach one or many pictures per color.
- Front end shows product pictures like Amazon thumbnails.
- Admin can choose colors with a color picker.
- Admin can enter a color number/code such as DG-2026 or a HEX number such as #183D32.
- Arabic / English website.
- Product categories: L Shape Sofas, Beds, Single Chairs.
- Cart and WhatsApp checkout.

How to use:
1. Upload all files inside maison_living_website to your hosting public_html.
2. Open index.html for the website.
3. Open admin.html to manage products.
4. Add or edit a product.
5. For each color, add:
   - Color name
   - Color code/number
   - Color picker value
   - Multiple attached images
6. Save product.
7. The website will immediately show the color and photos.

Important:
This is a static HTML website. The admin saves data in the browser localStorage.
For permanent publishing:
1. In admin.html click Export products.json.
2. Copy the JSON.
3. Replace products.json on your hosting.

Note:
If you want a true backend with login, database, image storage, and order records, you need PHP/MySQL or Node.js hosting.


Bug-fix update:
- Checkout now opens review.html instead of WhatsApp directly.
- Customers must sign up/sign in before checkout.
- Added auth.html for account creation and sign in.
- Added review.html order review page.
- Added star rating per product.
- Added orders.html in admin for viewing local orders and ratings.

Important security note:
This is still a static HTML website using localStorage. It is suitable as a prototype.
For real customer accounts, passwords, payments, and production orders, use a real backend database and server-side authentication.


CMS upgrade:
- Checkout city is now a scroll-down list.
- Riyadh delivery = free.
- Outside Riyadh delivery = SAR 400.
- Admin controls full homepage content.
- Admin controls banner image.
- Admin controls WhatsApp number.
- Admin controls Riyadh/outside Riyadh delivery fees.
- Admin controls menu items and visibility.
- Admin controls cities list.
- Products now support discount percentage.
- Front end shows old price, new price, and discount badge.

Static backend note:
All admin edits are saved in browser localStorage. To publish permanently, export JSON from admin and replace the matching .json file on the server:
- products.json
- settings.json
- menu.json
- cities.json


Payment and UX update:
- Company renamed to Crafted Visual.
- After Add to Cart, product popup stays open.
- Added success box with Continue Shopping, View Cart, Checkout Now.
- Confirm Order now opens payment.html.
- Payment methods added: Mada, Visa, Mastercard, Apple Pay, Samsung Pay.
- Added payment-style logos using HTML/CSS.
- Added thankyou.html.
- Orders page now shows payment status and method.

Important:
The payment page is a front-end demo only. For real live payments, connect a certified payment gateway such as Moyasar, HyperPay, Tap Payments, PayTabs, or Amazon Payment Services.


Backend menu update:
Admin now has 5 main sections:
1. Menu Control
2. Pictures & Banners Control
3. Products
4. Product Category
5. Discount Page

Customer view update:
- Added sort/filter controls in shop.
- Sort by Featured, High Price First, Low Price First, Highest Discount, Best Rating, Name A-Z.
- Category filter remains available.

Brand update: Customer-facing company name changed to Crafted Visual. Admin remains Crafted Visual CMS. Order prefix changed to CV-.


Final requested update:
- Removed remaining Crafted Visual references.
- Customer-facing brand is Crafted Visual.
- Added social media icons and links.
- Added admin fields for social media URLs.
- Added Google Analytics ID, Google Tag Manager ID, Meta Pixel, TikTok Pixel, Snap Pixel, and Hotjar fields.
- Added analytics loader in the website head.
- Added CRM page: crm.html.
- Added customer/order follow-up tracking.
- Added order status updates and follow-up notes in orders.html.
- Added customer Track Order page: track-order.html.

Important production note:
This is still a static HTML/localStorage prototype. A real CRM with secure accounts, multi-user admin, permanent follow-ups, payment capture, and customer history requires PHP/MySQL or Node/PostgreSQL backend.


Product admin simplification:
- Simple Add Product form.
- Fewer required fields: name, category, price, color photos.
- Product ID auto-generates if empty.
- Quick checkbox options for sizes and fabrics.
- Advanced options hidden under dropdown.
- Product search in admin.
- Duplicate product button.
- Sticky save button.

Order email and homepage update:
- Website menu appears at the top and inside the homepage hero.
- Added About Us content section on homepage.
- Admin can edit About Us text and image.
- Orders page now has Save Status button.
- Each order status/payment update generates a ready customer email.
- Send Email opens the customer email client with subject and body.
- Status history is saved per order.

Note: static HTML cannot send emails silently. The Send Email button opens a prepared email in the mail client using mailto. Fully automatic sending requires SMTP/SendGrid/Mailgun/Amazon SES/Zoho Mail API with backend.

Auto notification update:
- Saving any order update opens a ready customer email.
- Saving any order update opens a ready customer WhatsApp message.
- Payment confirmation opens email and WhatsApp messages.
- Notification activity is saved in CRM.

Note: Static HTML cannot silently send email/WhatsApp in the background. It opens the customer email client and WhatsApp chat with ready messages. Fully automatic sending requires SMTP/email API and WhatsApp Business Cloud API.


CRM automatic sender update:
- Order updates no longer open Outlook/mail client.
- Status update creates CRM email from do-not-reply@craftedvisual.com.
- Email is stored in CRM Email Outbox.
- If CRM Email API URL is added in admin, the website sends a POST request to that endpoint.
- WhatsApp follow-up is stored in CRM WhatsApp Outbox.
- If WhatsApp Business API URL is added in admin, the website sends a POST request to that endpoint.
- CRM page now shows Email Outbox and WhatsApp Outbox.

Production requirement:
For real automatic email delivery, connect crm_email_api_url to a backend endpoint using SendGrid, Mailgun, Amazon SES, SMTP, Zoho Mail, or Google Workspace SMTP.
For real WhatsApp automation, connect whatsapp_business_api_url to WhatsApp Business Cloud API.


Financial dashboard update:
- Added financial-dashboard.html.
- Tracks total sales before VAT.
- Calculates VAT at 15%.
- Shows sales including VAT.
- Tracks Cost of Goods Sold.
- Calculates gross profit, gross margin and net profit.
- Allows adding general expenses.
- Allows adding operational expenses.
- Allows manual offline sales and COGS.
- Added COGS field in product admin.
- Added VAT % field in product admin.

Menu repair update: Rebuilt admin tabs using external admin.js, fixed JavaScript syntax, added default website menu fallback, and added VAT price display before VAT + VAT 15% + total incl. VAT.

Size pricing update: Products now support different price before VAT per size. Added standard sizes for L Shape Sofas, Beds, and Single Chairs. Product page updates VAT/total based on selected size.

Admin save fix: added save status messages, made Arabic product category automatic from selected English category, improved product save/edit reliability, and added clearer localStorage error messages for oversized images.

Cart/fabric pricing update: fixed add-to-cart sizeOptions bug, added fabric + size price matrix, delivery VAT, and automatic image compression for larger uploads.

Final fix: cart now stores lightweight product references only, not images/full products; removed duplicate Contact menu and kept Contact Us; product modal closes after add-to-cart; cart shows color/fabric/size/qty; old heavy cart is cleaned on load.

Full bug revision: fixed cart checkout/close by restoring checkout function and robust cart functions; cart no longer stores images; financial dashboard now filters all time/date range/month/quarter and shows filtered totals.

Update:
- Fixed category buttons/filter menu behavior.
- Custom furniture request now requires only contact name, mobile, and message/notes.
- Removed Contact menu and kept Contact Us.
- Admin login added.
- Default Super Admin: superadmin@craftedvisual.com / Admin@12345
- Default Admin: admin@craftedvisual.com / Admin@12345
- Super Admin can create/delete admin users.
- Product image file input no longer compresses or enforces image size in code.

Update: Discount display is now red. Financial dashboard month filter now uses separate Month and Year selectors.

Update:
- Removed homepage floating menu on hero/green image.
- Improved banner/about picture saving with compressed session fallback.
- Track order now requires exact full order number.
- Added customer Forgot Password.
- Added captcha to sign in, sign up, and forgot password.
- Password reset requests are logged in CRM.

Responsive update: Added mobile, tablet, and iPad responsive layout rules without changing website data or content.

Fix: Restored account.html and contact.html pages and improved partial-window responsiveness.

Update:
- Added WhatsApp number/social links admin fields and WhatsApp hello message.
- Super Admin can create admins with authorities and edit/remove authorities.
- New product categories now render dynamically on website buttons/filter/custom form.
- Orders page now has status icons to monitor/update orders.
- CRM page now includes search and pagination, 10 records per page per section.
- Discount codes can be issued in admin and applied at checkout.
- Arabic product description displays in product modal when Arabic language is selected.
- Product modal close button moved above menu/z-index issue fixed.

Update:
- Product sizes are now manually added in an admin table with dimensions and price before VAT.
- Fabrics are now manually added in an admin table with description and additional price.
- Fabric + size pricing is calculated automatically.
- Categories are dynamically visible on website buttons/filter/custom form.
- Checkout discount code box added/ensured.
- Discount page has a Save button.

Update:
- Sizes are added manually without price.
- Fabrics are added manually with description.
- Added Size + Fabric price table with fabric dropdown-style columns next to each size.
- Price is now manually entered for every size + fabric combination.
- Fabric description appears next to product details on product page.

Update: Review order page now includes discount code box with Apply button. Valid active codes calculate discount immediately and update total.

Update: Admin footer control added for CR number, VAT number, address, email, phone, and extra footer information in English/Arabic.

Fix: Discount code box forced visible on review page. Category add/remove now autosaves to storage and website dynamic category menu reads storage and product categories.

Fix: lower category menu re-rendered dynamically and responsive after category changes. Admin user permissions now support read/write per section. Discount code box forced visible on review page.

Fix:
- Removed/blocked Luxury and Luxury Line categories from website/admin category displays until re-added intentionally later.
- Fixed admin login permissions issue where normal Admin users could see a blank backend.
- Admin users with old/missing permissions now default to readable backend sections instead of blank screen.
- Read/Write permissions remain supported per backend section.

Arabic Enhancement:
- Added translate-ar.js Arabic auto-translation engine.
- Added Auto Translate Arabic Content toggle in admin.
- If Arabic fields are empty, English content is auto-filled/transliterated using furniture-focused Arabic dictionary.
- Product Arabic name/description fallback added.
- Category Arabic fallback added.
- Fabric Arabic name/description fallback added.
- Improved RTL styling for Arabic version.

Update:
- Admin can now control the three About Us small boxes from backend.
- Size + Fabric matrix now includes both Selling Price Before VAT and Cost for every combination.
- Product cost is saved per selected size/fabric combination and carried to cart/order for financial reporting.

Permission Enforcement Fix:
- Admin session now loads exact permissions from the saved admin user every login and every page load.
- Admin users no longer get automatic read/write everything.
- Read permissions control visibility.
- Write permissions control editing; read-only sections are disabled.
- Orders, CRM and Financial Dashboard pages enforce read/write permissions.
- Super Admin can edit authorities using a Read/Write matrix, not a text prompt.


LATEST REVISION:
- About Us page and menu item removed.
- Final menu: Home, Shop, Custom Order, Track Order, Contact Us, My Account.
- Admin default menu updated to match the live website.
