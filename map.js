mapboxgl.accessToken = 'pk.eyJ1IjoiZGF1ZGk5NyIsImEiOiJjanJtY3B1bjYwZ3F2NGFvOXZ1a29iMmp6In0.9ZdvuGInodgDk7cv-KlujA';
function PieMarkerElement(data, pointName) { 
    // this.svg = d3.select(`svg#${pointName}`);
    this.height = 60;
    this.width = 60;
    this.svgId = pointName;
   
    this.radius = Math.min(this.width, this.height) / 2 - 10;

    var pie = d3.pie().value(function(d) { return d.value});
    this.pieData = pie(data);

    this.pieGenerator = d3.arc().innerRadius(0).outerRadius(this.radius);

    this.colors = {
        "Post Pull Tests":"red",
        "Stripping/Hangoffs":"blue",
        "Routing & Cleating":"pink",
        "Termination (MV & Fibre)":"black",
        "SAT B":"greenyellow",
        "Walkdowns":"purple",
        "AREI":"brown",
        "SAT C":"skyblue"
    };

    this.paths = this.pieData.map(dt => this.pieGenerator(dt));

    this.getSvg = function() {
        let paths = this.paths.map((p,i) => `<path d="${p}" fill="${this.color(this.pieData[i])}" stroke="#fafafa" stroke-width=1></path>`);

        return `<svg height='${this.height}' width='${this.width}' id=${this.pointName}>"+
            <g transform='translate(${this.height/2}, ${this.height/2})'>"+
                ${paths.join()}
            </g>
	    </svg>`;
    },

    this.color = function(node) {
        return node.data.status == 'completed' ? this.colors[node.data.label] : "rgba(255,255,255,0.2)";
    }
}

function MapModule() {
    this.markersOnScreen = {};
    this.markers = {};
    this.mapIsLoaded = false;
    this.init = function() {
        this.map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/dark-v10',
            center: [0.7149, 51.5453],
            zoom: 13.6
        });

        this.mapIsLoaded = this.map.loaded();

        // map events
    }
    
    this.addSource = function(id, data) {
        if(this.mapIsLoaded) {
            // this.map.addSource(id, {

            // });
        }
       
    }

    this.addLayer = function(sourceId, type, paint, layout) {

    }

    this.removeSource = function(sourceId) {

    }

    this.updateMarkers = function() {
        var newMarkers = {};
	    var features = this.map.querySourceFeatures('nodes');

        for (let index = 0; index < features.length; index++) {
            const feature = features[index];

            var props = feature.properties;
    
            if(!props.cluster) {
                // console.log(feature);
    
                var id = props.label;
    
                var marker = this.markers[id];
                if(!marker) {
                    marker = this.createMarker(feature);
                    this.markers[id] = marker;
                }
    
                newMarkers[id] = marker;
                if (!this.markersOnScreen[id]) marker.addTo(this.map);
            }
        };

        for (let id in this.markersOnScreen) {
            // console.log(id);
            if (!newMarkers[id]) {
                this.markersOnScreen[id].remove();
            }
        }
    
        this.markersOnScreen = newMarkers;
    }

    this.createMarker = function(feature) {
        let { geometry, properties } = feature;
        
        let data = [
            { label:"Post Pull Tests", status:properties["Post Pull Tests"], value:1},
            { label:"Stripping/Hangoffs", status:properties["Stripping/Hangoffs"], value:1},
            { label:"Routing & Cleating", status:properties["Routing & Cleating"], value:1},
            { label:"Termination (MV & Fibre)", status:properties["Termination (MV & Fibre)"], value:1},
            { label:"SAT B", status:properties["SAT B"], value:1},
            { label:"Walkdowns", status:properties["Walkdowns"], value:1},
            { label:"AREI", status:properties["AREI"], value:1},
            { label:"SAT C", status:properties["SAT C"], value:1}
        ];

        let element = new PieMarkerElement(data, properties.label);

        let popupKeys = Object.keys(feature.properties).filter(key => key != "label");
        let popupEntryString = popupKeys.map(key => {

            return `<div class='popup-entry'>${key}<b>${feature.properties[key]}</b></div>`;
        }).join('');

        var popupDiv = "<div class='popup-content'>" + 
            "<div class='popup-title'><strong>" + feature.properties.label +"</strong></div>" +
           popupEntryString +
        "</div>";

    
	    var popup = new mapboxgl.Popup({focusAfterOpen:false})
					.setHTML(popupDiv)
					.setMaxWidth("250px");

        let div = document.createElement("div");
        div.classList.add("div-marker");
        div.innerHTML = element.getSvg();

        let marker = new mapboxgl.Marker({
            element:div
        })
        .setLngLat(geometry.coordinates)
		.setPopup(popup);


        return marker;           
    }
}

var mapModule = new MapModule();
mapModule.init();

mapModule.map.on('load', function(e) {
    mapModule.map.addSource('nodes', {
        type:'geojson',
        data:"./nodes.json",
        cluster:true,
        clusterMaxZoom: 14,
		clusterRadius: 90
    });

    mapModule.map.addLayer({
        id:'nodes-layer',
        source:'nodes',
        type:'circle',
        filter:['==', 'cluster', true],
        paint:{
            'circle-color':'#717782',
            'circle-radius':20
        }
    });

    mapModule.map.addLayer({
        id:'nodes-count',
        source:'nodes',
        type:'symbol',
        filter:['==', 'cluster', true],
        layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 16,
        },
        paint:{
            'text-color':'white'
        }
    });

    mapModule.map.addLayer({
        id:'nodes-name',
        source:'nodes',
        type:'symbol',
        filter:["!", ['has', 'point_count']],
        layout: {
            'text-field': '{label}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12,
            'text-offset':[2.2, 1.8],
            'text-letter-spacing':0.1,
            'text-justify':'right'
        },
        paint:{
            'text-color':'#ddd',
            'text-halo-color':'black',
            'text-halo-width':0.3,

        }
    });

    // strings layer
    mapModule.map.addSource('string', {
        type:'geojson',
        data:'./strings.json'
    });

    mapModule.map.addLayer({
        id:'string-layer',
        source:'string',
        type:'line',
        paint:{
            'line-color':'orange',
            'line-width':2
        }
    });

    mapModule.map.addSource('string-labels', {
        type:'geojson',
        data:{"type":"FeatureCollection", "features":[]}
    });

    mapModule.map.addLayer({
        id:'string-labels-layer',
        source:'string-labels',
        type:'symbol',
        layout: {
            'text-field': '{label}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12,
            'text-offset':[-0.5, 0],
            'text-rotate':30,
            'text-letter-spacing':0.1
        },
        paint:{
            'text-color':'#ddd',
            'text-halo-color':'black',
            'text-halo-width':0.3
        }
    });

    fetchStringsData();

    // map events 
    mapModule.map.on('click', 'nodes-layer', function (e) {
		var features = map.queryRenderedFeatures(e.point, {
			layers: ['nodes-layer']
		});
		var clusterId = features[0].properties.cluster_id;
		mapModule.map.getSource('nodes').getClusterExpansionZoom(
			clusterId,
			function (err, zoom) {
				if (err) return;
				
				mapModule.map.easeTo({
					center: features[0].geometry.coordinates,
					zoom: zoom
				});
			}
		);
	});

	mapModule.map.on('mouseenter', 'nodes-layer', function () {
		mapModule.map.getCanvas().style.cursor = 'pointer';
	});

	mapModule.map.on('mouseleave', 'nodes-layer', function () {
		mapModule.map.getCanvas().style.cursor = '';
	});

    mapModule.map.on('render', function () {
		if (!mapModule.map.isSourceLoaded('nodes')) return;
		mapModule.updateMarkers();
	});
});

/* 
SOURCES
- Node Station
- Strings

LAYERS
- Node Markers: Custom Svg Icons
- Node Labels
- String Lines
- String Labels
*/

function fetchStringsData() {
    fetch('./strings.json')
    .then(res => res.json())
    .then(lineString => {
        let lineCenters = getLineCenters(lineString.features);
        
        console.log(lineCenters);

        // update the label names
        mapModule.map.getSource('string-labels').setData(lineCenters);
    })
    .catch(error => {
        console.error(error);
    })
}

function getLineCenters(linestring) {
    let features = [];

    linestring.forEach(feature => {
        let center = turf.center(feature);
        let centroid = turf.centroid(feature);

        center.properties = {...feature.properties};
        features.push(center);
    });

   return turf.featureCollection(features);
}

function createLegend() {
    let data = [
        { label:"Post Pull Tests", status:"", value:1},
        { label:"Stripping/Hangoffs", status:"", value:1},
        { label:"Routing & Cleating", status:"", value:1},
        { label:"Termination (MV & Fibre)", status:"", value:1},
        { label:"SAT B", status:"", value:1},
        { label:"Walkdowns", status:"", value:1},
        { label:"AREI", status:"", value:1},
        { label:"SAT C", status:"", value:1}
    ];

    let legendContainer = document.getElementById("legend-container");
    
    data.forEach(entry => {
        let node = {...entry, status:'completed' };
        let newData = [...data];

        newData = data.map(dt => {
            if( dt.label == entry.label) {
                dt = node;
            }
            
            return dt;
        });

        let div = document.createElement("div");
        div.classList.add("legend-item");

        let element = new PieMarkerElement(newData, "");

        div.innerHTML += element.getSvg();
        div.innerHTML += `<div>${node.label}</div>`;

        legendContainer.append(div);
    });

    
}

createLegend();


function createTimer() {
    let timers = [
        {name:'A', values:['Stripping/Hangoffs', 'Routing & Cleating']},
        {name:'B', values:['Stripping/Hangoffs', 'Routing & Cleating']},
        {name:'C', values:['"Post Pull Tests','Stripping/Hangoffs', 'Routing & Cleating', 'Termination (MV & Fibre)',"SAT B", "Walkdowns"]},
        {name:'D', values:['"Post Pull Tests','Stripping/Hangoffs', 'Routing & Cleating', 'Termination (MV & Fibre)',"SAT B", "Walkdowns", "AREI", "SAT C"]},
        {name:'E', values:['"Post Pull Tests','Stripping/Hangoffs', 'Routing & Cleating', 'Termination (MV & Fibre)', "AREI"]},
        {name:'F', values:['"Post Pull Tests','Stripping/Hangoffs', 'Routing & Cleating', 'Termination (MV & Fibre)', "AREI"]},
    ];


    let data = [
        { label:"Post Pull Tests", status:"", value:1},
        { label:"Stripping/Hangoffs", status:"", value:1},
        { label:"Routing & Cleating", status:"", value:1},
        { label:"Termination (MV & Fibre)", status:"", value:1},
        { label:"SAT B", status:"", value:1},
        { label:"Walkdowns", status:"", value:1},
        { label:"AREI", status:"", value:1},
        { label:"SAT C", status:"", value:1}
    ];

    let timerContainer = document.getElementById("timer-container");
    
    timers.forEach(timer => {
        let newData = [...data];

        newData = data.map(dt => {
            if( timer.values.indexOf(dt.label) != -1) {
                dt.status = "completed";
            }
            
            return dt;
        });

        let div = document.createElement("div");
        div.classList.add("timer-item");

        let element = new PieMarkerElement(newData, "");

        div.innerHTML += element.getSvg();
        div.innerHTML += `<div>${timer.name}</div>`;

        timerContainer.append(div);
    });
}

createTimer();