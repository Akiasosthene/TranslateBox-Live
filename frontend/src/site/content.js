// Public website copy, English and French. Facts only: every claim here is a
// feature of this app (no invented customers, ratings or certifications).

export const NAV = {
  en: { product: "Product", solutions: "Solutions", integrations: "Integrations", security: "Security", faq: "FAQ", join: "Join a session", signin: "Sign in", demo: "Book a demo" },
  fr: { product: "Produit", solutions: "Solutions", integrations: "Intégrations", security: "Sécurité", faq: "FAQ", join: "Rejoindre", signin: "Se connecter", demo: "Demander une démo" },
};

export const HOME = {
  en: {
    kicker: "Live AI interpretation",
    title: ["Every word,", "in every language,", "as it is spoken."],
    lead: "TranslateBox turns one speaker into a multilingual event: translated voice in each listener's headphones, live captions on every phone and on the big screen, then transcripts and summaries — without an app to install.",
    ctaDemo: "Book a demo", ctaJoin: "Join with a code", codePlaceholder: "ABCD-1234",
    proof: [["55", "listener languages"], ["0", "apps to install"], ["1", "QR code to join"], ["100%", "on your own server"]],
    lifecycleKicker: "Before · During · After",
    lifecycleTitle: "More than live translation.",
    lifecycle: [
      { tag: "Before", title: "Prepare in minutes", items: ["Schedule sessions, labels and languages", "Glossaries up to 3,000 terms, per language", "Speaker names and event profile (sermon, lecture…)", "Branding: logo and sponsor line"] },
      { tag: "During", title: "Everyone follows live", items: ["Translated voice: AI voices or human interpreters", "Captions on phones, room screen and video overlay", "Zoom, Teams, Webex or OBS as the audio source", "Runs on the server: the console can be closed"] },
      { tag: "After", title: "Keep the message", items: ["Timed transcripts: TXT, SRT, VTT", "Translate a transcript into another language", "AI summaries published to listeners", "Dubbed voice track for your recordings"] },
    ],
    productsTitle: "Seven tools in one session.",
    products: [
      ["Translated audio", "Natural voices in the listener's language, in real time."],
      ["Live captions", "Large, high-contrast, phrase-by-phrase captions."],
      ["Room screen", "Projector display with up to four languages side by side."],
      ["Interpreter booths", "Your human interpreters, mixed with AI languages."],
      ["Transcripts", "Every language, timestamped, ready for subtitles."],
      ["Summaries", "Key points, generated and published in one click."],
      ["Dubbing", "A translated voice track aligned to your video."],
    ],
    stepsTitle: "Three steps. No technician.",
    steps: [
      ["Choose the source", "A microphone, a mixing desk, or a Zoom, Teams, Webex or OBS stream."],
      ["Share the code", "Attendees scan the QR code or type the session code on their phone."],
      ["Speak", "Each listener picks a language and hears you, with captions, in about a second."],
    ],
    solutionsKicker: "Built for real rooms",
    solutionsTitle: "From the pulpit to the boardroom.",
    integrationsTitle: "Works with what you already use.",
    integrationsLead: "Send a meeting or a stream in, send captions back out, or embed the listener page anywhere.",
    integrations: ["Zoom", "Microsoft Teams", "Webex", "OBS Studio", "vMix", "RTMP · RTMPS · SRT", "Website embed", "Caption webhook", "REST API", "Single sign-on (OIDC)", "Android & iOS apps", "QR code & links"],
    languagesTitle: "55 languages for your listeners.",
    languagesLead: "13 languages with direct interpretation, plus 42 more translated sentence by sentence and spoken with a studio voice.",
    securityTitle: "Your event stays yours.",
    security: [
      ["Self-hosted", "Runs on your own server. Your data is not pooled with anyone else's."],
      ["No audio recordings", "Audio is processed live and never written to disk by the app."],
      ["Transcripts by choice", "Server archiving is off by default and deleted with the event."],
      ["Accounts and roles", "Owners, administrators and presenters, two-factor sign-in, SSO."],
    ],
    faqTitle: "Questions, answered.",
    faq: [
      ["Do attendees need an app or an account?", "No. They scan the QR code or type the session code; the listener page works in any modern browser on iPhone, Android or a computer. Native apps are available for those who prefer them."],
      ["How fast is the translation?", "Direct interpretation follows the speaker by roughly one to two seconds. The 42 text-and-voice languages arrive about two to four seconds later, once a sentence is complete."],
      ["Can I use my own interpreters?", "Yes. Assign a language to a human interpreter: they hear the floor from a web booth and speak into their microphone; listeners of that language hear them instead of the AI."],
      ["Does it work for hybrid and online events?", "Yes. Use the microphone in the room, or send Zoom, Teams, Webex or OBS to TranslateBox over RTMP or SRT, and send captions back to Zoom and Teams."],
      ["How do glossaries work?", "Add names, places and specialised terms — biblical, medical, technical — with corrections, sounds-like spellings and preferred terms per language. They apply to captions, voices and transcripts."],
      ["What does it cost?", "TranslateBox runs on your server with your own OpenAI account: you pay the AI usage directly, measured in minutes per language, with monthly caps and per-presenter minute balances."],
    ],
    ctaTitle: "Hear your next event in every language.",
    ctaLead: "A 30-minute video call: we set up a session with your languages, your glossary and your audio source.",
  },
  fr: {
    kicker: "Interprétation IA en direct",
    title: ["Chaque mot,", "dans chaque langue,", "au moment où il est dit."],
    lead: "TranslateBox fait d’un seul orateur un événement multilingue : la voix traduite dans les écouteurs de chacun, les sous-titres en direct sur chaque téléphone et sur grand écran, puis transcriptions et résumés — sans application à installer.",
    ctaDemo: "Demander une démo", ctaJoin: "Rejoindre avec un code", codePlaceholder: "ABCD-1234",
    proof: [["55", "langues d’écoute"], ["0", "app à installer"], ["1", "QR code pour rejoindre"], ["100 %", "sur votre propre serveur"]],
    lifecycleKicker: "Avant · Pendant · Après",
    lifecycleTitle: "Bien plus que de la traduction en direct.",
    lifecycle: [
      { tag: "Avant", title: "Préparez en quelques minutes", items: ["Planifiez sessions, étiquettes et langues", "Glossaires jusqu’à 3 000 termes, par langue", "Noms des orateurs et profil (prédication, cours…)", "Votre image : logo et ligne de commanditaire"] },
      { tag: "Pendant", title: "Tout le monde suit en direct", items: ["Voix traduite : voix IA ou interprètes humains", "Sous-titres sur téléphone, écran de salle et vidéo", "Zoom, Teams, Webex ou OBS comme source audio", "Tourne sur le serveur : la console peut être fermée"] },
      { tag: "Après", title: "Gardez le message", items: ["Transcriptions horodatées : TXT, SRT, VTT", "Traduction d’une transcription dans une autre langue", "Résumés IA publiés aux auditeurs", "Piste de voix doublée pour vos enregistrements"] },
    ],
    productsTitle: "Sept outils dans une seule session.",
    products: [
      ["Audio traduit", "Des voix naturelles dans la langue de l’auditeur, en temps réel."],
      ["Sous-titres en direct", "Grands, contrastés, phrase par phrase."],
      ["Écran de salle", "Pour le projecteur, jusqu’à quatre langues côte à côte."],
      ["Cabines d’interprètes", "Vos interprètes humains, mêlés aux langues IA."],
      ["Transcriptions", "Toutes les langues, horodatées, prêtes pour les sous-titres."],
      ["Résumés", "Les points clés, générés et publiés en un clic."],
      ["Doublage", "Une piste de voix traduite calée sur votre vidéo."],
    ],
    stepsTitle: "Trois étapes. Aucun technicien.",
    steps: [
      ["Choisissez la source", "Un micro, une console de mixage, ou un flux Zoom, Teams, Webex ou OBS."],
      ["Partagez le code", "Les participants scannent le QR code ou tapent le code de session sur leur téléphone."],
      ["Parlez", "Chacun choisit sa langue et vous entend, avec sous-titres, en une seconde environ."],
    ],
    solutionsKicker: "Pensé pour de vraies salles",
    solutionsTitle: "De la chaire à la salle du conseil.",
    integrationsTitle: "Fonctionne avec vos outils.",
    integrationsLead: "Faites entrer une réunion ou un flux, renvoyez les sous-titres, ou intégrez la page d’écoute partout.",
    integrations: ["Zoom", "Microsoft Teams", "Webex", "OBS Studio", "vMix", "RTMP · RTMPS · SRT", "Intégration web", "Webhook de sous-titres", "API REST", "Authentification unique (OIDC)", "Apps Android et iOS", "QR code et liens"],
    languagesTitle: "55 langues pour vos auditeurs.",
    languagesLead: "13 langues en interprétation directe, plus 42 autres traduites phrase par phrase et lues par une voix studio.",
    securityTitle: "Votre événement reste à vous.",
    security: [
      ["Auto-hébergé", "Tourne sur votre propre serveur. Vos données ne sont mélangées à celles de personne."],
      ["Aucun enregistrement audio", "Le son est traité en direct et jamais écrit sur disque par l’application."],
      ["Transcriptions au choix", "L’archivage serveur est désactivé par défaut et supprimé avec l’événement."],
      ["Comptes et rôles", "Propriétaires, administrateurs, présentateurs, double authentification, SSO."],
    ],
    faqTitle: "Vos questions, nos réponses.",
    faq: [
      ["Les participants ont-ils besoin d’une app ou d’un compte ?", "Non. Ils scannent le QR code ou tapent le code de session ; la page d’écoute fonctionne dans tout navigateur récent sur iPhone, Android ou ordinateur. Des apps natives existent pour ceux qui préfèrent."],
      ["Quel est le délai de traduction ?", "L’interprétation directe suit l’orateur d’une à deux secondes environ. Les 42 langues « texte + voix » arrivent deux à quatre secondes plus tard, une fois la phrase terminée."],
      ["Puis-je utiliser mes propres interprètes ?", "Oui. Confiez une langue à un interprète humain : il entend la salle depuis une cabine web et parle dans son micro ; les auditeurs de cette langue l’entendent à la place de l’IA."],
      ["Est-ce adapté aux événements hybrides et en ligne ?", "Oui. Utilisez le micro de la salle, ou envoyez Zoom, Teams, Webex ou OBS à TranslateBox en RTMP ou SRT, et renvoyez les sous-titres vers Zoom et Teams."],
      ["Comment fonctionnent les glossaires ?", "Ajoutez noms, lieux et termes spécialisés — bibliques, médicaux, techniques — avec corrections, graphies phonétiques et termes préférés par langue. Ils s’appliquent aux sous-titres, aux voix et aux transcriptions."],
      ["Combien ça coûte ?", "TranslateBox tourne sur votre serveur avec votre propre compte OpenAI : vous payez directement l’usage de l’IA, mesuré en minutes par langue, avec plafonds mensuels et soldes de minutes par présentateur."],
    ],
    ctaTitle: "Faites entendre votre prochain événement dans toutes les langues.",
    ctaLead: "Un appel vidéo de 30 minutes : nous préparons une session avec vos langues, votre glossaire et votre source audio.",
  },
};

export const SOLUTIONS = {
  en: [
    { slug: "churches", name: "Churches & ministries", title: "One sermon, every heart language.", text: "Members and visitors follow the preaching, worship and announcements in their own language — on their phone, with headphones, without disturbing anyone.", points: ["Sermon voice style and biblical vocabulary", "Book names, places and pastors' names in the glossary", "Room screen for lyrics and announcements", "Your own volunteer interpreters in web booths"] },
    { slug: "conferences", name: "Conferences & events", title: "Every session, every attendee.", text: "Keynotes, panels and breakouts with live voice and captions in up to five languages per room, from the stage microphone or the AV desk.", points: ["Session codes, QR codes and scheduling", "Speaker names on captions", "Sponsor line and logo on every phone", "Transcripts and summaries after each session"] },
    { slug: "education", name: "Schools & universities", title: "Lessons nobody misses.", text: "Newcomer students, parents' evenings and lectures: captions and translated voice help everyone follow and review.", points: ["High-contrast, complete-sentence captions", "Timed transcripts to study afterwards", "Glossaries for technical terms", "Works on the devices students already have"] },
    { slug: "public", name: "Municipalities & public sector", title: "Public meetings for the whole community.", text: "Council meetings, consultations and information sessions, in the languages your residents speak, in person and online.", points: ["Webex, Teams and Zoom as the source", "Captions sent back to the meeting", "Self-hosted, with roles and two-factor sign-in", "Archived transcripts on request"] },
    { slug: "nonprofits", name: "Associations & nonprofits", title: "Bring every member to the table.", text: "General assemblies, trainings and community events with the newcomers and partners you serve.", points: ["Minutes shared between presenters", "Simple setup by volunteers", "Human interpreters for key languages", "55 languages, including African and Asian languages"] },
    { slug: "business", name: "Businesses", title: "Global teams, one meeting.", text: "Town halls, trainings and client presentations across languages, with your brand and your security rules.", points: ["Single sign-on and API keys", "Activity reports per session and language", "Teams and Zoom captions", "Embed in your intranet or event platform"] },
  ],
  fr: [
    { slug: "churches", name: "Églises et ministères", title: "Une prédication, dans la langue du cœur.", text: "Membres et visiteurs suivent la prédication, la louange et les annonces dans leur langue — sur leur téléphone, au casque, sans déranger personne.", points: ["Style de voix « prédication » et vocabulaire biblique", "Livres, lieux et noms des pasteurs dans le glossaire", "Écran de salle pour les chants et les annonces", "Vos interprètes bénévoles en cabine web"] },
    { slug: "conferences", name: "Conférences et événements", title: "Chaque séance, chaque participant.", text: "Plénières, panels et ateliers avec voix et sous-titres en direct, jusqu’à cinq langues par salle, depuis le micro de scène ou la régie.", points: ["Codes de session, QR codes et planification", "Noms des orateurs dans les sous-titres", "Logo et commanditaire sur chaque téléphone", "Transcriptions et résumés après chaque séance"] },
    { slug: "education", name: "Écoles et universités", title: "Des cours que personne ne manque.", text: "Élèves nouveaux arrivants, rencontres de parents, cours magistraux : sous-titres et voix traduite pour suivre et réviser.", points: ["Sous-titres contrastés, phrases complètes", "Transcriptions horodatées pour réviser", "Glossaires pour les termes techniques", "Sur les appareils que les élèves ont déjà"] },
    { slug: "public", name: "Municipalités et secteur public", title: "Des séances publiques pour toute la communauté.", text: "Conseils municipaux, consultations et séances d’information dans les langues de vos citoyens, en salle et en ligne.", points: ["Webex, Teams et Zoom comme source", "Sous-titres renvoyés dans la réunion", "Auto-hébergé, avec rôles et double authentification", "Transcriptions archivées sur demande"] },
    { slug: "nonprofits", name: "Associations et OBNL", title: "Chaque membre a sa place.", text: "Assemblées générales, formations et événements communautaires avec les nouveaux arrivants et partenaires que vous servez.", points: ["Minutes partagées entre présentateurs", "Mise en place simple par des bénévoles", "Interprètes humains pour les langues clés", "55 langues, dont des langues africaines et asiatiques"] },
    { slug: "business", name: "Entreprises", title: "Des équipes mondiales, une seule réunion.", text: "Assemblées, formations et présentations clients dans plusieurs langues, avec votre image et vos règles de sécurité.", points: ["Authentification unique et clés API", "Rapports d’activité par session et par langue", "Sous-titres Teams et Zoom", "Intégration dans votre intranet ou plateforme"] },
  ],
};

export const SECURITY_PAGE = {
  en: {
    title: "Security and privacy, by design.",
    lead: "TranslateBox is software you run, not a shared cloud. Here is exactly what happens to your audio, your text and your accounts.",
    blocks: [
      ["Where it runs", "On your server (for example a VPS), in Docker containers you control. Updates are a git pull away and you choose when."],
      ["Audio", "Audio is streamed to the AI provider for live translation and is never written to disk by TranslateBox. Listeners' phones receive audio only while they listen."],
      ["Text and transcripts", "Captions live in memory during the session. Server archiving of transcripts is off by default, per event, and removed when the event is deleted."],
      ["AI provider", "Translation, voices and summaries use your own OpenAI account; summaries and text translation are sent with storage disabled. The API key never leaves the server."],
      ["Accounts", "Owner, administrator and presenter roles; presenters only see their own sessions. Passwords are hashed with scrypt; two-factor codes from any authenticator app; optional single sign-on (OIDC)."],
      ["Listeners", "No account and no app required. Optional PIN per event. Listener pages can be embedded only on the sites you allow."],
      ["Streams and keys", "Each event has its own secret stream key, which you can rotate. API keys are stored hashed and cannot create other keys."],
      ["What we do not claim", "TranslateBox does not hold third-party certifications (such as SOC 2 or ISO 27001) by itself: your hosting provider and your own policies determine those."],
    ],
  },
  fr: {
    title: "Sécurité et confidentialité, dès la conception.",
    lead: "TranslateBox est un logiciel que vous exploitez, pas un nuage partagé. Voici exactement ce qu’il advient de votre son, de vos textes et de vos comptes.",
    blocks: [
      ["Où il tourne", "Sur votre serveur (par exemple un VPS), dans des conteneurs Docker que vous contrôlez. Les mises à jour se font en une commande, quand vous le décidez."],
      ["Le son", "Le son est envoyé au fournisseur d’IA pour la traduction en direct et n’est jamais écrit sur disque par TranslateBox. Les téléphones des auditeurs ne reçoivent le son que pendant l’écoute."],
      ["Textes et transcriptions", "Les sous-titres restent en mémoire pendant la session. L’archivage serveur des transcriptions est désactivé par défaut, par événement, et supprimé avec l’événement."],
      ["Fournisseur d’IA", "Traduction, voix et résumés utilisent votre propre compte OpenAI ; résumés et traductions de texte sont envoyés sans stockage. La clé API ne quitte jamais le serveur."],
      ["Comptes", "Rôles propriétaire, administrateur et présentateur ; les présentateurs ne voient que leurs sessions. Mots de passe hachés (scrypt), codes de double authentification, authentification unique (OIDC) en option."],
      ["Auditeurs", "Ni compte ni app. PIN optionnel par événement. La page d’écoute ne s’intègre que sur les sites que vous autorisez."],
      ["Flux et clés", "Chaque événement a sa propre clé de flux secrète, renouvelable. Les clés API sont stockées hachées et ne peuvent pas créer d’autres clés."],
      ["Ce que nous ne prétendons pas", "TranslateBox ne détient pas à lui seul de certifications (comme SOC 2 ou ISO 27001) : elles dépendent de votre hébergeur et de vos propres politiques."],
    ],
  },
};

export const DEMO = {
  en: { title: "Book a demo", lead: "Tell us about your event. We will reply by email to schedule a 30-minute video call.", name: "Your name", email: "Email", org: "Organization", type: "Type of organization", size: "Attendees per event", languages: "Languages you need", message: "Anything we should know?", send: "Send", sent: "Thank you! We will get back to you shortly.", privacy: "We only use these details to answer your request.", types: ["Church or ministry", "Conference or event", "School or university", "Public sector", "Association or nonprofit", "Business", "Other"], sizes: ["Under 50", "50–200", "200–1,000", "Over 1,000"] },
  fr: { title: "Demander une démo", lead: "Parlez-nous de votre événement. Nous vous répondrons par courriel pour fixer un appel vidéo de 30 minutes.", name: "Votre nom", email: "Courriel", org: "Organisation", type: "Type d’organisation", size: "Participants par événement", languages: "Langues souhaitées", message: "Autre chose à nous dire ?", send: "Envoyer", sent: "Merci ! Nous vous répondons très vite.", privacy: "Nous utilisons ces informations uniquement pour répondre à votre demande.", types: ["Église ou ministère", "Conférence ou événement", "École ou université", "Secteur public", "Association ou OBNL", "Entreprise", "Autre"], sizes: ["Moins de 50", "50 à 200", "200 à 1 000", "Plus de 1 000"] },
};

export const FOOTER = {
  en: { tagline: "Different voices. One shared experience.", product: "Product", company: "Resources", listeners: "For listeners", rights: "All rights reserved." },
  fr: { tagline: "Des voix différentes. Une expérience partagée.", product: "Produit", company: "Ressources", listeners: "Pour les auditeurs", rights: "Tous droits réservés." },
};

// Sentences shown in the hero's live stage, with their translations.
export const STAGE_LINES = [
  { src: "Welcome, everyone. Tonight we celebrate what unites us.", out: { fr: "Bienvenue à tous. Ce soir, nous célébrons ce qui nous unit.", es: "Bienvenidos a todos. Esta noche celebramos lo que nos une.", sw: "Karibuni nyote. Usiku huu tunasherehekea kinachotuunganisha.", ar: "مرحبًا بالجميع. الليلة نحتفل بما يجمعنا." } },
  { src: "Turn to the person next to you and say: you are not alone.", out: { fr: "Tournez-vous vers votre voisin et dites-lui : tu n’es pas seul.", es: "Gírate hacia quien está a tu lado y dile: no estás solo.", sw: "Mgeukie aliye karibu nawe useme: hauko peke yako.", ar: "التفت إلى من بجانبك وقل له: لست وحدك." } },
  { src: "Our next speaker joins us from Kinshasa.", out: { fr: "Notre prochain intervenant nous rejoint depuis Kinshasa.", es: "Nuestro próximo orador nos acompaña desde Kinsasa.", sw: "Mzungumzaji wetu anayefuata anajiunga nasi kutoka Kinshasa.", ar: "ينضم إلينا المتحدث التالي من كينشاسا." } },
];
