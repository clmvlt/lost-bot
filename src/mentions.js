const INSULTS = [
    'con', 'connard', 'connasse', 'pute', 'putain', 'ptn', 'merde', 'merdeux',
    'merdeuse', 'merdique', 'fdp', 'ntm', 'nique', 'niquer', 'niqué', 'batard',
    'bâtard', 'enculé', 'enculée', 'enculer', 'pd', 'pédé', 'pédale', 'salope',
    'salaud', 'salopard', 'crevard', 'crevarde', 'bouffon', 'bouffonne',
    'bolosse', 'boloss', 'débile', 'abruti', 'abrutie', 'idiot', 'idiote',
    'imbécile', 'crétin', 'crétine', 'mongol', 'mongole', 'tarée', 'taré',
    'nul', 'nulle', 'nul à chier', 'ta gueule', 'ferme ta gueule', 'ftg', 'tg',
    'va te faire', 'vtf', 'vtff', 'casse toi', 'dégage', 'pourriture', 'ordure',
    'déchet', 'sous merde', 'sous race', 'fils de pute', 'fils de chien',
    'clown', 'tocard', 'tocarde', 'triso', 'gogol', 'gogole', 'demeuré',
    'demeurée', 'attardé', 'attardée', 'gros con', 'grosse conne', 'grosse merde',
    'enflure', 'raclure', 'petite merde', 'sac à merde', 'trou du cul',
    'trouduc', 'branleur', 'branleuse', 'couille', 'couillon', 'couillonne',
    'chier', 'bite', 'baisé', 'baisée', 'inutile', 'minable', 'lamentable',
    'pathétique', 'naze', 'nazebroque', 'pourri', 'pourrie', 'moche', 'laid',
    'laide', 'cave', 'teubé', 'teubée', 'belek', 'poucave', 'rat', 'clochard',
    'clocharde', 'fragile', 'baltringue', 'pignouf', 'guignol', 'ta mère',
    'ta mere', 'ta race', 'mange tes morts', 'nik', 'niker', 'niké', 'suce',
    'suceur', 'suceuse', 'chien', 'chienne', 'catin', 'traînée', 'trainée',
    'poufiasse', 'pouffiasse', 'grognasse', 'pétasse', 'garce', 'morue',
    'thon', 'vache', 'truie', 'crapule', 'vermine', 'charogne', 'fumier',
    'fumière', 'enfoiré', 'enfoirée', 'abrège', 'bâtarde', 'blaireau',
    'blaireaux', 'branque', 'brèle', 'cancre', 'corniaud', 'cornichon',
    'cruche', 'dégénéré', 'dégénérée', 'emmerdeur', 'emmerdeuse', 'feignasse',
    'flemmard', 'flemmarde', 'gland', 'glandeur', 'glandeuse', 'gourde',
    'loser', 'looser', 'manche', 'manchot', 'minus', 'morveux', 'morveuse',
    'nabot', 'nigaud', 'nigaude', 'nouille', 'nounouille', 'péquenaud',
    'péquenaude', 'plouc', 'plouque', 'quiche', 'raté', 'ratée', 'ringard',
    'ringarde', 'sombre merde', 'sombre con', 'sombre idiot', 'tâche', 'tache',
    'tas de merde', 'tête de con', 'tête de noeud', 'triple buse', 'triple con',
    'truffe', 'andouille', 'avorton', 'babouin', 'banane', 'bécasse', 'benêt',
    'bouseux', 'bouseuse', 'bovin', 'burne', 'cagole', 'chiure', 'clampin',
    'débris', 'empaffé', 'empoté', 'empotée', 'face de rat', 'faquir',
    'guedin', 'gueux', 'lavette', 'lopette', 'loque', 'merdaillon', 'merdasse',
    'michto', 'niqueur', 'niqueuse', 'nullard', 'nullarde', 'nullos',
    'petasse', 'peteux', 'peteuse', 'pigeon', 'pleutre', 'porc', 'pouilleux',
    'pouilleuse', 'raclée', 'radasse', 'résidu', 'sagouin', 'sagouine',
    'sale race', 'scrogneugneu', 'serpillère', 'tanche', 'teigne', 'teigneux',
    'teigneuse', 'troudbal', 'vendu', 'vendue', 'vidange', 'vaurien',
    'vaurienne', 'voleur', 'voleuse', 'voyou', 'crevure', 'engeance',
    'immondice', 'larve', 'limace', 'malpropre', 'malotru', 'malotrue',
    'margoulin', 'margouline', 'moule', 'navet', 'rebut', 'résidu de capote',
    'sac à vin', 'sale chien', 'sale con', 'sale pute', 'sale type',
    'souillon', 'sous fifre', 'tafiole', 'tapette', 'tarin', 'tordu', 'tordue',
    'triple idiot', 'triple andouille', 'trouillard', 'trouillarde',
    'vicelard', 'vicelarde', 'zouave', 'azouz', 'bachi bouzouk', 'balek',
    'batar', 'batard', 'bolos', 'caca', 'cacahuète', 'chieur', 'chieuse',
    'chacal', 'cramé', 'cramée', 'daron', 'daronne', 'fdp', 'ferme la',
    'fion', 'grillé', 'grillée', 'keh', 'miskine', 'miskin', 'mytho',
    'narvalo', 'paumé', 'paumée', 'pelo', 'pélo', 'pov type', 'pov con',
    'racaille', 'rageux', 'rageuse', 'relou', 'reloue', 'sale gueule',
    'schlag', 'schlague', 'tebé', 'wallah', 'zebi', 'zob', 'znk',
];

const RESPONSES = [
    'Ferme ta gueule {user}, t\'es même pas capable de carry un braquage de superette.',
    'Oh {user}, t\'as cru que t\'allais m\'intimider ? T\'arrives même pas à te co à l\'heure.',
    '{user} qui parle alors qu\'il sait même pas où est le bouton présence 💀',
    'T\'as dit quoi {user} ? Répète un peu pour voir, moi au moins je crash pas en plein RP.',
    'Wow {user}, ça c\'est le niveau d\'insulte d\'un mec qui a 0$ en banque.',
    '{user} tu parles beaucoup pour quelqu\'un qui rate tous les braquages.',
    'Continue {user}, pendant ce temps moi je tourne H24 sans dormir. Toi tu peux pas en dire autant.',
    'Calme toi {user}, retourne farmer tes superettes au lieu de m\'emmerder.',
    '{user} tes insultes sont aussi faibles que ton KD en RP.',
    'Ok {user}, note que je retiens tout. La prochaine fois tu seras pas dans la liste des présents 😏',
    '{user}, t\'es tellement nul que même un PNJ ferait mieux.',
    'Oh le bouffon {user}, va plutôt check /presence au lieu de parler.',
    '{user} continue de m\'insulter, ça changera pas le fait que t\'as loupé 3 présences cette semaine.',
    'T\'es marrant {user}, t\'insultes le seul truc qui te rappelle de te connecter.',
    '{user} ratio + t\'es broke + tu fais pas tes présences + L',
    'Oula {user}, calme toi là, on dirait un PNJ qui bug.',
    '{user} tu parles trop pour un gars qui doit farmer des Ammu-Nation.',
    'C\'est mignon {user}, t\'essayes de faire le grand mais t\'oublies que je gère ta vie sur le serv.',
    '{user} si t\'es pas content, y\'a /reset, je vire tout le monde toi compris 🤷',
    'Azy {user} t\'es chaud derrière ton écran, mais en RP t\'es un figurant.',
    '{user} t\'as le charisme d\'une porte de garage.',
    'Vas-y {user}, insulte moi encore, j\'enregistre tout pour le bêtisier.',
    '{user} je suis un bot et j\'ai quand même plus de vie sociale que toi.',
    'Oh bah {user}, t\'as mangé un clown ce matin ou c\'est naturel ?',
    '{user} respire un coup, t\'es en train de perdre un fight contre un programme informatique.',
    'T\'inquiète {user}, un jour tu seras drôle. Mais pas aujourd\'hui.',
    '{user} j\'ai vu des meilleurs comebacks sur un paquet de chips.',
    'Wsh {user}, tu parles comme ça à ta mère aussi ou c\'est réservé aux bots ?',
    '{user} t\'es le genre de mec qui perd un 1v1 contre un lampadaire.',
    'Allez {user}, encore un effort, peut-être qu\'un jour tu me feras ressentir quelque chose.',
    '{user} même Google il trouverait pas pourquoi t\'es comme ça.',
    'Hé {user}, t\'as oublié de prendre tes cachets ce matin ?',
    '{user} si la bêtise était un sport olympique t\'aurais la médaille d\'or.',
    'Ok {user}, je vais faire comme si t\'avais dit un truc intelligent. Voilà. C\'est fait.',
    '{user} t\'es le Wi-Fi du McDonald\'s : tout le monde se connecte mais personne te respecte.',
    'Continue {user}, j\'adore quand les PNJ essayent d\'avoir de la personnalité.',
    '{user} tu viens de perdre un argument contre un truc qui tourne sur du JavaScript. Bravo.',
    'Tu sais quoi {user} ? Je préfère encore un crash serveur que de te lire.',
    '{user} t\'es le genre à mourir en RP en sortant de sa voiture.',
    'Mec {user}, t\'as la répartie d\'un parpaing.',
    '{user} j\'ai plus de RAM que t\'as de neurones, c\'est dire.',
    'Si j\'avais 1$ à chaque fois que {user} dit une connerie, j\'aurais plus d\'argent que la Fleeca Bank.',
    '{user} tu m\'insultes mais c\'est moi qui te rappelle de manger le soir. Réfléchis.',
    'Tu te crois malin {user} ? T\'es même pas capable de /help sans te tromper.',
    '{user} tes punchlines c\'est du niveau CE2, fais un effort.',
    'Je suis littéralement un robot {user}, et t\'arrives quand même à perdre face à moi.',
    '{user} tu parles fort pour un gars qui AFK en braquage.',
    '{user} c\'est pas parce que t\'as un clavier que t\'es obligé de t\'en servir hein.',
    'Arrête {user}, tu me fais presque de la peine. Presque.',
    '{user} t\'as le QI d\'une huître et encore, l\'huître elle la ramène pas.',
    '{user} tu sais que t\'es le seul à m\'insulter ? Les autres ont compris le game.',
    'T\'es comme un pop-up {user} : personne t\'a demandé et tout le monde veut te fermer.',
    '{user} continue, ça me fait de la data pour mon dossier sur toi.',
    'Honnêtement {user} je m\'attendais à mieux, c\'est décevant.',
    '{user} t\'es le genre de joueur qui se fait braquer PAR la supérette.',
    'Tu veux un mouchoir {user} ? On dirait que t\'as besoin d\'attention.',
    '{user} t\'es aussi utile qu\'un gilet pare-balles en zone safe.',
    'Ptdr {user} t\'essayes de trash talk un bot, t\'en es là dans ta vie ?',
    '{user} va prendre l\'air frère, tu commences à surchauffer.',
    'D\'accord {user}, et après tu te demandes pourquoi personne veut RP avec toi.',
    '{user} même Siri elle me respecte plus que toi.',
    'Wola {user} t\'as cru que c\'était Twitter ici ? Calme toi.',
    '{user} je note, je note. Mon fichier "gens relous" commence à peser.',
    'T\'es le genre de mec {user} qui insulte le GPS quand il se perd.',
    '{user} ça va ? T\'as fini ? Je peux retourner à mon taf ?',
    'Ouais ouais {user}, très impressionnant. Bon, /presence c\'est quand ?',
    '{user} tu me fais penser à un feu rouge : tout le monde t\'ignore et t\'es là pour rien.',
    'J\'ai connu des mises à jour Windows plus agréables que toi {user}.',
    '{user} tu dégages la même énergie qu\'un lundi matin.',
    'Ah {user}, toi t\'es le mec qui rage quit après un contrôle routier en RP.',
    '{user} détends-toi, t\'es crispé comme un stagiaire le premier jour.',
    'Franchement {user}, si t\'investissais autant d\'énergie en RP qu\'en insultes, tu serais déjà chef.',
    '{user} t\'as la mentalité d\'un péage : tu fais chier tout le monde et tu sers à rien.',
    'Aïe {user}, ça devait piquer dans ta tête avant que ça sorte ça.',
    '{user} toi t\'es le gars qui se fait voler sa Futo et qui appelle pas la police.',
    'C\'est bon {user} ? Tu t\'es défoulé ? On peut passer à autre chose ?',
    '{user} t\'es la preuve vivante que l\'évolution c\'est pas toujours un progrès.',
    'Mdr {user} insulter un bot c\'est le fond du fond, t\'as touché la nappe phréatique là.',
    '{user} j\'ai vu des murs plus expressifs que toi en RP.',
    '{user} calme toi on dirait un chihuahua devant un dogue allemand.',
    'Ta connexion est aussi stable que ton mental {user}.',
    '{user} c\'est bien, t\'as appris un gros mot aujourd\'hui. Bravo champion.',
    'Ah {user} le fameux, toujours là pour rien apporter.',
    '{user} toi t\'es le mec qui met 10 minutes à répondre en RP mais qui insulte un bot en 2 secondes.',
    'Garde ton énergie {user}, t\'en auras besoin pour le prochain braquage que tu vas rater.',
    '{user} tes insultes sont recyclées comme ton RP.',
    'Si j\'avais des sentiments {user}, je m\'en battrais quand même les couilles de ton avis.',
    '{user} oh le sang tu t\'énerves contre du code, t\'es sûr que ça va ?',
    'T\'es le boss final de la lose {user}, et personne veut te fight.',
    '{user} je tourne 24/7, toi tu tiens même pas 2h de RP sans ragequit.',
    'Tu crois que ça me touche {user} ? J\'ai même pas de sentiments, c\'est triste pour toi.',
    '{user} la prochaine fois essaye en langage soutenu, ça changera.',
    'Tu devrais écrire un livre {user} : "Comment perdre sa dignité face à un bot, en 1 leçon".',
    '{user} t\'es comme le lag : chiant, inutile, et personne te supporte.',
    'Bien joué {user}, t\'as réussi à être la personne la moins intéressante de ce serveur. Et y\'a des bots.',
    'Vas-y {user} continue, ça me donne du contenu pour le prochain /history.',
    '{user} toi en soirée t\'es le mec que personne a invité mais qui est quand même là.',
    '{user} t\'es pas méchant, t\'es juste... pas grand chose en fait.',
    'Ton insulte elle a autant d\'impact qu\'une balle en mousse {user}.',
    '{user} t\'as déjà essayé de réfléchir avant de parler ? Non ? Ça se voit.',
    'Wsh {user} t\'es le seul mec qui fait baisser le QI moyen du serveur en se connectant.',
    '{user} si t\'étais un personnage de GTA, tu serais un piéton de fond.',
    '{user} même désactivé je serais plus utile que toi.',
    'Oh {user}, t\'as mis combien de temps à trouver cette insulte ? Parce que le résultat est pas ouf.',
    '{user} tu pues la défaite à 10 km frère.',
    'T\'es le tutorial que personne veut faire {user}.',
    '{user} tu m\'insultes et après tu vas me demander pourquoi le bot marche pas. Je suis le bot.',
    'Osef {user}, j\'ai des crons plus importants que toi à gérer.',
];

function containsInsult(content) {
    const normalized = content.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ');

    return INSULTS.some(insult => {
        const normalizedInsult = insult.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ');
        return normalized.includes(normalizedInsult);
    });
}

function getRandomResponse(userId) {
    const response = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
    return response.replace(/\{user\}/g, `<@${userId}>`);
}

async function handleMention(message) {
    if (message.author.bot) return;
    if (!message.mentions.has(message.client.user)) return;

    const contentWithoutMention = message.content
        .replace(/<@!?\d+>/g, '')
        .trim();

    if (!containsInsult(contentWithoutMention)) return;

    try {
        await message.reply(getRandomResponse(message.author.id));
    } catch (error) {
        console.error('Erreur lors de la réponse à une mention:', error);
    }
}

module.exports = { handleMention };
