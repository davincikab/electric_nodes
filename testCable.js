// Display a line work
var CableTest = function(cables) {
    this.cables = JSON.parse(JSON.stringify(cables));
    this.getCables = function() {
        // return the cables with 
        return this.cables;
    }

    this.getLocationFeatures = function() {
        return this.locationsTest;
    }

    this.setCables = function(cables) {
        this.cables = JSON.parse(JSON.stringify(cables));
    }

    this.updateCableWithTest = function() {

        // test locations data
        this.locationsTest = this.cables.map(cable => {
            let props = {...cable.properties};

            props.test_status = `${cable.properties.test.length}/${cable.properties.total_test}`;
            let coord = cable.geometry.coordinates[0];

            let centerIndex = Math.floor(coord.length * 0.5);
            let coordinates = coord[centerIndex];

            let point = turf.point(coordinates, props);
            return point;
        });

        this.cables = this.cables.filter(cable => {
            // console.log(cable.geometry.coordinates[0]);

            let coord = cable.geometry.coordinates[0].length > 2 ? [...cable.geometry.coordinates[0]] : [...cable.geometry.coordinates];
            let props = cable.properties;

            if(props.test && props.test[0]) {
                let percentageComplete = props.test.length / props.total_test;
                let count = Math.floor(coord.length * percentageComplete);
    
    
                if(count > 0) {
                    cable.geometry.coordinates = [[...coord.slice(0, count)]];
                    return cable;
                }

                return false;
            }
            
            return false;
        });

        console.log(this.cables);
    }

    this.init = function() {
        if(map) {
            map.addSource('required-test', {
                type:'geojson',
                data:{"type":"FeatureCollection", "features":[]}
            });

            map.addLayer({
                id:'cable-test',
                source:'required-test',
                type:'line',
                paint:{
                    'line-color':['get', 'Color'],
                    'line-width':5
                },
                layout:{
                    visibility:'none'
                }
            });

            // add the test numbers
            map.addSource('test-count', {
                type:'geojson',
                data:{"type":"FeatureCollection", "features":[]}
            });

            map.addLayer({
                id:'test-count-layer',
                source:'test-count',
                type:'symbol',
                paint:{
                    'text-color':'black'
                },
                layout: {
                    'text-field': ["get", "test_status"],
                    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                    'text-size': 9,
                    'visibility':'none'
                }
            })

            this.updateCableWithTest();

            // update the 
            let cableData = turf.featureCollection(this.getCables());
            console.log(cableData);

            map.getSource('required-test').setData(cableData);

            let locationTest = turf.featureCollection(this.getLocationFeatures())
            map.getSource('test-count').setData(locationTest);
        }
    }

    this.updateTestSource = function() {
        this.updateCableWithTest();

        // update the 
        let cableData = turf.featureCollection(this.getCables());
        map.getSource('required-test').setData(cableData);
    }

    this.toggleTestLayer = function(visibility) {
        if(map) {
            map.setLayoutProperty('cable-test', 'visiblity', visibility);
        }
    }

}