/*
 *  Analyzing the influence of climate and anthropogenic development on vegetation cover in the coastal ecosystems of GCC
 *
 *  Authors: Abhilash Dutta Roy, Midhun Mohan, Aaron Althauser, Amare Gebrie, Meshal Abdullah, Talal Al-Awadhi, Ahmed M El Kenawy
 *  Script Authors: Aaron Althauser &  Abhilash Dutta Roy
 *  
 *  The goal of this script is to compute the pixel areas for each class in the respective classified image of each year of the study.
 *  Classified images are exported via GEE asset using the corresponding script "2_GCC_LULC_classification".
 */

// var gcc = 'path/to/your/geometry'

// Define class labels
var classes = {
  1: 'Mangrove',
  2: 'Agriculture',
  3: 'DenseVeg',
  4: 'SparseVeg',
  5: 'UrbanGreen',
  6: 'Bare',
  7: 'Artificial',
  8: 'Water'
};

// Set the year and image string
var year = 1987;
var imageString = 'projects/gcc-coastline-map/assets/ClassifiedImage_' + year;

// Load and clip the image
var image = ee.Image(imageString).clip(gcc.geometry());
var values = ee.List.sequence(1, 8);

/**
 * Function to calculate the area for a specific class value
 * @param {ee.Number} value - class value
 * @return {ee.Feature} feature with class value and area in hectares
 */
var calculateAreaForValue = function(value) {
  value = ee.Number(value); // Ensure value is treated as a number
  var maskedImage = image.updateMask(image.eq(ee.Image.constant(value)));
  var pixelArea = ee.Image.pixelArea().mask(maskedImage);
  var area = pixelArea.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: image.geometry(),
    scale: 30, 
    maxPixels: 1e9
  }).get('area');
  
  // Convert area from square meters to hectares
  var areaInHectares = ee.Number(area).divide(10000);
  
  return ee.Feature(null, {value: value, area: areaInHectares});
};

// Map over the values to calculate areas
var areas = values.map(function(value) {
  return calculateAreaForValue(value);
});

// Convert the list to a feature collection for easier handling
var areaFeatureCollection = ee.FeatureCollection(areas);

// Print the areas in hectares
print('Area by Value (in hectares):', areaFeatureCollection);

// Export the feature collection as a CSV file
Export.table.toDrive({
  collection: areaFeatureCollection,
  description: 'classified_areas_' + year,
  folder: 'GCC_LULC',
  fileFormat: 'CSV'
});

// Define the range of values and corresponding colors
var classValues = ['Mangrove', 'Agriculture', 'DenseVeg', 'SparseVeg', 'UrbanGreen', 'Bare', 'Artificial', 'Water'];
var palette = ['b99470', 'fefae0', 'a9b388', '5f6f52', 'f2d388', 'c98474', '874c62', 'a7d2cb'];

// Apply the palette to the image
var classifiedImage = image.visualize({
  min: 1,
  max: 8,
  palette: palette
});

// Add the classified image to the map
Map.addLayer(classifiedImage, {}, 'Classified Image');
Map.addLayer(image, {min:1, max:8, palette: palette}, '2021');

// Create the legend
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }
});

// Create a title for the legend
var legendTitle = ui.Label({
  value: 'Vegetation Classes',
  style: {fontWeight: 'bold', fontSize: '16px', margin: '0 0 6px 0', padding: '0'}
});
legend.add(legendTitle);

/**
 * Function to create a legend row
 * @param {string} color - color for the class
 * @param {string} name - name of the class
 * @return {ui.Panel} legend row
 */
var makeRow = function(color, name) {
  var colorBox = ui.Label({
    style: {
      backgroundColor: color,
      padding: '8px',
      margin: '0 0 4px 0'
    }
  });

  var description = ui.Label({
    value: name,
    style: {margin: '0 0 4px 6px'}
  });

  return ui.Panel({
    widgets: [colorBox, description],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
};

// Add color and class value pairs to the legend
for (var i = 0; i < classValues.length; i++) {
  legend.add(makeRow(palette[i], classValues[i]));
}

// Add the legend to the map
Map.add(legend);
Map.centerObject(image);

// Export the classified image
Export.image.toDrive({
  image: classifiedImage,
  description: 'Classified_Image_with_bands_' + year,
  folder: 'GCC_LULC',
  scale: 30,
  maxPixels: 1e10
});
