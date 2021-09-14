let fileUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR3kgfxPfF6XL1y4TIcb-lWi9CMNpVFawPoZoHfqlESKAdRpdXGnxT3xhVsw9JPiw_oqxdODvq1PizJ/pub?output=csv'

var excelUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR3kgfxPfF6XL1y4TIcb-lWi9CMNpVFawPoZoHfqlESKAdRpdXGnxT3xhVsw9JPiw_oqxdODvq1PizJ/pub?output=xlsx";
var sheets;
var locationsData;
var cablesDataset;

var locationMarkers = [];
var infoWindow = document.getElementById('info-window');

// access token
mapboxgl.accessToken = 'pk.eyJ1IjoiZGF1ZGk5NyIsImEiOiJjanJtY3B1bjYwZ3F2NGFvOXZ1a29iMmp6In0.9ZdvuGInodgDk7cv-KlujA';

// map instance
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/outdoors-v11',
    center: [1.63272307059878, 53.8414629495329],
    zoom: 10.5
});

map.on('load', function() {
    // load the image
    map.loadImage('pylon.png', function(error , image) {
        if(error) throw error;

        map.addImage('pylon', image);
    });

    // cables
    map.addSource('locations', {
        type:'geojson',
        data:{"type":"FeatureCollection", "features":[]}
    });

    map.addLayer({
        id:'location-layer',
        source:'locations',
        type:'symbol',
        paint:{
            'icon-color':'red',
        },
        layout:{
            visibility:'visible',
            'icon-image':'pylon',
            'icon-size':0.5
        }
    });

    // cables
    map.addSource('cables', {
        type:'geojson',
        data:{"type":"FeatureCollection", "features":[]}
    });

    map.addLayer({
        id:'cable-layer',
        source:'cables',
        type:'line',
        paint:{
            'line-color':['get', 'Color'],
            'line-width':2
        },
        layout:{
            visibility:'visible'
        }
    });

    // read the excel file
    fetch(excelUrl, {
        // mode:'no-cors'
    })
    .then(res => {
        console.log(res);
        if(!res.ok) throw new Error("fetch failed");
        return res.arrayBuffer()
    })
    .then(ab => {
        console.log(ab);
        var data = new Uint8Array(ab);
        var workbook = XLSX.read(data, {type:"array"});

        console.log(workbook);
        sheets = processWorkbook(workbook);

        // add test photos t- 
        sheets['Tests'] = addTestImage(sheets['Tests'], sheets['Test_Photos']);

        // update location information
        sheets['Location'] = extractLatLng(sheets['Location']);
        sheets['Location'] = addLocationTestInfo(sheets['Location'],  sheets['Tests']);
        sheets['Location'] = addLocationPhotos(sheets['Location'], sheets['Photo']);

        // create markers
        locationsData = createLocationGeojson(sheets['Location']);
        map.getSource('locations').setData(locationsData);
        
        // createMarkers(sheets['Location']);
        console.log("Updating location markers");

        // cables
        cablesDataset = cableGeojson(sheets['Location'], sheets['Cable']);
        map.getSource('cables').setData(cablesDataset);

        // 
        console.log("Updating cable layer");

    })
    .catch(error => {
        console.error(error);
    });

    // layer control
    var layerControl = new LayerControl();
    layerControl.init(['cable-layer', 'location-layer'], map);

    // map events 
    map.on("click", 'cable-layer', function(e) {
        console.log(e.lngLat);

        if(e.features[0]) {
            let feature = e.features[0];
            let props = {...feature.properties};

            props.Name = props['Cable Name'];
            props.Field = props['Cable_Field_Link'];
            props['Location_Progress_Status'] = props['Cable_Progress_Status'];

            let popup = createPopup(props);

            popup
                .setLngLat(e.lngLat)
                .addTo(map);

            // open side panel with more info
            populateSidePanelInfo(feature, "Cable");
        }
    });

    // locations popup
    map.on("click", 'location-layer', function(e) {
        if(e.features[0]) {
            let feature = e.features[0];

            let popup = createPopup(feature.properties);
            popup
                .setLngLat(feature.geometry.coordinates)
                .addTo(map);

            console.log(feature);
            // open side panel with more info
            populateSidePanelInfo(feature, "Site");
        }
    });

    map.on("mouseover", 'cable-layer', mouseover);
    map.on("mouseleave", 'cable-layer', mouseleave);

    map.on("mouseover", 'location-layer', mouseover);
    map.on("mouseleave", 'location-layer', mouseleave);

    function mouseover() {
        map.getCanvas().style.cursor = "pointer";
    }

    function mouseleave() {
        map.getCanvas().style.cursor = "";
    }

});

function createMarkers(locations) {
    // let marker;
    locations.forEach(location => {
        let marker = createMarker(location);

        locationMarkers.push(marker);
        marker.addTo(map);
    });
}

function createMarker(location) {
    var divElement = document.createElement('div');
    divElement.classList.add('div-marker');

    divElement.innerHTML = "<img src='/pylon.png' />";

    // marker instance
    var marker = new mapboxgl.Marker({
        element:divElement
    });

    marker.setLngLat([location.lng, location.lat])
    
    let popup = createPopup(location);
    marker.setPopup(popup);
    
    return marker;
}

function createPopup(location) {
    // popup html
    var popupDiv = `<div class='popup-content'>
        <div class='popup-title'><strong>${location['Name']}</strong></div>
        <div class='popup-entry'>Field<b>${location['Field']}</b></div>
        <div class='popup-entry'>Progress Status<b>${location['Location_Progress_Status']}</b></div>
    </div>`;

    let popup = new mapboxgl.Popup()
        .setHTML(popupDiv)
		.setMaxWidth("250px");

    return popup;
}

function populateSidePanelInfo(feature, layer="Site") {
    // console.log(feature);

    infoWindow.innerHTML = "";

    let media = JSON.parse(feature.properties.photos).map((photo, index) => {
        return `<figure>
            <img src="https://picsum.photos/id/${231 + index}/200/200" alt="Trulli" style="width:100%; height:200px" >
            <figcaption>${photo['Photo_Label']}</figcaption>
        </figure>`
    });

    let html = `<div class="info-header">
        <h2>${layer} ${feature.properties['Name']}</h2>
    </div>
    <div class="info-body">
        <div class="general-info">
            <div class="media">
                ${media.join("")}
            </div>
        </div>
    </div>`;


    infoWindow.innerHTML = html;
}
// Module to process to enrich the tables
// create the cables


function processWorkbook(workbook) {
    let sheetsNames = [...workbook.SheetNames];
    let sheets = {};

    sheetsNames.forEach(sheetName => {
        sheets[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    });

    return sheets;
}

function extractLatLng(locationSheet) {
    let locations = JSON.parse(JSON.stringify(locationSheet));

    locations = locations.filter(location => {      

        if(location['Lat Long']) {
            let latLng = location['Lat Long'].split(',');
            location.lat = +latLng[0];
            location.lng = +latLng[1];

            return location;
        }

        return false;
    });


    return locations;
}


function addLocationPhotos(locations, photos) {
    let newLocations = locations.map(location => {
        let locationPhotos = photos.filter(photo => photo['Photo_Location_Link'] == location['Name']);

        location.photos = locationPhotos || [];
        return location;
    });

    return newLocations;
}

// test information
function addTestImage(tests, testImages) {
    let newTests = tests.map(test => {
        let testImage = testImages.filter(testImage => testImage['TestID'] == test['TP_Test_Link']);

        test.testImages = testImage || [];
        return test;
    });

    return newTests;
}

function addLocationTestInfo(locations, tests) {
    let newLocations = locations.map(location => {
        let locationTest = tests.filter(test => test['Testing_Location_Link'] == location['Name']);

        location.test = locationTest || [];

        return location;
    });

    return newLocations;
}

// location geojson
function createLocationGeojson(locations) {
    let features = locations.map(location => {
        return turf.point([location.lng, location.lat], {
            ...location,
            test:[...location.test],
            photos:[...location.photos],
        }
        );
    });

    return turf.featureCollection(features);
}

// cable connection
function cableGeojson(locations, cables) {
    let geojson = {"type":"FeatureCollection", "features":[]};

    let cableData = JSON.parse(JSON.stringify(cablesData));

    cableData.features = cableData.features.filter(cable => {
        // let p1 = locations.find(location => location.Name == cable['Location_A']);
        // let p2 = locations.find(location => location.Name == cable['Location_B']);

        let cableProps = cables.find(cbl => cbl['Cable Name'] == cable.properties['Cable Name'])
        
        if(cableProps){
           cable.properties = {...cable.properties, ...cableProps}
           return cable;
        } else {
            console.log("Missing: ", cableProps)
            return false;
        }
        
    });

    console.log(cableData);

    return cableData;
}

// layer toggler object
var LayerControl = function() {
    this.init = function(layerNames = [], map)  {
        this.layerNames = layerNames;
        this.map = map;
        this.layers = [];

        // handle layer
        if(this.map) {
            this.updateLayerProperties();
            this.handleLayerCheckbox();
        }
       
    }

    this.updateLayerProperties = function() {
        this.layerNames.forEach(name => {
            if(this.isLayerLoaded(name)) {
                let layer = {};
                layer.id = name;
                layer.visibility = this.isLayerVisible(name);

                this.layers.push(layer);
            }
        });
    }

    this.isLayerLoaded = function(layerName) {
        return this.map.getLayer(layerName) ? true : false;
    }

    this.isLayerVisible = function(layerName) {
        let isVisible = map.getLayoutProperty(layerName, 'visibility');
        console.log(isVisible);

        return isVisible == 'visible' ? true : false;
    }

    this.setLayerVisibilty = function(layerId) {
        this.layers = this.layers.map(layer => {
            if(layer.id == layerId) {
                layer.visibility = !layer.visibility;
            }

            return layer;
        });
    }

    this.toggleLayer = function(layer) {
        let visibility = layer.visibility ? 'visible' : 'none';
        this.map.setLayoutProperty(layer.id, 'visibility', visibility);
    }

    this.getLayer = function(layerId) {
        return this.layers.find(layer => layer.id == layerId);
    }


    // handle event listeners
    this.handleLayerCheckbox = function() {
        this.layers.forEach(layer => {
            let checkbox = document.querySelector(`#layers #${layer.id}`);
            checkbox.id = layer.id;

            checkbox.checked = layer.visibility;

            checkbox.onclick = (e) => {
                let layerId = e.target.id;

                console.log("Toggling layer:" + layerId);

                this.setLayerVisibilty(layerId);
                let layer = this.getLayer(e.target.id);

                console.log(layer);
                this.toggleLayer(layer);
            }

            return layer;
        });

        // create the checkboxes
    }


};


// toggle the side tab
var tabButtons = document.querySelectorAll('.tab-item');
let activeOverlaySection;
tabButtons.forEach(tabButton => {
    tabButton.onclick = function(e) {
        let { id } = e.target.dataset;

        if(id == 'refresh-map') {
            window.location.reload();
        } else{
            let element = document.getElementById(`${id}`);
            element.classList.toggle('d-none');

            if(activeOverlaySection) {
                activeOverlaySection.classList.add('d-none');
                activeOverlaySection = element;
            } else{
                activeOverlaySection = element;
            }
        }
        
    }
});


// filter module
var filterRadioBtns = document.querySelectorAll(".progess-filter");
filterRadioBtns.forEach(btn => {
    btn.onclick = function(e) {
        let { progress } = e.target.dataset;

        if(progress == 'All') {
            // display all the data
            map.getSource('cables').setData(cablesDataset);

            map.getSource('locations').setData(locationsData);
        } else {
            // filter the data
            let locations = locationsData.features.filter(location => {
                return location.properties['Location_Progress_Status'] == progress ? location : false; 
            });

            let cables = cablesDataset.features.filter(location => {
                return location.properties['Location_Progress_Status'] == progress ? location : false; 
            });


            // update the sources
            map.getSource('cables').setData(turf.featureCollection(cables));
            map.getSource('locations').setData(turf.featureCollection(locations));
        }
    }
});