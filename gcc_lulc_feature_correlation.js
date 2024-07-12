/*
 *  Analyzing the influence of climate and anthropogenic development on vegetation cover in the coastal ecosystems of GCC
 *
 *  Authors: Abhilash Dutta Roy, Midhun Mohan, Aaron Althauser, Amare Gebrie, Meshal Abdullah, Talal Al-Awadhi, Ahmed M El Kenawy
 *  Script Authors: Aaron Althauser &  Abhilash Dutta Roy
 *  
 *  The goal of this script is to build composites of Landsat 7/8 images for the scope of the study's years and region.
 *  Images are exported as GEE assets into the specified project folder for classification.
 */

var L8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2");
var L7 = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2");
var L7c2raw = ee.ImageCollection("LANDSAT/LE07/C02/T1");
var dem = ee.Image("NASA/NASADEM_HGT/001");

///////////////////
/* Cloud Masking */
//////////////////

/**
 * Masks clouds and cloud shadows from Landsat 8 images
 * @param {ee.Image} image - Landsat 8 image
 * @return {ee.Image} masked image
 */
function maskL8sr(image) {
  var cloudShadowBitMask = (1 << 3);
  var cloudsBitMask = (1 << 5);
  var qa = image.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
                .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
  return image.updateMask(mask);
}

/**
 * Masks clouds and cloud shadows from Landsat 7 images
 * @param {ee.Image} image - Landsat 7 image
 * @return {ee.Image} masked image
 */
function maskL7sr(image) {
  var qa = image.select('QA_PIXEL');
  var cloud = qa.bitwiseAnd(1 << 5)
                  .and(qa.bitwiseAnd(1 << 7))
                  .or(qa.bitwiseAnd(1 << 3));
  var maskL7 = image.mask().reduce(ee.Reducer.min());
  return image.updateMask(cloud.not()).updateMask(maskL7);
}

//////////////////////////////
/* Adding Spectral Indices */
///////////////////////////////

/**
 * Adds various spectral indices to Landsat 8 images
 * @param {ee.Image} img - Landsat 8 image
 * @return {ee.Image} image with added indices
 */
var addIndicesL8 = function(img) {
  var blue = img.select('SR_B2').rename('blue');
  var green = img.select('SR_B3').rename('green');
  var red = img.select('SR_B4').rename('red');
  var nir = img.select('SR_B5').rename('nir');
  var swir1 = img.select('SR_B6').rename('swir1');
  var swir2 = img.select('SR_B7').rename('swir2');
  var ndvi = img.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
  var ndmi = img.normalizedDifference(['SR_B7', 'SR_B3']).rename('NDMI');
  var ndwi = img.normalizedDifference(['SR_B3', 'SR_B5']).rename('NDWI');
  var mndwi = img.normalizedDifference(['SR_B3', 'SR_B6']).rename('MNDWI');
  var sr = img.select('SR_B5').divide(img.select('SR_B4')).rename('SR');
  var ratio54 = img.select('SR_B6').divide(img.select('SR_B5')).rename('R54');
  var ratio35 = img.select('SR_B4').divide(img.select('SR_B6')).rename('R35');
  var gcvi = img.expression('(NIR/GREEN)-1', {'NIR': img.select('SR_B5'), 'GREEN': img.select('SR_B3')}).rename('GCVI');
  var savi = img.expression('1.5 * (NIR - RED) / (NIR + RED + 0.5)', {'NIR': img.select('SR_B5'), 'RED': img.select('SR_B4')}).rename('SAVI');
  var evi = img.expression('2.5 * (NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1)', {'NIR': img.select('SR_B5'), 'RED': img.select('SR_B4'), 'BLUE': img.select('SR_B2')}).rename('EVI');
  var cmri = ndvi.subtract(ndwi).rename('CMRI');
  var mvi = img.expression('(NIR - GREEN) / (SWIR1 - GREEN)', {'NIR': img.select('SR_B5'), 'GREEN': img.select('SR_B3'), 'SWIR1': img.select('SR_B6')}).rename('MVI');
  var msi = img.expression('(SWIR1) / (NIR)', {'NIR': img.select('SR_B5'), 'SWIR1': img.select('SR_B6')}).rename('MSI');
  var gci = img.expression('(NIR / GREEN) - 1', {'NIR': img.select('SR_B5'), 'GREEN': img.select('SR_B3')}).rename('GCI');
  var bsi = img.expression('((SWIR1 + RED)-(NIR + BLUE))/((SWIR1 + RED)+(NIR + BLUE))', {'NIR': img.select('SR_B5'), 'SWIR1': img.select('SR_B6'), 'RED': img.select('SR_B4'), 'BLUE': img.select('SR_B2')}).rename('BSI');
  var psri = img.expression('(RED - NIR) / GREEN', {'RED': img.select('SR_B4'), 'NIR': img.select('SR_B5'), 'GREEN': img.select('SR_B3')}).rename('PSRI');
  var lai = ndvi.expression('3.618 * NDVI - 0.118', {'NDVI': ndvi}).rename('LAI');
  var slope = ee.Terrain.slope(dem);

  return img.addBands([blue, green, red, nir, swir1, swir2, ndvi, ndmi, ndwi, mndwi, sr, gcvi, savi, evi, mvi, msi, gci, bsi, psri, lai, dem, slope.rename('slope')]);
};

/**
 * Adds various spectral indices to Landsat 5 images
 * @param {ee.Image} img - Landsat 5 image
 * @return {ee.Image} image with added indices
 */
var addIndicesL5 = function(img) {
  var blue = img.select('SR_B1').rename('blue');
  var green = img.select('SR_B2').rename('green');
  var red = img.select('SR_B3').rename('red');
  var nir = img.select('SR_B4').rename('nir');
  var swir1 = img.select('SR_B5').rename('swir1');
  var swir2 = img.select('SR_B7').rename('swir2');
  var ndvi = img.normalizedDifference(['SR_B4', 'SR_B3']).rename('NDVI');
  var ndmi = img.normalizedDifference(['SR_B7', 'SR_B2']).rename('NDMI');
  var ndwi = img.normalizedDifference(['SR_B2', 'SR_B4']).rename('NDWI');
  var mndwi = img.normalizedDifference(['SR_B2', 'SR_B5']).rename('MNDWI');
  var sr = img.select('SR_B4').divide(img.select('SR_B3')).rename('SR');
  var gcvi = img.expression('(NIR/GREEN)-1', {'NIR': img.select('SR_B4'), 'GREEN': img.select('SR_B2')}).rename('GCVI');
  var savi = img.expression('1.5 * (NIR - RED) / (NIR + RED + 0.5)', {'NIR': img.select('SR_B4'), 'RED': img.select('SR_B3')}).rename('SAVI');
  var evi = img.expression('2.5 * (NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1)', {'NIR': img.select('SR_B4'), 'RED': img.select('SR_B3'), 'BLUE': img.select('SR_B1')}).rename('EVI');
  var cmri = ndvi.subtract(ndwi).rename('CMRI');
  var mvi = img.expression('(NIR - GREEN) / (SWIR - GREEN)', {'NIR': img.select('SR_B4'), 'GREEN': img.select('SR_B2'), 'SWIR': img.select('SR_B7')}).rename('MVI');
  var gndvi = img.expression('(NIR - GREEN) / (GREEN - NIR)', {'NIR': img.select('SR_B4'), 'GREEN': img.select('SR_B3')}).rename('GNDVI');
  var avi = img.expression('(NIR * (1 - RED) * (NIR - RED))**1/3', {'NIR': img.select('SR_B4'), 'RED': img.select('SR_B3')}).rename('AVI');
  var msi = img.expression('(SWIR) / (NIR)', {'NIR': img.select('SR_B5'), 'SWIR': img.select('SR_B7')}).rename('MSI');
  var gci = img.expression('(NIR / GREEN) - 1', {'NIR': img.select('SR_B4'), 'GREEN': img.select('SR_B2')}).rename('GCI');
  var bsi = img.expression('((SWIR + RED)-(NIR + BLUE))/((SWIR + RED))+(NIR + BLUE)', {'NIR': img.select('SR_B4'), 'SWIR': img.select('SR_B7'), 'RED': img.select('SR_B3'), 'BLUE': img.select('SR_B1')}).rename('BSI');
  var psri = img.expression('(RED - NIR) / GREEN', {'RED': img.select('SR_B3'), 'NIR': img.select('SR_B4'), 'GREEN': img.select('SR_B2')}).rename('PSRI');
  var lai = ndvi.expression('3.618 * NDVI - 0.118', {'NDVI': ndvi}).rename('LAI');
  var slope = ee.Terrain.slope(dem);

  return img.addBands([blue, green, red, nir, swir1, swir2, ndvi, ndmi, ndwi, mndwi, sr, gcvi, savi, evi, cmri, mvi, gndvi, avi, msi, gci, bsi, psri, lai, dem, slope.rename('slope')]);
};

var correlationMetrics = {};

///////////////////////////////////////
/* Adjust Year and Sensor Parameters */
//////////////////////////////////////
var sensor = L8;
var year_ = 2014;
var year = year_.toString();
var yearNext = (year_ + 1).toString();
var region = gcc.geometry();

/* Apply filters and masks */
var l8Masked = L8.filterBounds(region)
    .filterDate(year, yearNext)
    .filterMetadata('CLOUD_COVER_LAND', 'less_than', 5)
    .map(maskL8sr)
    .map(addIndicesL8);

var l8 = l8Masked.median();

/* Function to fill gaps from Landsat 7 SLC error using focal mean */
function fillGap(image) {
  return image.focal_mean(1.5, 'square', 'pixels', 2).blend(image);
}

var l7Masked = L7.filterBounds(region)
                .filterDate(year, yearNext)
                .filterMetadata('CLOUD_COVER', 'less_than', 5)
                .map(maskL7sr);  
var l7compositeMasked = l7Masked.median().clip(region); 

/* Apply fillGap function to Landsat 7 collection */
var l7Fill = l7Masked.map(fillGap);
var l7compositeFill = l7Fill.median().clip(region);

var bands = ['blue', 'green', 'red', 'nir', 'swir1', 'swir2', 
             'elevation', 'NDVI', 'NDMI', 'NDWI', 'SR', 'GCVI', 
             'SAVI', 'EVI', 'CMRI', 'MVI', 'GNDVI', 'AVI', 'MSI', 
             'GCI', 'BSI', 'PSRI', 'LAI', 'slope'];

var selectedBands = ['NDVI', 'EVI', 'MVI', 'MSI', 'BSI', 'elevation', 'slope'];
var image = l8.select(selectedBands).clip(region);

/* Export the image to an asset */
Export.image.toAsset({
  image: image.toFloat(),
  description: 'Processed_L8_' + year,
  assetId: 'processed_L8_' + year,
  region: region, 
  maxPixels: 1e10,
  scale: 30
});

/////////////////////////
/* Feature Correlation */
/////////////////////////

/* Sample the image */
var sample = image.sample({
  region: region,
  scale: 30,
  numPixels: 100
});

/* Function to calculate Pearson's correlation */
var correlate = ee.Reducer.pearsonsCorrelation();

/* Function to reduce columns */
var reduced = function(b1, b2) {
  return sample.reduceColumns(correlate, [b1, b2]);
};

/* Calculate correlations */
var correlations = ee.List(bands).map(function(band) {
  var correlationsForBand = ee.List(bands).map(function(otherBand) {
    var correlation = reduced(band, otherBand);
    return correlation;
  });
  return correlationsForBand;
});

/* Extract correlation values */
var extractCorrelations = function(item) {
  return ee.List(item).map(function(dict) {
    return ee.Dictionary(dict).get('correlation');
  });
};

var correlationsData = correlations.map(extractCorrelations);
var correlationArray = ee.Array(correlationsData);
var indexedBands = bands.map(function(band, index) {
  return band + '(' + index + ')';
});

/* Create the chart */
var chart = ui.Chart.array.values({
  array: correlationArray,
  axis: 0, 
  xLabels: indexedBands
}).setOptions({
  title: 'Correlation Heatmap',
  hAxis: {title: 'Bands'},
  vAxis: {title: 'Correlation'},
  colors: [
    '#E0FFFF', '#AFEEEE', '#00CED1', '#4682B4', '#5F9EA0', 
    '#00FA9A', '#7CFC00', '#ADFF2F', '#FFFF00', '#FFD700', 
    '#FFA500', '#FF8C00', '#FF4500', '#BDB76B', '#9ACD32', '#6B8E23'
  ]
});

/* Convert ee.Array to ee.List of lists */
var listOfLists = correlationArray.toList();
var features = listOfLists.map(function(list) {
  return ee.Feature(null, {
    'correlations': list
  });
});

/* Convert list of features into a FeatureCollection */
var featureCollection = ee.FeatureCollection(features);

/* Export the feature collection as a CSV file */
Export.table.toDrive({
  collection: featureCollection,
  description: 'ee-chart_correlation_analysis_L8_' + year,
  fileFormat: 'CSV'
});

correlationMetrics[year_] = {
  'PCAimage': pcImage,
  'eigenVectors': eigenVecs,
  'eigenValues': eigenVals,
  'scale': scale,
  'bandNames': bandNames,
  'covarMatrix': covarMatrix,
  'corrMatrix': corrMatrix
};
