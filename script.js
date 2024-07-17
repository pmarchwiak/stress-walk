let WAContext = window.AudioContext || window.webkitAudioContext;
let context = new WAContext();

let freq, volume;
let maxX = 400;
let maxY = 400;
let isStarted = false;
let startTime = Date.now();
let slider;
let timeSlider;
let distanceSlider;

let meanSynth, niceSynth;
let dist;
const niceNotes = ["C3", "E4", "A4", "E5"];
const meanNotes = ["C2", "E#4", "Ab4", "E3"];

function setup() {
  createCanvas(maxX, maxY);
  freq = 200;
  volume = 0;
  
  slider = createSlider(0, 100, 0);
  slider.position(10, 10);
  slider.size(80);
}

let lat = 0;
let long = 0;

let lastPositions = new CBuffer(10);
let mph = 0;
let relaxPercent = 0.0; // 0 is not at all, 100 is done

function draw() {
  background(220);
  let freqVal = map(mph, 0, 4, 6000, 20);
  let volumeVal = map(mph, 0, 4, 128, 0);
  freq.value = freqVal;
  volume.value = volumeVal;

  text("freq:" + Math.trunc(freqVal), 10, maxY - 40);
  text("vol:" + Math.trunc(volumeVal), 10, maxY - 20);
  text("lat:" + lat, 100, maxY - 40);
  text("long:" + long, 100, maxY - 20);

  for (let i = 0; i < 10; i++) {
    let val = lastPositions.get(i)
      ? `${lastPositions.get(i).timestamp} (${
          lastPositions.get(i).coords.longitude
        },${lastPositions.get(i).coords.latitude})`
      : null;
    text(`pos${i}: ${val}`, 10, 20 + i * 12);
  }

  let first = lastPositions.first() ? lastPositions.first().timestamp : null;
  text(`first: ${first}`, 10, 150);
  let last = lastPositions.last() ? lastPositions.last().timestamp : null;
  text(`last: ${last}`, 10, 162);
  text(`length: ${lastPositions.length}`, 10, 174);

  text(`mph: ${mph}`, 10, 190);
  
  let distortLevel = map(slider.value(), 0, 100, .9, .1);
  let volLevel = map(slider.value(), 0, 100, 0, -12);
  if (isStarted) {
    dist.distortion = distortLevel;
    meanSynth.volume.value = volLevel;
    niceSynth.volume.value = volLevel;
    text(`volume: ${volLevel}`, 10, 240)
  }
  
  relaxPercent = slider.value();
  text(`relaxPercent: ${relaxPercent}`, 10, 210);
  text(`distortion: ${distortLevel}`, 10, 222);
  

  
}

function startStop() {
  if (!isStarted) {
    initSound();
    initGeo();
    isStarted = true;
    context.resume();
    startTime = Date.now();
  } else {
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
  const from = turf.point([
    startPos.coords.longitude,
    startPos.coords.latitude,
  ]);
  const to = turf.point([endPos.coords.longitude, endPos.coords.latitude]);
  const options = { units: "miles" };

  const distance = turf.distance(from, to, options);
  console.log(distance);

  const hours = (endPos.timestamp - startPos.timestamp) / (1000 * 60 * 60);
  console.log(hours);
  return distance / hours;
}

function positionWatchError(err) {
  console.error(`ERROR(${err.code}): ${err.message}`);
}

var Cmajor = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];

let geoHandlerId;




const initSound = async () => {
  // create two monophonic synths
  niceSynth = new Tone.FMSynth().toDestination();
  
  meanSynth = new Tone.AMSynth().toDestination();
  dist = new Tone.Distortion(0.8).toDestination();
  meanSynth.connect(dist);

  const niceSynthSeq = new Tone.Sequence(
    (time, note) => {
      niceSynth.triggerAttackRelease(note, ".25", time);
    },
    niceNotes,
    "4n"
  ); // Setup the synth to be ready to play on beat 1
  niceSynthSeq.start();
  
  const meanSynthSeq = new Tone.Sequence(
    (time, note) => {
      meanSynth.triggerAttackRelease(note, ".25", time);
    },
    meanNotes,
    "8n"
  ); // Setup the synth to be ready to play on beat 1
  meanSynthSeq.start();

  //play a note every quarter-note
  // const loopA = new Tone.Loop((time) => {
  //   synthA.triggerAttackRelease("C2", "16n", time);
  //   synthA.triggerAttackRelease("E4", "16n", time);
  //   synthA.triggerAttackRelease("A4", "16n", time);
  //   synthA.triggerAttackRelease("E5", "16n", time);
  // }, "2n").start(0);

  //play another note every off quarter-note, by starting it "8n"
  // const loopB = new Tone.Loop((time) => {
  //   synthB.triggerAttackRelease("C4", "8n", time);
  // }, "4n").start("8n");

  // all loops start when the Transport is started
  Tone.getTransport().start();

  // ramp up to 200 bpm over 10 seconds
  // Tone.getTransport().bpm.rampTo(200, 10);
};

function initGeo() {
  geoHandlerId = navigator.geolocation.watchPosition(
    positionUpdated,
    positionWatchError,
    { maximumAge: 0, timeout: 100, enableHighAccuracy: true }
  );
}

function stop() {
  if (geoHandlerId !== null) {
    navigator.geolocation.clearWatch(geoHandlerId);
  }
  Tone.getTransport().stop();
}
