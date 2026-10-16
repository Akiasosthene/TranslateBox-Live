// Public website copy (French and English). Facts about the app only:
// no invented customers, ratings, savings or certifications.

export const IMG = {
  phone: "/site/phone-listen.webp",
  captions: "/site/phone-captions.webp",
  screen: "/site/room-screen.webp",
  sessions: "/site/portal-sessions.webp",
  transcripts: "/site/portal-transcripts.webp",
};

export const NAV = {
  fr: {
    announce: "Nouveau : 55 langues d'écoute et traduction sur le serveur, même console fermée.", announceLink: "Voir les nouveautés",
    products: "Produits", solutions: "Solutions", resources: "Ressources", login: "Connexion", contact: "Contact", demo: "Demander une démo", tryIt: "Rejoindre une session",
    allSolutions: "Toutes les solutions", faq: "FAQ", security: "Sécurité", how: "Comment ça marche", join: "Rejoindre avec un code", api: "Documentation API",
  },
  en: {
    announce: "New: 55 listener languages and server-side translation, even with the console closed.", announceLink: "See what's new",
    products: "Products", solutions: "Solutions", resources: "Resources", login: "Log in", contact: "Contact", demo: "Get a demo", tryIt: "Join a session",
    allSolutions: "All solutions", faq: "FAQ", security: "Security", how: "How it works", join: "Join with a code", api: "API documentation",
  },
};

export const PRODUCTS = {
  fr: [
    {
      slug: "traduction", icon: "Headphones", name: "Traduction en direct", short: "La voix de l'orateur, traduite dans les écouteurs de chaque participant.",
      title: "Traduction vocale en direct par IA", lead: "Chaque participant choisit sa langue sur son téléphone et entend l'orateur traduit, environ une seconde après lui. Il suffit d'un QR code et d'écouteurs.",
      image: "phone",
      steps: [["Branchez le son", "Un micro, une console de mixage ou un flux Zoom, Teams, Webex ou OBS."], ["Choisissez les langues", "Une langue principale et jusqu'à quatre autres, parmi 55."], ["Partagez le QR code", "Les participants scannent, choisissent leur langue et appuient sur Écouter."]],
      features: [["13 langues en interprétation directe", "Anglais, français, espagnol, portugais, allemand, italien, russe, chinois, japonais, coréen, hindi, indonésien et vietnamien."], ["42 langues texte + voix", "Arabe, swahili, lingala, ourdou, turc, haoussa, yoruba, créole haïtien et bien d'autres, lues par une voix studio."], ["13 voix studio", "Choisissez une voix et un style : interprète, prédication, cours ou ton doux."], ["Interprètes humains", "Confiez une langue à vos interprètes : ils remplacent l'IA pour cette langue."], ["Glossaires", "Noms propres, lieux et vocabulaire spécialisé, jusqu'à 3 000 termes."], ["Sans application", "La page d'écoute fonctionne dans le navigateur, sur iPhone, Android ou ordinateur."]],
      faq: [["Quel est le délai ?", "Une à deux secondes pour les 13 langues directes. Deux à quatre secondes de plus pour les langues texte + voix, qui attendent la fin de la phrase."], ["Faut-il des écouteurs ?", "C'est recommandé dans une salle : chacun écoute sa langue sans gêner ses voisins."], ["Combien de personnes peuvent écouter ?", "La limite par défaut est de 30 auditeurs par événement ; votre administrateur peut l'augmenter selon la puissance du serveur."]],
    },
    {
      slug: "sous-titres", icon: "Captions", name: "Sous-titres en direct", short: "Des sous-titres traduits sur les téléphones, l'écran de salle et la vidéo.",
      title: "Sous-titres en direct, dans la langue de chacun", lead: "Les sous-titres suivent l'orateur phrase par phrase. Chaque participant règle la taille, le contraste et l'affichage des phrases complètes.",
      image: "captions",
      steps: [["Activez les sous-titres", "Un interrupteur dans la console, pour toutes les langues."], ["Choisissez l'affichage", "Téléphone, écran de salle, incrustation vidéo ou réunion Zoom et Teams."], ["Laissez chacun régler", "Taille, contraste élevé, phrases complètes, téléchargement du texte."]],
      features: [["Trois tailles et contraste élevé", "Pour les personnes malentendantes et les grandes salles."], ["Phrases complètes", "Une option masque la phrase en cours pour une lecture plus calme."], ["Noms des orateurs", "Le nom s'affiche à chaque changement d'orateur."], ["Incrustation OBS et vMix", "Une page transparente à ajouter comme source navigateur."], ["Zoom et Teams", "Les sous-titres traduits arrivent directement dans la réunion."], ["Webhook", "Recevez chaque ligne de sous-titre sur votre propre service."]],
      faq: [["Les sous-titres sont-ils activés par défaut ?", "Non. L'organisateur les active pour l'événement, ce qui évite de diffuser du texte par erreur."], ["Peut-on corriger un mot mal reconnu ?", "Oui, avec le glossaire : une règle « erreur => correction » s'applique en direct à toutes les langues ou à une seule."]],
    },
    {
      slug: "transcriptions", icon: "FileText", name: "Transcriptions", short: "Le texte complet de chaque langue, horodaté, prêt à télécharger.",
      title: "Transcriptions dans toutes les langues", lead: "Après l'événement, retrouvez ce qui a été dit, dans la langue de l'orateur et dans chaque langue traduite, avec l'heure de chaque phrase.",
      image: "transcripts",
      steps: [["Activez l'archivage", "Une case à cocher à la création de l'événement."], ["Diffusez", "Le texte est enregistré chaque minute pendant la session."], ["Téléchargez", "TXT, TXT horodaté, SRT ou VTT, depuis le portail."]],
      features: [["Horodatage et décalage", "Alignez les heures sur votre enregistrement vidéo."], ["Sous-titres SRT et VTT", "Prêts pour YouTube, Vimeo et votre logiciel de montage."], ["Traduction après coup", "Traduisez une transcription dans une autre langue en gardant le minutage."], ["Noms des orateurs", "Chaque prise de parole est attribuée."], ["Archivage au choix", "Désactivé par défaut, supprimé avec l'événement."], ["Export pour vos outils", "Par l'API ou en fichiers."]],
      faq: [["Où sont stockées les transcriptions ?", "Sur votre serveur uniquement, et seulement si vous avez activé l'archivage pour l'événement."]],
    },
    {
      slug: "resumes", icon: "Sparkles", name: "Résumés IA", short: "Les points clés de la session, publiés aux participants.",
      title: "Résumés IA de vos sessions", lead: "En un clic, obtenez un résumé structuré : thèmes, points clés, décisions et citations. Publiez-le sur la page des participants dans la langue de votre choix.",
      image: "captions",
      steps: [["Terminez la session", "Ou demandez un résumé pendant qu'elle se déroule."], ["Choisissez la langue", "Le résumé peut être produit dans une autre langue que la transcription."], ["Publiez", "Le résumé apparaît sur la page d'écoute jusqu'à ce que vous le retiriez."]],
      features: [["Markdown propre", "Titres et listes faciles à copier dans un courriel ou un bulletin."], ["Vos glossaires appliqués", "Les noms et termes corrigés se retrouvent dans le résumé."], ["Sans conservation chez le fournisseur", "Les résumés sont demandés avec le stockage désactivé."]],
      faq: [["Le résumé est-il fiable ?", "Il est produit par une IA à partir d'une interprétation automatique : relisez les noms et les chiffres avant de le partager."]],
    },
    {
      slug: "ecran-de-salle", icon: "Monitor", name: "Écran de salle", short: "Les sous-titres en grand sur le projecteur, avec le QR code.",
      title: "Un écran de salle pour toute l'assemblée", lead: "Affichez les sous-titres en très grand sur un projecteur ou une télévision, jusqu'à quatre langues côte à côte, avec le QR code et le code de session pour rejoindre.",
      image: "screen",
      steps: [["Ouvrez l'écran de salle", "Un lien depuis la console, sur l'ordinateur relié au projecteur."], ["Choisissez les langues", "Une langue en plein écran, ou plusieurs côte à côte."], ["Laissez-le tourner", "L'écran reste allumé et se reconnecte tout seul."]],
      features: [["Multilingue", "Jusqu'à quatre langues sur le même écran."], ["Thème clair ou sombre", "Selon la lumière de la salle."], ["Logo et commanditaire", "Votre image sur l'écran."], ["Incrustation transparente", "Pour vos diffusions en direct."]],
      faq: [["L'écran de salle reçoit-il le son ?", "Non, il n'affiche que le texte ; il ne fait pas de bruit dans la salle."]],
    },
    {
      slug: "interpretes", icon: "UserRound", name: "Cabines d'interprètes", short: "Vos interprètes humains, en ligne, mêlés aux langues IA.",
      title: "Cabines d'interprètes humains, dans le navigateur", lead: "Vos interprètes entendent la salle depuis une cabine web et parlent dans leur micro. Les auditeurs de leur langue les entendent, avec la mention « Interprète humain ». Les autres langues restent traduites par l'IA.",
      image: "phone",
      steps: [["Confiez une langue", "À la création de l'événement, marquez la langue « Interprète humain »."], ["Envoyez le lien et le code", "L'interprète ouvre la cabine sur son ordinateur, avec un casque."], ["Passez à l'antenne", "Un bouton pour parler, un bouton pour tousser."]],
      features: [["Son de la salle séparé", "L'interprète entend l'orateur sans que ce son parte vers le public."], ["Un interprète à l'antenne par langue", "Pas de conflit entre deux cabines."], ["Aucun coût IA", "Les langues humaines ne consomment pas de minutes de traduction."]],
      faq: [["L'interprète doit-il être sur place ?", "Non. La cabine fonctionne à distance, dans le navigateur."]],
    },
    {
      slug: "integrations", icon: "Video", name: "Zoom, Teams, Webex, OBS", short: "Faites entrer une réunion ou un flux, renvoyez les sous-titres.",
      title: "Intégrations avec vos réunions et vos flux", lead: "Envoyez une réunion Zoom, Teams ou Webex, ou un flux OBS, à TranslateBox par RTMP ou SRT. Le serveur traduit pour vos auditeurs et peut renvoyer les sous-titres dans la réunion.",
      image: "screen",
      steps: [["Copiez l'adresse et la clé", "Elles sont propres à chaque événement."], ["Lancez la diffusion personnalisée", "Depuis Zoom, Teams, Webex, OBS ou vMix."], ["Démarrez sur le serveur", "La traduction tourne même si la console est fermée."]],
      features: [["RTMP, RTMPS et SRT", "Les protocoles de diffusion courants."], ["Sous-titres vers Zoom et Teams", "Avec le jeton de sous-titrage Zoom ou le lien CART de Teams."], ["Intégration web", "La page d'écoute dans votre site ou votre plateforme d'événement."], ["API et clés", "Créez des sessions et récupérez les transcriptions depuis vos outils."]],
      faq: [["Faut-il un robot dans la réunion ?", "Non. La plateforme de réunion envoie son flux à TranslateBox ; aucun participant automatique n'est ajouté."], ["Google Meet est-il pris en charge ?", "Pas directement. Avec OBS, vous pouvez envoyer le son d'une réunion Meet."]],
    },
    {
      slug: "doublage", icon: "AudioLines", name: "Doublage vidéo", short: "Une piste de voix traduite, calée sur votre enregistrement.",
      title: "Doublage de vos enregistrements", lead: "À partir de la transcription minutée, TranslateBox produit une piste audio WAV dans la langue choisie, avec la voix studio de votre choix, calée sur le minutage de la session.",
      image: "transcripts",
      steps: [["Diffusez la session", "Avec les transcriptions conservées."], ["Choisissez la voix", "Parmi les 13 voix studio."], ["Téléchargez la piste", "Un fichier WAV à ajouter à votre vidéo."]],
      features: [["Minutage conservé", "Chaque phrase est placée à son heure."], ["Glossaire appliqué", "Les noms et termes corrigés sont prononcés correctement."]],
      faq: [["Peut-on doubler une vidéo existante ?", "Le doublage part d'une session diffusée dans TranslateBox : diffusez la vidéo comme source audio, puis téléchargez la piste."]],
    },
  ],
  en: [
    {
      slug: "traduction", icon: "Headphones", name: "Live translation", short: "The speaker's voice, translated into each attendee's headphones.",
      title: "Live AI voice translation", lead: "Each attendee picks a language on their phone and hears the speaker translated, about a second behind. All it takes is a QR code and headphones.",
      image: "phone",
      steps: [["Connect the audio", "A microphone, a mixing desk, or a Zoom, Teams, Webex or OBS stream."], ["Choose the languages", "One main language and up to four more, out of 55."], ["Share the QR code", "Attendees scan it, pick a language and tap Listen."]],
      features: [["13 languages with direct interpretation", "English, French, Spanish, Portuguese, German, Italian, Russian, Chinese, Japanese, Korean, Hindi, Indonesian and Vietnamese."], ["42 text-and-voice languages", "Arabic, Swahili, Lingala, Urdu, Turkish, Hausa, Yoruba, Haitian Creole and many more, read by a studio voice."], ["13 studio voices", "Pick a voice and a style: interpreter, sermon, lecture or gentle."], ["Human interpreters", "Hand a language to your interpreters and they replace the AI for that language."], ["Glossaries", "Names, places and specialised vocabulary, up to 3,000 terms."], ["No app", "The listener page runs in the browser on iPhone, Android or a computer."]],
      faq: [["How long is the delay?", "One to two seconds for the 13 direct languages. Two to four seconds more for text-and-voice languages, which wait for the end of the sentence."], ["Are headphones needed?", "In a room, yes: everyone hears their own language without disturbing their neighbours."], ["How many people can listen?", "The default limit is 30 listeners per event; your administrator can raise it depending on the server."]],
    },
    {
      slug: "sous-titres", icon: "Captions", name: "Live captions", short: "Translated captions on phones, the room screen and video.",
      title: "Live captions in everyone's language", lead: "Captions follow the speaker sentence by sentence. Each attendee sets the size, the contrast and whether to show complete sentences only.",
      image: "captions",
      steps: [["Turn captions on", "One switch in the console, for every language."], ["Pick where they show", "Phones, the room screen, a video overlay or a Zoom and Teams meeting."], ["Let people adjust", "Size, high contrast, complete sentences, text download."]],
      features: [["Three sizes and high contrast", "For people who are hard of hearing and for large rooms."], ["Complete sentences", "An option hides the sentence in progress for calmer reading."], ["Speaker names", "The name appears each time the speaker changes."], ["OBS and vMix overlay", "A transparent page to add as a browser source."], ["Zoom and Teams", "Translated captions go straight into the meeting."], ["Webhook", "Receive every caption line on your own service."]],
      faq: [["Are captions on by default?", "No. The organizer turns them on for the event, so text is never broadcast by mistake."], ["Can a misheard word be fixed?", "Yes, with the glossary: a \"wrong => right\" rule applies live to every language or to one."]],
    },
    {
      slug: "transcriptions", icon: "FileText", name: "Transcripts", short: "The full text of every language, timestamped, ready to download.",
      title: "Transcripts in every language", lead: "After the event, find what was said in the speaker's language and in each translated language, with the time of every sentence.",
      image: "transcripts",
      steps: [["Turn archiving on", "A checkbox when you create the event."], ["Broadcast", "The text is saved every minute during the session."], ["Download", "TXT, timed TXT, SRT or VTT, from the portal."]],
      features: [["Timestamps and offset", "Line the times up with your video recording."], ["SRT and VTT subtitles", "Ready for YouTube, Vimeo and your editing software."], ["Translate afterwards", "Translate a transcript into another language and keep the timing."], ["Speaker names", "Every turn is attributed."], ["Archiving by choice", "Off by default, deleted with the event."], ["Export to your tools", "Through the API or as files."]],
      faq: [["Where are transcripts stored?", "Only on your server, and only if you turned archiving on for the event."]],
    },
    {
      slug: "resumes", icon: "Sparkles", name: "AI summaries", short: "The key points of the session, published to attendees.",
      title: "AI summaries of your sessions", lead: "In one click, get a structured summary: themes, key points, decisions and quotes. Publish it on the attendee page in the language you choose.",
      image: "captions",
      steps: [["Finish the session", "Or ask for a summary while it is still running."], ["Choose the language", "The summary can be in a different language from the transcript."], ["Publish", "The summary appears on the listener page until you remove it."]],
      features: [["Clean Markdown", "Headings and lists that paste well into an email or a newsletter."], ["Your glossaries applied", "Corrected names and terms carry into the summary."], ["Not kept by the provider", "Summaries are requested with storage disabled."]],
      faq: [["Is the summary reliable?", "It is written by AI from a machine interpretation: check names and figures before you share it."]],
    },
    {
      slug: "ecran-de-salle", icon: "Monitor", name: "Room screen", short: "Large captions on the projector, with the QR code.",
      title: "A room screen for the whole audience", lead: "Show very large captions on a projector or a TV, up to four languages side by side, with the QR code and the session code to join.",
      image: "screen",
      steps: [["Open the room screen", "A link from the console, on the computer connected to the projector."], ["Pick the languages", "One language full screen, or several side by side."], ["Leave it running", "The screen stays awake and reconnects by itself."]],
      features: [["Multilingual", "Up to four languages on one screen."], ["Light or dark theme", "To suit the lighting in the room."], ["Logo and sponsor", "Your branding on the screen."], ["Transparent overlay", "For your live streams."]],
      faq: [["Does the room screen play audio?", "No, it only shows text, so it makes no sound in the room."]],
    },
    {
      slug: "interpretes", icon: "UserRound", name: "Interpreter booths", short: "Your human interpreters, online, alongside AI languages.",
      title: "Human interpreter booths in the browser", lead: "Your interpreters hear the room from a web booth and speak into their microphone. Listeners of their language hear them, labelled \"Human interpreter\". The other languages stay with the AI.",
      image: "phone",
      steps: [["Assign a language", "When you create the event, mark the language \"Human interpreter\"."], ["Send the link and code", "The interpreter opens the booth on their computer, with a headset."], ["Go on air", "One button to speak, one to cough."]],
      features: [["Separate floor audio", "The interpreter hears the speaker without that sound reaching the audience."], ["One interpreter on air per language", "No clash between two booths."], ["No AI cost", "Human languages use no translation minutes."]],
      faq: [["Does the interpreter need to be on site?", "No. The booth works remotely, in the browser."]],
    },
    {
      slug: "integrations", icon: "Video", name: "Zoom, Teams, Webex, OBS", short: "Bring a meeting or a stream in, send captions back.",
      title: "Integrations with your meetings and streams", lead: "Send a Zoom, Teams or Webex meeting, or an OBS stream, to TranslateBox over RTMP or SRT. The server translates for your listeners and can send captions back into the meeting.",
      image: "screen",
      steps: [["Copy the URL and key", "They are unique to each event."], ["Start custom streaming", "From Zoom, Teams, Webex, OBS or vMix."], ["Start on the server", "Translation keeps running even with the console closed."]],
      features: [["RTMP, RTMPS and SRT", "The usual streaming protocols."], ["Captions to Zoom and Teams", "With the Zoom caption token or the Teams CART link."], ["Website embed", "The listener page inside your site or event platform."], ["API and keys", "Create sessions and fetch transcripts from your own tools."]],
      faq: [["Is a bot added to the meeting?", "No. The meeting platform sends its stream to TranslateBox; no automated participant joins."], ["Is Google Meet supported?", "Not directly. With OBS you can send the audio of a Meet call."]],
    },
    {
      slug: "doublage", icon: "AudioLines", name: "Video dubbing", short: "A translated voice track aligned to your recording.",
      title: "Dubbing for your recordings", lead: "From the timed transcript, TranslateBox produces a WAV voice track in the chosen language, with the studio voice of your choice, aligned to the session timing.",
      image: "transcripts",
      steps: [["Broadcast the session", "With transcripts kept."], ["Pick the voice", "From 13 studio voices."], ["Download the track", "A WAV file to add to your video."]],
      features: [["Timing kept", "Every sentence lands at its time."], ["Glossary applied", "Corrected names and terms are pronounced properly."]],
      faq: [["Can I dub an existing video?", "Dubbing starts from a session broadcast in TranslateBox: play the video as the audio source, then download the track."]],
    },
  ],
};

export const SOLUTIONS = {
  fr: [
    { slug: "eglises", icon: "Church", name: "Églises et ministères", title: "La prédication dans la langue du cœur", lead: "Accueillez les familles nouvellement arrivées, les visiteurs et les générations qui ne parlent pas la même langue. Chacun suit la prédication, la louange et les annonces sur son téléphone.", needs: [["Une assemblée de plusieurs langues", "Proposez jusqu'à cinq langues par culte, dont des langues africaines comme le lingala et le swahili."], ["Un vocabulaire particulier", "Le glossaire retient les livres bibliques, les lieux, les noms des pasteurs et des ministères."], ["Des bénévoles, pas des techniciens", "La console est simple et le culte peut tourner sur le serveur pendant que l'équipe s'occupe d'autre chose."]], points: ["Style de voix « prédication »", "Écran de salle pour les chants et les annonces", "Interprètes bénévoles en cabine web", "Résumé du message publié après le culte"] },
    { slug: "conferences", icon: "Presentation", name: "Conférences et événements", title: "Chaque séance, pour chaque participant", lead: "Plénières, panels, ateliers : la voix et les sous-titres traduits suivent l'orateur depuis le micro de scène ou la régie.", needs: [["Plusieurs salles en même temps", "Chaque séance a son code, son QR code et ses langues."], ["Des orateurs qui se succèdent", "Le nom de l'orateur apparaît dans les sous-titres et les transcriptions."], ["Des contenus à réutiliser", "Transcriptions, sous-titres SRT et résumés après chaque séance."]], points: ["Planification et import CSV des séances", "Logo et commanditaire sur chaque téléphone", "Écran de salle multilingue", "Rapport d'activité par séance"] },
    { slug: "education", icon: "GraduationCap", name: "Écoles et universités", title: "Des cours que tout le monde peut suivre", lead: "Élèves nouveaux arrivants, rencontres de parents, cours magistraux, cérémonies : la traduction et les sous-titres aident chacun à suivre et à réviser.", needs: [["Des niveaux de langue variés", "Les sous-titres en phrases complètes facilitent la lecture."], ["Réviser après le cours", "Les transcriptions horodatées restent disponibles."], ["Les appareils des élèves", "Aucune installation, le navigateur suffit."]], points: ["Glossaires par matière", "Contraste élevé et grandes polices", "Rencontres de parents multilingues", "Partage par code de session"] },
    { slug: "gouvernement", icon: "Landmark", name: "Municipalités et secteur public", title: "Des séances publiques accessibles à tous", lead: "Conseils municipaux, consultations publiques et séances d'information dans les langues de vos citoyens, en salle et en ligne.", needs: [["Des séances hybrides", "Webex, Teams ou Zoom comme source, sous-titres renvoyés dans la réunion."], ["Des exigences de sécurité", "Auto-hébergé, rôles, double authentification et authentification unique."], ["Des archives", "Transcriptions conservées si vous le décidez, supprimées avec l'événement."]], points: ["Langues officielles et langues des communautés", "Écran de salle pour l'assistance", "Clés API pour votre site", "Journal d'activité exportable"] },
    { slug: "associations", icon: "HeartHandshake", name: "Associations et OBNL", title: "Chaque membre trouve sa place", lead: "Assemblées générales, formations et événements communautaires avec les nouveaux arrivants et les partenaires que vous servez.", needs: [["Des budgets serrés", "Vous payez l'usage de l'IA directement, sans abonnement par participant."], ["Des équipes de bénévoles", "Plusieurs présentateurs avec leurs propres minutes."], ["Des langues moins courantes", "42 langues texte + voix en plus des 13 langues directes."]], points: ["Transfert de minutes entre présentateurs", "Interprètes bénévoles", "QR code imprimable", "Résumé publié aux membres"] },
    { slug: "entreprises", icon: "Building2", name: "Entreprises", title: "Une seule réunion pour des équipes du monde entier", lead: "Assemblées internes, formations, lancements et présentations clients dans plusieurs langues, avec votre image et vos règles.", needs: [["Des réunions Teams et Zoom", "Faites entrer la réunion par RTMP et renvoyez les sous-titres."], ["La sécurité de l'information", "Votre serveur, votre compte OpenAI, aucun enregistrement audio."], ["Mesurer l'usage", "Minutes par session, par langue et par présentateur."]], points: ["Authentification unique (OIDC)", "Intégration dans l'intranet", "Rapports CSV", "API REST"] },
  ],
  en: [
    { slug: "eglises", icon: "Church", name: "Churches and ministries", title: "The sermon in everyone's heart language", lead: "Welcome newcomer families, visitors and generations who do not share a language. Everyone follows the preaching, worship and announcements on their phone.", needs: [["A congregation with several languages", "Offer up to five languages per service, including African languages such as Lingala and Swahili."], ["A specific vocabulary", "The glossary keeps books of the Bible, places, and the names of pastors and ministries."], ["Volunteers, not technicians", "The console is simple, and the service can run on the server while the team does something else."]], points: ["\"Sermon\" voice style", "Room screen for songs and announcements", "Volunteer interpreters in web booths", "Message summary published after the service"] },
    { slug: "conferences", icon: "Presentation", name: "Conferences and events", title: "Every session, for every attendee", lead: "Keynotes, panels, breakouts: translated voice and captions follow the speaker from the stage microphone or the AV desk.", needs: [["Several rooms at once", "Each session has its own code, QR code and languages."], ["Speakers who take turns", "The speaker's name appears in captions and transcripts."], ["Content to reuse", "Transcripts, SRT subtitles and summaries after each session."]], points: ["Session scheduling and CSV import", "Logo and sponsor on every phone", "Multilingual room screen", "Activity report per session"] },
    { slug: "education", icon: "GraduationCap", name: "Schools and universities", title: "Lessons everyone can follow", lead: "Newcomer students, parent evenings, lectures, ceremonies: translation and captions help everyone follow along and review.", needs: [["Mixed language levels", "Complete-sentence captions are easier to read."], ["Review after class", "Timed transcripts stay available."], ["Students' own devices", "Nothing to install; the browser is enough."]], points: ["Glossaries per subject", "High contrast and large type", "Multilingual parent evenings", "Sharing by session code"] },
    { slug: "gouvernement", icon: "Landmark", name: "Municipalities and public sector", title: "Public meetings open to everyone", lead: "Council meetings, public consultations and information sessions in your residents' languages, in the room and online.", needs: [["Hybrid meetings", "Webex, Teams or Zoom as the source, captions sent back to the meeting."], ["Security requirements", "Self-hosted, roles, two-factor sign-in and single sign-on."], ["Records", "Transcripts kept if you decide, deleted with the event."]], points: ["Official and community languages", "Room screen for the public", "API keys for your website", "Exportable activity log"] },
    { slug: "associations", icon: "HeartHandshake", name: "Associations and nonprofits", title: "Every member has a seat at the table", lead: "General assemblies, trainings and community events with the newcomers and partners you serve.", needs: [["Tight budgets", "You pay for AI usage directly, with no per-attendee subscription."], ["Volunteer teams", "Several presenters, each with their own minutes."], ["Less common languages", "42 text-and-voice languages on top of the 13 direct ones."]], points: ["Minute transfers between presenters", "Volunteer interpreters", "Printable QR code", "Summary published to members"] },
    { slug: "entreprises", icon: "Building2", name: "Businesses", title: "One meeting for teams around the world", lead: "Town halls, trainings, launches and client presentations in several languages, with your branding and your rules.", needs: [["Teams and Zoom meetings", "Bring the meeting in over RTMP and send captions back."], ["Information security", "Your server, your OpenAI account, no audio recordings."], ["Measuring usage", "Minutes per session, per language and per presenter."]], points: ["Single sign-on (OIDC)", "Intranet embed", "CSV reports", "REST API"] },
  ],
};

export const HOME = {
  fr: {
    hero: {
      tagline: "Avec TranslateBox, personne ne perd un mot.",
      title: "Traduction, sous‑titres, transcriptions et résumés par IA",
      lead: "TranslateBox traduit vos réunions, cultes, cours et événements en direct, en salle comme en ligne. Les participants rejoignent avec un QR code et écoutent dans leur langue, sans application.",
      cta: "Demander une démo", cta2: "Comment ça marche",
      slogans: [["Globe", "Partout", "En salle, en ligne, hybride"], ["Users", "Pour tous", "55 langues d'écoute"], ["MessageSquareText", "Chaque mot", "Voix et texte en direct"]],
    },
    icons: [["Headphones", "Traduction", "traduction"], ["Captions", "Sous-titres", "sous-titres"], ["FileText", "Transcriptions", "transcriptions"], ["Sparkles", "Résumés", "resumes"]],
    stats: [["55", "langues pour vos auditeurs"], ["≈ 1 s", "de délai en interprétation directe"], ["5", "langues par session"], ["0", "application à installer"]],
    life: { title: "TranslateBox fait bien plus que traduire en direct", lead: "Du moment où vous planifiez la session jusqu'au résumé envoyé le lendemain.", cols: [
      { tag: "Avant l'événement", image: "sessions", items: ["Planifiez les sessions, les langues et les étiquettes, ou importez-les depuis un fichier CSV.", "Préparez un glossaire de noms, de lieux et de termes, par langue.", "Ajoutez votre logo, un commanditaire et les noms des orateurs."] },
      { tag: "Pendant l'événement", image: "captions", items: ["Traduction vocale et sous-titres sur chaque téléphone, en une seconde environ.", "Écran de salle, incrustation vidéo, Zoom, Teams, Webex et OBS.", "Interprètes humains en cabine web pour les langues de votre choix."] },
      { tag: "Après l'événement", image: "transcripts", items: ["Transcriptions horodatées en TXT, SRT et VTT, dans toutes les langues.", "Résumé IA publié sur la page des participants.", "Piste de voix doublée pour vos enregistrements."] },
    ] },
    trust: { title: "Prêt pour les organisations exigeantes", items: ["Auto-hébergé sur votre serveur", "Aucun enregistrement audio", "Double authentification", "Authentification unique (OIDC)", "Rôles et permissions", "Archivage au choix"] },
    bundle: { title: "Huit outils dans une seule solution", lead: "Tout ce qu'il faut pour un événement multilingue, dans la même console.", more: "Voir tous les produits" },
    benefits: { title: "Une traduction par IA prête pour tous vos événements", items: [
      ["Tous les formats", "En salle, en ligne ou hybride : un micro, une console de mixage, ou une réunion Zoom, Teams et Webex."],
      ["Mise en place immédiate", "Les participants rejoignent avec un QR code, un lien ou un code de session. Aucun compte, aucune application."],
      ["55 langues", "13 langues en interprétation directe et 42 langues texte + voix, dont l'arabe, le swahili et le lingala."],
      ["Un coût maîtrisé", "Vous payez l'usage de l'IA directement sur votre compte OpenAI, avec des plafonds par mois et par présentateur."],
      ["Prêt pour les organisations", "Comptes et rôles, double authentification, authentification unique, clés API et journal d'activité."],
      ["Tout-en-un", "Traduction, sous-titres, écran de salle, cabines d'interprètes, transcriptions, résumés et doublage."],
    ] },
    segments: { title: "Pensé pour les organisations de toutes tailles", lead: "Une petite église de quartier ou une conférence de plusieurs salles : la même console s'adapte à la taille de l'événement." },
    features: { title: "Fonctionnalités et avantages", items: [
      ["Combien coûte TranslateBox ?", "TranslateBox tourne sur votre serveur et utilise votre propre compte OpenAI. Vous payez l'usage réel, en minutes par langue, sans frais par participant. Les administrateurs fixent un plafond mensuel et des minutes par présentateur.", "Voir comment ça marche", "/comment-ca-marche"],
      ["Quels types d'événements ?", "Cultes, conférences, cours, conseils municipaux, formations et réunions, en salle, en ligne ou hybrides. Une session peut aussi tourner entièrement sur le serveur à partir d'un flux.", "Voir les solutions", "/solutions"],
      ["Comment les participants y accèdent-ils ?", "Ils scannent le QR code, ouvrent le lien ou tapent le code de session sur translatebox. La page d'écoute fonctionne sur tout téléphone ou ordinateur récent, sans compte.", "Rejoindre une session", "/join"],
      ["Combien de langues ?", "55 langues d'écoute : 13 en interprétation directe et 42 traduites phrase par phrase puis lues par une voix studio. La langue de l'orateur est détectée automatiquement parmi plus de 70.", "Voir la traduction en direct", "/produits/traduction"],
      ["Quelle précision ?", "La qualité dépend surtout du son. Un bon micro, un glossaire préparé et le bon style de voix font la différence. Les corrections du glossaire s'appliquent en direct.", "Voir les sous-titres", "/produits/sous-titres"],
      ["Quelles intégrations ?", "Zoom, Teams, Webex, OBS et vMix en entrée (RTMP, SRT), sous-titres renvoyés vers Zoom et Teams, intégration web, webhook et API REST.", "Voir les intégrations", "/produits/integrations"],
      ["Sécurité et confidentialité", "Le logiciel tourne chez vous. Le son n'est jamais enregistré par l'application, les transcriptions ne sont conservées que si vous le décidez, et la clé OpenAI ne quitte pas le serveur.", "Voir la sécurité", "/securite"],
    ] },
    cta: { title: "Envie d'en savoir plus sur TranslateBox ?", button: "Demander une démo" },
    demo: { title: "Obtenez une démo personnalisée", lead: "Un appel vidéo de 30 minutes pour voir TranslateBox avec vos langues et votre source audio.", items: ["Mise en place en direct de votre première session", "Réunion Zoom, Teams ou Webex comme source", "Glossaire préparé avec votre vocabulaire", "Transcriptions et résumés de la session", "Écran de salle et options d'affichage des sous-titres", "Comptes, rôles et minutes pour votre équipe"] },
  },
  en: {
    hero: {
      tagline: "With TranslateBox, nobody misses a word.",
      title: "AI translation, captions, transcripts and summaries",
      lead: "TranslateBox translates your meetings, services, classes and events live, in the room and online. Attendees join with a QR code and listen in their own language, with no app to install.",
      cta: "Get a demo", cta2: "How it works",
      slogans: [["Globe", "Everywhere", "In person, online, hybrid"], ["Users", "Everyone", "55 listener languages"], ["MessageSquareText", "Every word", "Live voice and text"]],
    },
    icons: [["Headphones", "Translation", "traduction"], ["Captions", "Captions", "sous-titres"], ["FileText", "Transcripts", "transcriptions"], ["Sparkles", "Summaries", "resumes"]],
    stats: [["55", "languages for your listeners"], ["≈ 1 s", "delay with direct interpretation"], ["5", "languages per session"], ["0", "apps to install"]],
    life: { title: "TranslateBox does much more than live translation", lead: "From the moment you schedule the session to the summary you send the next day.", cols: [
      { tag: "Before the event", image: "sessions", items: ["Schedule sessions, languages and labels, or import them from a CSV file.", "Prepare a glossary of names, places and terms, per language.", "Add your logo, a sponsor line and the speakers' names."] },
      { tag: "During the event", image: "captions", items: ["Voice translation and captions on every phone, about a second behind the speaker.", "Room screen, video overlay, Zoom, Teams, Webex and OBS.", "Human interpreters in web booths for the languages you choose."] },
      { tag: "After the event", image: "transcripts", items: ["Timed transcripts as TXT, SRT and VTT, in every language.", "AI summary published on the attendee page.", "A dubbed voice track for your recordings."] },
    ] },
    trust: { title: "Ready for demanding organizations", items: ["Self-hosted on your server", "No audio recordings", "Two-factor sign-in", "Single sign-on (OIDC)", "Roles and permissions", "Archiving by choice"] },
    bundle: { title: "Eight tools in one solution", lead: "Everything a multilingual event needs, in the same console.", more: "See all products" },
    benefits: { title: "AI translation ready for all your events", items: [
      ["Every format", "In person, online or hybrid: a microphone, a mixing desk, or a Zoom, Teams or Webex meeting."],
      ["Instant setup", "Attendees join with a QR code, a link or a session code. No account, no app."],
      ["55 languages", "13 with direct interpretation and 42 text-and-voice languages, including Arabic, Swahili and Lingala."],
      ["Predictable cost", "You pay AI usage directly on your OpenAI account, with monthly and per-presenter caps."],
      ["Built for organizations", "Accounts and roles, two-factor sign-in, single sign-on, API keys and an activity log."],
      ["All in one", "Translation, captions, room screen, interpreter booths, transcripts, summaries and dubbing."],
    ] },
    segments: { title: "Built for organizations of every size", lead: "A neighbourhood church or a multi-room conference: the same console adapts to the size of the event." },
    features: { title: "Features and benefits", items: [
      ["How much does TranslateBox cost?", "TranslateBox runs on your server and uses your own OpenAI account. You pay actual usage, in minutes per language, with no per-attendee fee. Administrators set a monthly cap and minutes per presenter.", "See how it works", "/comment-ca-marche"],
      ["What kinds of events?", "Services, conferences, classes, council meetings, trainings and meetings, in person, online or hybrid. A session can also run entirely on the server from a stream.", "See solutions", "/solutions"],
      ["How do attendees get in?", "They scan the QR code, open the link or type the session code. The listener page works on any recent phone or computer, with no account.", "Join a session", "/join"],
      ["How many languages?", "55 listener languages: 13 with direct interpretation and 42 translated sentence by sentence and read by a studio voice. The speaker's language is detected automatically among more than 70.", "See live translation", "/produits/traduction"],
      ["How accurate is it?", "Quality depends mostly on the audio. A good microphone, a prepared glossary and the right voice style make the difference. Glossary corrections apply live.", "See captions", "/produits/sous-titres"],
      ["Which integrations?", "Zoom, Teams, Webex, OBS and vMix as input (RTMP, SRT), captions sent back to Zoom and Teams, website embed, webhook and REST API.", "See integrations", "/produits/integrations"],
      ["Security and privacy", "The software runs on your side. Audio is never recorded by the app, transcripts are kept only if you decide, and the OpenAI key never leaves the server.", "See security", "/securite"],
    ] },
    cta: { title: "Want to learn more about TranslateBox?", button: "Get a demo" },
    demo: { title: "Get a personalized demo", lead: "A 30-minute video call to see TranslateBox with your languages and your audio source.", items: ["Your first session set up live", "A Zoom, Teams or Webex meeting as the source", "A glossary prepared with your vocabulary", "Session transcripts and summaries", "Room screen and caption display options", "Accounts, roles and minutes for your team"] },
  },
};

export const HOW = {
  fr: { title: "Comment fonctionne TranslateBox", lead: "Un orateur parle. TranslateBox écoute, traduit et diffuse vers chaque participant, dans sa langue, en voix et en texte.", steps: [
    ["Mic", "1. Le son arrive", "Depuis le micro de l'ordinateur, une console de mixage ou un flux RTMP/SRT envoyé par Zoom, Teams, Webex ou OBS."],
    ["Languages", "2. L'IA interprète", "Une session d'interprétation par langue. Pour les 42 langues texte + voix, chaque phrase est traduite puis lue par une voix studio."],
    ["Radio", "3. Le serveur diffuse", "Votre serveur envoie la voix et les sous-titres à chaque téléphone, à l'écran de salle et aux réunions."],
    ["Smartphone", "4. Les participants écoutent", "Ils scannent le QR code, choisissent leur langue et écoutent au casque."],
  ], cost: { title: "Ce que vous payez", text: "TranslateBox tourne sur votre serveur (un VPS suffit) avec votre clé OpenAI. La facture OpenAI dépend des minutes diffusées et du nombre de langues ; chaque langue ouvre sa propre session. Les langues confiées à des interprètes humains ne coûtent rien en IA. Le portail affiche les minutes utilisées par session, par langue et par présentateur, et un plafond mensuel bloque toute session au-delà." } },
  en: { title: "How TranslateBox works", lead: "A speaker talks. TranslateBox listens, translates and delivers to every attendee, in their language, as voice and text.", steps: [
    ["Mic", "1. Audio comes in", "From the computer's microphone, a mixing desk, or an RTMP/SRT stream sent by Zoom, Teams, Webex or OBS."],
    ["Languages", "2. The AI interprets", "One interpretation session per language. For the 42 text-and-voice languages, each sentence is translated, then read by a studio voice."],
    ["Radio", "3. Your server delivers", "Your server sends voice and captions to every phone, the room screen and meetings."],
    ["Smartphone", "4. Attendees listen", "They scan the QR code, pick their language and listen with headphones."],
  ], cost: { title: "What you pay", text: "TranslateBox runs on your server (a VPS is enough) with your OpenAI key. The OpenAI bill depends on minutes broadcast and the number of languages; each language opens its own session. Languages handled by human interpreters cost nothing in AI. The portal shows minutes used per session, language and presenter, and a monthly cap blocks any session beyond it." } },
};

export const SECURITY_PAGE = {
  fr: {
    title: "Sécurité et confidentialité", lead: "TranslateBox est un logiciel que vous exploitez vous-même. Voici exactement ce qu'il advient de votre son, de vos textes et de vos comptes.",
    blocks: [
      ["Où il tourne", "Sur votre serveur, dans des conteneurs Docker que vous contrôlez. Vous décidez quand installer une mise à jour."],
      ["Le son", "Le son est envoyé au fournisseur d'IA pour la traduction en direct. L'application ne l'écrit jamais sur disque. Les téléphones ne reçoivent le son que pendant l'écoute."],
      ["Les textes", "Les sous-titres restent en mémoire pendant la session. L'archivage des transcriptions est désactivé par défaut et supprimé avec l'événement."],
      ["Le fournisseur d'IA", "Traduction, voix et résumés passent par votre propre compte OpenAI. Les résumés et traductions de texte sont demandés sans stockage. La clé ne quitte jamais le serveur."],
      ["Les comptes", "Rôles propriétaire, administrateur et présentateur. Un présentateur ne voit que ses sessions. Mots de passe hachés (scrypt), double authentification, authentification unique en option."],
      ["Les participants", "Ni compte ni application. Un code PIN optionnel par événement. La page d'écoute ne s'intègre que sur les sites que vous autorisez."],
      ["Les flux et les clés", "Chaque événement a sa clé de flux secrète, que vous pouvez renouveler. Les clés API sont stockées hachées et ne peuvent pas créer d'autres clés."],
      ["Ce que nous ne prétendons pas", "TranslateBox ne détient pas à lui seul de certification comme SOC 2 ou ISO 27001. Elles dépendent de votre hébergeur et de vos propres politiques."],
    ],
  },
  en: {
    title: "Security and privacy", lead: "TranslateBox is software you run yourself. Here is exactly what happens to your audio, your text and your accounts.",
    blocks: [
      ["Where it runs", "On your server, in Docker containers you control. You decide when to install an update."],
      ["Audio", "Audio is sent to the AI provider for live translation. The app never writes it to disk. Phones only receive audio while listening."],
      ["Text", "Captions stay in memory during the session. Transcript archiving is off by default and deleted with the event."],
      ["The AI provider", "Translation, voices and summaries go through your own OpenAI account. Summaries and text translations are requested without storage. The key never leaves the server."],
      ["Accounts", "Owner, administrator and presenter roles. Presenters only see their own sessions. Passwords hashed with scrypt, two-factor sign-in, optional single sign-on."],
      ["Attendees", "No account and no app. An optional PIN per event. The listener page can only be embedded on sites you allow."],
      ["Streams and keys", "Each event has its own secret stream key, which you can rotate. API keys are stored hashed and cannot create other keys."],
      ["What we do not claim", "TranslateBox does not hold a certification such as SOC 2 or ISO 27001 by itself. Those depend on your hosting provider and your own policies."],
    ],
  },
};

export const DEMO = {
  fr: { title: "Demander une démo", lead: "Parlez-nous de votre événement. Nous vous répondons par courriel pour fixer un appel vidéo de 30 minutes.", name: "Votre nom", email: "Courriel", org: "Organisation", type: "Type d'organisation", size: "Participants par événement", languages: "Langues souhaitées", message: "Autre chose à nous dire ?", send: "Envoyer la demande", sent: "Merci ! Nous vous répondons très vite.", privacy: "Ces informations servent uniquement à répondre à votre demande.", types: ["Église ou ministère", "Conférence ou événement", "École ou université", "Secteur public", "Association ou OBNL", "Entreprise", "Autre"], sizes: ["Moins de 50", "50 à 200", "200 à 1 000", "Plus de 1 000"] },
  en: { title: "Get a demo", lead: "Tell us about your event. We will reply by email to set up a 30-minute video call.", name: "Your name", email: "Email", org: "Organization", type: "Type of organization", size: "Attendees per event", languages: "Languages you need", message: "Anything else we should know?", send: "Send request", sent: "Thank you! We will get back to you shortly.", privacy: "We only use these details to answer your request.", types: ["Church or ministry", "Conference or event", "School or university", "Public sector", "Association or nonprofit", "Business", "Other"], sizes: ["Under 50", "50 to 200", "200 to 1,000", "Over 1,000"] },
};

export const COMMON = {
  fr: { learnMore: "En savoir plus", how: "Comment ça marche", features: "Fonctionnalités", faq: "Questions fréquentes", related: "Autres produits", needs: "Ce dont vous avez besoin, et comment TranslateBox y répond", included: "Inclus", allProducts: "Tous les produits", footerTag: "Traduction, sous-titres et transcriptions en direct pour les réunions et les événements.", rights: "Tous droits réservés.", company: "TranslateBox", listeners: "Participants", made: "Conçu à Moncton, Nouveau-Brunswick" },
  en: { learnMore: "Learn more", how: "How it works", features: "Features", faq: "Frequently asked questions", related: "Other products", needs: "What you need, and how TranslateBox answers it", included: "Included", allProducts: "All products", footerTag: "Live translation, captions and transcripts for meetings and events.", rights: "All rights reserved.", company: "TranslateBox", listeners: "Attendees", made: "Made in Moncton, New Brunswick" },
};
