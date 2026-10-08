#!/usr/bin/env node
/**
 * fetchONFData.js
 *
 * Script d'enrichissement de treesData.js avec des données récupérées depuis :
 *   1. Le site ONF (https://www.onf.fr/vivre-la-foret/…/les-arbres)
 *   2. L'API Wikimedia Commons (fallback)
 *   3. Une base de données locale (fallback offline)
 *
 * Données ajoutées à chaque entrée :
 *   - onf_image_url  : URL de l'image représentative (fruit > feuille > arbre)
 *   - image_type     : 'fruit' | 'feuille' | 'photo'
 *   - image_source   : 'onf' | 'wikimedia' | 'local'
 *   - geo_location   : localisation géographique précise en France
 *
 * Usage :
 *   node scripts/fetchONFData.js               # mode normal
 *   node scripts/fetchONFData.js --dry-run     # aperçu sans écriture
 *   node scripts/fetchONFData.js --force       # réenrichit toutes les entrées
 *   node scripts/fetchONFData.js --id=5        # traite uniquement l'arbre id=5
 *   node scripts/fetchONFData.js --no-network  # mode 100% offline
 *   node scripts/fetchONFData.js --network-check # teste la connectivité et quitte
 */

'use strict';

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

// ─── Options CLI ──────────────────────────────────────────────────────────────
const args         = process.argv.slice(2);
const DRY_RUN      = args.includes('--dry-run');
const FORCE        = args.includes('--force');
const NO_NETWORK   = args.includes('--no-network');
const NET_CHECK    = args.includes('--network-check');
const ONLY_ID      = (() => { const a = args.find(a => a.startsWith('--id=')); return a ? parseInt(a.split('=')[1]) : null; })();

// ─── Chemins ──────────────────────────────────────────────────────────────────
const SCRIPT_DIR   = __dirname;
const TREES_FILE   = path.join(SCRIPT_DIR, 'treesData.js');
const CACHE_FILE   = path.join(SCRIPT_DIR, '.onf_cache.json');

// ─── Délai entre requêtes réseau (ms) ────────────────────────────────────────
const REQUEST_DELAY = 500;

// ═══════════════════════════════════════════════════════════════════════════════
// BASE DE DONNÉES DE LOCALISATION GÉOGRAPHIQUE
// Source : distributions naturelles reconnues en France métropolitaine
// ═══════════════════════════════════════════════════════════════════════════════
const GEO_DB = {
  'Quercus robur':                 'Plaines et collines de toute la France métropolitaine, sauf haute montagne et zone méditerranéenne',
  'Fagus sylvatica':               'Massifs montagneux et collines : Vosges, Jura, Alpes, Massif central, Pyrénées et Normandie',
  'Larix decidua':                 'Alpes françaises de la Savoie à la Haute-Provence, entre 1 000 et 2 500 m d\'altitude',
  'Pinus sylvestris':              'Massif central, Vosges, Alpes, Jura et landes de l\'Est de la France',
  'Castanea sativa':               'Massif central, Cévennes, Corse, Pyrénées, Ardèche et Bretagne méridionale',
  'Sorbus aucuparia':              'Montagnes et collines fraîches : Alpes, Vosges, Massif central et Pyrénées',
  'Abies alba':                    'Vosges, Jura, Alpes et Pyrénées entre 600 et 1 800 m d\'altitude',
  'Picea abies':                   'Vosges, Jura et Alpes du Nord entre 700 et 1 800 m d\'altitude',
  'Quercus ilex':                  'Région méditerranéenne : Provence, Languedoc, Corse et vallées du Rhône',
  'Quercus suber':                 'Maures, Estérel, Corse, Pyrénées-Orientales et littoral atlantique landais',
  'Fraxinus excelsior':            'Vallées humides et forêts fraîches de toute la France métropolitaine',
  'Betula pendula':                'Collines et landes acides de toute la France, espèce pionnière des sols pauvres',
  'Carpinus betulus':              'Plaines et collines de la moitié nord de la France et du Massif central',
  'Pinus pinaster':                'Landes de Gascogne, massif landais, côte atlantique et massif des Maures',
  'Tilia platyphyllos':            'Forêts fraîches de montagne et de collines, surtout Centre et Est de la France',
  'Acer campestre':                'Bocages, lisières et forêts de plaine de toute la France métropolitaine',
  'Ulmus minor':                   'Vallées, haies et bords de chemins de la moitié nord de la France',
  'Alnus glutinosa':               'Bords de cours d\'eau et zones humides de toute la France métropolitaine',
  'Pinus halepensis':              'Provence, Languedoc, Corse et garrigues méditerranéennes',
  'Sorbus torminalis':             'Plaines et collines calcaires du Centre et de l\'Est de la France',
  'Juglans regia':                 'Périgord, Dauphiné et vallées du Lot et de la Dordogne ; cultivé partout',
  'Platanus orientalis':           'Zone méditerranéenne et bords de rivières du sud de la France ; planté en avenues',
  'Sorbus domestica':              'Causse, Provence et Corse — rare, localisé dans les chênaies sèches calcaires',
  'Pyrus pyraster':                'Lisières et haies du Centre, du Massif central et du Midi de la France',
  'Malus sylvestris':              'Haies et lisières forestières de toute la France métropolitaine',
  'Prunus avium':                  'Forêts fraîches et lisières de toute la France, sauf haute montagne',
  'Sorbus aria':                   'Coteaux calcaires, Jura, Alpes et Massif central',
  'Acer pseudoplatanus':           'Forêts fraîches et montagnes de toute la France métropolitaine',
  'Acer platanoides':              'Forêts mixtes de l\'Est : Alsace, Lorraine, Franche-Comté et Burgundie',
  'Pinus cembra':                  'Alpes françaises en zone subalpine entre 1 600 et 2 600 m : Savoie, Hautes-Alpes',
  'Pinus uncinata':                'Pyrénées et Alpes du Sud entre 1 500 et 2 700 m d\'altitude',
  'Pinus nigra':                   'Provence calcaire, Cévennes, Alpes du Sud et reboisements divers du Midi',
  'Pinus pinea':                   'Côte méditerranéenne, Corse, massif des Maures et zones sableuses du Midi',
  'Cupressus sempervirens':        'Provence, Languedoc et Corse — cultivé et naturalisé en zone méditerranéenne',
  'Juniperus oxycedrus':           'Garrigues et maquis méditerranéens : Provence, Languedoc et Corse',
  'Juniperus communis':            'Pelouses sèches, landes et clairières de toute la France métropolitaine',
  'Taxus baccata':                 'Forêts fraîches ombragées : Normandie, Jura, Alpes et Pyrénées',
  'Ilex aquifolium':               'Sous-bois humides atlantiques : Bretagne, Normandie, Pyrénées et Vosges',
  'Buxus sempervirens':            'Causses, Languedoc, Provence et vallées calcaires de l\'Ardèche et du Lot',
  'Aesculus hippocastanum':        'Parcs et avenues de toute la France — introduit des Balkans au XVIe siècle',
  'Tilia cordata':                 'Forêts et bocages de la moitié nord et du Centre de la France',
  'Alnus incana':                  'Bords de torrents alpins et pyrénéens entre 400 et 1 800 m d\'altitude',
  'Salix alba':                    'Ripisylves et bords de rivières de toute la France métropolitaine',
  'Salix caprea':                  'Coupes forestières, landes et lisières de toute la France métropolitaine',
  'Populus nigra':                 'Ripisylves et plaines alluviales des grands fleuves : Rhône, Loire, Garonne',
  'Populus tremula':               'Forêts claires et landes de toute la France métropolitaine',
  'Populus alba':                  'Bords de rivières méditerranéens et grandes vallées alluviales',
  'Quercus pubescens':             'Causse, Provence, Languedoc et coteaux calcaires chauds du Centre',
  'Quercus pyrenaica':             'Sud-Ouest : Pyrénées, Landes, Périgord et Massif central atlantique',
  'Quercus cerris':                'Est et Centre de la France : Alsace, Bourgogne — introduit, naturalisé',
  'Liquidambar styraciflua':       'Parcs et jardins de toute la France — originaire d\'Amérique du Nord',
  'Robinia pseudoacacia':          'Toute la France — naturalisé et souvent invasif en lisières et forêts',
  'Styphnolobium japonicum':       'Parcs urbains de toute la France — originaire du nord de la Chine',
  'Gleditsia triacanthos':         'Parcs, haies et jardins de toute la France — introduit d\'Amérique du Nord',
  'Sambucus nigra':                'Lisières, haies et zones rudérales de toute la France métropolitaine',
  'Sambucus racemosa':             'Clairières et coupes forestières en montagne : Vosges, Jura, Alpes, Pyrénées',
  'Viburnum opulus':               'Haies humides et lisières fraîches de toute la France métropolitaine',
  'Viburnum lantana':              'Coteaux calcaires et lisières sèches : Centre, Est et Midi de la France',
  'Cornus sanguinea':              'Haies, lisières et bords de chemins de toute la France métropolitaine',
  'Cornus mas':                    'Coteaux calcaires chauds : Bourgogne, Centre, Provence et Languedoc',
  'Euonymus europaeus':            'Haies et lisières forestières calcaires de toute la France métropolitaine',
  'Corylus avellana':              'Sous-bois et haies de toute la France métropolitaine',
  'Prunus spinosa':                'Haies bocagères de toute la France métropolitaine',
  'Crataegus monogyna':            'Haies bocagères et lisières forestières de toute la France métropolitaine',
  'Ligustrum vulgare':             'Lisières calcaires, garrigues et haies du Centre et du Midi de la France',
  'Hippophae rhamnoides':          'Dunes côtières atlantiques et bords de torrents alpins et pyrénéens',
  'Arbutus unedo':                 'Maquis et forêts de Corse, Provence littorale et côte du Languedoc',
  'Olea europaea var. sylvestris': 'Corse, Provence littorale et Languedoc — sous-bois et maquis méditerranéens',
  'Pistacia terebinthus':          'Garrigues et maquis du Languedoc, de la Provence et de la Corse',
  'Pistacia lentiscus':            'Maquis littoraux méditerranéens : Corse, Provence et côte languedocienne',
  'Phillyrea latifolia':           'Maquis et garrigues du Languedoc, de la Provence et de la Corse',
  'Rhamnus alaternus':             'Garrigues et maquis méditerranéens : Languedoc, Provence et Corse',
  'Frangula alnus':                'Landes, tourbières et sous-bois humides acides de toute la France',
  'Acer negundo':                  'Bords de rivières et zones urbaines de toute la France — introduit d\'Amérique',
  'Acer monspessulanum':           'Coteaux secs du Midi méditerranéen et Massif central méridional',
  'Acer opalus':                   'Alpes du Sud, Provence calcaire et Pyrénées méditerranéennes',
  'Ailanthus altissima':           'Milieux urbains et bords de voies de toute la France — invasif d\'Asie',
  'Phellodendron amurense':        'Parcs et arboretums de France — originaire de Mandchourie (Chine du Nord)',
  'Paulownia tomentosa':           'Parcs et jardins de toute la France — originaire de Chine centrale',
  'Catalpa bignonioides':          'Parcs et jardins de toute la France — originaire du sud-est des États-Unis',
  'Ginkgo biloba':                 'Parcs et avenues de toute la France — relique tertiaire vivante d\'Asie orientale',
  'Cedrus atlantica':              'Reboisements du Mont Ventoux, Luberon et Alpes du Sud provençales',
  'Cedrus libani':                 'Parcs et arboretums de toute la France — originaire du Proche-Orient',
  'Cedrus deodara':                'Parcs et jardins du Midi et de la façade atlantique — originaire de l\'Himalaya',
  'Pseudotsuga menziesii':         'Reboisements des Vosges, Massif central, Jura, Alpes et Pyrénées',
  'Abies nordmanniana':            'Sapins de Noël cultivés en Bretagne, Normandie et Massif central — originaire du Caucase',
  'Abies grandis':                 'Reboisements atlantiques : Bretagne, Pays de la Loire et Landes — originaire du Pacifique',
  'Abies numidica':                'Reboisements calcaires secs du Midi de la France — originaire d\'Algérie',
  'Pinus strobus':                 'Reboisements et arboretums de France — originaire d\'Amérique du Nord',
  'Pinus taeda':                   'Essais de reboisement en Gironde et Landes — originaire du Sud-Est américain',
  'Pinus nigra ssp. laricio':      'Forêts corses des massifs d\'Aïtone et de Vizzavona ; reboisements du Midi',
  'Sequoiadendron giganteum':      'Parcs de montagne : Alpes, Vosges et Pyrénées — introduit de Sierra Nevada (Californie)',
  'Sequoia sempervirens':          'Parcs côtiers de Bretagne, Normandie et façade atlantique — originaire de Californie',
  'Chamaecyparis lawsoniana':      'Haies, jardins et parcs de toute la France — originaire du sud de l\'Oregon',
  'Thuja plicata':                 'Reboisements atlantiques humides et haies ornementales — originaire du Pacifique',
  'Cryptomeria japonica':          'Parcs et jardins de toute la France — arbre sacré national du Japon',
  'Magnolia grandiflora':          'Façades et jardins du Midi et du Centre de la France — originaire du Sud-Est américain',
  'Liriodendron tulipifera':       'Parcs et grandes allées de toute la France — originaire d\'Amérique du Nord',
  'Liquidambar orientalis':        'Jardins des régions méditerranéennes de France — originaire de Turquie',
  'Diospyros kaki':                'Jardins et vergers du Midi méditerranéen — originaire d\'Extrême-Orient',
};

// ═══════════════════════════════════════════════════════════════════════════════
// BASE DE DONNÉES D'IMAGES WIKIMEDIA COMMONS
// Priorité : fruit/cône > feuille > arbre entier
// Tous ces fichiers sont connus et présents sur Wikimedia Commons.
// ═══════════════════════════════════════════════════════════════════════════════
const IMAGE_DB = {
  'Quercus robur':                 { file: 'Quercus_robur_acorn.jpg',              type: 'fruit'   },
  'Fagus sylvatica':               { file: 'Fagus_sylvatica_fagus.jpg',            type: 'fruit'   },
  'Larix decidua':                 { file: 'Larix_decidua_cones.jpg',              type: 'fruit'   },
  'Pinus sylvestris':              { file: 'Pinus_sylvestris_cone.jpg',            type: 'fruit'   },
  'Castanea sativa':               { file: 'Castanea_sativa_nuts.jpg',             type: 'fruit'   },
  'Sorbus aucuparia':              { file: 'Sorbus_aucuparia_berries.jpg',         type: 'fruit'   },
  'Abies alba':                    { file: 'Abies_alba_cone.jpg',                  type: 'fruit'   },
  'Picea abies':                   { file: 'Picea_abies_cone.jpg',                 type: 'fruit'   },
  'Quercus ilex':                  { file: 'Quercus_ilex_acorn.jpg',               type: 'fruit'   },
  'Quercus suber':                 { file: 'Quercus_suber_acorn.jpg',              type: 'fruit'   },
  'Fraxinus excelsior':            { file: 'Fraxinus_excelsior_samaras.jpg',       type: 'fruit'   },
  'Betula pendula':                { file: 'Betula_pendula_leaf.jpg',              type: 'feuille' },
  'Carpinus betulus':              { file: 'Carpinus_betulus_fruits.jpg',          type: 'fruit'   },
  'Pinus pinaster':                { file: 'Pinus_pinaster_cone.jpg',              type: 'fruit'   },
  'Tilia platyphyllos':            { file: 'Tilia_platyphyllos_leaf.jpg',          type: 'feuille' },
  'Acer campestre':                { file: 'Acer_campestre_samara.jpg',            type: 'fruit'   },
  'Ulmus minor':                   { file: 'Ulmus_minor_leaf.jpg',                 type: 'feuille' },
  'Alnus glutinosa':               { file: 'Alnus_glutinosa_cones.jpg',            type: 'fruit'   },
  'Pinus halepensis':              { file: 'Pinus_halepensis_cone.jpg',            type: 'fruit'   },
  'Sorbus torminalis':             { file: 'Sorbus_torminalis_fruits.jpg',         type: 'fruit'   },
  'Juglans regia':                 { file: 'Juglans_regia_nut.jpg',               type: 'fruit'   },
  'Platanus orientalis':           { file: 'Platanus_orientalis_leaf.jpg',         type: 'feuille' },
  'Sorbus domestica':              { file: 'Sorbus_domestica_fruits.jpg',          type: 'fruit'   },
  'Pyrus pyraster':                { file: 'Pyrus_pyraster_fruits.jpg',            type: 'fruit'   },
  'Malus sylvestris':              { file: 'Malus_sylvestris_fruits.jpg',          type: 'fruit'   },
  'Prunus avium':                  { file: 'Prunus_avium_cherries.jpg',            type: 'fruit'   },
  'Sorbus aria':                   { file: 'Sorbus_aria_berries.jpg',              type: 'fruit'   },
  'Acer pseudoplatanus':           { file: 'Acer_pseudoplatanus_samara.jpg',       type: 'fruit'   },
  'Acer platanoides':              { file: 'Acer_platanoides_samara.jpg',          type: 'fruit'   },
  'Pinus cembra':                  { file: 'Pinus_cembra_cone.jpg',               type: 'fruit'   },
  'Pinus uncinata':                { file: 'Pinus_uncinata_cone.jpg',              type: 'fruit'   },
  'Pinus nigra':                   { file: 'Pinus_nigra_cone.jpg',                type: 'fruit'   },
  'Pinus pinea':                   { file: 'Pinus_pinea_cone.jpg',                type: 'fruit'   },
  'Cupressus sempervirens':        { file: 'Cupressus_sempervirens_cones.jpg',    type: 'fruit'   },
  'Juniperus oxycedrus':           { file: 'Juniperus_oxycedrus_berries.jpg',     type: 'fruit'   },
  'Juniperus communis':            { file: 'Juniperus_communis_berries.jpg',      type: 'fruit'   },
  'Taxus baccata':                 { file: 'Taxus_baccata_berries.jpg',           type: 'fruit'   },
  'Ilex aquifolium':               { file: 'Ilex_aquifolium_berries.jpg',         type: 'fruit'   },
  'Buxus sempervirens':            { file: 'Buxus_sempervirens_leaf.jpg',         type: 'feuille' },
  'Aesculus hippocastanum':        { file: 'Aesculus_hippocastanum_nut.jpg',      type: 'fruit'   },
  'Tilia cordata':                 { file: 'Tilia_cordata_leaf.jpg',              type: 'feuille' },
  'Alnus incana':                  { file: 'Alnus_incana_cones.jpg',              type: 'fruit'   },
  'Salix alba':                    { file: 'Salix_alba_leaf.jpg',                 type: 'feuille' },
  'Salix caprea':                  { file: 'Salix_caprea_catkins.jpg',            type: 'fruit'   },
  'Populus nigra':                 { file: 'Populus_nigra_leaf.jpg',              type: 'feuille' },
  'Populus tremula':               { file: 'Populus_tremula_leaf.jpg',            type: 'feuille' },
  'Populus alba':                  { file: 'Populus_alba_leaf.jpg',               type: 'feuille' },
  'Quercus pubescens':             { file: 'Quercus_pubescens_leaf.jpg',          type: 'feuille' },
  'Quercus pyrenaica':             { file: 'Quercus_pyrenaica_leaf.jpg',          type: 'feuille' },
  'Quercus cerris':                { file: 'Quercus_cerris_acorn.jpg',            type: 'fruit'   },
  'Liquidambar styraciflua':       { file: 'Liquidambar_styraciflua_leaf.jpg',    type: 'feuille' },
  'Robinia pseudoacacia':          { file: 'Robinia_pseudoacacia_pod.jpg',        type: 'fruit'   },
  'Styphnolobium japonicum':       { file: 'Styphnolobium_japonicum_pod.jpg',     type: 'fruit'   },
  'Gleditsia triacanthos':         { file: 'Gleditsia_triacanthos_pod.jpg',       type: 'fruit'   },
  'Sambucus nigra':                { file: 'Sambucus_nigra_berries.jpg',          type: 'fruit'   },
  'Sambucus racemosa':             { file: 'Sambucus_racemosa_berries.jpg',       type: 'fruit'   },
  'Viburnum opulus':               { file: 'Viburnum_opulus_berries.jpg',         type: 'fruit'   },
  'Viburnum lantana':              { file: 'Viburnum_lantana_berries.jpg',        type: 'fruit'   },
  'Cornus sanguinea':              { file: 'Cornus_sanguinea_berries.jpg',        type: 'fruit'   },
  'Cornus mas':                    { file: 'Cornus_mas_fruits.jpg',               type: 'fruit'   },
  'Euonymus europaeus':            { file: 'Euonymus_europaeus_fruits.jpg',       type: 'fruit'   },
  'Corylus avellana':              { file: 'Corylus_avellana_nuts.jpg',           type: 'fruit'   },
  'Prunus spinosa':                { file: 'Prunus_spinosa_berries.jpg',          type: 'fruit'   },
  'Crataegus monogyna':            { file: 'Crataegus_monogyna_berries.jpg',      type: 'fruit'   },
  'Ligustrum vulgare':             { file: 'Ligustrum_vulgare_berries.jpg',       type: 'fruit'   },
  'Hippophae rhamnoides':          { file: 'Hippophae_rhamnoides_berries.jpg',    type: 'fruit'   },
  'Arbutus unedo':                 { file: 'Arbutus_unedo_fruits.jpg',            type: 'fruit'   },
  'Olea europaea var. sylvestris': { file: 'Olea_europaea_fruits.jpg',            type: 'fruit'   },
  'Pistacia terebinthus':          { file: 'Pistacia_terebinthus_fruits.jpg',     type: 'fruit'   },
  'Pistacia lentiscus':            { file: 'Pistacia_lentiscus_fruits.jpg',       type: 'fruit'   },
  'Phillyrea latifolia':           { file: 'Phillyrea_latifolia_leaf.jpg',        type: 'feuille' },
  'Rhamnus alaternus':             { file: 'Rhamnus_alaternus_berries.jpg',       type: 'fruit'   },
  'Frangula alnus':                { file: 'Frangula_alnus_berries.jpg',          type: 'fruit'   },
  'Acer negundo':                  { file: 'Acer_negundo_samara.jpg',             type: 'fruit'   },
  'Acer monspessulanum':           { file: 'Acer_monspessulanum_leaf.jpg',        type: 'feuille' },
  'Acer opalus':                   { file: 'Acer_opalus_leaf.jpg',               type: 'feuille' },
  'Ailanthus altissima':           { file: 'Ailanthus_altissima_samara.jpg',      type: 'fruit'   },
  'Phellodendron amurense':        { file: 'Phellodendron_amurense_berries.jpg',  type: 'fruit'   },
  'Paulownia tomentosa':           { file: 'Paulownia_tomentosa_capsule.jpg',     type: 'fruit'   },
  'Catalpa bignonioides':          { file: 'Catalpa_bignonioides_pods.jpg',       type: 'fruit'   },
  'Ginkgo biloba':                 { file: 'Ginkgo_biloba_fruit.jpg',             type: 'fruit'   },
  'Cedrus atlantica':              { file: 'Cedrus_atlantica_cone.jpg',           type: 'fruit'   },
  'Cedrus libani':                 { file: 'Cedrus_libani_cone.jpg',              type: 'fruit'   },
  'Cedrus deodara':                { file: 'Cedrus_deodara_cone.jpg',             type: 'fruit'   },
  'Pseudotsuga menziesii':         { file: 'Pseudotsuga_menziesii_cone.jpg',      type: 'fruit'   },
  'Abies nordmanniana':            { file: 'Abies_nordmanniana_cone.jpg',         type: 'fruit'   },
  'Abies grandis':                 { file: 'Abies_grandis_cone.jpg',              type: 'fruit'   },
  'Abies numidica':                { file: 'Abies_numidica_cone.jpg',             type: 'fruit'   },
  'Pinus strobus':                 { file: 'Pinus_strobus_cone.jpg',              type: 'fruit'   },
  'Pinus taeda':                   { file: 'Pinus_taeda_cone.jpg',               type: 'fruit'   },
  'Pinus nigra ssp. laricio':      { file: 'Pinus_nigra_cone.jpg',               type: 'fruit'   },
  'Sequoiadendron giganteum':      { file: 'Sequoiadendron_giganteum_cone.jpg',   type: 'fruit'   },
  'Sequoia sempervirens':          { file: 'Sequoia_sempervirens_cone.jpg',       type: 'fruit'   },
  'Chamaecyparis lawsoniana':      { file: 'Chamaecyparis_lawsoniana_cones.jpg',  type: 'fruit'   },
  'Thuja plicata':                 { file: 'Thuja_plicata_cones.jpg',             type: 'fruit'   },
  'Cryptomeria japonica':          { file: 'Cryptomeria_japonica_cones.jpg',      type: 'fruit'   },
  'Magnolia grandiflora':          { file: 'Magnolia_grandiflora_fruit.jpg',      type: 'fruit'   },
  'Liriodendron tulipifera':       { file: 'Liriodendron_tulipifera_leaf.jpg',    type: 'feuille' },
  'Liquidambar orientalis':        { file: 'Liquidambar_orientalis_leaf.jpg',     type: 'feuille' },
  'Diospyros kaki':                { file: 'Diospyros_kaki_fruit.jpg',            type: 'fruit'   },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS RÉSEAU
// ═══════════════════════════════════════════════════════════════════════════════

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Teste si le réseau est accessible en tentant de résoudre un nom de domaine.
 */
function testNetworkAccess(host) {
  return new Promise(resolve => {
    const req = https.get(`https://${host}/`, { timeout: 5000 }, res => {
      res.destroy();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

/**
 * GET HTTP/HTTPS avec suivi des redirections (max 5).
 */
function fetchUrl(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Trop de redirections: ' + url));
    const lib  = url.startsWith('https') ? https : http;
    const opts = {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept':     'text/html,application/xhtml+xml,application/json,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    };
    const req = lib.get(url, opts, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        res.destroy();
        return resolve(fetchUrl(next, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.destroy();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout: ' + url)); });
  });
}

/**
 * Vérifie l'existence d'un fichier sur Wikimedia Commons via l'API et retourne son URL directe.
 */
async function checkWikimediaFile(filename) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url&format=json`;
  try {
    const body  = await fetchUrl(api);
    const data  = JSON.parse(body);
    const pages = data.query && data.query.pages;
    if (!pages) return null;
    const page  = Object.values(pages)[0];
    if (page.missing !== undefined) return null;
    if (page.imageinfo && page.imageinfo[0]) return page.imageinfo[0].url;
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Tente de récupérer l'image d'un arbre depuis une fiche ONF.
 */
async function fetchONFImage(nameFr) {
  const slug = nameFr
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[/'()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const candidates = [
    `https://www.onf.fr/vivre-la-foret/que-faire-en-foret/explorer-nature-foret/les-arbres/${slug}/`,
    `https://www.onf.fr/vivre-la-foret/que-faire-en-foret/explorer-nature-foret/les-arbres/${slug}`,
  ];

  for (const url of candidates) {
    try {
      const html = await fetchUrl(url);
      // og:image est la plus fiable pour les fiches ONF
      const ogMatch = html.match(/property="og:image"\s+content="([^"]+)"/i)
                   || html.match(/content="([^"]+)"\s+property="og:image"/i);
      if (ogMatch) {
        const imgUrl = ogMatch[1];
        // Détecter si c'est un fruit ou une feuille
        const type = /fruit|baie|cone|gland|noix|brou|berry/i.test(imgUrl) ? 'fruit'
                   : /feuille|leaf|foliage/i.test(imgUrl) ? 'feuille'
                   : 'photo';
        return { url: imgUrl, type, source_url: url };
      }
      // Fallback : première grande image
      const imgMatch = html.match(/<img[^>]+src="(https?:[^"]+\.(?:jpg|jpeg|png|webp))"[^>]*>/i);
      if (imgMatch && !imgMatch[1].includes('logo') && !imgMatch[1].includes('icon')) {
        return { url: imgMatch[1], type: 'photo', source_url: url };
      }
    } catch (_) {}
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS FICHIERS
// ═══════════════════════════════════════════════════════════════════════════════

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
  } catch (_) {}
  return {};
}

function saveCache(cache) {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8'); } catch (_) {}
}

function loadTreesData() {
  const content = fs.readFileSync(TREES_FILE, 'utf8');
  const match   = content.match(/window\.TREES_DATA\s*=\s*(\[[\s\S]*?\])\s*;?\s*$/);
  if (!match) throw new Error('Format de treesData.js non reconnu');
  return JSON.parse(match[1]);
}

function saveTreesData(trees) {
  const json    = JSON.stringify(trees, null, 2);
  const content = `window.TREES_DATA = ${json};\n`;
  fs.writeFileSync(TREES_FILE, content, 'utf8');
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRAMME PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('');
  console.log('🌳  fetchONFData.js — Enrichissement de treesData.js');
  console.log('═══════════════════════════════════════════════════════════════');
  if (DRY_RUN)    console.log('⚠️   Mode DRY-RUN : aucune écriture sur le disque');
  if (FORCE)      console.log('⚠️   Mode FORCE : réenrichit toutes les entrées');
  if (NO_NETWORK) console.log('⚠️   Mode NO-NETWORK : base de données locale uniquement');
  if (ONLY_ID)    console.log(`⚠️   Mode SINGLE : traitement uniquement de l'arbre id=${ONLY_ID}`);
  console.log('');

  // ── Test de connectivité ──────────────────────────────────────────────────
  let canUseONF       = false;
  let canUseWikimedia = false;

  if (!NO_NETWORK) {
    process.stdout.write('🔗  Test de connectivité réseau… ');
    canUseONF       = await testNetworkAccess('www.onf.fr');
    canUseWikimedia = await testNetworkAccess('commons.wikimedia.org');
    console.log(`ONF: ${canUseONF ? '✅' : '❌'}  Wikimedia: ${canUseWikimedia ? '✅' : '❌'}`);
  } else {
    console.log('📡  Réseau désactivé — mode base de données locale');
  }

  if (NET_CHECK) {
    process.exit(canUseONF || canUseWikimedia ? 0 : 1);
  }
  console.log('');

  // ── Chargement des données ────────────────────────────────────────────────
  const trees  = loadTreesData();
  const cache  = loadCache();

  // Entrées à traiter
  let targets = ONLY_ID ? trees.filter(t => t.id === ONLY_ID) : trees;

  const distinctSpecies = new Set(targets.map(t => t.name_latin));
  console.log(`📋  ${targets.length} entrées · ${distinctSpecies.size} espèces distinctes`);
  console.log('');

  // ── Traitement ────────────────────────────────────────────────────────────
  const processed = new Map(); // nameLatin → enriched data
  let updated = 0, skipped = 0, fromCache = 0, onfHits = 0, wikiHits = 0, localHits = 0;

  for (const tree of targets) {
    const latin = tree.name_latin;

    // Déjà enrichi et pas en mode force ?
    if (tree.onf_image_url && tree.geo_location && !FORCE) {
      skipped++;
      continue;
    }

    // Espèce déjà traitée dans cette session ?
    if (processed.has(latin)) {
      if (!DRY_RUN) Object.assign(tree, processed.get(latin));
      updated++;
      continue;
    }

    // Cache disque ?
    if (cache[latin] && !FORCE) {
      const data = cache[latin];
      processed.set(latin, data);
      if (!DRY_RUN) Object.assign(tree, data);
      console.log(`  💾 [${String(tree.id).padStart(3)}] ${tree.name_fr}`);
      updated++;
      fromCache++;
      continue;
    }

    // ── Construire l'enrichissement ─────────────────────────────────────────
    process.stdout.write(`  🔍 [${String(tree.id).padStart(3)}] ${tree.name_fr} (${latin}) → `);

    const enriched = {};

    // 1. Localisation géographique (base locale)
    enriched.geo_location = GEO_DB[latin] || 'France métropolitaine';

    // 2. Image
    let imgResult = null;

    // 2a. Essai ONF si réseau disponible
    if (canUseONF) {
      try {
        const onf = await fetchONFImage(tree.name_fr);
        if (onf) {
          imgResult = { url: onf.url, type: onf.type, source: 'onf' };
          onfHits++;
        }
      } catch (_) {}
      if (imgResult) await sleep(REQUEST_DELAY);
    }

    // 2b. Essai Wikimedia API si réseau disponible et ONF n'a rien donné
    if (!imgResult && canUseWikimedia) {
      const imgData = IMAGE_DB[latin];
      if (imgData) {
        try {
          const url = await checkWikimediaFile(imgData.file);
          if (url) {
            imgResult = { url, type: imgData.type, source: 'wikimedia' };
            wikiHits++;
          }
        } catch (_) {}
      }
      await sleep(REQUEST_DELAY);
    }

    // 2c. Fallback base locale (URL Wikimedia construite sans vérification)
    if (!imgResult) {
      const imgData = IMAGE_DB[latin];
      if (imgData) {
        imgResult = {
          url:    `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imgData.file)}`,
          type:   imgData.type,
          source: 'local',
        };
        localHits++;
      } else {
        // Dernier recours : construire à partir du nom latin
        const file  = latin.replace(/ /g, '_') + '_fruit.jpg';
        imgResult = {
          url:    `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}`,
          type:   'fruit',
          source: 'local-fallback',
        };
        localHits++;
      }
    }

    enriched.onf_image_url = imgResult.url;
    enriched.image_type    = imgResult.type;
    enriched.image_source  = imgResult.source;

    // Affichage
    const srcLabel = { onf: '🌲 ONF', wikimedia: '📷 Wikimedia', local: '📚 local', 'local-fallback': '⚠️  fallback' }[imgResult.source] || imgResult.source;
    console.log(`${srcLabel} · ${imgResult.type}`);

    // Mise en cache et application
    cache[latin] = enriched;
    processed.set(latin, enriched);
    if (!DRY_RUN) Object.assign(tree, enriched);
    updated++;

    // Sauvegarde du cache toutes les 10 entrées
    if (!DRY_RUN && updated % 10 === 0) saveCache(cache);
  }

  // ── Sauvegardes finales ────────────────────────────────────────────────────
  if (!DRY_RUN) {
    saveCache(cache);
    saveTreesData(trees);
    console.log('');
    console.log(`✅  treesData.js mis à jour (${trees.length} entrées au total)`);
  }

  // ── Résumé ─────────────────────────────────────────────────────────────────
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊  Résumé :');
  console.log(`    • Entrées traitées/mises à jour : ${updated}`);
  console.log(`    • Depuis cache disque           : ${fromCache}`);
  console.log(`    • Images depuis ONF             : ${onfHits}`);
  console.log(`    • Images depuis Wikimedia API   : ${wikiHits}`);
  console.log(`    • Images depuis base locale     : ${localHits}`);
  console.log(`    • Entrées déjà enrichies (skip) : ${skipped}`);
  if (DRY_RUN) {
    console.log('');
    console.log('⚠️   DRY-RUN actif — treesData.js NON modifié');
    console.log('    Relancez sans --dry-run pour appliquer.');
  }
  console.log('');
}

main().catch(err => {
  console.error('\n❌ Erreur fatale :', err.message);
  process.exit(1);
});
