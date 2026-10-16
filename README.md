# Syntova (formerly TranslateBox)

Console d’interprétation vocale en temps réel et diffusion aux auditeurs par lien/QR code.
React + Vite, FastAPI, WebRTC vers OpenAI, WebSocket pour la diffusion.

## Démarrage local

Prérequis : Python 3.12 et Node.js 22.12+.

```sh
python3.12 -m venv .venv
.venv/bin/pip install -r backend/requirements.lock -r backend/requirements-dev.txt
cp backend/.env.example backend/.env
python3 -c 'import secrets; print(secrets.token_urlsafe(32))'
```

Renseigner `OPENAI_API_KEY` et `OPERATOR_TOKEN` dans `backend/.env`. Le code opérateur généré est indépendant de la clé OpenAI. Ne jamais placer la clé OpenAI dans le frontend.

```sh
.venv/bin/uvicorn server:app --app-dir backend --host 127.0.0.1 --port 8001 --reload
```

Dans un autre terminal :

```sh
cd frontend
npm ci
npm start
```

Ouvrir <http://localhost:5173>, saisir le code opérateur, tester l’entrée audio puis démarrer la traduction. Vite transmet `/api` et les WebSockets au port 8001. Aucune variable frontend n’est nécessaire pour ce mode ou le déploiement standard.

## Déploiement HTTPS

Voir [DEPLOYMENT.md](DEPLOYMENT.md). Le dépôt contient une stack Docker Compose complète avec interface compilée, reverse proxy Caddy, HTTPS automatique et backend privé. MongoDB n’est pas nécessaire.

```sh
cp .env.example .env
# Renseigner domaine, origine HTTPS, clé OpenAI et code opérateur dans .env.
docker compose up -d --build
```

**Un seul worker et une seule réplique backend.** Les événements sont sauvegardés dans SQLite, sur le volume Docker `event_data`. Après redémarrage ou rechargement, utiliser **Saved events → Resume**, puis **START EVENT**, pour conserver le lien, le QR code et le PIN. La reprise renouvelle le jeton de publication et est refusée si un opérateur diffuse déjà. Les salles inactives expirent après 24 heures ; maximum 100 événements et 30 auditeurs par événement par défaut. Cette version vise une installation gérée par un opérateur de confiance, pas un service SaaS multi-utilisateurs.

## Utilisation

- Sélectionner la langue cible, le microphone et la sortie casque. L’audio source est automatiquement reconnu par le modèle.
- `Test` vérifie le niveau sans envoyer d’audio à OpenAI ; `START` lance une session payante selon votre compte OpenAI.
- Pour diffuser : créer un événement, partager son QR code et appuyer sur `START EVENT`. Le PIN auditeur est facultatif.
- Les auditeurs ouvrent `/e/<identifiant>` sans code opérateur, puis appuient sur `LISTEN`.
- Les sous-titres sont facultatifs. Désactiver leur diffusion efface le texte affiché chez les auditeurs connectés.
- Export TXT/PDF disponible dans les paramètres. « Save transcripts » conserve le texte dans la session de la page après arrêt ; ce n’est pas une sauvegarde durable.

## Voix

- **Voix de traduction** (par défaut) : la voix de `gpt-realtime-translate`, qui suit le ton de l’orateur. Délai minimal. Ce modèle ne permet pas de choisir une voix.
- **Voix studio** : le texte traduit est relu phrase par phrase par `gpt-4o-mini-tts` (`OPENAI_TTS_MODEL`) avec la voix choisie (Marin, Cedar, Coral, Sage…) et un style de diction. Compter environ 1 à 2 s de délai en plus et un coût de synthèse vocale par caractère. Le changement de voix est possible en direct.
- **Corrections** : une ligne `erreur => correction` corrige les sous-titres et la voix studio. Elle ne modifie pas la voix de traduction directe.
- La page auditeur indique toujours que la voix est générée par IA, comme l’exigent les règles d’usage d’OpenAI.

## Plusieurs langues, écran de salle, transcriptions

- **Plusieurs langues par événement** : à la création, choisir jusqu’à 4 langues en plus de la langue principale. Chaque auditeur choisit la sienne sur la page d’écoute et peut en changer en direct. Chaque langue est une session de traduction distincte à partir du même micro : la consommation OpenAI est multipliée par le nombre de langues. La limite de 30 auditeurs s’applique à l’événement entier.
- **Écran de salle** : `/e/<identifiant>/screen` affiche les sous-titres en très grand avec le QR code, pour un projecteur ou une télé. Il ne reçoit pas d’audio. Les sous-titres doivent être activés pour les auditeurs.
- **Transcriptions** : par langue, en TXT, SRT ou VTT (sous-titres vidéo), avec les corrections du glossaire appliquées. Elles restent dans l’onglet ; « Save transcripts » les conserve après l’arrêt.
- **Résumé IA** : `/api/summary` envoie la transcription au modèle `OPENAI_SUMMARY_MODEL` (Responses API, `store: false`) et renvoie un résumé en Markdown. Rien n’est conservé sur le serveur.
- **Glossaire** : `erreur => correction` remplace ; `mot =>` (rien à droite) masque le mot.

## Intégrations, interprètes humains et administration

- **Appuyer pour parler** : case « Appuyer pour parler » dans la console. Le micro reste coupé ; maintenir le gros bouton ou la barre d’espace pour parler. S’applique à toutes les langues et à la cabine.
- **Zoom et Teams (sous-titres)** : carte « Intégrations ». Coller le jeton API de sous-titrage Zoom ou le lien CART de Teams, choisir la langue. Chaque phrase terminée part comme une ligne de sous-titre via `/api/caption-relay` (seuls `*.zoom.us` et `api.captions.office.microsoft.com` sont acceptés). Les liens restent dans l’onglet.
- **Incrustation vidéo (OBS, vMix)** : `/e/<id>/screen?overlay=1&lang=fr`, fond transparent, à ajouter comme source navigateur. `?theme=light` pour un écran de salle clair.
- **Intégration web / Cvent** : `/e/<id>?embed=1` dans une iframe. Les sites autorisés vont dans `EMBED_ORIGINS` (Caddy envoie `frame-ancestors` pour `/e/*` seulement ; le reste refuse toujours l’intégration).
- **Interprètes humains** : à la création, marquer une langue ajoutée « Interprète humain ». L’événement reçoit un code de cabine. L’interprète ouvre `/e/<id>/booth`, entend la salle (canal `src`, jamais envoyé au public) et passe à l’antenne ; sa voix est diffusée aux auditeurs de cette langue avec la mention « Interprète humain ». Un seul interprète à l’antenne par langue. Pas de session OpenAI pour ces langues.
- **Consommation et plafonds** : le temps de diffusion IA est compté par événement et par langue (`/api/usage`, affiché dans la console). `USAGE_CAP_MINUTES` bloque l’ouverture de nouvelles sessions au-delà du plafond mensuel. Arrêt automatique réglable dans les Paramètres. Ce compteur estime l’usage à partir du temps de diffusion ; une traduction lancée sans diffusion n’est pas comptée.
- **Glossaires partagés** : enregistrés côté serveur (`/api/library`), visibles par tous les opérateurs.
- **Image de marque** : logo (PNG, JPEG ou WebP, redimensionné dans le navigateur) et ligne de commanditaire, affichés sur la page d’écoute et l’écran de salle.
- **Résumés publiés** : choisir la langue du résumé, puis « Publier pour les auditeurs » ; le résumé apparaît sur la page de l’événement jusqu’à son retrait ou l’expiration de l’événement.
- **Voix doublée** : pour chaque langue traduite, un fichier WAV avec la voix studio, calé sur le minutage de la session, pour doubler une vidéo enregistrée.
- **Connexion SSO (Google, Microsoft…)** : renseigner `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_ALLOWED` (courriels ou `@domaine`) et `PUBLIC_ORIGIN`, puis déclarer `https://<domaine>/api/auth/sso/callback` comme URI de redirection chez le fournisseur. Le code opérateur reste valable. Les sessions SSO durent `SSO_SESSION_HOURS` (12 h) et sont perdues au redémarrage du backend.

## Site public (V3.2)

- Site au format SaaS classique, centré produits : bandeau d’annonce, menu Produits en quatre catégories (traduction et sous-titres, réunions et diffusion, après l’événement, plateforme), menu Cas d’usage (réunions, conférences, webinaires, formations, événements hybrides, accueil du public), Ressources. 15 pages produits `/produits/:slug`, pages `/cas-usage/:slug` (`/solutions/*` redirige), `/fonctionnalites`, `/comment-ca-marche`, `/faq`, `/securite`, `/demo`. Bilingue FR/EN. Les images sont de vraies captures de l’application (`frontend/public/site/`).
- Les demandes de démo arrivent dans Portail → Demandes (administrateurs) : statut, courriel, export CSV. Aucun courriel n’est envoyé automatiquement.
- Aucun chiffre, client, avis ou certification inventé : uniquement des faits sur l’application.

## Plus de langues et traduction sur le serveur (V3.1)

- **55 langues d’écoute** : les 13 langues d’interprétation directe, plus 42 langues « texte + voix » (arabe, swahili, lingala, ourdou, turc, néerlandais, haoussa, yoruba, créole haïtien, kinyarwanda…). À la création de l’événement : « Plus de langues ». Pour ces langues, le serveur traduit chaque phrase terminée (modèle `OPENAI_CASCADE_MODEL`, par défaut `OPENAI_SUMMARY_MODEL`) et la lit avec la voix studio choisie : environ 2 à 4 s de décalage de plus. La langue principale reste une langue d’interprétation directe. La qualité de voix varie selon la langue : à faire vérifier par un locuteur natif.
- **Traduction sur le serveur** : console → Source audio → Réunion ou flux → « Démarrer sur le serveur ». Le serveur récupère le flux RTMP/SRT et traduit toutes les langues lui-même ; la console peut être fermée. Les noms d’orateur, l’archive des transcriptions, la cabine des interprètes humains et le décompte des minutes fonctionnent aussi. Arrêt automatique après `SERVER_IDLE_MINUTES` (30) sans son. Une seule diffusion à la fois par événement (console ou serveur).

## Plateforme (V3) : comptes, flux RTMP/SRT, apps mobiles

- **Parcours** : `/` accueil public avec « Rejoindre » par code ; `/login` connexion ; `/present` console ; `/portal/sessions`, `/portal/transcripts`, `/portal/activity`, `/portal/users`, `/portal/account`. Menu en haut de l’app, barre de contrôle du direct collée en haut de la console.
- **Comptes** : Portail → Utilisateurs (avec le code opérateur la première fois) → créer votre compte **Propriétaire**, puis vous connecter avec votre courriel. Rôles : propriétaire, administrateur, présentateur (ne voit que ses sessions). Mot de passe temporaire affiché une fois ; réinitialisation (mot de passe + double authentification) par un administrateur. Sessions de connexion conservées 12 h (`SSO_SESSION_HOURS`), même après un redémarrage. Le code opérateur reste un accès propriétaire de secours.
- **Double authentification** : Compte → « Activer avec une application d’authentification » (Google/Microsoft Authenticator, 1Password).
- **Minutes** : illimitées par défaut ; un administrateur fixe un solde par utilisateur et transfère des minutes ; un présentateur peut donner ses minutes à un collègue. Le temps de diffusion est décompté toutes les 30 s et la diffusion s’arrête quand le solde est à zéro.
- **SSO** : un courriel invité dans Utilisateurs peut se connecter par SSO même hors `OIDC_ALLOWED` ; les nouveaux comptes SSO reçoivent `OIDC_DEFAULT_ROLE` (présentateur par défaut).
- **Réunion ou flux (RTMP / SRT)** : console → Source audio → « Réunion ou flux ». Copier l’URL du serveur et la clé de flux dans Zoom (diffusion personnalisée), Teams (app « Custom Streaming », stratégie LiveStreamingMode), Webex, OBS ou vMix. Le son arrive dans la console et part en traduction comme un micro. Service `ingest` (MediaMTX) : ports **1935/tcp** (RTMP) et **8890/udp** (SRT) à ouvrir dans le pare-feu. RTMPS : monter un certificat et définir `MTX_RTMPENCRYPTION=optional`, `MTX_RTMPSERVERKEY`, `MTX_RTMPSERVERCERT`, `INGEST_RTMPS_PORT`. YouTube et Vimeo sont des destinations : pour les atteindre en même temps, diffuser en multiple depuis OBS ou Restream.
- **Robots de réunion** (un participant automatique qui rejoint Zoom/Teams/Meet) : non inclus ; ils exigent une app enregistrée chez chaque éditeur. L’entrée RTMP couvre Zoom, Teams et Webex sans robot.
- **Apps mobiles** : dossier `mobile/` (Capacitor). GitHub Actions « Mobile apps » produit un APK Android de test ; iOS se compile sur Mac avec un compte Apple Developer. Ajouter `https://localhost,capacitor://localhost` à `CORS_ORIGINS`. Voir [mobile/README.md](mobile/README.md).

## Portail, codes de session, archives (V2.3)

- **Code de session** : chaque événement a un code court (ex. `UHEG3270`) affiché dans la console, sur l’écran de salle et la page d’écoute. Les auditeurs tapent ce code sur `/join` (ou ouvrent `/join/UHEG3270`) au lieu de scanner le QR code.
- **Portail** (`/portal`, icône grille dans l’en-tête) : planifier des sessions (date, durée, étiquettes, langues), modifier, dupliquer, épingler (n’expire jamais), supprimer, importer un CSV (`name,start,duration,languages,labels,organization,archive` — bouton « Modèle CSV »), ouvrir une session dans la console.
- **Archive des transcriptions** (option par événement, désactivée par défaut) : la console envoie les transcriptions au serveur chaque minute et à l’arrêt. Dans le portail : TXT, TXT horodaté avec décalage, SRT, VTT, traduction d’une transcription dans une autre langue en gardant le minutage, suppression. Les auditeurs voient la mention « L’organisateur conserve une transcription écrite ». Tout est supprimé avec l’événement.
- **Noms des orateurs** : barre « Orateur » sous les commandes ; les noms viennent de Paramètres → Orateurs. Le nom apparaît dans les sous-titres, l’écran de salle et les transcriptions à chaque changement d’orateur, pour toutes les langues.
- **Écran multilingue** : `/e/<id>/screen?langs=en,fr,es` affiche jusqu’à 4 langues côte à côte. Bandeau « En pause » quand l’orateur s’arrête.
- **Page d’écoute** : contraste élevé, « phrases complètes seulement », enregistrement du texte reçu, aide intégrée, heure de début des sessions planifiées, bandeau de pause/fin.
- **Glossaire avancé** (jusqu’à ~3000 termes) : sections par langue `[fr]`, graphies phonétiques `Moncton <Monkton, Monckton>`, termes préférés `Terme !!` (envoyés à l’interprète IA, ~1500 caractères max), commentaires `#`.
- **Webhook de sous-titres** : dans Intégrations, « Webhook (HTTPS) » reçoit chaque ligne en JSON. Seules les adresses Internet publiques en HTTPS sont acceptées.
- **Clés API** (`tbk_…`) : Portail → Clés API. Elles donnent les droits opérateur sauf la gestion des clés. Référence : [docs/API.md](docs/API.md).
- **Rapport d’activité CSV**, **arrêt sur silence** (Paramètres), **touche pour parler configurable**.
- Comparaison détaillée : [docs/WORDLY-PARITY.md](docs/WORDLY-PARITY.md).

## Sécurité et confidentialité

Les routes de création de session, d’événement et de statistiques exigent `Authorization: Bearer <OPERATOR_TOKEN>`. Le code opérateur reste en mémoire dans l’onglet et n’est pas intégré au build. Chaque événement possède un jeton de publication distinct, envoyé dans le premier message WebSocket, jamais dans le QR code ou l’URL. Le PIN est également envoyé dans le premier message.

La clé OpenAI reste sur le serveur. Le navigateur opérateur reçoit uniquement le secret temporaire et les métadonnées nécessaires. Les requêtes sont limitées en taille et fréquence. Les origines HTTP/WS sont explicitement configurées. Les enregistrements audio ne sont pas écrits sur disque par cette application ; des tampons audio temporaires existent en mémoire, et l’audio de traduction est traité par OpenAI. Les profils et préférences utilisent le stockage local du navigateur.

## Tests

```sh
PYTHONPATH=backend .venv/bin/pytest backend/unit_tests -q
cd frontend
npm ci
npm test
npm run build
npm audit
```

Ces tests sont hors ligne vis-à-vis d’OpenAI : aucune clé réelle ni crédit API nécessaire. Les fichiers historiques dans `backend/tests` et `test_reports` décrivent l’ancien environnement de prévisualisation ; ils ne sont pas la suite de validation de cette version. Ne pas les lancer contre une instance de production.

La CI ajoute la construction des deux images et un contrôle HTTP de la stack Compose.

## Limites à vérifier avant un événement réel

- Microphone et WebRTC : HTTPS obligatoire hors localhost.
- Diffusion : PCM 16 kHz mono (≈256 kbit/s par auditeur) via WebSocket, lu par Web Audio (AudioWorklet) avec un tampon d’environ 350 ms. Fonctionne dans Chrome, Edge, Firefox et Safari, y compris iPhone/iPad. 30 auditeurs ≈ 8 Mbit/s sortants sur le serveur. À valider sur les appareils exacts.
- Sur iPhone, la page demande à garder l’écran allumé (Wake Lock) ; si l’écran se verrouille, iOS peut suspendre le son.
- Validation audio de bout en bout, arrivée tardive d’auditeurs, reprise après coupure et charge à 30 auditeurs restent à effectuer sur le réseau réel. Les tests automatisés ne prouvent pas la qualité audio ni la latence.
- La latence affichée est une estimation. Les profils/glossaires sont une tentative de personnalisation avec repli si le modèle les refuse.
- `/api/stats.openai_sessions` compte les opérateurs de diffusion connectés, pas les sessions OpenAI réelles ; une session utilisée uniquement dans la console n’est pas comptabilisée.

Intégration fondée sur la [documentation officielle de traduction temps réel](https://developers.openai.com/api/docs/guides/realtime-translation).
