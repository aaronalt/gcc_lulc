/*
 *  Analyzing the influence of climate and anthropogenic development on vegetation cover in the coastal ecosystems of GCC
 *
 *  Authors: Abhilash Dutta Roy, Midhun Mohan, Aaron Althauser, Amare Gebrie, Meshal Abdullah, Talal Al-Awadhi, Ahmed M El Kenawy
 *  Script Authors: Aaron Althauser &  Abhilash Dutta Roy
 *  
 *  The goal of this script is to classify yearly image composites into identified classes using the Random Forest algorithm.
 *  Image composites are taken from the corresponding script "1_GCC_LULC_featureCorrelation". Images are exported as GEE assets for area computation.
 */

// Define the year and sensor used for the analysis
var year = 2016;
var sensor = 'L8';
var region = gcc.geometry() // Define study region boundaries through imports

// Clip the image to the region of interest
var imageString = 'path/to/your/image' + year;
var composite = ee.Image(imageString);
var image = composite.clip(region);

// Assemble the training data from various classes
var classes = training_data

// Add training samples to the map for visualization
Map.addLayer(classes, {
  palette: ['FF0000', '#7CFC00'],
  min: 1, max: 8
}, 'training_samples');

/**
 * Function to convert 'landcover' property to float
 * @param {ee.Feature} feature - feature with 'landcover' property
 * @return {ee.Feature} feature with 'landcover' property converted to float
 */
var convertLandcoverToFloat = function(feature) {
  var landcover = feature.get('landcover');

  // Check if landcover is a string, convert it to number if true
  if (typeof landcover === 'string') {
    landcover = ee.Number.parse(landcover);
  }

  // Convert to float (if not already parsed correctly)
  var landcoverFloat = ee.Number(landcover);

  return feature.set('landcover', landcoverFloat);
};

// Apply the conversion function to each feature in the collection
var updatedFeatureCollection = classes.map(convertLandcoverToFloat);
print(updatedFeatureCollection);

// Define the bands to be included in the model
var bands = ['NDVI', 'EVI', 'MVI', 'MSI', 'elevation', 'slope'];

// Assemble samples for the model
var samples = image.sampleRegions({
  collection: updatedFeatureCollection,
  properties: ['landcover'],
  scale: 30,
  geometries: true
}).randomColumn('random', 100, 'normal');
print('samples ', samples.first());

// Split training data for testing
var split = 0.7;
var training = samples.filter(ee.Filter.lt('random', split));
var testing = samples.filter(ee.Filter.gte('random', split));
var trainFeatures = training.select([
  'NDVI', 'EVI', 'MVI', 'MSI', 'elevation', 'slope', 'landcover'
]);

// Get an array of 'landcover' values from the training dataset
var landcoverValues = training.aggregate_array('landcover');

// Function to count occurrences of each class
landcoverValues.evaluate(function(values) {
  var counts = {};
  var trainSampleCounts = {};
  values.forEach(function(value) {
    counts[value] = (counts[value] || 0) + 1;
  });

  // Print the number of samples per class in the training set
  for (var key in counts) {
    if (counts.hasOwnProperty(key)) {
      trainSampleCounts[key] = counts[key];
      print(key, counts[key]);
    }
  }
});

////////////////////////////////////////  
/*    Classification    */
////////////////////////////////////////

// Train Random Forest with best hyperparameters
var trainedRF = ee.Classifier.smileRandomForest(100).train({
  features: trainFeatures,
  classProperty: 'landcover',
  inputProperties: bands,
});

// Classify testing set using the trained model
var classifiedRF = testing.classify(trainedRF);

// Compute error metrics
var confusionMatrixRF = classifiedRF.errorMatrix({actual: 'landcover', predicted: 'classification'});
var precisionRF = confusionMatrixRF.consumersAccuracy();
var recallRF = confusionMatrixRF.producersAccuracy();
var fscoreRF = confusionMatrixRF.fscore();
var kappaRF = confusionMatrixRF.kappa();
var overallAccuracyRF = confusionMatrixRF.accuracy();
var overallRecallRF = confusionMatrixRF.consumersAccuracy();
var explainRF = trainedRF.explain();
var schemaRF = trainedRF.schema();
var matrixArray = confusionMatrixRF.array();
var confusionMatrixRFPrinted = confusionMatrixRF.array();

// Add results to a dictionary
var results = ee.Feature(null, {
  'RF_modelSchema': schemaRF,
  'RF_recall': recallRF,
  'RF_precision': precisionRF,
  'RF_fscore': fscoreRF,
  'RF_kappa': kappaRF,
  'RF_overall_precision': overallAccuracyRF,
  'RF_overall_recall': overallRecallRF,
  'RF_confusionMatrix': confusionMatrixRFPrinted
});

// Export the classification results as a CSV file
var featureCollectionClassification = ee.FeatureCollection(results);
Export.table.toDrive({
  collection: featureCollectionClassification,
  description: 'classificationResults__' + year,
  folder: 'GCC_LULC',
  fileFormat: 'CSV'
});

// Classify the image
var classified = image.classify(trainedRF);

// Display the results
Map.centerObject(image, 10);
Map.addLayer(classified, {min: 0, max: 1, palette: ['red', 'green']}, 'Classified Image');

// Export the classified image
Export.image.toAsset({
  image: classified.clip(region),
  description: 'ClassifiedImage_' + year + '_619',
  scale: 30,
  region: region,
  maxPixels: 1e10
});

// Collect and export model metrics in a Dictionary
var classificationMetrics = {
  'year': year,
  'imageId': imageString,
  'testSetN': testing.aggregate_count('.all'),
  'trainSetN': training.aggregate_count('.all'),
  'totalSamples': samples.aggregate_count('.all'),
  'trainTestSplit': split,
  'bands': bands,
  'RF_modelSchema': schemaRF,
  'RF_recall': recallRF,
  'RF_precision': precisionRF,
  'RF_fscore': fscoreRF,
  'RF_kappa': kappaRF,
  'RF_overall_precision': overallAccuracyRF,
  'RF_overall_recall': overallRecallRF,
  'RF_confusionMatrix': confusionMatrixRFPrinted,
};

// Convert the dictionary to a FeatureCollection
var features = [];
for (var key in classificationMetrics) {
  var feature = ee.Feature(null, {
    'metric': key,
    'value': classificationMetrics[key]
  });
  features.push(feature);
}

var featureCollection = ee.FeatureCollection(features);

// Export the classification metrics as a CSV file
Export.table.toDrive({
  collection: featureCollection,
  description: 'classification_metrics_' + year,
  fileFormat: 'CSV',
  priority: 5
});
