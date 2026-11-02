/** Demo data used by `npm run seed` (and recognised by `npm run db:clear`). */
import { c, un } from './seed-images.js';

// ---------------------------------------------------------------- categories
export const CATEGORIES = [
  { key: 'decor', name: 'Home Decor', icon: 'Lamp', image: c('lacquerBox', 500), description: 'Lacquerware, brass and handcrafted decor for every home' },
  { key: 'crochet', name: 'Crochet', icon: 'Flower2', image: c('crochetRed', 500), description: 'Doilies, bags and lace made stitch by stitch' },
  { key: 'clothing', name: 'Clothing', icon: 'Shirt', image: c('dumbara', 500), description: 'Handloom sarees, sarongs and batik wear' },
  { key: 'jewellery', name: 'Jewellery', icon: 'Gem', image: un('1535632066927-ab7c9ab60908', 500), description: 'Ceylon sapphires, moonstones and silverwork' },
  { key: 'pottery', name: 'Pottery', icon: 'Amphora', image: c('potteryPlate', 500), description: 'Clay and terracotta from village kilns' },
  { key: 'batik', name: 'Batik', icon: 'Brush', image: c('batikClose', 500), description: 'Hand-waxed and dyed Sri Lankan batik' },
  { key: 'coconut', name: 'Coconut Crafts', icon: 'TreePalm', image: c('coconutVase', 500), description: 'Carved shell bowls, lamps and ornaments' },
  { key: 'art', name: 'Art', icon: 'Palette', image: c('maskRaksha', 500), description: 'Ambalangoda masks, paintings and carvings' },
  { key: 'tea', name: 'Tea & Spices', icon: 'Leaf', image: c('cinnamonBundle', 500), description: 'Pure Ceylon tea, cinnamon and spice blends' },
];

// ---------------------------------------------------------------- artisan shops
export const SHOPS = [
  {
    key: 'batik', email: 'kandyanbatik@demo.lk', owner: 'Nimali Perera',
    shop: { name: 'Kandyan Batik House', tagline: 'Hand-waxed batik since 1987', district: 'Kandy', craft: 'Batik & handloom', phone: '0812 223 344',
      bio: 'A family workshop in the hills of Kandy. Every piece is drawn by hand, waxed with a tjanting and dyed in small batches using colourfast dyes.',
      logo: c('batikClose', 330), banner: c('batikBrush', 1280) },
  },
  {
    key: 'clay', email: 'molagodaclay@demo.lk', owner: 'Sunil Bandara',
    shop: { name: 'Molagoda Clay Works', tagline: 'Village pottery from the Kegalle road', district: 'Kegalle', craft: 'Pottery & terracotta',
      phone: '0352 245 678', bio: 'Three generations of potters shaping local clay on the wheel and firing in a wood kiln, just as our grandparents did.',
      logo: c('potteryPlate', 330), banner: un('1493106641515-6b5631de4bb9', 1600) },
  },
  {
    key: 'coconut', email: 'ruhunacoconut@demo.lk', owner: 'Kamal Wickramasinghe',
    shop: { name: 'Ruhuna Coconut Crafts', tagline: 'Zero-waste crafts from the southern coast', district: 'Matara', craft: 'Coconut shell crafts',
      phone: '0412 233 455', bio: 'We turn discarded coconut shells into lamps, bowls and ornaments - sanded, carved and polished by hand.',
      logo: c('coconutVase', 330), banner: un('1580910527739-556eb89f9d65', 1600) },
  },
  {
    key: 'crochet', email: 'gallecrochet@demo.lk', owner: 'Dilani Fernando',
    shop: { name: 'Galle Crochet Studio', tagline: 'Lace & crochet from the Fort', district: 'Galle', craft: 'Crochet & lace',
      phone: '0912 244 556', bio: 'A collective of women crocheters inside Galle Fort, keeping Sri Lankan lace traditions alive with modern designs.',
      logo: c('crochetRed', 330), banner: c('crochetDoily', 1280) },
  },
  {
    key: 'mask', email: 'ambalangodamasks@demo.lk', owner: 'Ariyapala Gunasekara',
    shop: { name: 'Ambalangoda Mask & Art', tagline: 'Traditional Kolam & Sanni masks', district: 'Galle', craft: 'Masks, carving & painting',
      phone: '0912 258 963', bio: 'Carved from light kaduru wood and painted in natural pigments - masks from the home of Sri Lankan mask making.',
      logo: c('maskRaksha', 330), banner: c('maskCarver', 1280) },
  },
  {
    key: 'gem', email: 'ratnapuragems@demo.lk', owner: 'Mohamed Rizwan',
    shop: { name: 'Ratnapura Gem Atelier', tagline: 'Ethically mined Ceylon gems', district: 'Ratnapura', craft: 'Jewellery & gemstones',
      phone: '0452 222 111', bio: 'From the "City of Gems": sapphires and moonstones cut and set by hand in silver and gold.',
      logo: un('1535632066927-ab7c9ab60908', 330), banner: un('1599643478518-a784e5dc4c8f', 1600) },
  },
  {
    key: 'tea', email: 'ceylonhilltea@demo.lk', owner: 'Ramesh Thevarajah',
    shop: { name: 'Ceylon Hill Tea & Spice', tagline: 'Single-estate tea and true cinnamon', district: 'Nuwara Eliya', craft: 'Tea & spices',
      phone: '0522 234 567', bio: 'High-grown tea plucked on our family estate and Alba-grade cinnamon from partner growers in the south.',
      logo: c('cinnamonBundle', 330), banner: c('teaPluckers', 1280) },
  },
  {
    key: 'decor', email: 'lakshahome@demo.lk', owner: 'Tharushi Jayawardena',
    shop: { name: 'Laksha Home Decor', tagline: 'Lacquerware & brass from Matale', district: 'Matale', craft: 'Lacquer, brass & decor',
      phone: '0662 231 456', bio: 'Kandyan lacquer (laksha) and hand-cast brass made by master craftsmen for modern homes.',
      logo: c('lacquerBox', 330), banner: c('brassLamp', 1280) },
  },
];
export const PENDING_SHOP = {
  email: 'jaffnapalmyrah@demo.lk', owner: 'Kavitha Sivakumar',
  shop: { name: 'Jaffna Palmyrah Weaves', tagline: 'Palmyrah leaf baskets & mats', district: 'Jaffna', craft: 'Palmyrah weaving',
    phone: '0212 223 344', bio: 'Women-led cooperative weaving baskets, boxes and mats from palmyrah leaves.', logo: '', banner: '' },
};

// ---------------------------------------------------------------- products
// [name, shop, category, price, comparePrice, stock, images, extra]
export const P = [
  ['Peacock Batik Wall Hanging', 'batik', 'batik', 8500, 10500, 12, [c('batikClose'), c('batikEdges')], { featured: true, materials: 'Cotton, wax, colourfast dye', dimensions: '90 x 60 cm' }],
  ['Hand-painted Batik Sarong', 'batik', 'batik', 4200, 0, 25, [c('batikWork'), c('batikPainter')], { colors: ['Indigo', 'Maroon', 'Green'] }],
  ['Batik Cushion Covers (Set of 2)', 'batik', 'batik', 2900, 3400, 30, [c('batikSewing')], { isNew: true, dimensions: '45 x 45 cm' }],
  ['Lotus Batik Silk Scarf', 'batik', 'batik', 3800, 0, 3, [c('batikEdges')], { isNew: true, materials: 'Pure silk' }],
  ['Dumbara Handloom Saree', 'batik', 'clothing', 18500, 21000, 6, [c('dumbara'), c('weaver')], { featured: true, materials: 'Handloom cotton, 6 yards' }],
  ['Handloom Cotton Sarong (Men)', 'batik', 'clothing', 3600, 0, 20, [c('weaver')], { colors: ['Blue check', 'Green check'] }],
  ['Batik Linen Shirt', 'batik', 'clothing', 5400, 6200, 15, [c('batikBrush')], { sizes: ['S', 'M', 'L', 'XL'] }],

  ['Lotus Clay Serving Plate', 'clay', 'pottery', 3200, 0, 18, [c('potteryPlate')], { featured: true, dimensions: '30 cm diameter' }],
  ['Clay Tea Set with Pot', 'clay', 'pottery', 6800, 7900, 9, [un('1564890369478-c89ca6d9cde9')], { featured: true }],
  ['Terracotta Water Pot (Kalaya)', 'clay', 'pottery', 2400, 0, 14, [un('1493106641515-6b5631de4bb9')], { materials: 'Kiln-fired terracotta' }],
  ['Stoneware Cups (Set of 4)', 'clay', 'pottery', 4500, 0, 22, [un('1610701596007-11502861dcfa')], { isNew: true }],
  ['Glazed Dinner Plates (Set of 4)', 'clay', 'pottery', 7200, 8400, 7, [un('1578749556568-bc2c40e68b61')], {}],
  ['Minimal Clay Vases (Trio)', 'clay', 'decor', 5600, 0, 2, [un('1565193566173-7a0ee3dbe261')], { isNew: true }],

  ['Coconut Shell Flower Vase', 'coconut', 'coconut', 2800, 3300, 16, [c('coconutVase')], { featured: true }],
  ['Coconut Lotus Tea-light Holders', 'coconut', 'coconut', 1950, 0, 40, [c('coconutLotus')], { isNew: true }],
  ['Carved Coconut Shell Lamp', 'coconut', 'coconut', 3400, 0, 11, [c('coconutCraft')], {}],

  ['Rose Mandala Crochet Doily', 'crochet', 'crochet', 1850, 0, 24, [c('crochetRed')], { featured: true, dimensions: '35 cm' }],
  ['Crochet Table Centrepiece', 'crochet', 'crochet', 2600, 3000, 12, [c('crochetDoily')], {}],
  ['Wheat Lace Doily', 'crochet', 'crochet', 1600, 0, 9, [c('crochetWheat')], { isNew: true }],
  ['Handmade Crochet Tote Bag', 'crochet', 'crochet', 4900, 5600, 8, [c('crochetBag'), un('1584992236310-6edddc08acff')], { colors: ['Cream', 'Grey'] }],
  ['Fan-stitch Crochet Placemat', 'crochet', 'crochet', 1400, 0, 30, [c('crochetFan')], {}],

  ['Maru Raksha Mask - Kaduru Wood', 'mask', 'art', 9500, 11500, 5, [c('maskRaksha')], { featured: true, dimensions: '40 cm' }],
  ['Deva Sanniya Healing Mask', 'mask', 'art', 7800, 0, 6, [c('maskDeva')], {}],
  ['Ananga Bhairava Mask', 'mask', 'art', 8900, 0, 4, [c('maskAnanga')], { isNew: true }],
  ['Traditional Mask Wall Set', 'mask', 'art', 14500, 16500, 3, [c('maskSet')], {}],
  ['"Monsoon" Abstract Canvas', 'mask', 'art', 22000, 0, 1, [un('1541961017774-22349e4a1262')], { isNew: true, dimensions: '60 x 90 cm' }],

  ['Ceylon Blue Sapphire Drop Earrings', 'gem', 'jewellery', 68000, 75000, 3, [un('1535632066927-ab7c9ab60908')], { featured: true, materials: '925 silver, natural sapphire' }],
  ['Moonstone Pendant Necklace', 'gem', 'jewellery', 24500, 0, 6, [un('1599643478518-a784e5dc4c8f')], { isNew: true }],
  ['Rose Gold Filigree Bracelet', 'gem', 'jewellery', 19800, 22000, 5, [un('1611591437281-460bfbe1220a')], {}],
  ['Freshwater Pearl Necklace', 'gem', 'jewellery', 15500, 0, 7, [un('1515562141207-7a88fb7ce338')], {}],
  ['Handmade Gold-plated Chain Bracelet', 'gem', 'jewellery', 9800, 0, 10, [un('1602173574767-37ac01994b2a')], {}],

  ['Nuwara Eliya Pure Ceylon Tea 200g', 'tea', 'tea', 1650, 0, 80, [un('1615485500704-8e990f9900f7'), c('teaPluckers')], { featured: true }],
  ['Ceylon Tea Estate Sampler (6)', 'tea', 'tea', 3900, 4500, 35, [un('1563822249366-3efb23b8e0c9')], { isNew: true }],
  ['Alba Ceylon Cinnamon Sticks 100g', 'tea', 'tea', 1450, 0, 60, [c('cinnamonBundle'), c('cinnamonSpices')], { featured: true }],
  ['Sri Lankan Spice Box (8 spices)', 'tea', 'tea', 4200, 4800, 20, [un('1596040033229-a9821ebd058d'), c('kandySpiceShop')], {}],
  ['Roasted Curry Powder Set', 'tea', 'tea', 1200, 0, 45, [un('1532336414038-cf19250c5757')], {}],
  ['True Cinnamon Powder 100g', 'tea', 'tea', 980, 0, 4, [c('cinnamonPowder')], {}],

  ['Kandyan Lacquerware Jewel Box', 'decor', 'decor', 6500, 7500, 9, [c('lacquerBox')], { featured: true }],
  ['Brass Pahana Oil Lamp', 'decor', 'decor', 12800, 0, 4, [c('brassLamp')], { dimensions: '55 cm' }],
  ['Hand-spun Brass Pendant Lights', 'decor', 'decor', 9900, 11900, 6, [un('1606170033648-5d55a3edf314')], { isNew: true }],
  ['Handcrafted Wall Art Frame Set', 'decor', 'decor', 7400, 0, 8, [un('1513519245088-0e12902e5a38')], {}],
];

export const BANNERS = [
  { position: 'hero', order: 1, tag: 'Handmade in Sri Lanka', title: 'Crafted by island hands, made for your home',
    subtitle: 'Shop batik, pottery, masks and more - direct from 100+ Sri Lankan artisans.',
    image: c('batikBrush', 1280), buttonText: 'Explore crafts', link: '/shop', bgColor: '#fdf3e7' },
  { position: 'hero', order: 2, tag: 'From the hill country', title: 'Pure Ceylon tea & true cinnamon',
    subtitle: 'Single-estate teas from Nuwara Eliya and Alba-grade cinnamon, packed fresh by growers.',
    image: c('teaPluckers', 1280), buttonText: 'Shop tea & spices', link: '/shop?category=tea-spices', bgColor: '#eef5ea' },
  { position: 'hero', order: 3, tag: 'Ambalangoda masks', title: 'Living traditions, carved in kaduru wood',
    subtitle: 'Raksha, Sanni and Kolam masks hand-painted by master carvers of the south coast.',
    image: c('maskCarver', 1280), buttonText: 'Discover art', link: '/shop?category=art', bgColor: '#fbeee6' },
  { position: 'hero', order: 4, tag: 'Island-wide delivery', title: 'From Ella to your doorstep',
    subtitle: 'Cash on delivery across all 25 districts. Free delivery over Rs 15,000.',
    image: un('1566296314736-6eaac1ca0cb9', 1600), buttonText: 'Start shopping', link: '/shop', bgColor: '#e9f3f1' },
  { position: 'promo', order: 1, tag: 'Zero-waste', title: 'Coconut shell crafts', subtitle: 'Lamps, vases & bowls from the south',
    image: c('coconutVase', 960), buttonText: 'Shop coconut crafts', link: '/shop?category=coconut-crafts', bgColor: '#f6ead8' },
  { position: 'promo', order: 2, tag: 'Galle Fort lace', title: 'Crochet & lace, stitch by stitch', subtitle: 'Doilies from Rs 1,400',
    image: c('crochetRed', 960), buttonText: 'Shop crochet', link: '/shop?category=crochet', bgColor: '#fbe9e7' },
  { position: 'strip', order: 1, title: 'Free island-wide delivery on orders over Rs 15,000' },
  { position: 'strip', order: 2, title: 'Cash on delivery available in all 25 districts' },
  { position: 'strip', order: 3, title: 'Every purchase supports a Sri Lankan artisan family' },
];

export const REVIEWS = [
  [5, 'Absolutely beautiful work, even better in person. Packed with so much care!'],
  [5, 'You can really feel that this was made by hand. Will buy again.'],
  [4, 'Lovely quality. Delivery to Colombo took 3 days.'],
  [5, 'Bought as a gift for my aunt in Canada - she loved it.'],
  [4, 'Great craftsmanship, colours slightly different from the photo but still lovely.'],
  [5, 'Supporting local artisans never felt so good. Highly recommend this shop.'],
];
