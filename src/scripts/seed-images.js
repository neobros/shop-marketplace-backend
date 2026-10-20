// Demo images from Wikimedia Commons (free licences — see credits) and Unsplash.
// Replace with the artisans' own product photos before going live.

const wm = (url, w) => url.replace(/\/\d+px-/, `/${w}px-`);
const un = (id, w = 900) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

const COMMONS = {
  crochetFan: "https://upload.wikimedia.org/wikipedia/commons/4/48/Crochet_doily_fan_stitch.png",
  crochetWheat: "https://upload.wikimedia.org/wikipedia/commons/4/45/Crocheted_doily%2C_representing_ears_of_ripe_wheat.jpg",
  crochetDoily: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/Crochet_doily.JPG/1280px-Crochet_doily.JPG",
  coconutVase: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/%E0%AE%9A%E0%AE%BF%E0%AE%B0%E0%AE%9F%E0%AF%8D%E0%AE%9F%E0%AF%88%E0%AE%95%E0%AF%8D_%E0%AE%95%E0%AF%88%E0%AE%AA%E0%AF%8D%E0%AE%AA%E0%AE%A3%E0%AE%BF_%E0%AE%85%E0%AE%B2%E0%AE%99%E0%AF%8D%E0%AE%95%E0%AE%BE%E0%AE%B0%E0%AE%AA%E0%AF%8D_%E0%AE%AA%E0%AF%8A%E0%AE%B0%E0%AF%81%E0%AE%B3%E0%AF%8D_01.jpg/1280px-%E0%AE%9A%E0%AE%BF%E0%AE%B0%E0%AE%9F%E0%AF%8D%E0%AE%9F%E0%AF%88%E0%AE%95%E0%AF%8D_%E0%AE%95%E0%AF%88%E0%AE%AA%E0%AF%8D%E0%AE%AA%E0%AE%A3%E0%AE%BF_%E0%AE%85%E0%AE%B2%E0%AE%99%E0%AF%8D%E0%AE%95%E0%AE%BE%E0%AE%B0%E0%AE%AA%E0%AF%8D_%E0%AE%AA%E0%AF%8A%E0%AE%B0%E0%AF%81%E0%AE%B3%E0%AF%8D_01.jpg",
  coconutLotus: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/06/%E0%AE%9A%E0%AE%BF%E0%AE%B0%E0%AE%9F%E0%AF%8D%E0%AE%9F%E0%AF%88%E0%AE%95%E0%AF%8D_%E0%AE%95%E0%AF%88%E0%AE%AA%E0%AF%8D%E0%AE%AA%E0%AE%A3%E0%AE%BF_%E0%AE%85%E0%AE%B2%E0%AE%99%E0%AF%8D%E0%AE%95%E0%AE%BE%E0%AE%B0%E0%AE%AA%E0%AF%8D_%E0%AE%AA%E0%AF%8A%E0%AE%B0%E0%AF%81%E0%AE%B3%E0%AF%81%E0%AE%95%E0%AF%8D%E0%AE%95%E0%AE%BE%E0%AE%A9_%E0%AE%B5%E0%AF%87%E0%AE%B2%E0%AF%88%E0%AE%AA%E0%AF%8D%E0%AE%AA%E0%AE%BE%E0%AE%9F%E0%AF%81_01.jpg/1280px-%E0%AE%9A%E0%AE%BF%E0%AE%B0%E0%AE%9F%E0%AF%8D%E0%AE%9F%E0%AF%88%E0%AE%95%E0%AF%8D_%E0%AE%95%E0%AF%88%E0%AE%AA%E0%AF%8D%E0%AE%AA%E0%AE%A3%E0%AE%BF_%E0%AE%85%E0%AE%B2%E0%AE%99%E0%AF%8D%E0%AE%95%E0%AE%BE%E0%AE%B0%E0%AE%AA%E0%AF%8D_%E0%AE%AA%E0%AF%8A%E0%AE%B0%E0%AF%81%E0%AE%B3%E0%AF%81%E0%AE%95%E0%AF%8D%E0%AE%95%E0%AE%BE%E0%AE%A9_%E0%AE%B5%E0%AF%87%E0%AE%B2%E0%AF%88%E0%AE%AA%E0%AF%8D%E0%AE%AA%E0%AE%BE%E0%AE%9F%E0%AF%81_01.jpg",
  crochetRed: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/003_2021_03_05_Handarbeit.jpg/1280px-003_2021_03_05_Handarbeit.jpg",
  kandySpiceShop: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/Spice_shop_in_Kandy_Market%2C_Sri_Lanka.jpg/1280px-Spice_shop_in_Kandy_Market%2C_Sri_Lanka.jpg",
  cinnamonSpices: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Cinnamomum_verum_spices.jpg/1280px-Cinnamomum_verum_spices.jpg",
  brassLamp: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/01/View_of_a_Hindu_brass_lamp_topped_by_a_rooster_at_the_Grand_Oriental_Hotel_in_Colombo_03.jpg/1280px-View_of_a_Hindu_brass_lamp_topped_by_a_rooster_at_the_Grand_Oriental_Hotel_in_Colombo_03.jpg",
  cinnamonBundle: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/84/Cinnamon_srilanka.jpg/1280px-Cinnamon_srilanka.jpg",
  cinnamonPowder: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/12/Ground_Cinnamon_Powder_and_a_Cinnamon_Stick.jpg/1280px-Ground_Cinnamon_Powder_and_a_Cinnamon_Stick.jpg",
  lacquerBox: "https://upload.wikimedia.org/wikipedia/commons/2/22/Laksha_-_%E0%B6%BD%E0%B7%8F%E0%B6%9A%E0%B7%8A%E0%B7%82%E0%B7%8F_-_Lacquerware.jpg",
  maskCarver: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Polonn%C3%A4ruv%C3%A2_Centre_artisanal_de_sculptures_sur_bois_WLF2023_%281%29.jpg/1280px-Polonn%C3%A4ruv%C3%A2_Centre_artisanal_de_sculptures_sur_bois_WLF2023_%281%29.jpg",
  maskSet: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/24/Polonn%C3%A4ruv%C3%A2_Centre_artisanal_de_sculptures_sur_bois.-_Traditional_masks.jpg/1280px-Polonn%C3%A4ruv%C3%A2_Centre_artisanal_de_sculptures_sur_bois.-_Traditional_masks.jpg",
  spicesMix: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/28/Gewuerze_004_2024_08_10.jpg/1280px-Gewuerze_004_2024_08_10.jpg",
  sigiriya: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c7/Sigiriya.jpg/1280px-Sigiriya.jpg",
  coconutCraft: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/Craft_item.jpg/1280px-Craft_item.jpg",
  crochetBag: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/Crochet_bag.jpg/1280px-Crochet_bag.jpg",
  teaPluckers: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1f/Ceylon_Tea_in_SL.jpg/1280px-Ceylon_Tea_in_SL.jpg",
  batikClose: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/86/Using_batik_inkt_Sri_Lanka.JPG/1280px-Using_batik_inkt_Sri_Lanka.JPG",
  batikBrush: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3c/Woman_with_brush_painting_batik_Sri_Lanka.JPG/1280px-Woman_with_brush_painting_batik_Sri_Lanka.JPG",
  batikPainter: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f0/Woman_batik_painting_Sri_Lanka.JPG/1280px-Woman_batik_painting_Sri_Lanka.JPG",
  batikSewing: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/df/Woman_who_sews_batik_factory_Sri_Lanka.JPG/1280px-Woman_who_sews_batik_factory_Sri_Lanka.JPG",
  batikWork: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/17/Batik_Sri_Lanka.JPG/1280px-Batik_Sri_Lanka.JPG",
  batikEdges: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/eb/Edges_painting_batik_factory_Sri_Lanka.JPG/1280px-Edges_painting_batik_factory_Sri_Lanka.JPG",
  potteryPlate: "https://upload.wikimedia.org/wikipedia/commons/b/b6/Tradtional_Sri_Lankan_Pottery.jpg",
  maskRaksha: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d6/%28Maru_Rakshaya%29_Traditional_masks_of_Ambalangoda%2C_Sri_Lanka_-_Tharaka_Nirmal_Photography.png/1280px-%28Maru_Rakshaya%29_Traditional_masks_of_Ambalangoda%2C_Sri_Lanka_-_Tharaka_Nirmal_Photography.png",
  maskDeva: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d8/%28Deva_Sanniya%29_Traditional_masks_of_Ambalangoda%2C_Sri_Lanka_-_Tharaka_Nirmal_Photography.png/1280px-%28Deva_Sanniya%29_Traditional_masks_of_Ambalangoda%2C_Sri_Lanka_-_Tharaka_Nirmal_Photography.png",
  maskAnanga: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/%28Ananga_Bahirawa%29_Traditional_masks_of_Ambalangoda%2C_Sri_Lanka_-_Tharaka_Nirmal_Photography.png/1280px-%28Ananga_Bahirawa%29_Traditional_masks_of_Ambalangoda%2C_Sri_Lanka_-_Tharaka_Nirmal_Photography.png",
  weaver: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b9/Weaver_of_Sri_Lanka.JPG/1280px-Weaver_of_Sri_Lanka.JPG",
  dumbara: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/08/Dumbara_Rata.jpg/1280px-Dumbara_Rata.jpg",
};

export const CREDITS = [
  {"key":"crochetFan","title":"File:Crochet doily fan stitch.png","license":"CC BY 3.0","author":"WillowW"},
  {"key":"crochetWheat","title":"File:Crocheted doily, representing ears of ripe wheat.jpg","license":"CC BY-SA 2.5","author":"The original uploader was Kgraff at Engl"},
  {"key":"crochetDoily","title":"File:Crochet doily.JPG","license":"CC BY-SA 4.0","author":"רחל1"},
  {"key":"coconutVase","title":"File:சிரட்டைக் கைப்பணி அலங்காரப் பொருள் 01.jpg","license":"CC BY-SA 4.0","author":"SL Trades and Crafts Documentation Proje"},
  {"key":"coconutLotus","title":"File:சிரட்டைக் கைப்பணி அலங்காரப் பொருளுக்கான வேலைப்பாடு 01.jpg","license":"CC BY-SA 4.0","author":"SL Trades and Crafts Documentation Proje"},
  {"key":"crochetRed","title":"File:003 2021 03 05 Handarbeit.jpg","license":"CC BY-SA 4.0","author":"Friedrich Haag"},
  {"key":"kandySpiceShop","title":"File:Spice shop in Kandy Market, Sri Lanka.jpg","license":"CC BY 2.0","author":"McKay Savage"},
  {"key":"cinnamonSpices","title":"File:Cinnamomum verum spices.jpg","license":"CC BY-SA 3.0","author":"Simon A. Eugster"},
  {"key":"brassLamp","title":"File:View of a Hindu brass lamp topped by a rooster at the Grand Oriental Hotel in Colombo 03.jpg","license":"CC0","author":"Levi Clancy"},
  {"key":"cinnamonBundle","title":"File:Cinnamon srilanka.jpg","license":"CC BY-SA 4.0","author":"Vidarshana sandaruwan"},
  {"key":"cinnamonPowder","title":"File:Ground Cinnamon Powder and a Cinnamon Stick.jpg","license":"CC BY 2.0","author":"formulatehealth"},
  {"key":"lacquerBox","title":"File:Laksha - ලාක්ෂා - Lacquerware.jpg","license":"CC BY-SA 4.0","author":"Chandan.S"},
  {"key":"maskCarver","title":"File:Polonnäruvâ Centre artisanal de sculptures sur bois WLF2023 (1).jpg","license":"CC BY-SA 4.0","author":"Pierre André Leclercq"},
  {"key":"maskSet","title":"File:Polonnäruvâ Centre artisanal de sculptures sur bois.- Traditional masks.jpg","license":"CC0","author":"Pierre André Leclercq"},
  {"key":"spicesMix","title":"File:Gewuerze 004 2024 08 10.jpg","license":"CC BY-SA 4.0","author":"Friedrich Haag"},
  {"key":"sigiriya","title":"File:Sigiriya.jpg","license":"CC BY-SA 3.0","author":"Bernard Gagnon"},
  {"key":"coconutCraft","title":"File:Craft item.jpg","license":"CC BY-SA 3.0","author":"Nandhinikandhasamy"},
  {"key":"crochetBag","title":"File:Crochet bag.jpg","license":"CC BY-SA 4.0","author":"Whippetsgalore2"},
  {"key":"teaPluckers","title":"File:Ceylon Tea in SL.jpg","license":"CC BY-SA 4.0","author":"Curved.kiwix"},
  {"key":"batikClose","title":"File:Using batik inkt Sri Lanka.JPG","license":"CC BY-SA 3.0","author":"Peter van der Sluijs"},
  {"key":"batikBrush","title":"File:Woman with brush painting batik Sri Lanka.JPG","license":"CC BY-SA 3.0","author":"Peter van der Sluijs"},
  {"key":"batikPainter","title":"File:Woman batik painting Sri Lanka.JPG","license":"CC BY-SA 3.0","author":"Peter van der Sluijs"},
  {"key":"batikSewing","title":"File:Woman who sews batik factory Sri Lanka.JPG","license":"CC BY-SA 3.0","author":"Peter van der Sluijs"},
  {"key":"batikWork","title":"File:Batik Sri Lanka.JPG","license":"CC BY-SA 3.0","author":"Peter van der Sluijs"},
  {"key":"batikEdges","title":"File:Edges painting batik factory Sri Lanka.JPG","license":"CC BY-SA 3.0","author":"Peter van der Sluijs"},
  {"key":"potteryPlate","title":"File:Tradtional Sri Lankan Pottery.jpg","license":"CC BY-SA 4.0","author":"VinPrasad"},
  {"key":"maskRaksha","title":"File:(Maru Rakshaya) Traditional masks of Ambalangoda, Sri Lanka - Tharaka Nirmal Photography.png","license":"CC BY-SA 4.0","author":"Henda Hewa Tharaka Nirmal"},
  {"key":"maskDeva","title":"File:(Deva Sanniya) Traditional masks of Ambalangoda, Sri Lanka - Tharaka Nirmal Photography.png","license":"CC BY-SA 4.0","author":"Henda Hewa Tharaka Nirmal"},
  {"key":"maskAnanga","title":"File:(Ananga Bahirawa) Traditional masks of Ambalangoda, Sri Lanka - Tharaka Nirmal Photography.png","license":"CC BY-SA 4.0","author":"Henda Hewa Tharaka Nirmal"},
  {"key":"weaver","title":"File:Weaver of Sri Lanka.JPG","license":"CC BY-SA 3.0","author":"Peter van der Sluijs"},
  {"key":"dumbara","title":"File:Dumbara Rata.jpg","license":"CC BY-SA 4.0","author":"Mahiru Fernando"},
];

/** Commons image at a given width (thumbnails are served in standard widths: 330, 500, 960, 1280). */
export const c = (key, w = 960) => wm(COMMONS[key], w);
export { un };
