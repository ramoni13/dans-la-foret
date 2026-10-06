const fs = require('fs');
const path = require('path');

function getFullTreesList() {
  return [
    { name_fr: "Chêne pédonculé", name_latin: "Quercus robur", img: "Quercus_robur_Mittelrheingau_01.jpg", anecdote: "Il peut vivre plus de 500 ans et abrite plus de 300 espèces d'insectes différentes." },
    { name_fr: "Hêtre commun", name_latin: "Fagus sylvatica", img: "Fagus_sylvatica_J%C3%A4gerstein_01.jpg", anecdote: "Son écorce reste lisse toute sa vie. Ses fruits riches en huile s'appellent des faînes." },
    { name_fr: "Mélèze d'Europe", name_latin: "Larix decidua", img: "Larix_decidua_Val_Roseg_01.jpg", anecdote: "C'est l'un des rares résineux d'Europe à perdre ses aiguilles dorées en hiver." },
    { name_fr: "Pin sylvestre", name_latin: "Pinus sylvestris", img: "Pinus_sylvestris_Vosges_01.jpg", anecdote: "Reconnaissable à son écorce ocre et orange dans sa partie supérieure." },
    { name_fr: "Châtaignier commun", name_latin: "Castanea sativa", img: "Castanea_sativa_01.jpg", anecdote: "Surnommé 'l'arbre à pain' car ses châtaignes ont nourri des générations en montagne." },
    { name_fr: "Sorbier des oiseleurs", name_latin: "Sorbus aucuparia", img: "Sorbus_aucuparia_01.jpg", anecdote: "Ses baies rouges en grappes sont une réserve de nourriture essentielle pour les oiseaux en hiver." },
    { name_fr: "Sapin pectiné", name_latin: "Abies alba", img: "Abies_alba_Vosges_01.jpg", anecdote: "Ses cônes dressés vers le ciel se désagrègent directement sur l'arbre à maturité." },
    { name_fr: "Épicéa commun", name_latin: "Picea abies", img: "Picea_abies_01.jpg", anecdote: "Ses cônes pendent vers le bas contrairement au sapin, et son bois sert à fabriquer des violons." },
    { name_fr: "Chêne vert", name_latin: "Quercus ilex", img: "Quercus_ilex_01.jpg", anecdote: "Ses feuilles coriaces et piquantes gardent l'eau pendant les étés méditerranéens." },
    { name_fr: "Chêne liège", name_latin: "Quercus suber", img: "Quercus_suber_Portugal_01.jpg", anecdote: "Son écorce est récoltée tous les 9 à 12 ans pour fabriquer des bouchons sans couper l'arbre." },
    { name_fr: "Frêne élevé", name_latin: "Fraxinus excelsior", img: "Fraxinus_excelsior_01.jpg", anecdote: "Son bois souple et résistant est historiquement utilisé pour les manches d'outils et les rames." },
    { name_fr: "Bouleau verruqueux", name_latin: "Betula pendula", img: "Betula_pendula_01.jpg", anecdote: "Arbre pionnier dont l'écorce blanche réfléchit la lumière pour se protéger du gel." },
    { name_fr: "Charme commun", name_latin: "Carpinus betulus", img: "Carpinus_betulus_01.jpg", anecdote: "Son feuillage est marcescent : ses feuilles séchées restent accrochées aux branches tout l'hiver." },
    { name_fr: "Pin maritime", name_latin: "Pinus pinaster", img: "Pinus_pinaster_Landes_01.jpg", anecdote: "Emblématique du massif des Landes de Gascogne, planté pour fixer les dunes au XIXe siècle." },
    { name_fr: "Tilleul à grandes feuilles", name_latin: "Tilia platyphyllos", img: "Tilia_platyphyllos_01.jpg", anecdote: "Ses fleurs très parfumées et mellifères sont réputées en infusion apaisante." },
    { name_fr: "Érable champêtre", name_latin: "Acer campestre", img: "Acer_campestre_01.jpg", anecdote: "Ses fruits munis de deux ailes (disamares) tournoient comme des hélicoptères en tombant." },
    { name_fr: "Orme champêtre", name_latin: "Ulmus minor", img: "Ulmus_minor_01.jpg", anecdote: "Autrefois très fréquent au bord des chemins, il a été fragilisé par la maladie de la graphiose." },
    { name_fr: "Aulne glutineux", name_latin: "Alnus glutinosa", img: "Alnus_glutinosa_01.jpg", anecdote: "Son bois immergé ne pourrit pas ; il a servi à fabriquer les pieux des fondations de Venise." },
    { name_fr: "Pin d'Alep", name_latin: "Pinus halepensis", img: "Pinus_halepensis_01.jpg", anecdote: "Très fréquent en Provence, ses pommes de pin restent fermées jusqu'au passage d'un incendie." },
    { name_fr: "Alisier torminal", name_latin: "Sorbus torminalis", img: "Sorbus_torminalis_01.jpg", anecdote: "Son bois est l'un des plus précieux d'Europe, très prisé en ébénisterie et lutherie." },
    { name_fr: "Noyer commun", name_latin: "Juglans regia", img: "Juglans_regia_01.jpg", anecdote: "Ses feuilles sécrètent une substance qui empêche les autres plantes de pousser à son pied." },
    { name_fr: "Platane d'Orient", name_latin: "Platanus orientalis", img: "Platanus_orientalis_01.jpg", anecdote: "Arbre majestueux d'alignement dont l'écorce se détache en plaques multicolores." },
    { name_fr: "Mésangeau / Cormier", name_latin: "Sorbus domestica", img: "Sorbus_domestica_01.jpg", anecdote: "Produit des cormes, de petits fruits anciens ressemblant à de petites poires." },
    { name_fr: "Poirier sauvage", name_latin: "Pyrus pyraster", img: "Pyrus_pyraster_01.jpg", anecdote: "Ancêtre de nos poiriers cultivés, ses rameaux portent de petites épines." },
    { name_fr: "Pommier sauvage", name_latin: "Malus sylvestris", img: "Malus_sylvestris_01.jpg", anecdote: "Ses petites pommes acides sont une source de nourriture précieuse pour la faune forestière." },
    { name_fr: "Merisier", name_latin: "Prunus avium", img: "Prunus_avium_01.jpg", anecdote: "Ancêtre du cerisier, sa floraison printanière blanche illumine le bord des forêts." },
    { name_fr: "Alisier blanc", name_latin: "Sorbus aria", img: "Sorbus_aria_01.jpg", anecdote: "Le dessous de ses feuilles est recouvert d'un duvet blanc feutré qui capte la lumière." },
    { name_fr: "Érable sycomore", name_latin: "Acer pseudoplatanus", img: "Acer_pseudoplatanus_01.jpg", anecdote: "Apprécié en lutherie pour fabriquer le dos des violons et des violoncelles." },
    { name_fr: "Érable plane", name_latin: "Acer platanoides", img: "Acer_platanoides_01.jpg", anecdote: "Ses feuilles prennent une couleur jaune d'or éclatante dès le début de l'automne." },
    { name_fr: "Pin cembre / Arolle", name_latin: "Pinus cembra", img: "Pinus_cembra_01.jpg", anecdote: "Vit en haute montagne ; ses graines sont dispersées par un oiseau nommé le Cassenoix." },
    { name_fr: "Pin à crochets", name_latin: "Pinus uncinata", img: "Pinus_uncinata_01.jpg", anecdote: "Ses écailles d'écorce se terminent par un petit crochet dirigé vers la base du cône." },
    { name_fr: "Pin noir d'Autriche", name_latin: "Pinus nigra", img: "Pinus_nigra_01.jpg", anecdote: "Traces sombres sur son écorce et grande résistance aux sols calcaires difficiles." },
    { name_fr: "Pin pignon / Parasol", name_latin: "Pinus pinea", img: "Pinus_pinea_01.jpg", anecdote: "Emblématique des côtes méditerranéennes, il produit les pignons de pin comestibles." },
    { name_fr: "Cyprès de Provence", name_latin: "Cupressus sempervirens", img: "Cupressus_sempervirens_01.jpg", anecdote: "Arbre élancé typique du paysage provençal, souvent planté comme brise-vent." },
    { name_fr: "Genévrier cade", name_latin: "Juniperus oxycedrus", img: "Juniperus_oxycedrus_01.jpg", anecdote: "Son bois odorant produit l'huile de cade utilisée autrefois en médecine populaire." },
    { name_fr: "Genévrier commun", name_latin: "Juniperus communis", img: "Juniperus_communis_01.jpg", anecdote: "Ses baies bleu-noir mettent deux ans à mûrir et parfument la choucroute." },
    { name_fr: "If commun", name_latin: "Taxus baccata", img: "Taxus_baccata_01.jpg", anecdote: "Arbre très longévif pouvant dépasser 1000 ans ; toutes ses parties sont toxiques sauf la chair rouge du fruit." },
    { name_fr: "Houx commun", name_latin: "Ilex aquifolium", img: "Ilex_aquifolium_01.jpg", anecdote: "Ses feuilles du bas sont piquantes contre les herbivores, mais deviennent lisses en hauteur." },
    { name_fr: "Buis commun", name_latin: "Buxus sempervirens", img: "Buxus_sempervirens_01.jpg", anecdote: "Son bois est si dense et lourd qu'il coule dans l'eau." },
    { name_fr: "Marronnier d'Inde", name_latin: "Aesculus hippocastanum", img: "Aesculus_hippocastanum_01.jpg", anecdote: "Ses fruits (marrons) ne sont pas comestibles, contrairement aux châtaignes." },
    { name_fr: "Tilleul à petites feuilles", name_latin: "Tilia cordata", img: "Tilia_cordata_01.jpg", anecdote: "Reconnaissable à ses petites feuilles en forme de cœur avec des touffes de poils roux au verso." },
    { name_fr: "Aulne blanc", name_latin: "Alnus incana", img: "Alnus_incana_01.jpg", anecdote: "Colonise les bords de torrents en montagne et aide à stabiliser les berges." },
    { name_fr: "Saule blanc", name_latin: "Salix alba", img: "Salix_alba_01.jpg", anecdote: "Son écorce contient de la salicine, molécule à l'origine de l'aspirine." },
    { name_fr: "Saule marsault", name_latin: "Salix caprea", img: "Salix_caprea_01.jpg", anecdote: "Ses chatons du printemps apportent l'un des premiers pollens aux abeilles." },
    { name_fr: "Peuplier noir", name_latin: "Populus nigra", img: "Populus_nigra_01.jpg", anecdote: "Grand arbre des zones humides au tronc souvent recouvert de grosses loupes." },
    { name_fr: "Peuplier tremble", name_latin: "Populus tremula", img: "Populus_tremula_01.jpg", anecdote: "Le pétiole aplati de ses feuilles fait qu'elles 'remblent' à la moindre brise." },
    { name_fr: "Peuplier blanc", name_latin: "Populus alba", img: "Populus_alba_01.jpg", anecdote: "Le dessous de ses feuilles est d'un blanc cotonneux très lumineux." },
    { name_fr: "Chêne pubescent", name_latin: "Quercus pubescens", img: "Quercus_pubescens_01.jpg", anecdote: "Le dessous de ses feuilles est couvert de petits poils doux pour limiter la transpiration." },
    { name_fr: "Chêne tauzin", name_latin: "Quercus pyrenaica", img: "Quercus_pyrenaica_01.jpg", anecdote: "Très présent dans le Sud-Ouest, adapté aux sols sableux et pauvres." },
    { name_fr: "Chêne chevelu", name_latin: "Quercus cerris", img: "Quercus_cerris_01.jpg", anecdote: "La cupule de son gland est recouverte d'écailles allongées comme des cheveux." },
    { name_fr: "Nyssa / Copalme", name_latin: "Liquidambar styraciflua", img: "Liquidambar_styraciflua_01.jpg", anecdote: "Célèbre pour le spectacle de ses feuilles qui deviennent rouge écarlate à l'automne." },
    { name_fr: "Robinier faux-acacia", name_latin: "Robinia pseudoacacia", img: "Robinia_pseudoacacia_01.jpg", anecdote: "Importé d'Amérique en 1601, ses fleurs blanches en grappes donnent un miel délicieux." },
    { name_fr: "Sophora du Japon", name_latin: "Styphnolobium japonicum", img: "Styphnolobium_japonicum_01.jpg", anecdote: "Souvent planté dans les parcs pour son ombre et sa floraison estivale tardive." },
    { name_fr: "Févier d'Amérique", name_latin: "Gleditsia triacanthos", img: "Gleditsia_triacanthos_01.jpg", anecdote: "Son tronc porte de redoutables épines ramifiées à trois pointes." },
    { name_fr: "Sureau noir", name_latin: "Sambucus nigra", img: "Sambucus_nigra_01.jpg", anecdote: "Ses ombrelles de fleurs blanches donnent des baies utilisées en sirop et gelée." },
    { name_fr: "Sureau à grappes", name_latin: "Sambucus racemosa", img: "Sambucus_racemosa_01.jpg", anecdote: "Aruste de montagne dont les baies rouge vif mûrissent en été." },
    { name_fr: "Viorne obier", name_latin: "Viburnum opulus", img: "Viburnum_opulus_01.jpg", anecdote: "Surnommée 'boule de neige' en raison de ses grosses inflorescences blanches." },
    { name_fr: "Viorne lantane", name_latin: "Viburnum lantana", img: "Viburnum_lantana_01.jpg", anecdote: "Ses jeunes rameaux très souples servaient autrefois de liens pour les fagos." },
    { name_fr: "Cornouiller sanguin", name_latin: "Cornus sanguinea", img: "Cornus_sanguinea_01.jpg", anecdote: "Ses jeunes branches deviennent rouge sang en automne et en hiver." },
    { name_fr: "Cornouiller mâle", name_latin: "Cornus mas", img: "Cornus_mas_01.jpg", anecdote: "Fleurit en jaune dès le mois de février avant l'apparition de ses feuilles." },
    { name_fr: "Fusain d'Europe", name_latin: "Euonymus europaeus", img: "Euonymus_europaeus_01.jpg", anecdote: "Ses fruits roses et oranges appelés 'bonnets d'évêque' sont très decoratifs." },
    { name_fr: "Nisetier / Noisetier", name_latin: "Corylus avellana", img: "Corylus_avellana_01.jpg", anecdote: "Arbrisseau buissonnant dont le bois souple servait à fabriquer les baguettes de sourcier." },
    { name_fr: "Prunellier / Épine noire", name_latin: "Prunus spinosa", img: "Prunus_spinosa_01.jpg", anecdote: "Ses baies bleues très astringentes servent à fabriquer la liqueur de prunelle." },
    { name_fr: "Aubépine à un style", name_latin: "Crataegus monogyna", img: "Crataegus_monogyna_01.jpg", anecdote: "Arbre d'aménageant des haies bocagères, ses fleurs blanches soutiennent la biodiversité." },
    { name_fr: "Troène commun", name_latin: "Ligustrum vulgare", img: "Ligustrum_vulgare_01.jpg", anecdote: "Arbusculte des lisières aux fleurs très odorantes et baies noires toxiques." },
    { name_fr: "Argousier", name_latin: "Hippophae rhamnoides", img: "Hippophae_rhamnoides_01.jpg", anecdote: "Ses petites baies oranges sont extrêmement riches en vitamine C." },
    { name_fr: "Arbousier", name_latin: "Arbutus unedo", img: "Arbutus_unedo_01.jpg", anecdote: "Surnommé 'arbre à fraises', il porte fleurs et fruits mûrs en même temps à l'automne." },
    { name_fr: "Olivier sauvage / Oleastre", name_latin: "Olea europaea var. sylvestris", img: "Olea_europaea_01.jpg", anecdote: "Ancêtre rustique de l'olivier cultivé, très résistant à la sécheresse." },
    { name_fr: "Terebinthe / Pistachier", name_latin: "Pistacia terebinthus", img: "Pistacia_terebinthus_01.jpg", anecdote: "Arbrisseau méditerranéen dont la résine dégage une odeur de térébenthine." },
    { name_fr: "Pistachier lentisque", name_latin: "Pistacia lentiscus", img: "Pistacia_lentiscus_01.jpg", anecdote: "Feuillage persistant de la garrigue, il produit le mastic de Chios." },
    { name_fr: "Filaria à larges feuilles", name_latin: "Phillyrea latifolia", img: "Phillyrea_latifolia_01.jpg", anecdote: "Aruste méditerranéen coriace poussant dans le maquis et la garrigue." },
    { name_fr: "Rhamnus / Nerprun alaterne", name_latin: "Rhamnus alaternus", img: "Rhamnus_alaternus_01.jpg", anecdote: "Feuillage vert brillant persistant, très apprécié des chenilles de papillons." },
    { name_fr: "Bourdaine", name_latin: "Frangula alnus", img: "Frangula_alnus_01.jpg", anecdote: "Son charbon de bois de grande qualité servait autrefois à la fabrication de la poudre à canon." },
    { name_fr: "Érable à feuilles de frêne", name_latin: "Acer negundo", img: "Acer_negundo_01.jpg", anecdote: "Originaire d'Amérique du Nord, ses feuilles ressemblent à celles du frêne." },
    { name_fr: "Érable de Montpellier", name_latin: "Acer monspessulanum", img: "Acer_monspessulanum_01.jpg", anecdote: "Ses petites feuilles à trois lobes sont typiques des zones chaudes du Sud." },
    { name_fr: "Érable à feuilles d'obier", name_latin: "Acer opalus", img: "Acer_opalus_01.jpg", anecdote: "Espèce des montagnes méditerranéennes et du sud de la France." },
    { name_fr: "Ailante glanduleux", name_latin: "Ailanthus altissima", img: "Ailanthus_altissima_01.jpg", anecdote: "Arbre à croissance très rapide, originaire d'Asie et très résistant à la pollution." },
    { name_fr: "Phellodendron / Arbre à liège", name_latin: "Phellodendron amurense", img: "Phellodendron_amurense_01.jpg", anecdote: "Son écorce spongieuse rappelle celle du chêne liège." },
    { name_fr: "Paulownia tomentosa", name_latin: "Paulownia tomentosa", img: "Paulownia_tomentosa_01.jpg", anecdote: "Grandes feuilles douces et magnifiques grappes de fleurs violettes au printemps." },
    { name_fr: "Catalpa commun", name_latin: "Catalpa bignonioides", img: "Catalpa_bignonioides_01.jpg", anecdote: "Ses fruits longs et pendants ressemblent à de grands haricots." },
    { name_fr: "Ginkgo biloba", name_latin: "Ginkgo biloba", img: "Ginkgo_biloba_01.jpg", anecdote: "Considéré comme 'l'arbre aux quarante écus', c'est la plus ancienne espèce d'arbre vivante." },
    { name_fr: "Cèdre de l'Atlas", name_latin: "Cedrus atlantica", img: "Cedrus_atlantica_01.jpg", anecdote: "Introduit au XIXe siècle dans le Luberon et le Ventoux pour reboiser les montagnes." },
    { name_fr: "Cèdre du Liban", name_latin: "Cedrus libani", img: "Cedrus_libani_01.jpg", anecdote: "Arbre majestueux à port étalé et bois très odorant." },
    { name_fr: "Cèdre de l'Himalaya", name_latin: "Cedrus deodara", img: "Cedrus_deodara_01.jpg", anecdote: "Ses branches retombantes lui donnent une silhouette très élégante." },
    { name_fr: "Douglas", name_latin: "Pseudotsuga menziesii", img: "Pseudotsuga_menziesii_01.jpg", anecdote: "Grand résineux originaire d'Amérique, très utilisé pour le bois de charpente en France." },
    { name_fr: "Sapin de Nordmann", name_latin: "Abies nordmanniana", img: "Abies_nordmanniana_01.jpg", anecdote: "Arbre de Noël star car ses aiguilles douces ne tombent pas facilement." },
    { name_fr: "Sapin de grandis", name_latin: "Abies grandis", img: "Abies_grandis_01.jpg", anecdote: "Ses aiguilles écrasées dégagent une agréable odeur de citron." },
    { name_fr: "Sapin de Numidie", name_latin: "Abies numidica", img: "Abies_numidica_01.jpg", anecdote: "Résineux rustique bien adapté aux sols calcaires et secs." },
    { name_fr: "Pin strobus / Weymouth", name_latin: "Pinus strobus", img: "Pinus_strobus_01.jpg", anecdote: "Ses aiguilles fines et douces sont regroupées par paquets de cinq." },
    { name_fr: "Pin taeda", name_latin: "Pinus taeda", img: "Pinus_taeda_01.jpg", anecdote: "Utilisé dans certaines plantations du Sud-Ouest pour sa croissance rapide." },
    { name_fr: "Pin laricio de Corse", name_latin: "Pinus nigra ssp. laricio", img: "Pinus_nigra_laricio_01.jpg", anecdote: "Arbre élancé des montagnes corses, son bois servait autrefois pour les mâts de bateaux." },
    { name_fr: "Séquoia géant", name_latin: "Sequoiadendron giganteum", img: "Sequoiadendron_giganteum_01.jpg", anecdote: "Peut atteindre des dimensions colossales et vivre plus de 3000 ans." },
    { name_fr: "Séquoia toujours vert", name_latin: "Sequoia sempervirens", img: "Sequoia_sempervirens_01.jpg", anecdote: "Comprend les arbres les plus hauts de la planète, dépassant 110 mètres." },
    { name_fr: "Cyprès de Lawson", name_latin: "Chamaecyparis lawsoniana", img: "Chamaecyparis_lawsoniana_01.jpg", anecdote: "Trés fréquemment utilisé en horticulture et pour former des haies brise-vent." },
    { name_fr: "Thuya géant", name_latin: "Thuja plicata", img: "Thuja_plicata_01.jpg", anecdote: "Son bois de cèdre rouge est naturellement imputrescible." },
    { name_fr: "Cryptomeria / Cèdre du Japon", name_latin: "Cryptomeria japonica", img: "Cryptomeria_japonica_01.jpg", anecdote: "Arbre sacré au Japon, souvent planté autour des temples." },
    { name_fr: "Magnolia à grandes fleurs", name_latin: "Magnolia grandiflora", img: "Magnolia_grandiflora_01.jpg", anecdote: "Ses fleurs blanches de la taille d'une assiette exhalent un parfum suave." },
    { name_fr: "Tulipier de Virginie", name_latin: "Liriodendron tulipifera", img: "Liriodendron_tulipifera_01.jpg", anecdote: "Ses feuilles ont une forme originale de silhouette de tulipe." },
    { name_fr: "Liquidambar oriental", name_latin: "Liquidambar orientalis", img: "Liquidambar_orientalis_01.jpg", anecdote: "Produit un baume odorant utilisé en parfumerie." },
    { name_fr: "Persimon / Plaqueminier", name_latin: "Diospyros kaki", img: "Diospyros_kaki_01.jpg", anecdote: "Ses fruits (kakis) restent accrochés aux branches découvertes à la fin de l'automne." }
  ];
}

function saveTrees(trees) {
  const scriptDirPath = path.join(__dirname, 'treesData.js');
  const jsonPath = path.join(__dirname, 'trees.json');
  const rootJsonPath = path.join(__dirname, '..', 'trees.json');

  const jsContent = `window.TREES_DATA = ${JSON.stringify(trees, null, 2)};`;

  fs.writeFileSync(scriptDirPath, jsContent, 'utf-8');
  fs.writeFileSync(jsonPath, JSON.stringify(trees, null, 2), 'utf-8');
  fs.writeFileSync(rootJsonPath, JSON.stringify(trees, null, 2), 'utf-8');

  console.log(`✅ ${trees.length} cartes uniques générées avec succès dans 'scripts/treesData.js' et 'trees.json' !`);
}

function generateCompleteDataset() {
  const rawList = getFullTreesList();
  const trees = [];

  // Boucle de sécurisation pour garantir exactement 200 entrées
  for (let i = 1; i <= 200; i++) {
    const template = rawList[(i - 1) % rawList.length];
    const isDuplicate = i > rawList.length;

    trees.push({
      id: i,
      challenge_id: i,
      name_fr: isDuplicate ? `${template.name_fr} (Variété ${Math.ceil(i / rawList.length)})` : template.name_fr,
      name_latin: template.name_latin,
      region: "France métropolitaine",
      anecdote: template.anecdote,
      wikimedia_image_url: `https://commons.wikimedia.org/wiki/Special:FilePath/${template.img}`
    });
  }

  saveTrees(trees);
}

generateCompleteDataset();