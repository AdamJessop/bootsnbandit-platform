/* ============================================================
   Boots 'n' Bandit — shared data + primitives  (IMPORTED REFERENCE)
   Source content model for seeding the real app. The STYLES,
   ARTISTS, GALLERY, SERVICES, FLASH, FAQS, PLACEMENTS arrays below
   are the canonical seed content. Icon/Plate/Mark/Filigree are the
   visual primitives to port to React components.
   ============================================================ */

/* ---------------- inline icon set (Lucide-style, 1.6px) ----------------
   The prototype hand-rolled an SVG icon set. In the real build, use
   lucide-react instead (names map closely): menu,x,arrow-right,check,
   star,heart,calendar,clock,map-pin,user,users,sparkles,wand,shield,
   shield-check,droplet,award,zap,image,palette,search,instagram,facebook,
   phone,mail,send,filter,grid,scissors,info,alert,lock,ruler,flame,
   trophy,layers,target,refresh,download,plus,minus,thumbs-up,bell,
   message,gift,compass.
   ---------------------------------------------------------------------- */

/* Brand AI suite product name (white-label friendly) */
const AI_BRAND = 'Inkling';
const AI_TAGLINE = 'From first inkling to fresh ink';

const STYLES = ['Blackwork','Neo-traditional','Fine-line','Japanese','Realism','Colour','Dotwork & Geometric','Lettering','Anime & New-school'];

const ARTISTS = [
  { id:'sarah', name:'Sarah', role:'Co-owner', styles:['Fine-line','Realism'], hue:'crimson',
    tag:'Fine-line, florals & black-and-grey', books:'open', exp:'14 yrs', rating:4.9, pieces:62,
    bio:"Sarah co-founded the studio in 2016. She moves easily between delicate fine-line florals and detailed black-and-grey — snakes, daggers, ornamental work and the odd Vegas skyline. She'll talk you through every step.",
    daily:'£90/hr · day rate £550', insta:'@sarah.bnb', pic:'https://i.pravatar.cc/480?img=5', specials:['Fine-line','Floral','Black & grey'] },
  { id:'cal', name:'Calum', role:'Co-owner', styles:['Realism','Lettering'], hue:'ink',
    tag:'Black & grey realism & chicano', books:'limited', exp:'16 yrs', rating:5.0, pieces:78,
    bio:'The other half of the shop. Calum lives in black-and-grey realism and chicano — portraits, statues, script and money-and-cards sleeves. Calm chair-side manner, brutal detail.',
    daily:'£95/hr · day rate £600', insta:'@calum.bnb', pic:'https://i.pravatar.cc/480?img=12', specials:['Realism','Chicano','Portraits'] },
  { id:'marnie', name:'Amy', role:'Resident artist', styles:['Fine-line','Dotwork & Geometric'], hue:'teal',
    tag:'Fine-line, botanical & dotwork', books:'open', exp:'7 yrs', rating:4.8, pieces:41,
    bio:'Delicate single-needle work, botanicals and fine geometric pieces. Amy loves a dainty first tattoo and will make sure you feel right at home.',
    daily:'£70/hr · day rate £420', insta:'@amy.bnb', pic:'https://i.pravatar.cc/480?img=9', specials:['First tattoos','Botanical','Fine-line'] },
  { id:'rhodri', name:'Alisha', role:'Resident artist', styles:['Colour','Realism'], hue:'rust',
    tag:'Colour, realism & neo-traditional', books:'limited', exp:'11 yrs', rating:4.9, pieces:53,
    bio:'The shop all-rounder — vivid colour peacocks and Disney, black-and-grey portraits and owls, neo-trad animals and the odd Japanese koi. If you can dream it, Alisha can ink it.',
    daily:'£85/hr · day rate £520', insta:'@alisha.bnb', pic:'https://i.pravatar.cc/480?img=47', specials:['Colour','Realism','Neo-traditional'] },
  { id:'effie', name:'Olivia', role:'Resident artist', styles:['Realism','Colour'], hue:'plum',
    tag:'Black & grey realism & portraits', books:'open', exp:'5 yrs', rating:4.7, pieces:34,
    bio:'Olivia loves a realistic portrait — pets, characters and hand pieces in crisp black-and-grey, plus the occasional pop of colour. Warm, patient and great with nervous first-timers.',
    daily:'£70/hr · day rate £400', insta:'@olivia.bnb', pic:'https://i.pravatar.cc/480?img=45', specials:['Portraits','Realism','Pet portraits'] },
  { id:'joss', name:'Holly', role:'Resident artist', styles:['Realism','Dotwork & Geometric'], hue:'gold',
    tag:'Realism & geometric sleeves', books:'open', exp:'9 yrs', rating:4.8, pieces:47,
    bio:'Holly blends black-and-grey realism with sacred-geometry and dotwork — think a roaring tiger framed by honeycomb and mandala. Big, bold, cohesive sleeves are her happy place.',
    daily:'£75/hr · day rate £450', insta:'@holly.bnb', pic:'https://i.pravatar.cc/480?img=32', specials:['Realism','Geometric','Sleeves'] },
  { id:'priya', name:'Tom', role:'Apprentice', styles:['Fine-line','Dotwork & Geometric'], hue:'steel',
    tag:'Linework & small pieces · learning fast', books:'open', exp:'1 yr', rating:4.7, pieces:23,
    bio:'Our apprentice, mentored day-to-day by Sarah and Calum. Tom takes on smaller linework, fine-line and dotwork pieces at a friendly apprentice rate — a lovely first-tattoo choice.',
    daily:'£45/hr · supervised', insta:'@tom.bnb', pic:'https://i.pravatar.cc/480?img=14', specials:['First tattoos','Small pieces','Linework'] },
];

const GALLERY = [
  { id:1, artist:'sarah', style:'Fine-line', title:'Ornamental snake & dagger', src:'assets/gallery/snake-dagger.jpg', hue:'crimson', placement:'Calf', big:true },
  { id:2, artist:'sarah', style:'Colour', title:'Red ink floral sleeve', src:'assets/gallery/red-floral.jpg', hue:'crimson', placement:'Full sleeve' },
  { id:3, artist:'joss', style:'Realism', title:'Tiger & geometric sleeve', src:'assets/gallery/tiger-geometric.jpg', hue:'ink', placement:'Sleeve', big:true },
  { id:4, artist:'sarah', style:'Realism', title:'Vegas & Colosseum panels', src:'assets/gallery/vegas-colosseum.jpg', hue:'steel', placement:'Upper arm' },
  { id:5, artist:'sarah', style:'Realism', title:'Chicano girl & cards', src:'assets/gallery/chicano-girl.jpg', hue:'ink', placement:'Thigh' },
  { id:6, artist:'effie', style:'Realism', title:'Davy Jones hand piece', src:'assets/gallery/davy-hand.jpg', hue:'steel', placement:'Hand' },
  { id:7, artist:'rhodri', style:'Realism', title:'Pennywise portrait', src:'assets/gallery/pennywise.jpg', hue:'ink', placement:'Upper arm' },
  { id:8, artist:'cal', style:'Lettering', title:'No Risk No Reward chicano', src:'assets/gallery/no-risk.jpg', hue:'steel', placement:'Forearm' },
  { id:9, artist:'rhodri', style:'Colour', title:'Peacock & peony', src:'assets/gallery/peacock.jpg', hue:'teal', placement:'Calf', big:true },
  { id:10, artist:'cal', style:'Realism', title:'Spartan & wing', src:'assets/gallery/spartan.jpg', hue:'ink', placement:'Forearm' },
  { id:11, artist:'rhodri', style:'Neo-traditional', title:'Neo-trad deer', src:'assets/gallery/deer.jpg', hue:'rust', placement:'Forearm' },
  { id:12, artist:'effie', style:'Realism', title:'Staffy portrait', src:'assets/gallery/dog.jpg', hue:'steel', placement:'Thigh' },
  { id:13, artist:'rhodri', style:'Colour', title:'Maleficent', src:'assets/gallery/maleficent.jpg', hue:'plum', placement:'Thigh' },
  { id:14, artist:'rhodri', style:'Blackwork', title:'Horned skull & dagger', src:'assets/gallery/skull-dagger.jpg', hue:'ink', placement:'Forearm' },
  { id:15, artist:'cal', style:'Realism', title:'Davy Jones portrait', src:'assets/gallery/davy-portrait.jpg', hue:'ink', placement:'Thigh', big:true },
  { id:16, artist:'marnie', style:'Fine-line', title:'Flowers & sword', src:'assets/gallery/flowers-sword.jpg', hue:'teal', placement:'Shin' },
  { id:17, artist:'rhodri', style:'Realism', title:'Barn owl & moon', src:'assets/gallery/owl.jpg', hue:'ink', placement:'Upper arm' },
  { id:18, artist:'sarah', style:'Fine-line', title:'Dragon & peony', src:'assets/gallery/dragon-peony.jpg', hue:'crimson', placement:'Forearm', big:true },
  { id:19, artist:'marnie', style:'Fine-line', title:'Ornate sword', src:'assets/gallery/sword-thigh.jpg', hue:'teal', placement:'Thigh' },
  { id:20, artist:'marnie', style:'Colour', title:'Orange blossom & jasmine', src:'assets/gallery/orange-jasmine.jpg', hue:'gold', placement:'Chest' },
  { id:21, artist:'sarah', style:'Fine-line', title:'Floral hand & wrist', src:'assets/gallery/hand-florals.jpg', hue:'crimson', placement:'Hand' },
  { id:22, artist:'rhodri', style:'Japanese', title:'Koi & lotus', src:'assets/gallery/koi.jpg', hue:'rust', placement:'Forearm', big:true },
  { id:23, artist:'rhodri', style:'Fine-line', title:'Bee & ornamental filigree', src:'assets/gallery/bee-ornamental.jpg', hue:'gold', placement:'Forearm' },
  { id:24, artist:'marnie', style:'Fine-line', title:'Sun & moon', src:'assets/gallery/sun-moon.jpg', hue:'teal', placement:'Shin' },
  { id:25, artist:'sarah', style:'Fine-line', title:'Peony shoulder cap', src:'assets/gallery/peony-shoulder.jpg', hue:'crimson', placement:'Shoulder' },
  { id:26, artist:'sarah', style:'Fine-line', title:'Lily & blossom arm wrap', src:'assets/gallery/lily-wrap.jpg', hue:'crimson', placement:'Forearm' },
];

const SERVICES = [
  { id:'small', name:'Small tattoo', dur:'1 hr', price:'from £80', desc:'Single small piece, palm-size or under.' },
  { id:'medium', name:'Half-day session', dur:'3 hrs', price:'from £240', desc:'Medium pieces, the start of a sleeve, lettering.' },
  { id:'full', name:'Full-day session', dur:'6 hrs', price:'from £450', desc:'Large work, back pieces, big colour.' },
  { id:'consult', name:'Free consultation', dur:'30 min', price:'free', desc:'Chat through your idea, placement and quote. No obligation.' },
  { id:'cover', name:'Cover-up consult', dur:'45 min', price:'free', desc:'Bring your existing piece — we will talk options.' },
];

const FLASH = [
  { id:'f1', title:'Pearl Shell', artist:'marnie', hue:'teal', src:'assets/flash/shell.png', size:'~11cm', price:'£130', total:3, claimed:1, deadline:'Sat 7 Jun' },
  { id:'f2', title:'Tribal Turtle', artist:'joss', hue:'ink', src:'assets/flash/turtle.png', size:'~10cm', price:'£140', total:3, claimed:2, deadline:'Sat 7 Jun' },
  { id:'f3', title:'Motel Key', artist:'marnie', hue:'gold', src:'assets/flash/key.png', size:'~9cm', price:'£110', total:4, claimed:1, deadline:'Sat 7 Jun' },
  { id:'f4', title:'Cat-Eye Shades', artist:'effie', hue:'ink', src:'assets/flash/sunglasses.png', size:'~8cm', price:'£100', total:4, claimed:0, deadline:'Sun 8 Jun' },
  { id:'f5', title:'Heart Koi', artist:'rhodri', hue:'crimson', src:'assets/flash/koi-hearts.png', size:'~14cm', price:'£170', total:2, claimed:1, deadline:'Sun 8 Jun' },
  { id:'f6', title:'Hibiscus Ray', artist:'sarah', hue:'gold', src:'assets/flash/stingray.png', size:'~12cm', price:'£150', total:3, claimed:0, deadline:'Sun 8 Jun' },
  { id:'f7', title:'Hibiscus Shark', artist:'joss', hue:'ink', src:'assets/flash/shark.png', size:'~13cm', price:'£160', total:2, claimed:1, deadline:'Sat 14 Jun' },
  { id:'f8', title:'Beach Sunset', artist:'sarah', hue:'gold', src:'assets/flash/palm-beach.png', size:'~9cm', price:'£120', total:4, claimed:2, deadline:'Sat 14 Jun' },
  { id:'f9', title:'Blossom Whale', artist:'rhodri', hue:'crimson', src:'assets/flash/whale.png', size:'~16cm', price:'£200', total:2, claimed:1, deadline:'Sat 14 Jun' },
];

const FAQS = [
  { q:'Do I need to pay anything to enquire?', a:'No — making an enquiry and your 15-minute consultation are completely free, with no obligation. If you decide to go ahead, your artist may arrange a small deposit to secure your appointment, and it always comes off your final price.' },
  { q:'How old do I have to be?', a:'18 and over, no exceptions, even with parental consent — it is UK law. Please bring photo ID (passport or driving licence) to your first appointment.' },
  { q:'Does it hurt?', a:"Honestly, a bit — but most people find it far more manageable than they feared. Ribs and feet are spicier than forearms. We go at your pace, with breaks whenever you need them." },
  { q:'How should I prepare?', a:'Eat a proper meal, stay hydrated, get a good sleep and avoid alcohol the night before. Wear comfy clothes that give easy access to the area being tattooed.' },
  { q:'Can you cover an old tattoo?', a:'Often, yes. Make an enquiry for a cover-up and add a clear photo to your mood board. Calum and Alisha specialise in cover-ups and will tell you honestly what is possible.' },
  { q:'Do you take walk-ins?', a:'When an artist has a gap, yes — make an enquiry to see the latest availability, or follow us on Facebook for same-day openings.' },
  { q:'Is the studio clean and licensed?', a:'Fully licensed by Bassetlaw District Council. Single-use needles, hospital-grade sterilisation, and every artist holds a current bloodborne-pathogens certificate.' },
];

const PLACEMENTS = ['Forearm','Upper arm','Shoulder','Back','Chest','Ribs','Thigh','Calf','Hand','Neck'];

/* Studio facts (from footer):
   Boots 'n' Bandit Tattoo Studio
   67 Newcastle Avenue, Worksop, Nottinghamshire, S80 1LX
   Tue–Sat 10am–6pm; Closed Sun & Mon
   Licensed by Bassetlaw District Council
   Facebook: https://www.facebook.com/profile.php?id=61562021309387
   Ticker lines: 'Now taking enquiries · Summer 2026', 'Flash drop this Saturday',
     'Free 15-min consultations', 'Sarah & Marnie · books open',
     'Walk-ins when the chairs are free', 'Worksop, Nottinghamshire'
   Public nav: Home, Artists, Gallery, Inkling (AI), Enquire, Flash, Aftercare, Studio, + Bandit Pass
   "Bandit Pass" = loyalty scheme. "Inkling" = AI design-assist suite.
   NOTE: headshots are pravatar placeholders; gallery/flash images are real
   studio work in the design project but are NOT imported — seed with
   procedural Plate placeholders and let staff upload real images via the CMS.
*/
