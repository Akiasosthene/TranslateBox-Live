// Public website copy in five languages. Facts about the app only:
// no invented customers, ratings, savings or certifications.

export const LANGS = [["fr", "Français"], ["en", "English"], ["es", "Español"], ["pt", "Português"], ["de", "Deutsch"]];

export const IMG = {
  phone: "/site/phone-listen.webp",
  captions: "/site/phone-captions.webp",
  screen: "/site/room-screen.webp",
  sessions: "/site/portal-sessions.webp",
  transcripts: "/site/portal-transcripts.webp",
};

// Old product URLs now point to the merged product pages.
export const PRODUCT_ALIASES = { zoom: "integrations", teams: "integrations", diffusion: "integrations", "passerelle-sous-titres": "integrations", api: "integrations", "sous-titres-video": "transcriptions", "espace-de-travail": "integrations", "image-de-marque": "ecran-de-salle" };

const ICONS = { traduction: "Headphones", "sous-titres": "Captions", transcriptions: "FileText", resumes: "Sparkles", "ecran-de-salle": "Monitor", interpretes: "UserRound", integrations: "Waypoints", doublage: "AudioLines" };
const IMAGES = { traduction: "phone", "sous-titres": "captions", transcriptions: "transcripts", resumes: "captions", "ecran-de-salle": "screen", interpretes: "phone", integrations: "screen", doublage: "transcripts" };
const UC_ICONS = { reunions: "Users", conferences: "Presentation", webinaires: "MonitorPlay", formations: "GraduationCap", "evenements-hybrides": "Globe", "accueil-du-public": "Landmark" };
export const UC_PRODUCTS = {
  reunions: ["traduction", "integrations", "transcriptions", "resumes"],
  conferences: ["traduction", "ecran-de-salle", "interpretes", "sous-titres"],
  webinaires: ["integrations", "sous-titres", "transcriptions", "doublage"],
  formations: ["sous-titres", "transcriptions", "resumes", "traduction"],
  "evenements-hybrides": ["ecran-de-salle", "integrations", "traduction", "sous-titres"],
  "accueil-du-public": ["traduction", "sous-titres", "interpretes", "ecran-de-salle"],
};

// [slug, name, short, title, lead, [[feature, text] x4], [question, answer]]
const products = (rows) => rows.map(([slug, name, short, title, lead, features, faq]) => ({ slug, icon: ICONS[slug], image: IMAGES[slug], name, short, title, lead, features, faq: [faq] }));
// [slug, name, title, lead, [[need, text] x3]]
const usecases = (rows) => rows.map(([slug, name, title, lead, needs]) => ({ slug, icon: UC_ICONS[slug], name, title, lead, needs }));

export const PRODUCTS = {
  fr: products([
    ["traduction", "Traduction en direct", "La voix de l'intervenant, traduite dans les écouteurs de chacun.", "Traduction vocale en direct par IA", "Chaque participant choisit sa langue sur son téléphone et entend l'intervenant traduit, environ une seconde après lui. Un QR code et des écouteurs suffisent.",
      [["55 langues d'écoute", "13 en interprétation directe, 42 traduites phrase par phrase."], ["13 voix studio", "Une voix et un style au choix."], ["Langue détectée", "La langue de l'intervenant est reconnue automatiquement."], ["Sans application", "Tout se passe dans le navigateur du téléphone."]],
      ["Quel est le délai ?", "Une à deux secondes pour les langues directes, quelques secondes de plus pour les autres."]],
    ["sous-titres", "Sous-titres en direct", "Des sous-titres traduits sur chaque téléphone.", "Sous-titres en direct, dans la langue de chacun", "Les sous-titres suivent l'intervenant phrase par phrase. Chacun règle la taille et le contraste.",
      [["Trois tailles", "Et un mode contraste élevé."], ["Phrases complètes", "Pour une lecture plus calme."], ["Noms des intervenants", "Affichés à chaque changement."], ["Glossaires", "Noms et sigles corrigés en direct."]],
      ["Faut-il le son pour lire ?", "Non, les sous-titres fonctionnent seuls, sans écouteurs."]],
    ["transcriptions", "Transcriptions", "Le texte complet, horodaté, dans chaque langue.", "Transcriptions dans toutes les langues", "Après la séance, retrouvez tout ce qui a été dit, dans la langue de l'intervenant et dans chaque langue traduite.",
      [["TXT, SRT et VTT", "Pour vos documents et vos vidéos."], ["Horodatage", "Avec un décalage réglable."], ["Traduction après coup", "Ajoutez une langue, le minutage reste."], ["Au choix", "Rien n'est conservé si vous ne l'activez pas."]],
      ["Où sont-elles stockées ?", "Sur votre serveur uniquement."]],
    ["resumes", "Résumés IA", "Les points clés de la séance, en un clic.", "Résumés IA de vos séances", "Un résumé clair : thèmes, points clés, décisions et citations, dans la langue de votre choix, publié pour les participants.",
      [["En un clic", "Pendant ou après la séance."], ["Toutes les langues", "Indépendamment de la transcription."], ["Prêt à partager", "Titres et listes faciles à copier."], ["Glossaire appliqué", "Les noms restent corrects."]],
      ["Faut-il le relire ?", "Oui, relisez les noms et les chiffres avant de le diffuser."]],
    ["ecran-de-salle", "Affichage en salle", "Les sous-titres en grand, avec le QR code.", "Les sous-titres en grand, pour toute la salle", "Affichez jusqu'à quatre langues sur un projecteur ou une télévision, avec votre logo et le QR code pour rejoindre.",
      [["Jusqu'à 4 langues", "Côte à côte sur le même écran."], ["Clair ou sombre", "Selon la lumière de la salle."], ["Votre logo", "Et celui de vos partenaires."], ["Incrustation vidéo", "Pour OBS et vMix."]],
      ["L'écran diffuse-t-il le son ?", "Non, il affiche seulement le texte."]],
    ["interpretes", "Interprètes humains", "Vos interprètes et l'IA dans la même session.", "Vos interprètes et l'IA, ensemble", "Confiez certaines langues à vos interprètes, qui travaillent depuis une cabine dans le navigateur. Les autres langues restent traduites par l'IA.",
      [["Cabine web", "Un ordinateur et un casque suffisent."], ["À distance", "L'interprète n'a pas besoin d'être sur place."], ["Sans coût IA", "Pour les langues humaines."], ["Transparent", "Le participant sait qui traduit."]],
      ["Plusieurs interprètes par langue ?", "Oui, un seul est à l'antenne à la fois."]],
    ["integrations", "Intégrations", "Zoom, Teams, Webex, OBS, RTMP et API.", "Branché sur vos outils", "Traduisez une réunion Zoom, Teams ou Webex, ou n'importe quel flux RTMP ou SRT. Les sous-titres traduits reviennent dans la réunion.",
      [["Zoom et Teams", "Diffusion personnalisée, sous-titres renvoyés."], ["RTMP et SRT", "Depuis OBS, vMix ou votre régie."], ["Sur le serveur", "La traduction continue console fermée."], ["API et intégration web", "Sessions, transcriptions, page d'écoute dans votre site."]],
      ["Faut-il un robot dans la réunion ?", "Non, la réunion envoie son flux sans participant ajouté."]],
    ["doublage", "Doublage IA", "Une piste de voix traduite pour vos vidéos.", "Doublage IA de vos enregistrements", "À partir de la transcription horodatée, Syntova produit une piste audio dans la langue choisie, avec une voix studio.",
      [["Minutage conservé", "Chaque phrase tombe à sa place."], ["13 voix", "Au choix."], ["Fichier WAV", "Prêt pour le montage."], ["Glossaire appliqué", "Noms bien prononcés."]],
      ["Remplace-t-il la voix d'origine ?", "Non, c'est une piste séparée que vous mixez au montage."]],
  ]),
  en: products([
    ["traduction", "Live translation", "The speaker's voice, translated into everyone's headphones.", "Live AI voice translation", "Each attendee picks a language on their phone and hears the speaker translated, about a second behind. A QR code and headphones are all it takes.",
      [["55 listener languages", "13 with direct interpretation, 42 translated sentence by sentence."], ["13 studio voices", "Pick a voice and a style."], ["Language detection", "The speaker's language is recognised automatically."], ["No app", "It all runs in the phone's browser."]],
      ["How long is the delay?", "One to two seconds for direct languages, a few seconds more for the others."]],
    ["sous-titres", "Live captions", "Translated captions on every phone.", "Live captions in everyone's language", "Captions follow the speaker sentence by sentence. Everyone sets their own size and contrast.",
      [["Three sizes", "Plus a high-contrast mode."], ["Complete sentences", "For calmer reading."], ["Speaker names", "Shown at each change."], ["Glossaries", "Names and acronyms fixed live."]],
      ["Do I need audio to read?", "No, captions work on their own, without headphones."]],
    ["transcriptions", "Transcripts", "The full text, timestamped, in every language.", "Transcripts in every language", "After the session, find everything that was said, in the speaker's language and in each translated language.",
      [["TXT, SRT and VTT", "For documents and videos."], ["Timestamps", "With an adjustable offset."], ["Translate later", "Add a language, timing kept."], ["Your choice", "Nothing is kept unless you turn it on."]],
      ["Where are they stored?", "Only on your server."]],
    ["resumes", "AI summaries", "The key points of the session, in one click.", "AI summaries of your sessions", "A clear summary of themes, key points, decisions and quotes, in the language you choose, published for attendees.",
      [["One click", "During or after the session."], ["Any language", "Independent of the transcript."], ["Ready to share", "Headings and lists that paste well."], ["Glossary applied", "Names stay right."]],
      ["Should I review it?", "Yes, check names and figures before sharing."]],
    ["ecran-de-salle", "Room display", "Large captions with the QR code.", "Large captions for the whole room", "Show up to four languages on a projector or TV, with your logo and the QR code to join.",
      [["Up to 4 languages", "Side by side on one screen."], ["Light or dark", "To suit the room."], ["Your logo", "And your partners'."], ["Video overlay", "For OBS and vMix."]],
      ["Does the screen play audio?", "No, it only shows text."]],
    ["interpretes", "Human interpreters", "Your interpreters and AI in the same session.", "Your interpreters and AI, together", "Hand some languages to your interpreters, who work from a booth in the browser. The other languages stay with the AI.",
      [["Web booth", "A computer and a headset are enough."], ["Remote", "Interpreters don't need to be on site."], ["No AI cost", "For human languages."], ["Transparent", "Attendees know who is translating."]],
      ["Several interpreters per language?", "Yes, one is on air at a time."]],
    ["integrations", "Integrations", "Zoom, Teams, Webex, OBS, RTMP and API.", "Connected to your tools", "Translate a Zoom, Teams or Webex meeting, or any RTMP or SRT stream. Translated captions go back into the meeting.",
      [["Zoom and Teams", "Custom streaming, captions sent back."], ["RTMP and SRT", "From OBS, vMix or your AV desk."], ["On the server", "Translation keeps going with the console closed."], ["API and web embed", "Sessions, transcripts, listener page in your site."]],
      ["Is there a bot in the meeting?", "No, the meeting sends its stream without adding a participant."]],
    ["doublage", "AI dubbing", "A translated voice track for your videos.", "AI dubbing for your recordings", "From the timed transcript, Syntova produces an audio track in the chosen language, with a studio voice.",
      [["Timing kept", "Every sentence lands in place."], ["13 voices", "Your choice."], ["WAV file", "Ready for editing."], ["Glossary applied", "Names pronounced properly."]],
      ["Does it replace the original voice?", "No, it is a separate track you mix in editing."]],
  ]),
  es: products([
    ["traduction", "Traducción en directo", "La voz del orador, traducida en los auriculares de cada uno.", "Traducción de voz en directo con IA", "Cada asistente elige su idioma en el móvil y escucha al orador traducido, con un segundo de retraso. Basta un código QR y unos auriculares.",
      [["55 idiomas de escucha", "13 con interpretación directa y 42 traducidos frase a frase."], ["13 voces de estudio", "Elija voz y estilo."], ["Idioma detectado", "El idioma del orador se reconoce solo."], ["Sin aplicación", "Todo funciona en el navegador del móvil."]],
      ["¿Cuánto retraso hay?", "Uno o dos segundos en los idiomas directos, unos segundos más en los demás."]],
    ["sous-titres", "Subtítulos en directo", "Subtítulos traducidos en cada móvil.", "Subtítulos en directo, en el idioma de cada uno", "Los subtítulos siguen al orador frase a frase. Cada persona ajusta el tamaño y el contraste.",
      [["Tres tamaños", "Y modo de alto contraste."], ["Frases completas", "Para leer con calma."], ["Nombres de los oradores", "En cada cambio."], ["Glosarios", "Nombres y siglas corregidos en directo."]],
      ["¿Hace falta audio para leer?", "No, los subtítulos funcionan solos, sin auriculares."]],
    ["transcriptions", "Transcripciones", "El texto completo, con marcas de tiempo, en cada idioma.", "Transcripciones en todos los idiomas", "Después de la sesión, encuentre todo lo que se dijo, en el idioma del orador y en cada idioma traducido.",
      [["TXT, SRT y VTT", "Para documentos y vídeos."], ["Marcas de tiempo", "Con desfase ajustable."], ["Traducir después", "Añada un idioma y se conserva el tiempo."], ["Usted decide", "No se guarda nada si no lo activa."]],
      ["¿Dónde se guardan?", "Solo en su servidor."]],
    ["resumes", "Resúmenes con IA", "Los puntos clave de la sesión, en un clic.", "Resúmenes con IA de sus sesiones", "Un resumen claro con temas, puntos clave, decisiones y citas, en el idioma que elija, publicado para los asistentes.",
      [["En un clic", "Durante o después de la sesión."], ["Cualquier idioma", "Independiente de la transcripción."], ["Listo para compartir", "Títulos y listas fáciles de copiar."], ["Glosario aplicado", "Los nombres quedan bien."]],
      ["¿Conviene revisarlo?", "Sí, revise nombres y cifras antes de compartirlo."]],
    ["ecran-de-salle", "Pantalla de sala", "Subtítulos grandes con el código QR.", "Subtítulos grandes para toda la sala", "Muestre hasta cuatro idiomas en un proyector o una televisión, con su logotipo y el código QR para unirse.",
      [["Hasta 4 idiomas", "Uno al lado del otro."], ["Claro u oscuro", "Según la sala."], ["Su logotipo", "Y el de sus patrocinadores."], ["Superposición de vídeo", "Para OBS y vMix."]],
      ["¿La pantalla reproduce audio?", "No, solo muestra texto."]],
    ["interpretes", "Intérpretes humanos", "Sus intérpretes y la IA en la misma sesión.", "Sus intérpretes y la IA, juntos", "Asigne algunos idiomas a sus intérpretes, que trabajan desde una cabina en el navegador. Los demás idiomas siguen con la IA.",
      [["Cabina web", "Basta un ordenador y unos cascos."], ["A distancia", "El intérprete no tiene que estar en la sala."], ["Sin coste de IA", "En los idiomas humanos."], ["Transparente", "El asistente sabe quién traduce."]],
      ["¿Varios intérpretes por idioma?", "Sí, uno en antena a la vez."]],
    ["integrations", "Integraciones", "Zoom, Teams, Webex, OBS, RTMP y API.", "Conectado a sus herramientas", "Traduzca una reunión de Zoom, Teams o Webex, o cualquier flujo RTMP o SRT. Los subtítulos traducidos vuelven a la reunión.",
      [["Zoom y Teams", "Transmisión personalizada y subtítulos de vuelta."], ["RTMP y SRT", "Desde OBS, vMix o su control."], ["En el servidor", "La traducción sigue con la consola cerrada."], ["API e inserción web", "Sesiones, transcripciones y página de escucha en su web."]],
      ["¿Hay un bot en la reunión?", "No, la reunión envía su flujo sin añadir participantes."]],
    ["doublage", "Doblaje con IA", "Una pista de voz traducida para sus vídeos.", "Doblaje con IA de sus grabaciones", "A partir de la transcripción con tiempos, Syntova genera una pista de audio en el idioma elegido, con una voz de estudio.",
      [["Tiempos conservados", "Cada frase en su sitio."], ["13 voces", "A elegir."], ["Archivo WAV", "Listo para editar."], ["Glosario aplicado", "Nombres bien pronunciados."]],
      ["¿Sustituye la voz original?", "No, es una pista aparte que se mezcla en la edición."]],
  ]),
  pt: products([
    ["traduction", "Tradução ao vivo", "A voz do orador, traduzida nos fones de cada um.", "Tradução de voz ao vivo com IA", "Cada participante escolhe o idioma no celular e ouve o orador traduzido, cerca de um segundo depois. Basta um QR code e fones de ouvido.",
      [["55 idiomas de escuta", "13 com interpretação direta e 42 traduzidos frase a frase."], ["13 vozes de estúdio", "Escolha a voz e o estilo."], ["Idioma detectado", "O idioma do orador é reconhecido automaticamente."], ["Sem aplicativo", "Tudo funciona no navegador do celular."]],
      ["Qual é o atraso?", "Um a dois segundos nos idiomas diretos, alguns segundos a mais nos outros."]],
    ["sous-titres", "Legendas ao vivo", "Legendas traduzidas em cada celular.", "Legendas ao vivo, no idioma de cada um", "As legendas acompanham o orador frase a frase. Cada pessoa ajusta o tamanho e o contraste.",
      [["Três tamanhos", "E modo de alto contraste."], ["Frases completas", "Para uma leitura mais calma."], ["Nomes dos oradores", "Exibidos a cada troca."], ["Glossários", "Nomes e siglas corrigidos ao vivo."]],
      ["Preciso de áudio para ler?", "Não, as legendas funcionam sozinhas, sem fones."]],
    ["transcriptions", "Transcrições", "O texto completo, com horário, em cada idioma.", "Transcrições em todos os idiomas", "Depois da sessão, encontre tudo o que foi dito, no idioma do orador e em cada idioma traduzido.",
      [["TXT, SRT e VTT", "Para documentos e vídeos."], ["Marcação de tempo", "Com ajuste de deslocamento."], ["Traduzir depois", "Adicione um idioma mantendo os tempos."], ["Você decide", "Nada é guardado sem a sua ativação."]],
      ["Onde ficam armazenadas?", "Apenas no seu servidor."]],
    ["resumes", "Resumos com IA", "Os pontos principais da sessão, em um clique.", "Resumos com IA das suas sessões", "Um resumo claro com temas, pontos principais, decisões e citações, no idioma escolhido, publicado para os participantes.",
      [["Um clique", "Durante ou depois da sessão."], ["Qualquer idioma", "Independente da transcrição."], ["Pronto para compartilhar", "Títulos e listas fáceis de copiar."], ["Glossário aplicado", "Os nomes ficam corretos."]],
      ["Preciso revisar?", "Sim, confira nomes e números antes de compartilhar."]],
    ["ecran-de-salle", "Tela da sala", "Legendas grandes com o QR code.", "Legendas grandes para toda a sala", "Mostre até quatro idiomas em um projetor ou TV, com o seu logotipo e o QR code para entrar.",
      [["Até 4 idiomas", "Lado a lado na mesma tela."], ["Claro ou escuro", "Conforme a sala."], ["Seu logotipo", "E o dos seus parceiros."], ["Sobreposição de vídeo", "Para OBS e vMix."]],
      ["A tela reproduz áudio?", "Não, ela mostra apenas o texto."]],
    ["interpretes", "Intérpretes humanos", "Seus intérpretes e a IA na mesma sessão.", "Seus intérpretes e a IA, juntos", "Confie alguns idiomas aos seus intérpretes, que trabalham numa cabine no navegador. Os outros idiomas continuam com a IA.",
      [["Cabine web", "Basta um computador e um headset."], ["A distância", "O intérprete não precisa estar no local."], ["Sem custo de IA", "Nos idiomas humanos."], ["Transparente", "O participante sabe quem traduz."]],
      ["Vários intérpretes por idioma?", "Sim, um no ar de cada vez."]],
    ["integrations", "Integrações", "Zoom, Teams, Webex, OBS, RTMP e API.", "Conectado às suas ferramentas", "Traduza uma reunião do Zoom, Teams ou Webex, ou qualquer transmissão RTMP ou SRT. As legendas traduzidas voltam para a reunião.",
      [["Zoom e Teams", "Transmissão personalizada e legendas de volta."], ["RTMP e SRT", "Do OBS, vMix ou da sua mesa técnica."], ["No servidor", "A tradução continua com o console fechado."], ["API e incorporação web", "Sessões, transcrições e página de escuta no seu site."]],
      ["Há um robô na reunião?", "Não, a reunião envia a transmissão sem adicionar participantes."]],
    ["doublage", "Dublagem com IA", "Uma faixa de voz traduzida para os seus vídeos.", "Dublagem com IA das suas gravações", "A partir da transcrição com tempos, o Syntova gera uma faixa de áudio no idioma escolhido, com uma voz de estúdio.",
      [["Tempos mantidos", "Cada frase no lugar certo."], ["13 vozes", "À sua escolha."], ["Arquivo WAV", "Pronto para edição."], ["Glossário aplicado", "Nomes bem pronunciados."]],
      ["Substitui a voz original?", "Não, é uma faixa separada que você mixa na edição."]],
  ]),
  de: products([
    ["traduction", "Live-Übersetzung", "Die Stimme der Sprecherin, übersetzt in jeden Kopfhörer.", "KI-Sprachübersetzung in Echtzeit", "Jede Person wählt ihre Sprache auf dem Smartphone und hört die Rede übersetzt, etwa eine Sekunde später. Ein QR-Code und Kopfhörer genügen.",
      [["55 Zuhörsprachen", "13 mit Direktdolmetschen, 42 Satz für Satz übersetzt."], ["13 Studiostimmen", "Stimme und Stil frei wählbar."], ["Spracherkennung", "Die Sprache der Rede wird automatisch erkannt."], ["Ohne App", "Alles läuft im Browser des Smartphones."]],
      ["Wie groß ist die Verzögerung?", "Ein bis zwei Sekunden bei den Direktsprachen, einige Sekunden mehr bei den anderen."]],
    ["sous-titres", "Live-Untertitel", "Übersetzte Untertitel auf jedem Smartphone.", "Live-Untertitel in jeder Sprache", "Die Untertitel folgen der Rede Satz für Satz. Größe und Kontrast stellt jede Person selbst ein.",
      [["Drei Schriftgrößen", "Dazu ein Hochkontrastmodus."], ["Ganze Sätze", "Für ruhigeres Lesen."], ["Namen der Sprechenden", "Bei jedem Wechsel."], ["Glossare", "Namen und Abkürzungen live korrigiert."]],
      ["Braucht man Ton zum Lesen?", "Nein, die Untertitel funktionieren auch ohne Kopfhörer."]],
    ["transcriptions", "Transkripte", "Der vollständige Text mit Zeitstempeln, in jeder Sprache.", "Transkripte in allen Sprachen", "Nach der Sitzung finden Sie alles Gesagte, in der Originalsprache und in jeder übersetzten Sprache.",
      [["TXT, SRT und VTT", "Für Dokumente und Videos."], ["Zeitstempel", "Mit einstellbarem Versatz."], ["Später übersetzen", "Sprache hinzufügen, Timing bleibt."], ["Ihre Wahl", "Ohne Aktivierung wird nichts gespeichert."]],
      ["Wo werden sie gespeichert?", "Nur auf Ihrem Server."]],
    ["resumes", "KI-Zusammenfassungen", "Die Kernpunkte der Sitzung mit einem Klick.", "KI-Zusammenfassungen Ihrer Sitzungen", "Eine klare Zusammenfassung mit Themen, Kernpunkten, Entscheidungen und Zitaten, in der gewünschten Sprache, für die Teilnehmenden veröffentlicht.",
      [["Ein Klick", "Während oder nach der Sitzung."], ["Jede Sprache", "Unabhängig vom Transkript."], ["Bereit zum Teilen", "Überschriften und Listen zum Kopieren."], ["Mit Glossar", "Namen bleiben korrekt."]],
      ["Sollte ich sie prüfen?", "Ja, prüfen Sie Namen und Zahlen vor dem Teilen."]],
    ["ecran-de-salle", "Saalanzeige", "Große Untertitel mit QR-Code.", "Große Untertitel für den ganzen Saal", "Zeigen Sie bis zu vier Sprachen auf einem Beamer oder Fernseher, mit Ihrem Logo und dem QR-Code zum Beitreten.",
      [["Bis zu 4 Sprachen", "Nebeneinander auf einem Bildschirm."], ["Hell oder dunkel", "Passend zum Raum."], ["Ihr Logo", "Und das Ihrer Partner."], ["Video-Overlay", "Für OBS und vMix."]],
      ["Gibt die Anzeige Ton wieder?", "Nein, sie zeigt nur Text."]],
    ["interpretes", "Menschliche Dolmetscher", "Ihre Dolmetscher und die KI in derselben Sitzung.", "Ihre Dolmetscher und die KI, gemeinsam", "Übergeben Sie einzelne Sprachen an Ihre Dolmetscher, die aus einer Kabine im Browser arbeiten. Die übrigen Sprachen übernimmt die KI.",
      [["Web-Kabine", "Ein Computer und ein Headset genügen."], ["Aus der Ferne", "Dolmetscher müssen nicht vor Ort sein."], ["Keine KI-Kosten", "Für menschlich gedolmetschte Sprachen."], ["Transparent", "Teilnehmende sehen, wer übersetzt."]],
      ["Mehrere Dolmetscher pro Sprache?", "Ja, jeweils einer ist auf Sendung."]],
    ["integrations", "Integrationen", "Zoom, Teams, Webex, OBS, RTMP und API.", "Verbunden mit Ihren Werkzeugen", "Übersetzen Sie ein Zoom-, Teams- oder Webex-Meeting oder jeden RTMP- und SRT-Stream. Die übersetzten Untertitel gehen zurück ins Meeting.",
      [["Zoom und Teams", "Benutzerdefiniertes Streaming, Untertitel zurück."], ["RTMP und SRT", "Aus OBS, vMix oder Ihrer Regie."], ["Auf dem Server", "Die Übersetzung läuft auch bei geschlossener Konsole."], ["API und Web-Einbettung", "Sitzungen, Transkripte, Zuhörseite auf Ihrer Website."]],
      ["Kommt ein Bot ins Meeting?", "Nein, das Meeting sendet seinen Stream, ohne Teilnehmer hinzuzufügen."]],
    ["doublage", "KI-Synchronisation", "Eine übersetzte Tonspur für Ihre Videos.", "KI-Synchronisation Ihrer Aufnahmen", "Aus dem Transkript mit Zeitstempeln erzeugt Syntova eine Tonspur in der gewählten Sprache, mit einer Studiostimme.",
      [["Timing bleibt", "Jeder Satz am richtigen Platz."], ["13 Stimmen", "Frei wählbar."], ["WAV-Datei", "Bereit für den Schnitt."], ["Mit Glossar", "Namen richtig ausgesprochen."]],
      ["Ersetzt sie die Originalstimme?", "Nein, es ist eine separate Spur, die Sie im Schnitt mischen."]],
  ]),
};

export const USECASES = {
  fr: usecases([
    ["reunions", "Réunions d'entreprise", "Des réunions où chacun parle sa langue", "Assemblées, comités et réunions d'équipe avec des collègues de plusieurs pays.", [["Teams et Zoom", "La réunion entre par diffusion, les sous-titres y reviennent."], ["Confidentialité", "Votre serveur, aucun enregistrement audio."], ["Suivi de l'usage", "Minutes par réunion et par présentateur."]]],
    ["conferences", "Conférences et salons", "Chaque séance, pour chaque participant", "Plénières, panels et ateliers, traduits depuis le micro de scène ou la régie.", [["Plusieurs salles", "Un code et un QR code par séance."], ["Intervenants successifs", "Leur nom dans les sous-titres."], ["Contenus réutilisables", "Transcriptions et résumés après chaque séance."]]],
    ["webinaires", "Webinaires", "Des webinaires suivis dans toutes les langues", "Démonstrations, lancements et présentations en ligne pour un public international.", [["55 langues", "À partir d'une seule présentation."], ["Rien à surveiller", "La traduction tourne sur le serveur."], ["Le replay", "Sous-titres et doublage de l'enregistrement."]]],
    ["formations", "Formation et éducation", "Des formations que tout le monde comprend", "Formations internes, cours et intégration des nouveaux employés.", [["Lecture facile", "Phrases complètes et grandes polices."], ["Révision", "Transcriptions disponibles après la séance."], ["Aucune installation", "Le navigateur suffit."]]],
    ["evenements-hybrides", "Événements hybrides", "La salle et l'écran, dans la même langue", "Le public sur place écoute au téléphone, celui à distance suit en ligne.", [["Deux publics", "Un seul flux traduit."], ["Affichage", "Écran de salle et sous-titres dans la réunion."], ["Fiabilité", "Reconnexion et arrêt automatiques."]]],
    ["accueil-du-public", "Séances publiques", "Des séances ouvertes à tous", "Séances d'information et consultations dans les langues de votre communauté.", [["Sans compte", "Un QR code suffit."], ["Accessible", "Sous-titres contrastés."], ["Archives", "Si vous le décidez."]]],
  ]),
  en: usecases([
    ["reunions", "Business meetings", "Meetings where everyone speaks their own language", "Town halls, committees and team meetings with colleagues from several countries.", [["Teams and Zoom", "The meeting streams in, captions go back."], ["Confidentiality", "Your server, no audio recordings."], ["Usage tracking", "Minutes per meeting and presenter."]]],
    ["conferences", "Conferences and trade shows", "Every session, for every attendee", "Keynotes, panels and breakouts, translated from the stage mic or AV desk.", [["Several rooms", "A code and a QR code per session."], ["Speakers in turn", "Their names in the captions."], ["Reusable content", "Transcripts and summaries after each session."]]],
    ["webinaires", "Webinars", "Webinars followed in every language", "Demos, launches and online presentations for an international audience.", [["55 languages", "From one presentation."], ["Nothing to watch", "Translation runs on the server."], ["The replay", "Subtitles and dubbing for the recording."]]],
    ["formations", "Training and education", "Training everyone understands", "Internal training, classes and employee onboarding.", [["Easy reading", "Complete sentences and large type."], ["Review", "Transcripts available after the session."], ["Nothing to install", "The browser is enough."]]],
    ["evenements-hybrides", "Hybrid events", "The room and the screen, in the same language", "People in the room listen on their phones; remote attendees follow online.", [["Two audiences", "One translated feed."], ["Display", "Room screen and captions in the meeting."], ["Reliability", "Automatic reconnect and stop."]]],
    ["accueil-du-public", "Public sessions", "Sessions open to everyone", "Information sessions and consultations in the languages of your community.", [["No account", "A QR code is enough."], ["Accessible", "High-contrast captions."], ["Records", "If you decide."]]],
  ]),
  es: usecases([
    ["reunions", "Reuniones de empresa", "Reuniones en las que cada uno habla su idioma", "Asambleas, comités y reuniones de equipo con colegas de varios países.", [["Teams y Zoom", "La reunión entra por transmisión y los subtítulos vuelven."], ["Confidencialidad", "Su servidor, sin grabaciones de audio."], ["Control del uso", "Minutos por reunión y por presentador."]]],
    ["conferences", "Congresos y ferias", "Cada sesión, para cada asistente", "Plenarias, paneles y talleres, traducidos desde el micrófono del escenario o el control.", [["Varias salas", "Un código y un QR por sesión."], ["Oradores sucesivos", "Su nombre en los subtítulos."], ["Contenido reutilizable", "Transcripciones y resúmenes tras cada sesión."]]],
    ["webinaires", "Webinarios", "Webinarios seguidos en todos los idiomas", "Demostraciones, lanzamientos y presentaciones en línea para un público internacional.", [["55 idiomas", "Desde una sola presentación."], ["Nada que vigilar", "La traducción funciona en el servidor."], ["La grabación", "Subtítulos y doblaje."]]],
    ["formations", "Formación y educación", "Formaciones que todos entienden", "Formación interna, clases e incorporación de nuevos empleados.", [["Lectura fácil", "Frases completas y letra grande."], ["Repaso", "Transcripciones disponibles después."], ["Sin instalar nada", "Basta el navegador."]]],
    ["evenements-hybrides", "Eventos híbridos", "La sala y la pantalla, en el mismo idioma", "El público en la sala escucha en el móvil; el remoto sigue en línea.", [["Dos públicos", "Un solo flujo traducido."], ["Visualización", "Pantalla de sala y subtítulos en la reunión."], ["Fiabilidad", "Reconexión y parada automáticas."]]],
    ["accueil-du-public", "Sesiones públicas", "Sesiones abiertas a todos", "Sesiones informativas y consultas en los idiomas de su comunidad.", [["Sin cuenta", "Basta un código QR."], ["Accesible", "Subtítulos de alto contraste."], ["Archivo", "Si usted lo decide."]]],
  ]),
  pt: usecases([
    ["reunions", "Reuniões corporativas", "Reuniões em que cada um fala o seu idioma", "Assembleias, comitês e reuniões de equipe com colegas de vários países.", [["Teams e Zoom", "A reunião entra por transmissão e as legendas voltam."], ["Confidencialidade", "Seu servidor, sem gravação de áudio."], ["Controle de uso", "Minutos por reunião e por apresentador."]]],
    ["conferences", "Conferências e feiras", "Cada sessão, para cada participante", "Plenárias, painéis e oficinas, traduzidos do microfone do palco ou da mesa técnica.", [["Várias salas", "Um código e um QR por sessão."], ["Oradores em sequência", "Nomes nas legendas."], ["Conteúdo reutilizável", "Transcrições e resumos após cada sessão."]]],
    ["webinaires", "Webinars", "Webinars acompanhados em todos os idiomas", "Demonstrações, lançamentos e apresentações online para um público internacional.", [["55 idiomas", "A partir de uma única apresentação."], ["Nada para vigiar", "A tradução roda no servidor."], ["A gravação", "Legendas e dublagem."]]],
    ["formations", "Treinamento e educação", "Treinamentos que todos entendem", "Treinamentos internos, aulas e integração de novos funcionários.", [["Leitura fácil", "Frases completas e letras grandes."], ["Revisão", "Transcrições disponíveis depois."], ["Nada a instalar", "O navegador basta."]]],
    ["evenements-hybrides", "Eventos híbridos", "A sala e a tela, no mesmo idioma", "Quem está na sala ouve pelo celular; quem está remoto acompanha online.", [["Dois públicos", "Um único fluxo traduzido."], ["Exibição", "Tela da sala e legendas na reunião."], ["Confiabilidade", "Reconexão e parada automáticas."]]],
    ["accueil-du-public", "Sessões públicas", "Sessões abertas a todos", "Sessões informativas e consultas nos idiomas da sua comunidade.", [["Sem conta", "Basta um QR code."], ["Acessível", "Legendas de alto contraste."], ["Arquivo", "Se você decidir."]]],
  ]),
  de: usecases([
    ["reunions", "Unternehmensmeetings", "Meetings, in denen jede Person ihre Sprache spricht", "Townhalls, Gremien und Teammeetings mit Kollegen aus mehreren Ländern.", [["Teams und Zoom", "Das Meeting wird gestreamt, Untertitel gehen zurück."], ["Vertraulichkeit", "Ihr Server, keine Audioaufzeichnung."], ["Nutzung im Blick", "Minuten pro Meeting und Person."]]],
    ["conferences", "Konferenzen und Messen", "Jede Session, für alle Teilnehmenden", "Keynotes, Panels und Workshops, übersetzt vom Bühnenmikrofon oder aus der Regie.", [["Mehrere Säle", "Ein Code und ein QR-Code pro Session."], ["Wechselnde Sprecher", "Namen in den Untertiteln."], ["Wiederverwendbar", "Transkripte und Zusammenfassungen nach jeder Session."]]],
    ["webinaires", "Webinare", "Webinare in allen Sprachen", "Demos, Produktstarts und Online-Präsentationen für ein internationales Publikum.", [["55 Sprachen", "Aus einer einzigen Präsentation."], ["Nichts zu überwachen", "Die Übersetzung läuft auf dem Server."], ["Die Aufzeichnung", "Untertitel und Synchronisation."]]],
    ["formations", "Schulung und Bildung", "Schulungen, die alle verstehen", "Interne Schulungen, Unterricht und Onboarding neuer Mitarbeitender.", [["Leicht lesbar", "Ganze Sätze und große Schrift."], ["Nacharbeit", "Transkripte nach der Sitzung."], ["Keine Installation", "Der Browser genügt."]]],
    ["evenements-hybrides", "Hybride Events", "Saal und Bildschirm in derselben Sprache", "Im Saal hört man über das Smartphone, aus der Ferne folgt man online.", [["Zwei Zielgruppen", "Ein übersetzter Kanal."], ["Anzeige", "Saalbildschirm und Untertitel im Meeting."], ["Zuverlässig", "Automatische Wiederverbindung und Abschaltung."]]],
    ["accueil-du-public", "Öffentliche Sitzungen", "Sitzungen, offen für alle", "Informationsveranstaltungen und Bürgerdialoge in den Sprachen Ihrer Gemeinschaft.", [["Ohne Konto", "Ein QR-Code genügt."], ["Barrierearm", "Untertitel mit hohem Kontrast."], ["Archiv", "Wenn Sie es wünschen."]]],
  ]),
};

const nav = (announce, announceLink, products, usecases, resources, login, contact, demo, tryIt, allProducts, allUsecases, features, how, faq, security, join) => ({ announce, announceLink, products, usecases, resources, login, contact, demo, tryIt, allProducts, allUsecases, features, how, faq, security, join });
export const NAV = {
  fr: nav("Nouveau : 55 langues d'écoute.", "Découvrir", "Produits", "Cas d'usage", "Ressources", "Connexion", "Contact", "Demander une démo", "Rejoindre une session", "Tous les produits", "Tous les cas d'usage", "Fonctionnalités", "Comment ça marche", "FAQ", "Sécurité", "Rejoindre avec un code"),
  en: nav("New: 55 listener languages.", "Learn more", "Products", "Use cases", "Resources", "Log in", "Contact", "Get a demo", "Join a session", "All products", "All use cases", "Features", "How it works", "FAQ", "Security", "Join with a code"),
  es: nav("Novedad: 55 idiomas de escucha.", "Descubrir", "Productos", "Casos de uso", "Recursos", "Iniciar sesión", "Contacto", "Solicitar demo", "Unirse a una sesión", "Todos los productos", "Todos los casos de uso", "Funciones", "Cómo funciona", "Preguntas frecuentes", "Seguridad", "Unirse con un código"),
  pt: nav("Novidade: 55 idiomas de escuta.", "Saiba mais", "Produtos", "Casos de uso", "Recursos", "Entrar", "Contato", "Pedir uma demo", "Entrar numa sessão", "Todos os produtos", "Todos os casos de uso", "Funcionalidades", "Como funciona", "Perguntas frequentes", "Segurança", "Entrar com um código"),
  de: nav("Neu: 55 Zuhörsprachen.", "Mehr erfahren", "Produkte", "Anwendungsfälle", "Ressourcen", "Anmelden", "Kontakt", "Demo anfragen", "Sitzung beitreten", "Alle Produkte", "Alle Anwendungsfälle", "Funktionen", "So funktioniert's", "FAQ", "Sicherheit", "Mit Code beitreten"),
};

export const HOME = {
  fr: {
    hero: { title: "Traduction, sous‑titres et transcriptions par IA", lead: "Syntova traduit vos réunions et vos événements en direct. Les participants scannent un QR code et écoutent dans leur langue, sans application.", cta: "Demander une démo", cta2: "Comment ça marche" },
    life: { title: "Avant, pendant et après l'événement", cols: [
      { tag: "Avant", image: "sessions", items: ["Planifiez les sessions et les langues.", "Préparez un glossaire.", "Ajoutez votre logo."] },
      { tag: "Pendant", image: "captions", items: ["Voix et sous-titres sur chaque téléphone.", "Affichage en salle, Zoom et Teams.", "Interprètes humains si besoin."] },
      { tag: "Après", image: "transcripts", items: ["Transcriptions dans toutes les langues.", "Résumé IA pour les participants.", "Piste de doublage pour vos vidéos."] },
    ] },
    bundle: { title: "Tout dans une seule solution", lead: "Huit produits pour vos événements multilingues." },
    benefits: { title: "Pensé pour tous vos événements", items: [["En salle ou en ligne", "Un micro, une console ou une réunion Zoom, Teams et Webex."], ["Immédiat", "Un QR code, ni compte ni application."], ["55 langues", "Pour un public vraiment international."], ["Coût maîtrisé", "Vous payez l'usage réel, avec des plafonds."]] },
    usecases: { title: "Pour tous les formats", lead: "D'une réunion d'équipe à une conférence de plusieurs salles." },
    features: { title: "Questions fréquentes", items: [
      ["Combien ça coûte ?", "Syntova tourne sur votre serveur avec votre compte OpenAI. Vous payez l'usage réel, sans frais par participant.", "Comment ça marche", "/comment-ca-marche"],
      ["Comment les participants rejoignent-ils ?", "Avec un QR code, un lien ou un code de session, sur n'importe quel téléphone.", "Rejoindre une session", "/join"],
      ["Quelles intégrations ?", "Zoom, Teams, Webex, OBS, vMix, RTMP, SRT et une API.", "Voir les intégrations", "/produits/integrations"],
      ["Mes données sont-elles protégées ?", "Le son n'est jamais enregistré et les transcriptions restent sur votre serveur.", "Voir la sécurité", "/securite"],
    ] },
    cta: { title: "Prêt à essayer Syntova ?", button: "Demander une démo" },
  },
  en: {
    hero: { title: "AI translation, captions and transcripts", lead: "Syntova translates your meetings and events live. Attendees scan a QR code and listen in their own language, with no app to install.", cta: "Get a demo", cta2: "How it works" },
    life: { title: "Before, during and after the event", cols: [
      { tag: "Before", image: "sessions", items: ["Schedule sessions and languages.", "Prepare a glossary.", "Add your logo."] },
      { tag: "During", image: "captions", items: ["Voice and captions on every phone.", "Room display, Zoom and Teams.", "Human interpreters if needed."] },
      { tag: "After", image: "transcripts", items: ["Transcripts in every language.", "AI summary for attendees.", "Dubbing track for your videos."] },
    ] },
    bundle: { title: "Everything in one solution", lead: "Eight products for your multilingual events." },
    benefits: { title: "Built for every event", items: [["In the room or online", "A mic, a mixing desk, or a Zoom, Teams or Webex meeting."], ["Instant", "A QR code, no account, no app."], ["55 languages", "For a truly international audience."], ["Predictable cost", "Pay for actual usage, with caps."]] },
    usecases: { title: "For every format", lead: "From a team meeting to a multi-room conference." },
    features: { title: "Frequently asked questions", items: [
      ["How much does it cost?", "Syntova runs on your server with your OpenAI account. You pay actual usage, with no per-attendee fee.", "How it works", "/comment-ca-marche"],
      ["How do attendees join?", "With a QR code, a link or a session code, on any phone.", "Join a session", "/join"],
      ["Which integrations?", "Zoom, Teams, Webex, OBS, vMix, RTMP, SRT and an API.", "See integrations", "/produits/integrations"],
      ["Is my data protected?", "Audio is never recorded and transcripts stay on your server.", "See security", "/securite"],
    ] },
    cta: { title: "Ready to try Syntova?", button: "Get a demo" },
  },
  es: {
    hero: { title: "Traducción, subtítulos y transcripciones con IA", lead: "Syntova traduce sus reuniones y eventos en directo. Los asistentes escanean un código QR y escuchan en su idioma, sin instalar nada.", cta: "Solicitar demo", cta2: "Cómo funciona" },
    life: { title: "Antes, durante y después del evento", cols: [
      { tag: "Antes", image: "sessions", items: ["Planifique sesiones e idiomas.", "Prepare un glosario.", "Añada su logotipo."] },
      { tag: "Durante", image: "captions", items: ["Voz y subtítulos en cada móvil.", "Pantalla de sala, Zoom y Teams.", "Intérpretes humanos si hace falta."] },
      { tag: "Después", image: "transcripts", items: ["Transcripciones en todos los idiomas.", "Resumen con IA para los asistentes.", "Pista de doblaje para sus vídeos."] },
    ] },
    bundle: { title: "Todo en una sola solución", lead: "Ocho productos para sus eventos multilingües." },
    benefits: { title: "Pensado para todos sus eventos", items: [["En sala o en línea", "Un micrófono, una mesa de mezclas o una reunión de Zoom, Teams o Webex."], ["Inmediato", "Un código QR, sin cuenta ni aplicación."], ["55 idiomas", "Para un público realmente internacional."], ["Coste controlado", "Paga el uso real, con límites."]] },
    usecases: { title: "Para todos los formatos", lead: "De una reunión de equipo a un congreso con varias salas." },
    features: { title: "Preguntas frecuentes", items: [
      ["¿Cuánto cuesta?", "Syntova funciona en su servidor con su cuenta de OpenAI. Paga el uso real, sin coste por asistente.", "Cómo funciona", "/comment-ca-marche"],
      ["¿Cómo se unen los asistentes?", "Con un código QR, un enlace o un código de sesión, desde cualquier móvil.", "Unirse a una sesión", "/join"],
      ["¿Qué integraciones hay?", "Zoom, Teams, Webex, OBS, vMix, RTMP, SRT y una API.", "Ver integraciones", "/produits/integrations"],
      ["¿Mis datos están protegidos?", "El audio nunca se graba y las transcripciones se quedan en su servidor.", "Ver seguridad", "/securite"],
    ] },
    cta: { title: "¿Listo para probar Syntova?", button: "Solicitar demo" },
  },
  pt: {
    hero: { title: "Tradução, legendas e transcrições com IA", lead: "O Syntova traduz suas reuniões e eventos ao vivo. Os participantes escaneiam um QR code e ouvem no próprio idioma, sem aplicativo.", cta: "Pedir uma demo", cta2: "Como funciona" },
    life: { title: "Antes, durante e depois do evento", cols: [
      { tag: "Antes", image: "sessions", items: ["Planeje sessões e idiomas.", "Prepare um glossário.", "Adicione seu logotipo."] },
      { tag: "Durante", image: "captions", items: ["Voz e legendas em cada celular.", "Tela da sala, Zoom e Teams.", "Intérpretes humanos se precisar."] },
      { tag: "Depois", image: "transcripts", items: ["Transcrições em todos os idiomas.", "Resumo com IA para os participantes.", "Faixa de dublagem para seus vídeos."] },
    ] },
    bundle: { title: "Tudo numa única solução", lead: "Oito produtos para seus eventos multilíngues." },
    benefits: { title: "Feito para todos os seus eventos", items: [["Presencial ou online", "Um microfone, uma mesa de som ou uma reunião do Zoom, Teams ou Webex."], ["Imediato", "Um QR code, sem conta e sem aplicativo."], ["55 idiomas", "Para um público realmente internacional."], ["Custo sob controle", "Você paga o uso real, com limites."]] },
    usecases: { title: "Para todos os formatos", lead: "De uma reunião de equipe a uma conferência com várias salas." },
    features: { title: "Perguntas frequentes", items: [
      ["Quanto custa?", "O Syntova roda no seu servidor com a sua conta OpenAI. Você paga o uso real, sem taxa por participante.", "Como funciona", "/comment-ca-marche"],
      ["Como os participantes entram?", "Com um QR code, um link ou um código de sessão, em qualquer celular.", "Entrar numa sessão", "/join"],
      ["Quais integrações?", "Zoom, Teams, Webex, OBS, vMix, RTMP, SRT e uma API.", "Ver integrações", "/produits/integrations"],
      ["Meus dados estão protegidos?", "O áudio nunca é gravado e as transcrições ficam no seu servidor.", "Ver segurança", "/securite"],
    ] },
    cta: { title: "Pronto para experimentar o Syntova?", button: "Pedir uma demo" },
  },
  de: {
    hero: { title: "KI-Übersetzung, Untertitel und Transkripte", lead: "Syntova übersetzt Ihre Meetings und Events in Echtzeit. Teilnehmende scannen einen QR-Code und hören in ihrer Sprache, ganz ohne App.", cta: "Demo anfragen", cta2: "So funktioniert's" },
    life: { title: "Vor, während und nach dem Event", cols: [
      { tag: "Vorher", image: "sessions", items: ["Sitzungen und Sprachen planen.", "Ein Glossar vorbereiten.", "Ihr Logo hinzufügen."] },
      { tag: "Währenddessen", image: "captions", items: ["Stimme und Untertitel auf jedem Smartphone.", "Saalanzeige, Zoom und Teams.", "Menschliche Dolmetscher bei Bedarf."] },
      { tag: "Danach", image: "transcripts", items: ["Transkripte in allen Sprachen.", "KI-Zusammenfassung für Teilnehmende.", "Tonspur für Ihre Videos."] },
    ] },
    bundle: { title: "Alles in einer Lösung", lead: "Acht Produkte für Ihre mehrsprachigen Events." },
    benefits: { title: "Für jedes Event gemacht", items: [["Vor Ort oder online", "Ein Mikrofon, ein Mischpult oder ein Zoom-, Teams- oder Webex-Meeting."], ["Sofort startklar", "Ein QR-Code, kein Konto, keine App."], ["55 Sprachen", "Für ein wirklich internationales Publikum."], ["Planbare Kosten", "Sie zahlen die tatsächliche Nutzung, mit Limits."]] },
    usecases: { title: "Für jedes Format", lead: "Vom Teammeeting bis zur Konferenz mit mehreren Sälen." },
    features: { title: "Häufige Fragen", items: [
      ["Was kostet es?", "Syntova läuft auf Ihrem Server mit Ihrem OpenAI-Konto. Sie zahlen die tatsächliche Nutzung, ohne Gebühr pro Teilnehmer.", "So funktioniert's", "/comment-ca-marche"],
      ["Wie treten Teilnehmende bei?", "Per QR-Code, Link oder Sitzungscode, mit jedem Smartphone.", "Sitzung beitreten", "/join"],
      ["Welche Integrationen?", "Zoom, Teams, Webex, OBS, vMix, RTMP, SRT und eine API.", "Integrationen ansehen", "/produits/integrations"],
      ["Sind meine Daten geschützt?", "Audio wird nie aufgezeichnet, Transkripte bleiben auf Ihrem Server.", "Sicherheit ansehen", "/securite"],
    ] },
    cta: { title: "Bereit, Syntova auszuprobieren?", button: "Demo anfragen" },
  },
};

// [icon, title, items]
export const FEATURES = {
  fr: { title: "Fonctionnalités", lead: "Ce que fait Syntova, en un coup d'œil.", groups: [
    ["Mic", "Audio et langues", ["Micro, console ou flux RTMP/SRT", "55 langues d'écoute", "13 voix studio", "Détection de la langue source"]],
    ["Captions", "Sous-titres", ["Sous-titres en direct", "Tailles et contraste réglables", "Affichage en salle multilingue", "Sous-titres vers Zoom et Teams"]],
    ["Smartphone", "Participants", ["QR code, lien ou code", "Sans compte ni application", "Changement de langue en direct", "Applications Android et iOS"]],
    ["CalendarClock", "Sessions", ["Planification et import CSV", "Glossaires", "Logo et partenaires", "Interprètes humains"]],
    ["FileText", "Après l'événement", ["Transcriptions TXT, SRT, VTT", "Résumés IA", "Piste de doublage", "Archivage au choix"]],
    ["ShieldCheck", "Équipe et sécurité", ["Rôles et permissions", "Double authentification", "Authentification unique", "Minutes et plafonds"]],
  ] },
  en: { title: "Features", lead: "What Syntova does, at a glance.", groups: [
    ["Mic", "Audio and languages", ["Mic, mixing desk or RTMP/SRT stream", "55 listener languages", "13 studio voices", "Source language detection"]],
    ["Captions", "Captions", ["Live captions", "Adjustable size and contrast", "Multilingual room display", "Captions to Zoom and Teams"]],
    ["Smartphone", "Attendees", ["QR code, link or code", "No account, no app", "Switch language live", "Android and iOS apps"]],
    ["CalendarClock", "Sessions", ["Scheduling and CSV import", "Glossaries", "Logo and partners", "Human interpreters"]],
    ["FileText", "After the event", ["TXT, SRT and VTT transcripts", "AI summaries", "Dubbing track", "Archiving by choice"]],
    ["ShieldCheck", "Team and security", ["Roles and permissions", "Two-factor sign-in", "Single sign-on", "Minutes and caps"]],
  ] },
  es: { title: "Funciones", lead: "Lo que hace Syntova, de un vistazo.", groups: [
    ["Mic", "Audio e idiomas", ["Micrófono, mesa o flujo RTMP/SRT", "55 idiomas de escucha", "13 voces de estudio", "Detección del idioma de origen"]],
    ["Captions", "Subtítulos", ["Subtítulos en directo", "Tamaño y contraste ajustables", "Pantalla de sala multilingüe", "Subtítulos a Zoom y Teams"]],
    ["Smartphone", "Asistentes", ["Código QR, enlace o código", "Sin cuenta ni aplicación", "Cambio de idioma en directo", "Apps para Android e iOS"]],
    ["CalendarClock", "Sesiones", ["Planificación e importación CSV", "Glosarios", "Logotipo y patrocinadores", "Intérpretes humanos"]],
    ["FileText", "Después del evento", ["Transcripciones TXT, SRT y VTT", "Resúmenes con IA", "Pista de doblaje", "Archivo opcional"]],
    ["ShieldCheck", "Equipo y seguridad", ["Roles y permisos", "Verificación en dos pasos", "Inicio de sesión único", "Minutos y límites"]],
  ] },
  pt: { title: "Funcionalidades", lead: "O que o Syntova faz, num relance.", groups: [
    ["Mic", "Áudio e idiomas", ["Microfone, mesa ou transmissão RTMP/SRT", "55 idiomas de escuta", "13 vozes de estúdio", "Detecção do idioma de origem"]],
    ["Captions", "Legendas", ["Legendas ao vivo", "Tamanho e contraste ajustáveis", "Tela da sala multilíngue", "Legendas para Zoom e Teams"]],
    ["Smartphone", "Participantes", ["QR code, link ou código", "Sem conta e sem aplicativo", "Troca de idioma ao vivo", "Apps para Android e iOS"]],
    ["CalendarClock", "Sessões", ["Agendamento e importação CSV", "Glossários", "Logotipo e parceiros", "Intérpretes humanos"]],
    ["FileText", "Depois do evento", ["Transcrições TXT, SRT e VTT", "Resumos com IA", "Faixa de dublagem", "Arquivo opcional"]],
    ["ShieldCheck", "Equipe e segurança", ["Funções e permissões", "Verificação em duas etapas", "Login único", "Minutos e limites"]],
  ] },
  de: { title: "Funktionen", lead: "Was Syntova kann, auf einen Blick.", groups: [
    ["Mic", "Audio und Sprachen", ["Mikrofon, Mischpult oder RTMP/SRT-Stream", "55 Zuhörsprachen", "13 Studiostimmen", "Erkennung der Ausgangssprache"]],
    ["Captions", "Untertitel", ["Live-Untertitel", "Größe und Kontrast einstellbar", "Mehrsprachige Saalanzeige", "Untertitel für Zoom und Teams"]],
    ["Smartphone", "Teilnehmende", ["QR-Code, Link oder Code", "Ohne Konto und ohne App", "Sprache live wechseln", "Apps für Android und iOS"]],
    ["CalendarClock", "Sitzungen", ["Planung und CSV-Import", "Glossare", "Logo und Partner", "Menschliche Dolmetscher"]],
    ["FileText", "Nach dem Event", ["Transkripte als TXT, SRT, VTT", "KI-Zusammenfassungen", "Synchron-Tonspur", "Archivierung nach Wahl"]],
    ["ShieldCheck", "Team und Sicherheit", ["Rollen und Rechte", "Zwei-Faktor-Anmeldung", "Single Sign-on", "Minuten und Limits"]],
  ] },
};

export const HOW = {
  fr: { title: "Comment fonctionne Syntova", lead: "Un intervenant parle, Syntova traduit, chaque participant écoute dans sa langue.", steps: [["Mic", "Le son arrive", "Micro, console ou flux de Zoom, Teams, Webex ou OBS."], ["Languages", "L'IA traduit", "Une interprétation par langue, en voix et en texte."], ["Radio", "Votre serveur diffuse", "Vers les téléphones, l'écran de salle et les réunions."], ["Smartphone", "Les participants écoutent", "QR code, langue, écouteurs."]], cost: { title: "Ce que vous payez", text: "Syntova tourne sur votre serveur avec votre clé OpenAI. Le coût dépend des minutes diffusées et du nombre de langues. Le portail affiche l'usage et bloque tout dépassement de votre plafond mensuel." } },
  en: { title: "How Syntova works", lead: "A speaker talks, Syntova translates, every attendee listens in their language.", steps: [["Mic", "Audio comes in", "Mic, mixing desk or a stream from Zoom, Teams, Webex or OBS."], ["Languages", "AI translates", "One interpretation per language, as voice and text."], ["Radio", "Your server delivers", "To phones, the room display and meetings."], ["Smartphone", "Attendees listen", "QR code, language, headphones."]], cost: { title: "What you pay", text: "Syntova runs on your server with your OpenAI key. Cost depends on minutes broadcast and the number of languages. The portal shows usage and blocks anything beyond your monthly cap." } },
  es: { title: "Cómo funciona Syntova", lead: "Un orador habla, Syntova traduce y cada asistente escucha en su idioma.", steps: [["Mic", "Llega el audio", "Micrófono, mesa o flujo de Zoom, Teams, Webex u OBS."], ["Languages", "La IA traduce", "Una interpretación por idioma, en voz y texto."], ["Radio", "Su servidor difunde", "A los móviles, la pantalla de sala y las reuniones."], ["Smartphone", "Los asistentes escuchan", "Código QR, idioma y auriculares."]], cost: { title: "Lo que paga", text: "Syntova funciona en su servidor con su clave de OpenAI. El coste depende de los minutos emitidos y del número de idiomas. El portal muestra el uso y bloquea todo lo que supere su límite mensual." } },
  pt: { title: "Como o Syntova funciona", lead: "Um orador fala, o Syntova traduz e cada participante ouve no seu idioma.", steps: [["Mic", "O áudio chega", "Microfone, mesa ou transmissão do Zoom, Teams, Webex ou OBS."], ["Languages", "A IA traduz", "Uma interpretação por idioma, em voz e texto."], ["Radio", "Seu servidor transmite", "Para os celulares, a tela da sala e as reuniões."], ["Smartphone", "Os participantes ouvem", "QR code, idioma e fones."]], cost: { title: "O que você paga", text: "O Syntova roda no seu servidor com a sua chave OpenAI. O custo depende dos minutos transmitidos e do número de idiomas. O portal mostra o uso e bloqueia o que passar do seu limite mensal." } },
  de: { title: "So funktioniert Syntova", lead: "Jemand spricht, Syntova übersetzt, alle hören in ihrer Sprache.", steps: [["Mic", "Der Ton kommt an", "Mikrofon, Mischpult oder ein Stream aus Zoom, Teams, Webex oder OBS."], ["Languages", "Die KI übersetzt", "Eine Verdolmetschung pro Sprache, als Stimme und Text."], ["Radio", "Ihr Server verteilt", "An Smartphones, Saalanzeige und Meetings."], ["Smartphone", "Alle hören zu", "QR-Code, Sprache, Kopfhörer."]], cost: { title: "Was Sie zahlen", text: "Syntova läuft auf Ihrem Server mit Ihrem OpenAI-Schlüssel. Die Kosten hängen von den gesendeten Minuten und der Zahl der Sprachen ab. Das Portal zeigt die Nutzung und blockiert alles über Ihrem Monatslimit." } },
};

export const SECURITY_PAGE = {
  fr: { title: "Sécurité et confidentialité", lead: "Syntova est un logiciel que vous exploitez vous-même. Voici ce qu'il advient de vos données.", blocks: [["Votre serveur", "Tout tourne dans des conteneurs que vous contrôlez."], ["Le son", "Envoyé au fournisseur d'IA pour la traduction, jamais enregistré."], ["Les textes", "Archivage désactivé par défaut, supprimé avec l'événement."], ["Les comptes", "Rôles, mots de passe hachés, double authentification."], ["Les participants", "Ni compte ni application, PIN optionnel."], ["Certifications", "Syntova ne détient pas seul de certification comme SOC 2 : elle dépend de votre hébergement."]] },
  en: { title: "Security and privacy", lead: "Syntova is software you run yourself. Here is what happens to your data.", blocks: [["Your server", "Everything runs in containers you control."], ["Audio", "Sent to the AI provider for translation, never recorded."], ["Text", "Archiving off by default, deleted with the event."], ["Accounts", "Roles, hashed passwords, two-factor sign-in."], ["Attendees", "No account, no app, optional PIN."], ["Certifications", "Syntova does not hold a certification such as SOC 2 on its own; that depends on your hosting."]] },
  es: { title: "Seguridad y privacidad", lead: "Syntova es un software que usted mismo opera. Esto es lo que ocurre con sus datos.", blocks: [["Su servidor", "Todo funciona en contenedores que usted controla."], ["El audio", "Se envía al proveedor de IA para traducir y nunca se graba."], ["Los textos", "Archivo desactivado por defecto y borrado con el evento."], ["Las cuentas", "Roles, contraseñas cifradas y verificación en dos pasos."], ["Los asistentes", "Sin cuenta ni aplicación, PIN opcional."], ["Certificaciones", "Syntova no tiene por sí solo certificaciones como SOC 2: dependen de su alojamiento."]] },
  pt: { title: "Segurança e privacidade", lead: "O Syntova é um software que você mesmo opera. Veja o que acontece com os seus dados.", blocks: [["Seu servidor", "Tudo roda em contêineres que você controla."], ["O áudio", "Enviado ao provedor de IA para tradução, nunca gravado."], ["Os textos", "Arquivo desativado por padrão e apagado com o evento."], ["As contas", "Funções, senhas com hash e verificação em duas etapas."], ["Os participantes", "Sem conta e sem aplicativo, PIN opcional."], ["Certificações", "O Syntova não tem sozinho certificações como SOC 2: elas dependem da sua hospedagem."]] },
  de: { title: "Sicherheit und Datenschutz", lead: "Syntova ist Software, die Sie selbst betreiben. So wird mit Ihren Daten umgegangen.", blocks: [["Ihr Server", "Alles läuft in Containern unter Ihrer Kontrolle."], ["Audio", "Zur Übersetzung an den KI-Anbieter gesendet, nie aufgezeichnet."], ["Texte", "Archivierung standardmäßig aus, mit dem Event gelöscht."], ["Konten", "Rollen, gehashte Passwörter, Zwei-Faktor-Anmeldung."], ["Teilnehmende", "Kein Konto, keine App, optionale PIN."], ["Zertifizierungen", "Syntova besitzt allein keine Zertifizierung wie SOC 2; das hängt von Ihrem Hosting ab."]] },
};

const demo = (title, lead, name, email, org, type, size, languages, message, send, sent, privacy, tooMany, failed, types, sizes, includes, items) => ({ title, lead, name, email, org, type, size, languages, message, send, sent, privacy, tooMany, failed, types, sizes, includes, items });
export const DEMO = {
  fr: demo("Demander une démo", "Parlez-nous de votre événement. Nous vous répondons par courriel.", "Votre nom", "Courriel professionnel", "Organisation", "Type d'événement", "Participants", "Langues souhaitées", "Message", "Envoyer", "Merci ! Nous vous répondons très vite.", "Ces informations servent uniquement à répondre à votre demande.", "Trop de demandes. Réessayez dans une minute.", "L'envoi a échoué. Réessayez.", ["Réunions", "Conférence", "Webinaire", "Formation", "Événement hybride", "Autre"], ["Moins de 50", "50 à 200", "200 à 1 000", "Plus de 1 000"], "Pendant la démo", ["Une session avec vos langues", "Votre source audio", "Transcriptions et résumés"]),
  en: demo("Get a demo", "Tell us about your event. We will reply by email.", "Your name", "Work email", "Organization", "Type of event", "Attendees", "Languages you need", "Message", "Send", "Thank you! We will get back to you shortly.", "We only use these details to answer your request.", "Too many requests. Try again in a minute.", "Sending failed. Please try again.", ["Meetings", "Conference", "Webinar", "Training", "Hybrid event", "Other"], ["Under 50", "50 to 200", "200 to 1,000", "Over 1,000"], "During the demo", ["A session with your languages", "Your audio source", "Transcripts and summaries"]),
  es: demo("Solicitar demo", "Cuéntenos sobre su evento. Le responderemos por correo.", "Su nombre", "Correo profesional", "Organización", "Tipo de evento", "Asistentes", "Idiomas necesarios", "Mensaje", "Enviar", "¡Gracias! Le responderemos pronto.", "Solo usamos estos datos para responder a su solicitud.", "Demasiadas solicitudes. Inténtelo en un minuto.", "No se pudo enviar. Inténtelo de nuevo.", ["Reuniones", "Congreso", "Webinario", "Formación", "Evento híbrido", "Otro"], ["Menos de 50", "50 a 200", "200 a 1.000", "Más de 1.000"], "Durante la demo", ["Una sesión con sus idiomas", "Su fuente de audio", "Transcripciones y resúmenes"]),
  pt: demo("Pedir uma demo", "Conte-nos sobre o seu evento. Responderemos por e-mail.", "Seu nome", "E-mail profissional", "Organização", "Tipo de evento", "Participantes", "Idiomas desejados", "Mensagem", "Enviar", "Obrigado! Responderemos em breve.", "Usamos estes dados apenas para responder ao seu pedido.", "Muitos pedidos. Tente novamente em um minuto.", "O envio falhou. Tente novamente.", ["Reuniões", "Conferência", "Webinar", "Treinamento", "Evento híbrido", "Outro"], ["Menos de 50", "50 a 200", "200 a 1.000", "Mais de 1.000"], "Durante a demo", ["Uma sessão com os seus idiomas", "A sua fonte de áudio", "Transcrições e resumos"]),
  de: demo("Demo anfragen", "Erzählen Sie uns von Ihrem Event. Wir antworten per E-Mail.", "Ihr Name", "Geschäftliche E-Mail", "Organisation", "Art des Events", "Teilnehmende", "Gewünschte Sprachen", "Nachricht", "Senden", "Danke! Wir melden uns in Kürze.", "Wir nutzen diese Angaben nur, um Ihre Anfrage zu beantworten.", "Zu viele Anfragen. Bitte in einer Minute erneut versuchen.", "Senden fehlgeschlagen. Bitte erneut versuchen.", ["Meetings", "Konferenz", "Webinar", "Schulung", "Hybrides Event", "Sonstiges"], ["Unter 50", "50 bis 200", "200 bis 1.000", "Über 1.000"], "In der Demo", ["Eine Sitzung mit Ihren Sprachen", "Ihre Audioquelle", "Transkripte und Zusammenfassungen"]),
};

const common = (learnMore, features, faq, related, needs, included, footerTag, rights, company, made, allFeatures, language) => ({ learnMore, features, faq, related, needs, included, footerTag, rights, company, made, allFeatures, language });
export const COMMON = {
  fr: common("En savoir plus", "Fonctionnalités", "Questions fréquentes", "Produits associés", "Ce dont vous avez besoin", "Produits recommandés", "Traduction, sous-titres et transcriptions en direct pour vos réunions et événements.", "Tous droits réservés.", "Entreprise", "Conçu au Nouveau-Brunswick, Canada", "Voir toutes les fonctionnalités", "Langue"),
  en: common("Learn more", "Features", "Frequently asked questions", "Related products", "What you need", "Recommended products", "Live translation, captions and transcripts for meetings and events.", "All rights reserved.", "Company", "Made in New Brunswick, Canada", "See all features", "Language"),
  es: common("Más información", "Funciones", "Preguntas frecuentes", "Productos relacionados", "Lo que necesita", "Productos recomendados", "Traducción, subtítulos y transcripciones en directo para reuniones y eventos.", "Todos los derechos reservados.", "Empresa", "Hecho en Nuevo Brunswick, Canadá", "Ver todas las funciones", "Idioma"),
  pt: common("Saiba mais", "Funcionalidades", "Perguntas frequentes", "Produtos relacionados", "Do que você precisa", "Produtos recomendados", "Tradução, legendas e transcrições ao vivo para reuniões e eventos.", "Todos os direitos reservados.", "Empresa", "Feito em New Brunswick, Canadá", "Ver todas as funcionalidades", "Idioma"),
  de: common("Mehr erfahren", "Funktionen", "Häufige Fragen", "Ähnliche Produkte", "Was Sie brauchen", "Empfohlene Produkte", "Live-Übersetzung, Untertitel und Transkripte für Meetings und Events.", "Alle Rechte vorbehalten.", "Unternehmen", "Entwickelt in New Brunswick, Kanada", "Alle Funktionen ansehen", "Sprache"),
};
