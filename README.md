# MPES
Remote sensing random forest model for deforestation in Meghalaya, India

# Meghalaya Forest Cover Classification & Change Detection

Random Forest classification of forest/non-forest land cover in Meghalaya, India
using NICFI Planet basemaps in Google Earth Engine, with dry-season compositing, and
k-fold cross-validation. Time periods for change detection can be changed.

## Study Area
Meghalaya state, Northeast India (`ADM1_NAME = 'Meghalaya'` via FAO GAUL 2015).

## Data Sources
| Source | Description |
|--------|-------------|
| [NICFI Planet Basemaps](https://developers.google.com/earth-engine/datasets/catalog/projects_planet-nicfi_assets_basemaps_asia) | 4.77m monthly composites — R, G, B, NIR bands |
| FAO GAUL 2015 Level 1 | Administrative boundary for Meghalaya ROI |
| `meg2022_points_only` | Labeled training points — see note below |

## Training Data
Training points (`meg2022_points_only`) are stored as a private GEE asset and
are not included in this repository. The asset contains labeled point samples
with two classes:

| Class value | Label |
|-------------|-------|
| 1 | Forest |
| 2 | Non-Forest |

To reproduce results, you will need to either:
- Get access to the asset at `users/mariastorch/meg2022_points_only`
- Use the geojson in this repo
## Methodology
- **Compositing:** Dry-season median composite (November–February) to minimize
  cloud cover 
- **Features:** R, G, B, NIR, NDVI derived from NICFI basemaps
- **Classifier:** Random Forest (100 trees) via `ee.Classifier.smileRandomForest`
- **Validation:** 5-fold cross-validation with random fold assignment
- **Change detection:** Pixel-wise comparison of 2021 and 2022 classified maps;
  deforestation defined as Forest (2021) → Non-Forest (2022)

## Outputs
All outputs export to Google Drive under the folder `GEE_Meghalaya`. Outputs a tif files for classification in both periods as well as deforestation detection (points that are classified as forest in the first period and not forest in the second period)



## Known Limitations
- Classifier is trained on 2022 labels and applied to imagery from other time periods, assuming class spectral signatures are stable across years
