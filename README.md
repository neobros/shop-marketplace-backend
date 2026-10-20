# shop-marketplace-backend

Node.js + Express REST API for **Ceylon Craft Collective**, a multi-vendor marketplace where Sri Lankan artisans and small creative businesses sell handmade products.

- **Database:** Firebase **Firestore**.
- **Auth:** the API's own **JWT + bcrypt**. It does not use Firebase Authentication.
- **Roles:** `customer`, `seller` (artisan shop) and `admin`.
- **Currency:** LKR. Delivery costs Rs 450 and is free over Rs 15,000. The platform commission is 10%. Change these in `src/config/shop.js` or `.env`.

## Setup

```bash
npm install
cp .env.example .env          # then set JWT_SECRET
```

1. In the [Firebase Console](https://console.firebase.google.com), create a project and enable **Firestore Database**.
2. Go to **Project settings → Service accounts → Generate new private key** and save the file as `serviceAccountKey.json` in this folder. It is git-ignored.
3. Seed the demo data and start the API:

```bash
npm run seed -- --fresh   # categories, 8 artisan shops, 41 products, banners, reviews, orders
npm run dev               # http://localhost:5000
```

| Demo login | Email | Password |
|---|---|---|
| Admin | admin@shop.com | Admin@123 |
| Seller (approved) | kandyanbatik@demo.lk (also molagodaclay@, ruhunacoconut@, gallecrochet@, ambalangodamasks@, ratnapuragems@, ceylonhilltea@, lakshahome@ …demo.lk) | Seller@123 |
| Seller (pending application) | jaffnapalmyrah@demo.lk | Seller@123 |
| Customer | ayesha@demo.lk | Customer@123 |

### Running without a Firebase project
```bash
npx firebase-tools emulators:start --only firestore --project demo-shop   # needs Java
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run seed -- --fresh
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run dev
```

## Deploy to Vercel
The app lives in `src/app.js`. `api/index.js` exposes it as a serverless function, and `vercel.json` sends every route to it. For local development, `src/server.js` still runs `app.listen`.

1. Import this repo in Vercel (Framework preset: **Other**, no build command).
2. Add these environment variables in Vercel:
   - `JWT_SECRET`: a long random string
   - `FIREBASE_SERVICE_ACCOUNT`: the full contents of `serviceAccountKey.json`
   - `CLIENT_URL`: your frontend URL, e.g. `https://your-shop.vercel.app`
3. Deploy, then open `https://<backend>.vercel.app/api/health`.
4. In the frontend project, set `VITE_API_URL=https://<backend>.vercel.app/api` and redeploy.

Run `npm run seed` from your own machine (with `.env` pointing at the same Firebase project), not on Vercel.

## How the marketplace works
1. **Applying:** a customer applies at `POST /api/sellers/apply`. Their role becomes `seller` and the shop status becomes `pending`.
2. **Review:** an admin approves, rejects or suspends the shop at `PUT /api/sellers/:id/status`. Suspending a shop hides all of its products.
3. **Products:** approved sellers create and edit only their own products. Each product stores its shop's name, slug and district, so listings need no extra lookups. Only admins can set the "featured" flag.
4. **Orders:** an order can contain items from several sellers. Each seller sees only their own lines, plus their earnings after commission, at `GET /api/seller/orders`. They update their own fulfilment status (processing → shipped → delivered). The order's overall status is worked out from all sellers' statuses.
5. **Integrity:** prices are recalculated on the server, stock is checked and decremented in a transaction, and cancelling an order restores the stock.

## API

| Method | Route | Access |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | public |
| GET/PUT | `/api/auth/me` · PUT `/api/auth/me/password` · wishlist `/api/auth/me/wishlist[/:productId]` | user |
| GET | `/api/products?q&category&seller&district&minPrice&maxPrice&sort&featured&isNew&page&limit` | public |
| GET | `/api/products/:idOrSlug` (with seller, reviews, related) | public |
| POST/PUT/DELETE | `/api/products[/:id]` | admin or approved seller (own products) |
| POST | `/api/products/:id/reviews` | user |
| GET | `/api/sellers?q&district` · `/api/sellers/:slug` | public |
| POST | `/api/sellers/apply` · PUT `/api/sellers/me` | user / seller |
| GET | `/api/sellers/admin/all?status=` · PUT `/api/sellers/:id/status` | admin |
| GET | `/api/seller/products` · `/api/seller/orders` · `/api/seller/stats?days=` · PUT `/api/seller/orders/:id/status` | seller |
| GET | `/api/categories` · `/api/banners?position=hero\|promo\|strip` (+ admin CRUD) | public / admin |
| POST | `/api/orders` · GET `/api/orders/mine` · `/api/orders/:id` · PUT `/api/orders/:id/cancel` | user |
| GET | `/api/orders` · PUT `/api/orders/:id/status` | admin |
| GET/POST/PUT/DELETE | `/api/users[/:id]` | admin |
| GET | `/api/admin/stats?days=30` · `/api/config` | admin / public |

## Demo photo credits
The demo images come from Wikimedia Commons under the licences listed below, plus Unsplash. **Replace them with the artisans' own photos before launch.**

| File | Author | Licence |
|---|---|---|
| Crochet doily fan stitch.png | WillowW | CC BY 3.0 |
| Crocheted doily, representing ears of ripe wheat.jpg | The original uploader was Kgraff at Engl | CC BY-SA 2.5 |
| Crochet doily.JPG | רחל1 | CC BY-SA 4.0 |
| சிரட்டைக் கைப்பணி அலங்காரப் பொருள் 01.jpg | SL Trades and Crafts Documentation Proje | CC BY-SA 4.0 |
| சிரட்டைக் கைப்பணி அலங்காரப் பொருளுக்கான வேலைப்பாடு 01.jpg | SL Trades and Crafts Documentation Proje | CC BY-SA 4.0 |
| 003 2021 03 05 Handarbeit.jpg | Friedrich Haag | CC BY-SA 4.0 |
| Spice shop in Kandy Market, Sri Lanka.jpg | McKay Savage | CC BY 2.0 |
| Cinnamomum verum spices.jpg | Simon A. Eugster | CC BY-SA 3.0 |
| View of a Hindu brass lamp topped by a rooster at the Grand Oriental Hotel in Colombo 03.jpg | Levi Clancy | CC0 |
| Cinnamon srilanka.jpg | Vidarshana sandaruwan | CC BY-SA 4.0 |
| Ground Cinnamon Powder and a Cinnamon Stick.jpg | formulatehealth | CC BY 2.0 |
| Laksha - ලාක්ෂා - Lacquerware.jpg | Chandan.S | CC BY-SA 4.0 |
| Polonnäruvâ Centre artisanal de sculptures sur bois WLF2023 (1).jpg | Pierre André Leclercq | CC BY-SA 4.0 |
| Polonnäruvâ Centre artisanal de sculptures sur bois.- Traditional masks.jpg | Pierre André Leclercq | CC0 |
| Gewuerze 004 2024 08 10.jpg | Friedrich Haag | CC BY-SA 4.0 |
| Sigiriya.jpg | Bernard Gagnon | CC BY-SA 3.0 |
| Craft item.jpg | Nandhinikandhasamy | CC BY-SA 3.0 |
| Crochet bag.jpg | Whippetsgalore2 | CC BY-SA 4.0 |
| Ceylon Tea in SL.jpg | Curved.kiwix | CC BY-SA 4.0 |
| Using batik inkt Sri Lanka.JPG | Peter van der Sluijs | CC BY-SA 3.0 |
| Woman with brush painting batik Sri Lanka.JPG | Peter van der Sluijs | CC BY-SA 3.0 |
| Woman batik painting Sri Lanka.JPG | Peter van der Sluijs | CC BY-SA 3.0 |
| Woman who sews batik factory Sri Lanka.JPG | Peter van der Sluijs | CC BY-SA 3.0 |
| Batik Sri Lanka.JPG | Peter van der Sluijs | CC BY-SA 3.0 |
| Edges painting batik factory Sri Lanka.JPG | Peter van der Sluijs | CC BY-SA 3.0 |
| Tradtional Sri Lankan Pottery.jpg | VinPrasad | CC BY-SA 4.0 |
| (Maru Rakshaya) Traditional masks of Ambalangoda, Sri Lanka - Tharaka Nirmal Photography.png | Henda Hewa Tharaka Nirmal | CC BY-SA 4.0 |
| (Deva Sanniya) Traditional masks of Ambalangoda, Sri Lanka - Tharaka Nirmal Photography.png | Henda Hewa Tharaka Nirmal | CC BY-SA 4.0 |
| (Ananga Bahirawa) Traditional masks of Ambalangoda, Sri Lanka - Tharaka Nirmal Photography.png | Henda Hewa Tharaka Nirmal | CC BY-SA 4.0 |
| Weaver of Sri Lanka.JPG | Peter van der Sluijs | CC BY-SA 3.0 |
| Dumbara Rata.jpg | Mahiru Fernando | CC BY-SA 4.0 |




