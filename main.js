let fileUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR3kgfxPfF6XL1y4TIcb-lWi9CMNpVFawPoZoHfqlESKAdRpdXGnxT3xhVsw9JPiw_oqxdODvq1PizJ/pub?output=csv'

var excelUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR3kgfxPfF6XL1y4TIcb-lWi9CMNpVFawPoZoHfqlESKAdRpdXGnxT3xhVsw9JPiw_oqxdODvq1PizJ/pub?output=xlsx";
var sheets;
var locationsData;
var cablesDataset;

var locationMarkers = [];
var infoBody = document.getElementById('info-body');
var infoWindow = document.getElementById('info-window');

var progressColors = ['#66c2a5','#fc8d62','#8da0cb','#e78ac3'];
var progressStatus = ['Incomplete','In Progress','Pending','Complete'];
var spinner = document.getElementById("loading");

// test instance
var cableTest;
var installationVisual;

// access token
mapboxgl.accessToken = 'pk.eyJ1IjoiZGF1ZGk5NyIsImEiOiJjanJtY3B1bjYwZ3F2NGFvOXZ1a29iMmp6In0.9ZdvuGInodgDk7cv-KlujA';

// map instance
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/outdoors-v11',
    center: [1.5773458126799937, 53.88578000911349],
    zoom: 11.054858191088872
});

map.on('load', function() {
    // load the image
    map.loadImage('wind-turbine.png', function(error , image) {
        if(error) throw error;

        map.addImage('pylon', image, {sdf:true});
    });

    // test layer
    // cableTest.init();

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
            'line-width':1.5
        },
        layout:{
            visibility:'visible'
        }
    });

    // sites
    map.addSource('locations', {
        type:'geojson',
        data:{"type":"FeatureCollection", "features":[]}
    });

    map.addLayer({
        id:'location-layer',
        source:'locations',
        type:'symbol',
        paint:{
            'icon-color':'#444',
        },
        layout:{
            visibility:'visible',
            'icon-image':'pylon',
            'icon-size':0.3
        }
    });

    map.addLayer({
        id:'location-required-images',
        source:'locations',
        type:"circle",
        paint:{
            'circle-radius':18,
            'circle-color':'white'
        },
        layout:{
            'visibility':'none'
        }
    });

    map.addLayer({
        id:'location-required-images_label',
        source:'locations',
        type:"symbol",
        paint:{
            'text-color':'black'
        },
        layout: {
            'text-field': ["get", "images_status"],
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 10,
            'visibility':'none'
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

        sheets['Location'] = addCableCountPerLocation(sheets['Location'], sheets['Cable']);
        sheets['Location'] = addInstallationPhaseInfo(sheets['Location'], sheets['Installation_Phases'], sheets['Field_Reports']);

        // images
        sheets['Location'] = addLocationRequiredImagesInfo(sheets['Location'], sheets['Required_Images']);
        sheets['Location'] = addLocationPhotos(sheets['Location'], sheets['Photo']);

        sheets['Cable'] = addCableInstallationPhaseInfo(sheets['Cable'], sheets['Installation_Phases'], sheets['Field_Reports']);
        sheets['Cable'] =  addCableRequiredImagesInfo(sheets['Cable'], sheets['Required_Images']);
        // sheets['Cable'] = 

        // create markers
        locationsData = createLocationGeojson(sheets['Location']);
        map.getSource('locations').setData(locationsData);
        
        // createMarkers(sheets['Location']);
        installationVisual = new InstallationVisual(locationsData.features);
        installationVisual.init();

        console.log("Updating location markers");

        // cables
        cablesDataset = cableGeojson(sheets['Location'], sheets['Cable'], sheets['Required_Tests'], sheets['Tests']);
        map.getSource('cables').setData(cablesDataset);

        // update the cable with test
        cableTest = new CableTest(cablesDataset.features);
        cableTest.init();

        // cableTest.setCables([...cablesDataset.features]);
        // cableTest.updateTestSource();
        console.log("Updating cable layer");

        // Initial chart
        createProgressChart(getChartValues('Location'), 'Cables');
        updateCounts();

        // close the spinner
        spinner.classList.add('d-none');
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

            props.photos = "[]";

            let popup = createPopup(props);

            popup
                .setLngLat(e.lngLat)
                .addTo(map);

            // open side panel with more info
            populateSidePanelInfo({...feature, properties:props}, "Cable");
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
    console.log(feature);

   infoBody.innerHTML = "";

    let media = JSON.parse(feature.properties.photos).map((photo, index) => {
        return `<figure>
            <img src="https://picsum.photos/id/${231 + index}/200/150" alt="Trulli" style="width:100%; height:150px" >
            <figcaption>${photo['Photo_Label']}</figcaption>
        </figure>`
    });

    let featureInfo = layer == 'Site' ? getLocationInfo(feature) :getCableInfo(feature);

    let infoTitle = document.getElementById('info-title');
    infoTitle.innerHTML = `${layer} ${feature.properties['Name']}`;

    // <div class="media">
    //     ${media[0]}
    // </div>

    let html = `<div class="general-info">
            
        </div>
        ${featureInfo}
    `;

    console.log(feature);
    console.log(layer);

   infoBody.innerHTML = html;
   infoWindow.classList.remove('d-none');

    //toggle
    toggleCollapse();
}

function getCableInfo(feature) {
    let requiredTests = JSON.parse(feature.properties.requiredTest);
    let completeTests = JSON.parse(feature.properties.test);

    let completeValue = JSON.parse(feature.properties.test).length;
    let inCompleteValue = feature.properties.total_test - completeValue;

    let remainingTest = requiredTests.filter(test => {
        let activeTest = completeTests.find(cTest => cTest['Req_Test_Link'] == test['ReqTestID']);

        if(activeTest) {
            return false;
        }

        return test;
    });

    // test
    let completeTestsList = completeTests.map(test => {
        return `<li>${test['Test_Group']}</li>`;
    });

    let remainingTestsList = remainingTest.map(rTest => {
        return `<li>${rTest['Abbreviated Name']}</li>`;
    });

    return `<div class="info-section">
        <h3>General Information</h3>
        <div class="info-items">
            <div class="info-item">
                Progress <b>${feature.properties['Cable_Progress_Status']}</b>
            </div>

            <div class="info-item">
                Site <b>${feature.properties['Cable_Site_Link']}</b>
            </div>

            <div class="info-item">
                Field <b>${feature.properties['Cable_Field_Link']}</b>
            </div>

            <div class="info-item">
                Cable String Link<b>${feature.properties['Cable_String_Link']}</b>
            </div>
        </div>
        </div>

        <div class="info-section">
            <!--  -->
            <h3>Cable Test</h3>
            <div>
                <div>
                    <button type="button" class="collapsible"> ${completeValue} Complete Test</button>
                    <div class="content">
                        ${completeTestsList.join("")}
                    </div>
                </div>

                <div>
                    <button type="button" class="collapsible"> ${inCompleteValue} InComplete Test</button>
                    <div class="content">
                        ${remainingTestsList.join("")}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getLocationInfo(feature) {
    let allPhases = feature.properties.cable_count *  5 + 3;
    console.log(allPhases);

    // locations phases
    let locationPhases = JSON.parse(feature.properties.installationPhases);

    // cable phases
    let cablePhases = JSON.parse(feature.properties.cables);

    // let phases = JSON.parse();
    let cablecompletePhases = cablePhases.reduce((a,b) => {
        a = [...a, ...b.installation.completePhases]
        return a;
    }, []);

    let completeValue = [...locationPhases.completePhases, ...cablecompletePhases].length;
    let inCompleteValue = allPhases - completeValue;

    // complete phases
    let listLocPhases  = `<div>${feature.properties.Name} <br>
        ${locationPhases.completePhases.map(phase => `<li>${phase['Field_Report_Install_Phase_Link']}</li>` ).join("")}
    </div>`;

    let listCablePhases = cablePhases.map(cable => {
        return `<div>${cable.name} <br>
            ${cable.installation.completePhases.map(phase => `<li>${phase['Field_Report_Install_Phase_Link']}</li>` ).join("")}
        </div>`;
    }).join("");

    // incomplete phases
    let locIncompletePhases = locationPhases.required.filter(phase => {
        let phaseEntry = locationPhases.completePhases.find(ph => ph['Field_Report_Install_Phase_Link'] == phase['Field_Report_Install_Phase_Link'])
        
        if(phaseEntry) {
            return false
        }

        return phase;
    });

    let cablesIncompletePhases = cablePhases.map(cable => {
        cable.installation.incompletePhases = cable.installation.required.filter(phase => {
            let phaseEntry = cable.installation.completePhases.find(ph => ph['Field_Report_Install_Phase_Link'] == phase['Field_Report_Install_Phase_Link'])
            
            if(phaseEntry) {
                return false
            }
    
            return phase;
        });

        return cable;
    });

    // incomplete list
    let incompleteLocList = `<div>${feature.properties.Name} <br>
        ${locIncompletePhases.map(phase => `<li>${phase['Installation_Phase_Name']}</li>` ).join("")}
    </div>`;

    let incompleteCableList = cablesIncompletePhases.map(cable => {
        return `<div>${cable.name} <br>
            ${cable.installation.incompletePhases.map(phase => `<li>${phase['Installation_Phase_Name']}</li>` ).join("")}
        </div>`;
    }).join("");

    // Field_Report_Cable_Link
    // let incompletePhases = 

    return `<div class="info-section">
        <h3>General Information</h3>
        <div class="info-items">
            <div class="info-item">
                Progress <b>${feature.properties['Location_Progress_Status']}</b>
            </div>

            <div class="info-item">
                Site <b>${feature.properties['Site']}</b>
            </div>

            <div class="info-item">
                Field <b>${feature.properties['Field']}</b>
            </div>

            <div class="info-item">
                Primary Sub Station <b>${feature.properties['Primary_Sub_Station']}</b>
            </div>

            <div class="info-item">
                Connected Cables <b>${feature.properties['cable_count']}</b>
            </div>
        </div>
    </div>

    <div class="info-section">
        <!--  -->
        <h3>Installation Phases</h3>
        <div class="test-item">
            <div>
                <button type="button" class="collapsible"> ${completeValue} Complete Phases</button>
                <div class="content">
                    ${listLocPhases}
                    ${listCablePhases}
                </div>
            </div>

            <div>
                <button type="button" class="collapsible"> ${inCompleteValue} Incomplete Phases</button>
                <div class="content">
                   ${incompleteLocList}
                   ${incompleteCableList}
                </div>
            </div>
        </div>
    </div>

    <div class="info-section">
        <!--  -->
        <h3>Required Images</h3>
        <div class="test-item">
            <div>${JSON.parse(feature.properties.photos).length} Captured</div>
            <div>${ feature.properties.requiredImagesTotals - JSON.parse(feature.properties.photos).length} Images Remaining</div>
        </div>
    </div>
    `
}

function toggleCollapse() {
    var coll = document.getElementsByClassName("collapsible");
    var i;

    for (i = 0; i < coll.length; i++) {
    coll[i].addEventListener("click", function() {
        this.classList.toggle("active");
        var content = this.nextElementSibling;
        if (content.style.maxHeight){
        content.style.maxHeight = null;
        } else {
        content.style.maxHeight = content.scrollHeight + "px";
        } 
    });
    }
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
    console.log(photos);
    let newLocations = locations.map(location => {
        let ids = location.requiredImages.map(image => image.ReqImagesID);
        let photo = photos.filter(photo => ids.includes(photo.Req_Img_Type));

        let locationPhotos = photo.filter(photo => photo['Photo_Location_Link'] == location['Name']);

        console.log(locationPhotos);

        location.photos = locationPhotos || [];
        location.images_status = location.photos.length + "/" + location.requiredImagesTotals;

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

function addCableCountPerLocation(locations, cables) {
    let newLocation = locations.map(location => {
        let locationCables = cables.filter(cable => cable['Location_A'] == location.Name || cable['Location_B'] == location.Name);

        let cableInfo = locationCables.map(cable => {
            return { name:cable['Cable Name'], cableID:cable['CableID'] }
        });

        location.cables = [...cableInfo];
        location.cable_count = locationCables.length;

        return location;
    });

    return newLocation;
}

function addInstallationPhaseInfo(locations, installation, fieldReports) {
   
    // 
    locations = locations.map(location => {
        if(location.Location_Type == 'OSP') {
            location.installationPhases = getLocationPhases('OSP', location);

            // installation phases per cable
            location.cables = location.cables.map(cable => {
                cable.installation = getCablePhases('TP', cable, location);
                return cable;
            });

            return location;
        }

        if(location.Location_Type == 'Tower') {
            location.installationPhases = getLocationPhases('TP', location);

            // installation phases per cable
            location.cables = location.cables.map(cable => {
                cable.installation = getCablePhases('TP', cable, location);
                return cable;
            });

            return location
        }
        
        location.installationPhases = [];
        return location
    });

    function getLocationPhases(locationType, location) {
        let phases = installation.filter(phase => {
            if(phase.Installation_Phase_Type == locationType && phase.Installation_Requirement == 'Per Location') {
                return phase;
            }

            return false;
        }) || [];

        let phaseIds = phases.map(phase => phase.InstallationPhaseID);

        // console.log(phaseIds);

        let reports = fieldReports.filter(report => {
            if(phaseIds.includes(report.Field_Report_Install_Phase_Link)) {
                return report;
            }

            return false;
        });

        let installationPhases =  reports.filter(report => report.Field_Report_Location_Link == location.Name) || [];
        return {required:[...phases], completePhases:[...installationPhases]};
    }

    function getCablePhases(cableType, cable, location) {
        let phases = installation.filter(phase => {
            if(phase.Installation_Phase_Type == cableType && phase.Installation_Requirement == 'Per Cable' ) {
                return phase;
            }

            return false;
        }) || [];

        let phaseIds = phases.map(phase => phase.InstallationPhaseID);

        // let reports = fieldReports.filter(report => {
        //     if(phaseIds.includes(report.Field_Report_Install_Phase_Link)) {
        //         return report;
        //     }

        //     return false;
        // });

        // console.log(reports);

        let installationPhases =  fieldReports.filter(report => {
            if(report.Field_Report_Cable_Link == cable.cableID  && report.Field_Report_Location_Link == location.Name) {
                return report;
            } 

            return false;
        }) || [];

        return { required: [...phases], completePhases:[...installationPhases]};
    }


    // add cable installation info
    return locations;
}

function addCableInstallationPhaseInfo(cables, installation, fieldReports) {
    // 
    cables = cables.map(cable => {
        // if(cable.Location_Type == 'OSP') {
        //     cable.installationPhases = getCablePhases('OSP', cable);
        //     return cable;
        // }

        // if(cable.Location_Type == 'Tower') {
        //     cable.installationPhases = getCablePhases('TP', cable);
        //     return cable
        // }
        
        cable.installationPhases = getCablePhases('TP', cable) || [];
        return cable
    });

    function getCablePhases(cableType, cable) {
        let phases = installation.filter(phase => {
            if(phase.Installation_Requirement == 'Per Cable') {
                return phase;
            }

            return false;
        }) || [];

        let phaseIds = phases.map(phase => phase.InstallationPhaseID);

        reports = fieldReports.filter(report => {
            if(phaseIds.includes(report.Field_Report_Install_Phase_Link)) {
                return report;
            }

            return false;
        });

        let installationPhases =  reports.filter(report => report.Field_Report_Cable_Link == cable.CableID) || [];
        return installationPhases;
    }


    // add cable installation info
    return cables;
}

function addLocationRequiredImagesInfo(locations, requiredImages, photos) {
    cableImages = requiredImages.filter(rm => rm['Requirement'] == 'Per Cable' && rm['Install_Phase_Type'] == 'TP' && rm['Temp1'] == 'map');
    // let imagesId = requiredImages.map(image => image.ReqImagesID);

    // console.log(cableImages.length);

    // 
    locations = locations.map(location => {
        if(location.Location_Type == 'OSP') {
            locationImages = requiredImages.filter(image => image.Requirement == 'Per Location' && image.Install_Phase_Type == "OSP" && image['Temp1'] == 'map');
            location.requiredImagesTotals = location.cable_count * cableImages.length + locationImages.length;

            location.requiredImages = [...locationImages, ...cableImages];
            return location;
        }

        if(location.Location_Type == 'Tower') {
            locationImages = requiredImages.filter(image => image.Requirement == 'Per Location' && image.Install_Phase_Type == "TP" && image['Temp1'] == 'map');
            console.log(locationImages.length);

            location.requiredImagesTotals = location.cable_count * cableImages.length + locationImages.length;

            // 35 images
            location.requiredImages = [...locationImages, ...cableImages];
            return location;
        }

        location.requiredImages = [];
        return location;
    });

    return locations;
}

function addCableRequiredImagesInfo(cables, requiredImages, photos) {
    requiredImages = requiredImages.filter(image => image.Requirement == 'Per Cable');
    let imagesId = requiredImages.map(image => image.ReqImagesID);

    cables = cables.map(cable => {
        cable.requiredImages = requiredImages.filter(image => image.Install_Phase_Type == "TP") || [];
        return cable;
    });

    return cables;
}


// images count
function addLocationRequiredImages(locations, requiredImages, photos) {

}

function addCableRequiredImages(locations, requiredImages, photos) {

}

// required test
function addLocationRequiredTest(locations, requiredImages, photos) {

}

function addCableRequiredTest(locations, requiredImages, photos) {

}

function getTestCountPerLocation(location, cable, images) {

}

function getTestCountPerCable(location, cable, images) {

}


// DATA MAPPING
// Installation Phases

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
function cableGeojson(locations, cables, requiredTests, tests) {
    let geojson = {"type":"FeatureCollection", "features":[]};

    let cableData = JSON.parse(JSON.stringify(cablesData));
    let totalTest = requiredTests.length;
    
    cableData.features = cableData.features.filter(cable => {
        // let p1 = locations.find(location => location.Name == cable['Location_A']);
        // let p2 = locations.find(location => location.Name == cable['Location_B']);

        let cableProps = cables.find(cbl => cbl['Cable Name'] == cable.properties['Cable Name']);

        // update the cable with test
        cableProps.test = tests.filter(test => {
            // recreate the cable name
            let cableName = test['Test_Cable_Link'].replace('_', " - ")
            if(cableName == cable.properties['Cable Name']) {
                console.log(cableName);

                return test;
            }

            return false;
        });

        cableProps.requiredTest = [...requiredTests];
        cableProps.total_test = totalTest;

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
var filterRadioBtns = document.querySelectorAll(".progress-filter");
filterRadioBtns.forEach(btn => {
    btn.onclick = function(e) {
        let { progress } = e.target.dataset;

        console.log("Site Progress: ", progress);

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
                return location.properties['Cable_Progress_Status'] == progress ? location : false; 
            });


            // update the sources
            map.getSource('cables').setData(turf.featureCollection(cables));
            map.getSource('locations').setData(turf.featureCollection(locations));
        }
    }
});

// close sidebar

// close overlay section
var closeButtons = document.querySelectorAll(".close-btn");
closeButtons.forEach(button => {
    button.onclick = function(e) {
        let { id } = e.target.dataset;

        let parentElement = document.getElementById(id);
        parentElement.classList.add('d-none');
    }
});


// different visual types
var layers = [
    {
        name:'location-required-images_label',
        visibility:false
    },
    {
        name:'location-required-images',
        visibility:false
    },
    {
        name:'location-layer',
        visibility:true
    },
    // {
    //     name:'cable-layer',
    //     visibility:true
    // },
    {
      name:'installation-phases',
      visibility:false
    },
    {
        name:'cable-test',
        visibility:false
    },
    {
        name:'test-count-layer',
        visibility:false
    }
]


var changeVisuals = document.querySelectorAll(".visual-type");
changeVisuals.forEach(visualType => {
    visualType.onclick = function(e) {
        let { checked, dataset :{ visual } } = e.target;
        
        if(checked && visual == 'default') {
            resetVisual();
            toggleLayers(['location-layer']);
            return;
        }

        if(checked && visual == 'progress') {``
            visualizeByProgress();
            toggleLayers(['location-layer']);
            return;
        }

        if(checked && visual == 'test') {
            visualizeByTest('test');
            resetVisual();

            toggleLayers(['cable-test', 'location-layer', 'test-count-layer']);

            return;
        }

        if(checked && visual == 'installation-phases') {
            toggleLayers(['installation-phases']);
            return;
        }

        if(checked && visual == 'required-images') {
            toggleLayers(["location-required-images", "location-required-images_label"]);

            return;
        }
    }
});


function visualizeByProgress() {
    // locations
    map.setPaintProperty('location-layer', 'icon-color', [
        'match', 
        ['get', 'Location_Progress_Status'],
        'Incomplete',
        progressColors[0],
        'In Progress',
        progressColors[1],
        'Pending',
        progressColors[2],
        'Complete',
        progressColors[3],
        '#333'
    ]);

    // cables
    map.setPaintProperty('cable-layer', 'line-color', [
        'match',
        ['get', 'Cable_Progress_Status'],
        'Incomplete',
        progressColors[0],
        'In Progress',
        progressColors[1],
        'Pending',
        progressColors[2],
        'Complete',
        progressColors[3],
        '#333'
    ]);
}

function visualizeByTest() {
    // locations
    return;
}

function resetVisual() {
    console.log("Resetting Visual");

    map.setPaintProperty('cable-layer', 'line-color', ['get', 'Color']);
    map.setPaintProperty('location-layer', 'icon-color', '#333');
}

function visualizeByRequiredImages() {
    console.log("Required Images");

    // display the 
    layers = layers.map(layer => {
        if(layer.name == ""  ) {
            layer.visibility = true;
            return layer;
        }

        layer.visibility = false;
        return layer;
    });
}


function toggleLayers(layerNames) {
    layers = layers.map(layer => {
        if(layerNames.includes(layer.name)) {
            layer.visibility = true;
            return layer;
        }

        layer.visibility = false;
        return layer;
    });

    layers.forEach(layer => {

        if(layer.name == 'installation-phases') {
            if(!layer.visibility) {
                installationVisual.remove();
            } else {
                installationVisual.addMarkers();
            }

            return layer;
        }

        if(map.getLayer(layer.name)) {
            let visibility = layer.visibility ? 'visible' :'none';

            map.setLayoutProperty(layer.name, 'visibility', visibility);
        }
    });
}

// chart section
var chartContainer = document.getElementById('chart-container');
function createProgressChart(values, title) {
    console.log(values);

    let nVal = values.map(vl => vl.value);
    let status = values.map(vl => vl.name);

    var svg = d3.select('svg.chart');
    var x = d3.scaleBand()
        .domain(status)
        .range([0, 80])
        .paddingInner(0.15)

    // var yScale = d3.scaleLinear()
    //     .domain([0, 60])
    //     .range([0, 80]);

    var axisScale = d3.scaleLinear()
        .domain([0, 80])
        .range([0, 120]);

    var rectGroup = svg.append('g').attr('class', 'rects').attr('transform', 'translate(20, 0)');

    // rect
    rectGroup.selectAll('rect')
        .data(values)
        .join('rect')
        .attr('width', (d) => d.value)
        .attr('height', 15)
        .attr('x', (d,i) => 40)
        .attr('y', (d, i) => 20 * i)
        .attr('fill', (d, i) => progressColors[i])
        .on('mouseover', (e) => {
            console.log(e);

            // popup showing the count and the 
        }).on('mouseover', (e) => {
            console.log(e);

            // clear the popup 
        });

    // axis
    let axisBottom = d3.axisBottom(axisScale).tickValues([0, 20, 40, 60, 80]);

    let axisLeft = d3.axisLeft(x)
        

    // axis groups
    d3.select('g.left').call(axisLeft);


  
    d3.select('g.bottom').call(axisBottom);
}

// toggle different charts
var chartTogglers = document.querySelectorAll(".chart-toggler");
var activeChartToggler = document.querySelector(".chart-toggler.active");
chartTogglers.forEach(toggler => {
    toggler.onclick = function(e) {
        let { layer } = e.target.dataset;

        activeChartToggler.classList.remove('active');

        if(layer == "location") {
            activeChartToggler = toggler;
            activeChartToggler.classList.add('active');

            let chartValues = getChartValues('Location');
            createProgressChart(chartValues, "Location");
        } else {
            activeChartToggler = toggler;
            activeChartToggler.classList.add('active');

            let chartValues = getChartValues('Cable');
            createProgressChart(chartValues, "Cables");
        }
    }
});

function getChartValues(chart) {
    let values = [];

    function getValues(data) {
        console.log(data);

        progressStatus.forEach(status => {
            let count = data.features.filter(feature => feature.properties[`${chart}_Progress_Status`] == status).length;

            values.push({
                name:status,
                value:count
            })
        });
    }

    if(chart == 'Location') {
       getValues(locationsData)

        
    } else if( chart == 'Cable') {
       getValues(cablesData);
    }

    return values;
}

// Counts
function updateCounts() {
    let cableCount = document.getElementById('cable-count');
    let locationCount = document.getElementById('location-count')

    cableCount.innerHTML = cablesData.features.length;
    locationCount.innerHTML = locationsData.features.length;
}

// Progress Legend container
var legendContainer = document.getElementById('legend-container');
function updateLegend(colors) {
    let html = "";
    colors.forEach((color, index) => {
        html += `<div class="legend-item"><div style="background-color:${color}"></div> <span>${progressStatus[index]}</span></div>`;
    });

    legendContainer.innerHTML = html;
}


updateLegend(progressColors);



