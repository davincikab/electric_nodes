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
        "Incomplete Phases":"white",
        "Complete Phases":"red"
    };

    this.paths = this.pieData.map(dt => this.pieGenerator(dt));

    this.getSvg = function() {
        let paths = this.paths.map((p,i) => `<path d="${p}" fill="${this.color(this.pieData[i])}" stroke="${this.color(this.pieData[i])}" stroke-width=1></path>`);

        return `<svg height='${this.height}' width='${this.width}' id=${this.pointName}>"+
            <g transform='translate(${this.height/2}, ${this.height/2})'>"+
                ${paths.join()}
            </g>
	    </svg>`;
    },

    this.color = function(node) {

        // return this.colors[node.data.label];

        return node.data.status == 'Complete' ? this.colors[node.data.label] : "rgba(255,255,255,0.2)";
    }
}

var InstallationVisual = function(locations) {
    this.locations = locations;

    this.init = function() {
        // create markers 
        this.createMarkers();
    }

    this.createMarkers = function() {
        this.markers = this.locations.map(location => {
            let allPhases = location.properties.cable_count *  5 + 3;

            let completeValue = location.properties.installationPhases.length;
            let inCompleteValue = allPhases - completeValue;
            
            let data = [
                {label:'Incomplete Phases', status:'Incomplete', value:inCompleteValue},
                {label:'Complete Phases', status:'Complete', value:completeValue}
            ];

            console.log(data);

            let marker = this.createMarker(data, location);
            return marker;
        });

        console.log(this.markers);
    }

    this.createMarker = function(data, location) {
        // var popup = new mapboxgl.Popup({focusAfterOpen:false})
        //     .setHTML(popupDiv)
        //     .setMaxWidth("250px");

        let element = new PieMarkerElement(data, location.properties.Name);

        let div = document.createElement("div");
        div.classList.add("div-marker");
        div.innerHTML = element.getSvg();

        let marker = new mapboxgl.Marker({
            element:div
        })
        .setLngLat(location.geometry.coordinates);
        // .setPopup(popup);

        return marker;
    }

    this.addMarkers = function() {
        // add markers to map
        this.markers.forEach(marker => marker.addTo(map));
    }

    this.remove = function() {
        this.markers.forEach(marker => marker.remove());
    }
}