let WAContext = window.AudioContext || window.webkitAudioContext;
let context = new WAContext();

let freq, volume;
let maxX = 400;
let maxY = 400;
let isStarted = false;

function setup() {
  createCanvas(maxX, maxY);
  freq = 200;
  volume = 0;
}

let lat = 0;
let long = 0;


let lastPositions = new CBuffer(10);
let mph = 0;

function draw() {
  background(220);
  let freqVal = map(mph, 0, 4, 6000, 20);
  let volumeVal = map(mph, 0, 4, 128, 0);
  freq.value = freqVal;
  volume.value = volumeVal;
  
  text('freq:' + Math.trunc(freqVal), 10, maxY - 40);
  text('vol:' + Math.trunc(volumeVal), 10, maxY - 20);
  text('lat:' + lat, 100, maxY - 40);
  text('long:' + long, 100, maxY - 20);
  
  for(let i = 0; i < 10; i++) {
    let val = lastPositions.get(i) ? 
        `${lastPositions.get(i).timestamp} (${lastPositions.get(i).coords.longitude},${lastPositions.get(i).coords.latitude})` :
        null;
    text(`pos${i}: ${val}`, 10, 20 + (i*12));
  }
  
  let first = lastPositions.first() ? lastPositions.first().timestamp : null;
  text(`first: ${first}`, 10, 150);
  let last = lastPositions.last() ? lastPositions.last().timestamp : null;
  text(`last: ${last}`, 10, 162);
  text(`length: ${lastPositions.length}`, 10, 174);
  
  text(`mph: ${mph}`, 10, 190);
  
  
}

function startStop() {
  if (!isStarted) {
    initSound();
    initGeo();
    isStarted = true;
    context.resume();
  }
  else {
    stop();
    context.suspend();
  }
}



function positionUpdated(pos) {
  const crd = pos.coords;
  const timestamp = pos.timestamp;
  lat = crd.latitude;
  long = crd.longitude;
  
  lastPositions.push(pos);
  
  if (lastPositions.length > 1) {
    mph = calcMph(lastPositions.first(), lastPositions.last());
  }
}

function calcMph(startPos, endPos) {
  console.log("startPos", startPos.coords);
  console.log("endPos", endPos.coords);
  const from = turf.point([startPos.coords.longitude, startPos.coords.latitude]);
  const to = turf.point([endPos.coords.longitude, endPos.coords.latitude]);
  const options = { units: "miles" };

  const distance = turf.distance(from, to, options);
  console.log(distance);
  
  const hours = (endPos.timestamp - startPos.timestamp) / (1000*60*60);
  console.log(hours);
  return distance / hours;
}

function positionWatchError(err) {
  console.error(`ERROR(${err.code}): ${err.message}`);
}



let geoHandlerId;

const initSound = async () => {
    let rawPatcher = await fetch("theremin_rnbo.export.json");
    let patcher = await rawPatcher.json();

    let device = await RNBO.createDevice({ context, patcher });
    
    //get the params
    freq = device.parametersById.get("freq");
    volume = device.parametersById.get("volume");

    device.node.connect(context.destination);
};

function initGeo() {
    geoHandlerId = navigator.geolocation.watchPosition(positionUpdated, positionWatchError, {maximumAge: 0, timeout: 100, enableHighAccuracy: true});
}

function stop() {
  if (geoHandlerId !== null) {
    navigator.geolocation.clearWatch(geoHandlerId);
  }
}