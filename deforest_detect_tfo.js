// ================================================================
// FOREST CLASSIFICATION, K-FOLD CV, CHANGE DETECTION & EXPORT
// Meghalaya — NICFI Planet Basemaps (Dry Season: Nov–Feb)
// ================================================================

var roi = ee.FeatureCollection("FAO/GAUL/2015/level1")
            .filter(ee.Filter.eq('ADM1_NAME', 'Meghalaya')); // administrative boundary included for meg

var bands = ['R', 'G', 'B', 'N', 'NDVI'];
var K     = 5;   // number of folds 

// ── TRAINING DATA ─────────────────────────────────────────────────
var trainingData = ee.FeatureCollection("users/mariastorch/meg2022_points_only");

var nicfi = ee.ImageCollection("projects/planet-nicfi/assets/basemaps/asia"); //must link tfo account and gee 

// Assign each point a fold index 0–(K-1)
var withFold = trainingData
  .randomColumn('random')
  .map(function(f) {
    var fold = ee.Number(f.get('random')).multiply(K).floor().min(K - 1);
    return f.set('fold', fold);
  });

// Takes a "base year" — Nov of that year through Feb of the next
// e.g. baseyear=2021 → Nov 2021–Feb 2022

var getDrySeasonStack = function(baseYear) {
  var start = ee.Date.fromYMD(baseYear,      11, 1);
  var end   = ee.Date.fromYMD(baseYear + 1,  3,  1);
  var mosaic = nicfi
    .filter(ee.Filter.date(start, end))
    .median()          // median composite across Nov–Feb months
    .clip(roi);
  var ndvi = mosaic.normalizedDifference(['N', 'R']).rename('NDVI');
  return mosaic.addBands(ndvi).select(bands);
};

var stack2021 = getDrySeasonStack(2020);  // Nov 2020 – Feb 2021
var stack2022 = getDrySeasonStack(2021);  // Nov 2021 – Feb 2022

// ── SAMPLE ALL PIXELS ONCE (expensive, do it once) ───────────────
var fullSample = stack2022.sampleRegions({
  collection:  withFold,
  properties:  ['class', 'fold'],
  scale:       4.77
});



// K-FOLD CROSS VALIDATION
// This is a spatial k-fold
// divide Meghalaya into k geographic grid cells and hold out one cell at a 
// time as the test region, the model always has to predict on areas it has 
// never seen spatially, not just points it hasn't seen from the same 
// neighborhood.

print('K-FOLD CROSS-VALIDATION (k = ' + K + ')');

var foldAccuracies = [];

for (var k = 0; k < K; k++) {
  var kTrain = fullSample.filter(ee.Filter.neq('fold', k));
  var kTest  = fullSample.filter(ee.Filter.eq('fold',  k));

  var kClassifier = ee.Classifier.smileRandomForest(100).train({
    features:        kTrain,
    classProperty:   'class',
    inputProperties: bands
  });

  var kValidated = kTest.classify(kClassifier);
  var kMatrix    = kValidated.errorMatrix('class', 'classification');

  print('── Fold ' + (k + 1) + ' ──────────────────────────');
  print('  Confusion Matrix:',    kMatrix);
  print('  Overall Accuracy:',    kMatrix.accuracy());
  print('  Kappa:',               kMatrix.kappa());
  print('  Producers Accuracy:',  kMatrix.producersAccuracy());
  print('  Consumers Accuracy:',  kMatrix.consumersAccuracy());

  foldAccuracies.push(kMatrix.accuracy());
}

// Average OA across folds (client-side mean after .evaluate resolves)
var eeAccuracyList = ee.List(foldAccuracies);
print('Mean Overall Accuracy (k-fold):', eeAccuracyList.reduce(ee.Reducer.mean()));
print('════════════════════════════════════════');


var finalClassifier = ee.Classifier.smileRandomForest(100).train({
  features:        fullSample,
  classProperty:   'class',
  inputProperties: bands
});

// ── CLASSIFY BOTH YEARS ───────────────────────────────────────────
var classified2021 = stack2021.classify(finalClassifier).rename('class_2021');
var classified2022 = stack2022.classify(finalClassifier).rename('class_2022');

// ── CHANGE DETECTION ──────────────────────────────────────────────
var deforestation = classified2021.eq(1)
                      .and(classified2022.eq(2))
                      .selfMask()
                      .rename('deforestation');

var lossStats = ee.Image.pixelArea().divide(10000)
  .updateMask(deforestation)
  .reduceRegion({
    reducer:   ee.Reducer.sum(),
    geometry:  roi,
    scale:     4.77,
    maxPixels: 1e13
  });

print('DEFORESTATION SUMMARY (Dry Season 2021 → 2022)');
print('Total Forest Area Lost (Ha):', ee.Number(lossStats.get('area')).format('%.2f'));

// ── VISUALIZATION ─────────────────────────────────────────────────
var forestPalette = {min: 1, max: 2, palette: ['#228B22', '#D2691E']};
var rgb2022 = nicfi
  .filter(ee.Filter.date('2021-11-01', '2022-03-01'))
  .median().clip(roi);

Map.centerObject(roi, 8);
Map.addLayer(rgb2022,        {bands: ['R','G','B'], min: 0, max: 3000}, 'Planet RGB (dry 2021–22)');
Map.addLayer(classified2021, forestPalette,                              'Forest Map 2021 (dry)',  false);
Map.addLayer(classified2022, forestPalette,                              'Forest Map 2022 (dry)');
Map.addLayer(deforestation,  {palette: ['#FF0000']},                     'Deforestation 2021→2022');

// Exports 
var exportParams = {
  region:    roi.geometry().bounds(),
  scale:     4.77,
  crs:       'EPSG:4326',
  maxPixels: 1e13,
  folder:    'GEE_Meghalaya'
};

Export.image.toDrive({
  image:       classified2022.toByte(),
  description: 'Meghalaya_ForestMap_DrySeason_2022',
  region:      roi.geometry().bounds(),
  scale:       4.77,
  crs:         'EPSG:4326',
  maxPixels:   1e13,
  folder:      'GEE_Meghalaya'
});

Export.image.toDrive({
  image:       classified2021.toByte(),
  description: 'Meghalaya_ForestMap_DrySeason_2021',
  region:      roi.geometry().bounds(),
  scale:       4.77,
  crs:         'EPSG:4326',
  maxPixels:   1e13,
  folder:      'GEE_Meghalaya'
});

Export.image.toDrive({
  image:       deforestation.toByte(),
  description: 'Meghalaya_Deforestation_DrySeason_2021_2022',
  region:      roi.geometry().bounds(),
  scale:       4.77,
  crs:         'EPSG:4326',
  maxPixels:   1e13,
  folder:      'GEE_Meghalaya'
});
