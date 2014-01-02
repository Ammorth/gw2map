$(document).ready(function(){

// HELPER FUNCTIONS

	function distanceFromSegment(p, a, b){
	    var dx = b.x - a.x;
	    var dy = b.y - a.y;
	    var L = (dx*dx) + (dy*dy);
	    if(L == 0){
	    	return Math.sqrt((p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y));
	    }
	    var r = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L;
	    if(r > 1){
	    	return Math.sqrt((p.x - b.x) * (p.x - b.x) + (p.y - b.y) * (p.y - b.y));
	    }else if(r < 0){
	    	return Math.sqrt((p.x - a.x) * (p.x - a.x) + (p.y - a.y) * (p.y - a.y));
	    }
	    dx = a.x + r * dx;
	    dy = a.y + r * dy;
	    return Math.sqrt((p.x - dx) * (p.x - dx) + (p.y - dy) * (p.y - dy));
	}

// CONVERSION FUNCTIONS

	function fromLatLngToPoint(ll, max_zoom){
		var point = new google.maps.Point(0, 0),
			origin = new google.maps.Point(128, 128),
			tiles = 1 << max_zoom,
			bound = function(value, min, max){
				if (min != null) value = Math.max(value, min);
				if (max != null) value = Math.min(value, max);
				return value;
			},
			sin_y = bound(Math.sin(ll.lat() * (Math.PI / 180)), -0.9999, 0.9999);
		point.x = origin.x + ll.lng() * (256 / 360);
		point.y = origin.y + 0.5 * Math.log((1 + sin_y) / (1 - sin_y)) * -(256 / (2 * Math.PI));
		return new google.maps.Point(Math.floor(point.x * tiles), Math.floor(point.y * tiles));
	}

	function fromPointToLatLng(point, max_zoom){
		var size = (1 << max_zoom) * 256,
			lat = (2 * Math.atan(Math.exp((point.y - size/2) / -(size/(2 * Math.PI)))) - (Math.PI / 2)) * (180/Math.PI),
			lng = (point.x - size/2) * (360/size);
		return new google.maps.LatLng(lat, lng);
	}

// Map Declaration

	var mapSize = 32768;

	var gmap = new google.maps.Map(document.getElementById("gw2map") , {
		zoom: 8,
		minZoom: 5,
		maxZoom: 11,
		center: new google.maps.LatLng(0, 0),
		streetViewControl: false,
		backgroundColor: '#000',
		mapTypeId: "1", // string for gmaps' sake
		mapTypeControlOptions: {
			mapTypeIds: ["1","2"]
		}
	});

// For mouse-over markers

	var pixelOverlay = new google.maps.OverlayView();
	pixelOverlay.draw = function(){};
	pixelOverlay.setMap(gmap);

// functions to drive the map

	var max_zoom = function(){
		return gmap.getMapTypeId() === "1" ? 11 : 10
	};

	var ll2p = function(latlng){
		var p = fromLatLngToPoint(latlng, max_zoom());
		p.x -= (mapSize*8), p.y -= (mapSize*8);
		return p;
	};

	var p2ll = function(point){
		point.x += (mapSize*8), point.y += (mapSize*8);
		return fromPointToLatLng(point, max_zoom());
	};

	var get_tile = function(coords,zoom){
		var zOffset = 4;
		var offset = (1 << (zoom - 1));
		var actualX = coords.x - offset;
		var actualY = coords.y - offset;
		var actualZ = zoom - zOffset;
		if(actualY < 0 || actualX < 0 || actualY >= (1 << actualZ) || actualX >= (1 << actualZ)){
			return "http://wiki-de.guildwars2.com/images/6/6f/Kartenhintergrund.png";
		}
		return "https://tiles.guildwars2.com/"+gmap.getMapTypeId()+"/1/"+actualZ+"/"+actualX+"/"+actualY+".jpg";
	};

// defining map settings

	var tile_size = new google.maps.Size(256,256);

	var tyria = new google.maps.ImageMapType({
		maxZoom: 11,
		alt: "Tyria",
		name: "Tyria",
		tileSize: tile_size,
		getTileUrl: get_tile
	});
		
	var mists = new google.maps.ImageMapType({
		maxZoom: 10,
		alt: "The Mists",
		name: "The Mists",
		tileSize: tile_size,
		getTileUrl: get_tile
	});

	gmap.mapTypes.set("1",tyria);
	gmap.mapTypes.set("2",mists);

	// centering map at start

	gmap.setCenter(p2ll(new google.maps.Point(mapSize/2, mapSize/2)));

	var exportDiv = document.createElement('div');
	exportDiv.style.padding = '5px';

	// Set CSS for the control border
	var controlUI = document.createElement('div');
	controlUI.style.backgroundColor = 'white';
	controlUI.style.borderStyle = 'solid';
	controlUI.style.borderWidth = '1px';
	controlUI.style.borderRadius = '2px';
	controlUI.style.borderColor = 'grey';
	controlUI.style.cursor = 'pointer';
	controlUI.style.textAlign = 'center';
	controlUI.title = 'Click to export';
	controlUI.style.padding = '1px';
	exportDiv.appendChild(controlUI);

	// Set CSS for the control interior
	var controlText = document.createElement('div');
	controlText.style.fontFamily = 'Arial,sans-serif';
	controlText.style.fontSize = '12px';
	controlText.style.paddingLeft = '4px';
	controlText.style.paddingRight = '4px';
	controlText.innerHTML = '<b>Export</b>';
	controlUI.appendChild(controlText);

	var lastValidPosition = ll2p(gmap.getCenter());

	function boundCheck(){
		var bounds = gmap.getBounds();
		var ne = ll2p(bounds.getNorthEast());
		var sw = ll2p(bounds.getSouthWest());
		var pos = ll2p(gmap.getCenter());
		//console.log("center: " + pos.x + ", " + pos.y);
		//console.log("NE: " + ne.x + ", " + ne.y);
		//console.log("SW: " + sw.x + ", " + sw.y);

		var force = false;

		if(sw.y - ne.y >= mapSize){
			if(pos.y != mapSize/2){
				pos.y = mapSize/2;
				force = true;
			}
		}else if(ne.y < 0){
			pos.y -= ne.y;
			force = true;
		}else if(sw.y > mapSize){
			pos.y -= (sw.y - mapSize);
			force = true;
		}

		if(ne.x - sw.x >= mapSize){
			if(pos.x != mapSize/2){
				pos.x = mapSize/2;
				force = true;
			}
		}else if(sw.x < 0){
			pos.x -= sw.x;
			force = true;
		}else if(ne.x > mapSize){
			pos.x -= (ne.x - mapSize);
			force = true;
		}

		if(force == true){
			//console.log("set center: " + pos.x + ", " + pos.y);
			gmap.setCenter(p2ll(pos));
			
		}

	}

	google.maps.event.addListener(gmap, 'center_changed', boundCheck);
/*
	google.maps.event.addListener(gmap, 'bounds_changed', function(){
		console.log("bounds_changed");
		var ne = ll2p(gmap.getBounds().getNorthEast());
		var sw = ll2p(gmap.getBounds().getSouthWest());
		console.log(ne.x + ", " + ne.y + "   " + sw.x + ", " + sw.y);
	});

	google.maps.event.addListener(gmap, 'center_changed', function(){
		console.log("center_changed");
		var ne = ll2p(gmap.getBounds().getNorthEast());
		var sw = ll2p(gmap.getBounds().getSouthWest());
		console.log(ne.x + ", " + ne.y + "   " + sw.x + ", " + sw.y);
	});

	google.maps.event.addListener(gmap, 'dragstart', function(){
		console.log("dragstart");
		var ne = ll2p(gmap.getBounds().getNorthEast());
		var sw = ll2p(gmap.getBounds().getSouthWest());
		console.log(ne.x + ", " + ne.y + "   " + sw.x + ", " + sw.y);
	});

	google.maps.event.addListener(gmap, 'dragend', function(){
		console.log("dragend");
		var ne = ll2p(gmap.getBounds().getNorthEast());
		var sw = ll2p(gmap.getBounds().getSouthWest());
		console.log(ne.x + ", " + ne.y + "   " + sw.x + ", " + sw.y);
	});
*/
	var allPaths = new Array();

	// Setup the click event listeners: simply set the map to
	// Chicago
	google.maps.event.addDomListener(controlUI, 'click', function() {
		var pathData = new Array();
		for (var i = allPaths.length - 1; i >= 0; i--) {
			var path = allPaths[i];
			var pathPoints = new Array();
			for(var j = path.polyMarkers.length - 1; j >= 0; j--){
				var marker = path.polyMarkers[j];
				var p = ll2p(marker.getPosition());
				pathPoints.push(p);
			}
			pathData.push(pathPoints);
		};
		console.log(JSON.stringify(pathData));
	});

	exportDiv.index = 1;
	gmap.controls[google.maps.ControlPosition.TOP_RIGHT].push(exportDiv);
			
	var editPath = null;

	function PolyPath(map){
		var that = this;
		this.polyLines = new Array();
		this.polyLinesType = new Array();
		this.edit = false;
		this.map = map
	};

	PolyPath.prototype.polyEdit = {
	    strokeColor: '#0B0',
	    strokeOpacity: 1.0,
	    strokeWeight: 3,
	    icons: [{
	    	icon: {
			    path: 'M 0,-2 1,0 -1,0 z',
			    fillOpacity: 1,
			    strokeWeight: 1,
			    scale: 5
		  	},
	    	offset: '100%',
	    	repeat: '100px',
	    }],
	};

	PolyPath.prototype.polyDone = {
	    strokeColor: '#B00',
	    strokeOpacity: 1.0,
	    strokeWeight: 3,
	    icons: [{
	    	icon: {
			    path: 'M 0,-2 1,0 -1,0 z',
			    fillOpacity: 1,
			    strokeWeight: 1,
			    scale: 5
		  	},
	    	offset: '100%',
	    	repeat: '100px',
	    }],
	};

	PolyPath.prototype.polyUnderground = {
	    strokeColor: '#D70',
	    strokeOpacity: 1.0,
	    strokeWeight: 3,
	    icons: [],
	};

	PolyPath.prototype.InsertLatLng = function(LatLng, index, type){
		index = typeof index != 'undefined' ? index : this.polyLines.length;
		type = typeof type != 'undefined' ? type : 0;
		

	};

	PolyPath.prototype.SetActive = function(bool){
	};

	PolyPath.prototype.setVisible = function(bool){
		this.SetActive(false);
		for (var i = this.polyLines.length - 1; i >= 0; i--) {
			this.polyLines[i].setVisible(bool);
		};
	}

	PolyPath.prototype.ToggleUnderground = function(index){
	}


	

	google.maps.event.addListener(gmap, "click", function(e){
		if(editPath != null){
			editPath.InsertLatLng(e.latLng, true);
		}else{
			editPath = new PolyPath(gmap);
			editPath.InsertLatLng(e.latLng, true);
			allPaths.push(editPath);
		}
	});

	function loadLines(lines){
		for (var i = lines.length - 1; i >= 0; i--) {
			var line = lines[i];
			var tempPath = new PolyPath(gmap);
			for (var j = line.length - 1; j >= 0; j--) {
				var point = line[j];
				tempPath.InsertLatLng(p2ll(point));
			};
			tempPath.SetActive(false);
			allPaths.push(tempPath);
		};
	}

	if(typeof GW2MapLoadData == 'function'){
		console.log("Loading data...");
		loadLines(GW2MapLoadData());
	}else{
		console.log("Data is unavailable.");
	}

	var markers_waypoint = new Array();
	var markers_point_of_interest = new Array();
	var markers_heart = new Array();
	var markers_skill = new Array();
	var markers_vista = new Array();
	var map_info = new Array();

	var map_whitelist = [
		"Dredgehaunt Cliffs",
		"Lornar's Pass",
		"Wayfarer Foothills",
		"Timberline Falls",
		"Frostgorge Sound",
		"Snowden Drifts",
		"Hoelbrak",
		"Eye of the North",
		"Plains of Ashford",
		"Blazeridge Steppes",
		"Fields of Ruin",
		"Fireheart Rise",
		"Iron Marches",
		"Diessa Plateau",
		"Black Citadel",
		"Straits of Devastation",
		"Cursed Shore",
		"Malchor's Leap",
		"Queensdale",
		"Harathi Hinterlands",
		"Divinity's Reach",
		"Kessex Hills",
		"Gendarran Fields",
		"Lion's Arch",
		"Bloodtide Coast",
		"Southsun Cove",
		"Caledon Forest",
		"Metrica Province",
		"Brisban Wildlands",
		"The Grove",
		"Rata Sum",
		"Mount Maelstrom",
		"Sparkfly Fen",
	];

	$.getJSON( "https://api.guildwars2.com/v1/map_floor.json?continent_id=1&floor=0", function( data ) {

		var waypointIcon = {
			url: "https://render.guildwars2.com/file/32633AF8ADEA696A1EF56D3AE32D617B10D3AC57/157353.png",
			anchor: new google.maps.Point(12,12),
			scaledSize: new google.maps.Size(24,24),
		};

		var waypointHoverIcon = {
			url: "https://render.guildwars2.com/file/95CE3F6B0502232AD90034E4B7CE6E5B0FD3CC5F/157354.png",
			anchor: new google.maps.Point(12,12),
			scaledSize: new google.maps.Size(24,24),
		};

		var landmarkIcon = {
			url: "https://render.guildwars2.com/file/25B230711176AB5728E86F5FC5F0BFAE48B32F6E/97461.png",
			anchor: new google.maps.Point(9,9),
			scaledSize: new google.maps.Size(18,18),
		};

		var vistaIcon = {
			url: "images/vista.png",
			anchor: new google.maps.Point(11,11),
			scaledSize: new google.maps.Size(22,22),
		};

		var skillpointIcon = {
			url: "images/skillpoint.png",
			anchor: new google.maps.Point(11,11),
			scaledSize: new google.maps.Size(22,22),
		};

		var taskIcon = {
			url: "https://render.guildwars2.com/file/B3DEEC72BBEF0C6FC6FEF835A0E275FCB1151BB7/102439.png",
			anchor: new google.maps.Point(11,11),
			scaledSize: new google.maps.Size(22,22),
		};

		function makeOverFunc(target){
			return function(e){
				$('#hover_window').html(target.name);
				$('#hover_window').stop().fadeIn({
					duration:200,
					queue: false,
				});
				if(target.type == "waypoint"){
					target.setIcon(waypointHoverIcon);
				}

				var proj = pixelOverlay.getProjection();
				var pixel = proj.fromLatLngToContainerPixel(target.getPosition());
				var docWidth = $(document).width();
				var floatWidth = $('#hover_window').width();
				

				if(Math.round(pixel.x) + floatWidth + 20 >= docWidth){
					$('#hover_window').css({
						top: (Math.round(pixel.y) - 45) + "px",
						left: (Math.round(pixel.x) - (floatWidth + 10) ) + "px",
					});
				}else{
					$('#hover_window').css({
						top: (Math.round(pixel.y) - 45) + "px",
						left: (Math.round(pixel.x) + 0) + "px",
					});
				}

				
				
			};
		}

		function makeOutFunc(target){
			return function(e){ 
				if(target.type == "waypoint"){
					target.setIcon(waypointIcon);
				}
				$('#hover_window').stop().fadeOut({
					duration:200,
					queue: false,
				});
			};
		}



		for(var rkey in data.regions){
			var region = data.regions[rkey];
			for(var mkey in region.maps){
				var map = region.maps[mkey];
				if($.inArray(map.name, map_whitelist) == -1){
					console.log("skipped map " + map.name);
					continue;
				}
				for(var key in map.points_of_interest){
					var POI = map.points_of_interest[key];

					var tempMarker;
					if(POI.type == "landmark"){
						tempMarker = new google.maps.Marker({
							position: p2ll(new google.maps.Point(POI.coord[0], POI.coord[1])),
							draggable: false,
							map: gmap,
							icon: landmarkIcon,
							visible: false,
							name: POI.name,
							type: POI.type,
							zIndex: 100,
						});

						markers_point_of_interest.push(tempMarker);

						google.maps.event.addListener(tempMarker, "mouseover", makeOverFunc(tempMarker));
						google.maps.event.addListener(tempMarker, "mouseout", makeOutFunc(tempMarker));

					}else if(POI.type == "waypoint"){
						tempMarker = new google.maps.Marker({
							position: p2ll(new google.maps.Point(POI.coord[0], POI.coord[1])),
							draggable: false,
							map: gmap,
							icon: waypointIcon,
							visible: false,
							name: POI.name,
							type: POI.type,
							zIndex: 100,
						});

						google.maps.event.addListener(tempMarker, "mouseover", makeOverFunc(tempMarker));
						google.maps.event.addListener(tempMarker, "mouseout", makeOutFunc(tempMarker));

						markers_waypoint.push(tempMarker);

					}else if(POI.type == "vista"){
						tempMarker = new google.maps.Marker({
							position: p2ll(new google.maps.Point(POI.coord[0], POI.coord[1])),
							draggable: false,
							map: gmap,
							icon: vistaIcon,
							visible: false,
							name: "Discovered Vista",
							type: POI.type,
							zIndex: 100,
						});

						markers_vista.push(tempMarker);

						google.maps.event.addListener(tempMarker, "mouseover", makeOverFunc(tempMarker));
						google.maps.event.addListener(tempMarker, "mouseout", makeOutFunc(tempMarker));
					}
				}

				for(var key in map.tasks){
					var task = map.tasks[key];
					
					var tempMarker = new google.maps.Marker({
						position: p2ll(new google.maps.Point(task.coord[0], task.coord[1])),
						draggable: false,
						map: gmap,
						icon: taskIcon,
						visible: false,
						name: task.objective + "\xA0\xA0<font style='color:#BBB;font-size:0.9em;'>(" + task.level + ")</font>",
						type: "task",
						zIndex: 100,
					});
					markers_heart.push(tempMarker);

					google.maps.event.addListener(tempMarker, "mouseover", makeOverFunc(tempMarker));
					google.maps.event.addListener(tempMarker, "mouseout", makeOutFunc(tempMarker));

				}

				for(var key in map.skill_challenges){
					var skill = map.skill_challenges[key];

					var tempMarker = new google.maps.Marker({
						position: p2ll(new google.maps.Point(skill.coord[0], skill.coord[1])),
						draggable: false,
						map: gmap,
						icon: skillpointIcon,
						visible: false,
						type: "skill",
						name: "Skill Point",
						zIndex: 100,
					});
					markers_skill.push(tempMarker);

					google.maps.event.addListener(tempMarker, "mouseover", makeOverFunc(tempMarker));
					google.maps.event.addListener(tempMarker, "mouseout", makeOutFunc(tempMarker));
					
				}

				var label_coord = new google.maps.Point(
					(map.continent_rect[0][0] + map.continent_rect[1][0]) / 2,
					(map.continent_rect[0][1] + map.continent_rect[1][1]) / 2
				);

				new MapLabel({
					map: gmap,
					fontColor: '#d6bb70',
					fontSize: 24,
					fontFamily: 'Menomonia',
					strokeWeight: 3,
					strokeColor: '#000',
					maxZoom: 9,
					minZoom: 7,
					position: p2ll(label_coord),
					text: map.name,
					level: map.min_level == 0 ? null : "(" + map.min_level + " - " + map.max_level + ")",
					levelColor: '#AAA',
					levelSize: 20,
					zIndex: 100,
				});
				

				map_info.push({
					name: map.name,
					min_level: map.min_level,
					max_level: map.max_level,
					map_rect: [	new google.maps.Point(map.continent_rect[0][0], map.continent_rect[0][1]), new google.maps.Point(map.continent_rect[1][0], map.continent_rect[1][1]) ],
				});
			}

			var reg_label_coord = new google.maps.Point(region.label_coord[0], region.label_coord[1]);

			console.log(region.name);

			new MapLabel({
				map: gmap,
				fontColor: '#d6bb70',
				fontSize: 24,
				fontFamily: 'Menomonia',
				strokeWeight: 3,
				strokeColor: '#000',
				maxZoom: 6,
				minZoom: 6,
				position: p2ll(reg_label_coord),
				text: region.name,
				zIndex: 100,
			});
		}
	});

	var lastZoom = gmap.getZoom();

	function doAllMarkers(action, state, start){
		state = typeof state != 'undefined' ? state : 0;
		start = typeof start != 'undefined' ? start : 0;
		var count = 0;
		var max_count = 20;
		var delay = 0;
		if(state == 0){
			for (var i = start; i < markers_waypoint.length; i++) {
				action(markers_waypoint[i]);

				count++;
				if(count > max_count)
				{
					setTimeout(function(){ doAllMarkers(action, state, i); }, delay);
					return;
				}
			}
			state++;
			start = 0;
		}
		if(state == 1){
			for (var i = start; i < markers_skill.length; i++) {
				action(markers_skill[i]);

				count++;
				if(count > max_count)
				{
					setTimeout(function(){ doAllMarkers(action, state, i); }, delay);
					return;
				}
			}
			state++;
			start = 0;
		}
		if(state == 2){
			for (var i = start; i < markers_heart.length; i++) {
				action(markers_heart[i]);

				count++;
				if(count > max_count)
				{
					setTimeout(function(){ doAllMarkers(action, state, i); }, delay);
					return;
				}
			}
			state++;
			start = 0;
		}
		if(state == 3){
			for (var i = start; i < markers_vista.length; i++) {
				action(markers_vista[i]);

				count++;
				if(count > max_count)
				{
					setTimeout(function(){ doAllMarkers(action, state, i); }, delay);
					return;
				}
			}
			state++;
			start = 0;
		}
		if(state == 4){
			for (var i = start; i < markers_point_of_interest.length; i++) {
				action(markers_point_of_interest[i]);

				count++;
				if(count > max_count)
				{
					setTimeout(function(){ doAllMarkers(action, state, i); }, delay);
					return;
				}
			}
			state++;
			start = 0;
		}
	}

	google.maps.event.addListener(gmap, "zoom_changed", function(){
		var markerZoom = 8;
		var pathZoom = 8;
		if(gmap.getZoom() <= markerZoom && lastZoom > markerZoom){
			doAllMarkers(function(marker){
				marker.setVisible(false);
			});
		}else if(gmap.getZoom() > markerZoom && lastZoom <= markerZoom ){
			doAllMarkers(function(marker){
				marker.setVisible(true);
			});
		}

		if(gmap.getZoom() <= pathZoom && lastZoom > pathZoom){
			for (var i = allPaths.length - 1; i >= 0; i--) {
				var path = allPaths[i];
				path.setVisible(false);
			};
			editPath = null;
		}else if(gmap.getZoom() > pathZoom && lastZoom <= pathZoom ){
			for (var i = allPaths.length - 1; i >= 0; i--) {
				var path = allPaths[i];
				path.setVisible(true);
			};
		}

		lastZoom = gmap.getZoom();
	});

	var pathStyleNormal = {
		editable: false,
		map: gmap,
		suppressUndo: true,
		zIndex: 9,
		strokeOpacity: 1,
		strokeWeight: 3,
		strokeColor: '#4F4',
	};

	var pathStyleUnderground = {
		editable: false,
		map: gmap,
		suppressUndo: true,
		zIndex: 9,
		strokeOpacity: 0,
		strokeWeight: 2,
		strokeColor: '#F62',
		icons:  [{
	    	icon: {
			    path: 'M 1,-2 1,2 -1,2 -1,-2 z',
			    fillOpacity: 1,
			    strokeWeight: 0,
		  	},
	    	offset: '0px',
	    	repeat: '12px',
	    }],
	};

	var myPath = new MapPath(gmap, {
		types: [pathStyleNormal, pathStyleUnderground],
		vertices: [
			{
				pos: p2ll(new google.maps.Point(4000,4000)),
				type: 0,
			},
			{
				pos: p2ll(new google.maps.Point(6000,6000)),
				type: 0,
			},
			{
				pos: p2ll(new google.maps.Point(12000,7000)),
				type: 1,
			},
			{
				pos: p2ll(new google.maps.Point(9000,10000)),
				type: 0,
			},
			{
				pos: p2ll(new google.maps.Point(10000,11000)),
				type: 0,
			},
		],
	});   
	

	// detect zone stuff

	var currentZone = null;

	google.maps.event.addListener(gmap, 'center_changed', function(){
		var center = ll2p(gmap.getCenter());
		console.log(currentZone);
		if(currentZone == null || 
			!(
				map_info[currentZone].map_rect[0].x < center.x &&
				map_info[currentZone].map_rect[1].x > center.x &&
				map_info[currentZone].map_rect[0].y < center.y &&
				map_info[currentZone].map_rect[1].y > center.y
			))
		{
			for (var i = map_info.length - 1; i >= 0; i--) {
				if(map_info[i].map_rect[0].x < center.x &&
					map_info[i].map_rect[1].x > center.x &&
					map_info[i].map_rect[0].y < center.y &&
					map_info[i].map_rect[1].y > center.y)
				{
					currentZone = i;
					$('#map_title').show()
					$('#map_title_content').text(map_info[i].name);
					return;
				}
			}
			currentZone = null;
			$('#map_title').hide();
		}	
	})

});