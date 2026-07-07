/* Faithbook — demo data
   All content lives here so it's easy to edit without touching logic.
   This is a PoC: everything is hand-authored, not a live model.

   Profile photos: each person has a real `photo` (a local file in assets/img,
   so it works offline — no internet needed at demo time). To swap a face, just
   replace the file or point `photo` at a new path. Organisations use `logo:'eo'`.
   If a person has no `photo`, app.js falls back to a generated illustrated
   portrait via an optional `av:{bg,skin,hair,clothes,style}` spec. */

const USER = {
  name:"Brian", initials:"B",
  photo:"assets/img/brian.jpg"
};

/* Every chat opens with this. Relationship before information:
   it reflects what Brian's past actions DID for real people, then asks
   what he is grateful for. (voorganger = Protestant pastor; fits EO.) */
const GREETING =
  "Goedemorgen Brian.\n\n" +
  "Voorganger Luuk vroeg me om je te bedanken. Dankzij jou vonden afgelopen week " +
  "drie mensen die rouwden net iets meer rust.\n\n" +
  "Waar ben je vandaag dankbaar voor — en hoe kan ik je van dienst zijn?";

/* ── The hero flow: laptop scenario (AI Community Coordinator) ────────────── */
const FLOW_LAPTOP = {
  userOpen:
    "Ik ben dankbaar dat de zon vandaag schijnt.\n\n" +
    "Ik zoek tweedehands laptops die mensen niet meer gebruiken. Ik wil ze doneren " +
    "aan kinderen in oorlogsgebieden, zodat ze online naar school kunnen.",

  reflect:
    "Wat een mooi voornemen, Brian. Je zoekt geen laptop om te kópen — je wilt " +
    "kinderen weer laten leren.\n\n" +
    "Ik ken de gemeenschap goed. Zal ik het voor je vragen?",
  yesLabel:"Ja, graag",
  noLabel:"Nog even niet",
  brianYes:"Ja, graag.",

  working:"Ik ga voor je op zoek. Je hoeft verder niets te doen — ik geef een seintje zodra er nieuws is.",

  donorsIntro:
    "Goed nieuws, Brian.\n\n" +
    "Ik heb 128 mensen benaderd van wie ik dacht dat ze zouden willen helpen. " +
    "Eenentwintig willen een laptop doneren.",
  donors:[
    { name:"Elly Vermeer",   note:"heeft een MacBook Air over",     photo:"assets/img/elly.jpg" },
    { name:"Ruben de Groot",  note:"twee Dell-laptops van kantoor",  photo:"assets/img/ruben.jpg" },
    { name:"Familie Tan",     note:"de laptop van hun zoon",         photo:"assets/img/tan.jpg" },
    { name:"EO",              note:"stelt 10 laptops beschikbaar",   logo:"eo" },
    { name:"en 17 anderen",   note:"willen ook doneren",             count:"+17" }
  ],

  triageIntro:
    "Een paar mensen hadden nog een vraag. Ik heb alvast een antwoord voorgesteld — " +
    "jij bepaalt. Je kunt het versturen, aanpassen of afwijzen.",
  questions:[
    {
      name:"Mari Koster", photo:"assets/img/mari.jpg",
      question:"Mijn Lenovo heeft geen oplader. Wil je hem dan toch?",
      suggested:"Ja, heel graag. Een oplader schaffen we zelf wel aan. Dank je wel, Mari!"
    },
    {
      name:"Ilia Novak", photo:"assets/img/ilia.jpg",
      question:"Mijn werkgever heeft misschien veel ongebruikte laptops. Zal ik het vragen?",
      suggested:"Wat geweldig, Ilia. Ja, graag — dat zou enorm helpen. Dank je!"
    }
  ],

  coordinateIntro:"Hoe wil je het regelen?",
  options:[
    "Ik plan inzamelmomenten in de kerk",
    "Laat ze naar mij opsturen",
    "Ze leveren in bij de kerk"
  ],
  done:
    "Mooi. Ik stem het met iedereen af en houd je op de hoogte.\n\n" +
    "Dank je wel, Brian — en dank namens de kinderen die straks weer naar school kunnen."
};

/* ── Simpler threads (show range): a single, warm person hand-off ─────────── */
const PEOPLE = {
  grief:{
    reply:"Wat verdrietig om te horen. Ik denk aan iemand die dit echt begrijpt.",
    name:"Marijke Verhoef", meta:"Kring Noord · Utrecht · 58 jaar",
    photo:"assets/img/marijke.jpg",
    tag:"Waarom Marijke",
    why:"Marijke verloor drie jaar geleden ook haar moeder. Ze staat graag naast anderen die hetzelfde meemaken, in alle rust.",
    action:"Stuur Marijke een berichtje"
  },
  kring:{
    reply:"Fijn dat je aansluiting zoekt. Er is iemand die je graag ontvangt.",
    name:"Sanne Prins", meta:"Kring West · Amersfoort · 29 jaar",
    photo:"assets/img/sanne.jpg",
    tag:"Waarom Sanne",
    why:"Sanne begeleidt een kring van jongvolwassenen die op maandagavond bij elkaar komt, vijf minuten bij je vandaan. Ze verwelkomt graag nieuwe mensen.",
    action:"Stuur Sanne een berichtje"
  },
  default:{
    reply:"Ik denk dat ik iemand ken die je hier verder mee kan helpen.",
    name:"Anouk Bakker", meta:"Kring West · Amersfoort · 41 jaar",
    photo:"assets/img/anouk.jpg",
    tag:"Waarom Anouk",
    why:"Anouk staat in de gemeente bekend als iemand die goed luistert en mensen met elkaar in contact brengt. Ze reageert meestal binnen een dag.",
    action:"Stuur Anouk een berichtje"
  }
};

/* ── History: chats that already happened (shown under "Eerder") ──────────
   These are past conversations, so they legitimately have titles. Each is a
   list of turns rendered instantly (no typing animation) when opened. */
const HISTORY = {
  grief:{
    title:"Rouw om mijn moeder",
    turns:[
      { bot:"Goedemorgen Brian. Hoe kan ik je vandaag van dienst zijn?" },
      { user:"Ik heb net mijn moeder verloren." },
      { person:PEOPLE.grief }        // reply + person card (from PEOPLE.grief)
    ]
  },
  kring:{
    title:"Op zoek naar een kring",
    turns:[
      { bot:"Goedemorgen Brian. Waar ben je vandaag naar op zoek?" },
      { user:"Ik ben nieuw hier en zou graag bij een kring aansluiten." },
      { person:PEOPLE.kring }
    ]
  }
};

/* The intention Brian types in the new chat (presenter backup / hotkey). */
const PRESETS = {
  laptop:FLOW_LAPTOP.userOpen
};
