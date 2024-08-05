let maxX;
let maxY;
let isStarted = false;
let isFinished = false; // finishes once time runs out
let startTimeMs;

let slider;
let timeSlider;
let mphSlider;
let debugCheckbox;
let isDebugMode = false;

let timePercent = 0;

// tone.js objects
let meanSynth, niceSynth;
let dist, revEffect, gain;


// how long should the walk be and what's the max speed?
let walkTimeSec = 60;
let maxMph = 4;


let tonic;
let niceNotes;
let meanNotes;

// store most recent lat/longs in a circular buffer
let lastPositions = new CBuffer(6);
let lat = 0;
let long = 0;
let mph = 0.0;
let elapsedSec = 0;
let relaxPercent = 0.0; // 0 is not at all, 100 is done

let f = 25;

let circles = [];

let audioContext = new AudioContext();

let isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

let startStopButton = document.querySelector("#start-stop-button");
if (isMobile) {
  // not sure if this is necessary but read that ios can have trouble initializing
  // the audio context after a click so use touchend instead...
  startStopButton.addEventListener('touchend', startStop); 
}
else {
  startStopButton.addEventListener('click', startStop);
  document.querySelector("#mobile-rec").style['display'] = 'block';
}

// p5.js init
function setup() {
  maxX = windowWidth;
  maxY = windowHeight;
  let canvas = createCanvas(maxX, maxY);
  canvas.parent('sketch-container');
  
  volume = 0;
  debugCheckbox = createCheckbox("debug?");
  debugCheckbox.position(10);
  
  tonic = getTonic();
  niceNotes = getNiceNotes(tonic);
  meanNotes = getMeanNotes(tonic);

  const canvasTop = document
    .getElementsByTagName("canvas")[0]
    .getBoundingClientRect().top;

  timeSlider = createSlider(0, walkTimeSec, 0); // seconds
  timeSlider.hide();
  timeSlider.position(10, canvasTop + 10);
  timeSlider.size(80);

  mphSlider = createSlider(0, maxMph, 0); // mph
  mphSlider.hide();
  mphSlider.position(10, canvasTop + 50);
  mphSlider.size(80);

  let numCircles = 100;
  for (let c = 0; c < numCircles; c++) {
    circles.push({
      x: Math.floor(Math.random() * maxX),
      y: Math.floor(Math.random() * maxY),
      size: random(10, maxX * 0.3),
    });
  }
}

// p5.js loop
function draw() {
  background("white");
  colorMode(HSB);
  
  let remainingSec = Math.floor(walkTimeSec - elapsedSec);
  if (remainingSec <= 0) {
    if (!isFinished) {
      isFinished = true;
      let body = document.querySelector("body").classList.add('fade-out');
      stop(); // stop audio and geo
    }
    niceSynth.volume.value = -20;
  }
  

  if (debugCheckbox.checked() && !isDebugMode) {
    timeSlider.show();
    mphSlider.show();
    isDebugMode = true;
  } else if (!debugCheckbox.checked() && isDebugMode) {
    timeSlider.hide();
    mphSlider.hide();
    isDebugMode = false;
  }

  // determine
  if (!isDebugMode) {
    elapsedSec = (Date.now() - startTimeMs) / 1000;
  } else {
    elapsedSec = timeSlider.value();
  }
  timePercent = map(elapsedSec, 0, walkTimeSec, 0, 1.0);

  if (isDebugMode) {
    mph = mphSlider.value();
  }
  let speedPercent = map(mph, 0, maxMph, 0, 1.0);

  // Calculate a relax percent based on both time elapsed
  // and speed of movement.
  // As long as the user is moving,
  // the mean sequence should reduce in volume, the amount of
  // distortion should go down, and the bpm should slow down.
  let relaxPercent = 0.0;
  if (speedPercent <= 0.1) {
    // if the user is not moving
    relaxPercent = 0.0;
  } else {
    if (timePercent < 0.33) {
      relaxPercent += 0.33 * speedPercent + timePercent;
    } else if (timePercent >= 0.33 && timePercent <= 0.66) {
      relaxPercent += 0.66 * speedPercent + timePercent;
    } else {
      // getting close to the end
      relaxPercent += 0.8 * speedPercent + timePercent;
    }
  }

  let distortLevel = map(relaxPercent, 0, 1.0, 0.9, 0.2);
  let meanVolLevel = map(relaxPercent, 0, 1.0, 0, -30);
  let bpm = map(timePercent, 0, 1.0, 160, 60);

  if (isStarted && timePercent < 1) {
    dist.distortion = distortLevel;
    meanSynth.volume.value = meanVolLevel;
    Tone.getTransport().bpm.value = bpm;

    if (isDebugMode) {
      text(`volume: ${meanVolLevel}`, 10, 240);
      text(`bpm: ${Tone.getTransport().bpm.value}`, 10, 260);
      text(`distortion: ${distortLevel}`, 10, 222);
    }

    let saturation = map(relaxPercent, 0, 2, 100, 20);
    let wiggleAmount = map(relaxPercent, 0, 2, 3, 0);
    // console.log(`relaxPercent=${relaxPercent}, wiggle:=${wiggleAmount}`);
    // console.log('hi!')

   
    let numCircles = map(relaxPercent, 0, 1.5, circles.length, 0);
    for (let c = 0; c < numCircles; c++) {
      // Draw a circle, with hue determined by frameCount
      fill((f/3) + c, saturation, 90);
      circle(circles[c].x, circles[c].y, circles[c].size);
      circles[c] = {
        x: circles[c].x + random(-wiggleAmount, wiggleAmount),
        y: circles[c].y + random(-wiggleAmount, wiggleAmount),
        size: circles[c].size + random(-1,1),
      }
    }
    f += 5;
    if (f > 360) { // reset framecounter
      f = 0;
    }
  }

  if (isDebugMode) {
    text("lat:" + lat, 10, maxY - 40);
    text("long:" + long, 10, maxY - 20);
    text(`speedPercent: ${speedPercent}`, 10, 280);
    text(`timePercent: ${timePercent}`, 100, 20);
    text(`mph: ${mph}`, 100, 60);
    text(`relaxPercent: ${relaxPercent}`, 10, 210);
    text(`distortion: ${distortLevel}`, 10, 222);
  }
  
  document.querySelector("#mph").innerHTML = `mph: ${mph}`;
  document.querySelector("#timeLeft").innerHTML = `timeLeft: ${remainingSec}s`;

}

function startStop() {
  if (audioContext.state === "suspended") {
    audioContext.resume();
    Tone.getTransport().start();
  }
  
  if (!isStarted) {
    initGeo();
    
    if (audioContext.state !== 'running') {
      // on ios, sometimes it takes a few hundred ms for the audiocontext to be ready
      console.log(`startStopClicked() - Tone.context.state: ${Tone.context.state}`)
      console.log(`startStopClicked() - audioContext.state: ${audioContext.state}`)

      setTimeout(function() {
        console.log("waiting for audio context")
        initSound();
      }, 500);
    }
    else {
      initSound();
    }
    startTimeMs = Date.now();
    
    console.log(`end of startStopClicked() - Tone.context.state: ${Tone.context.state}`)
    document.querySelector("#start-stop-button").innerHTML = "stop";
  } else {
    stop();
  }
}

// called every time geolocation provides an update
function positionUpdated(pos) {
  const crd = pos.coords;
  const timestamp = pos.timestamp;
  lat = crd.latitude;
  long = crd.longitude;

  // add the current position to the circular buffer of positions
  lastPositions.push(pos);

  // use the difference between the first and last position in the buffer
  // to calculate mph
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
  console.error(`positionWatchError(${err.code}): ${err.message}`);
}

let geoHandlerId;

const initSound = async () => {
  console.log(`entered initSound - Tone.context.state: ${Tone.context.state}, audioContext.state: ${audioContext.state}`)

  // create two monophonic synths
  gain = new Tone.Gain(0).toDestination();
  niceSynth = new Tone.AMSynth().toDestination();
  revEffect = new Tone.Reverb(0.7).toDestination();
  niceSynth.connect(revEffect);

  meanSynth = new Tone.AMSynth().toDestination();
  dist = new Tone.Distortion(0.8).toDestination();
  meanSynth.connect(dist);

  const niceSynthSeq = new Tone.Sequence(
    (time, note) => {
      niceSynth.triggerAttackRelease(note, "8n", time);
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

  Tone.getTransport().start();
  isStarted = true;
  
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
  console.log("stopped Tone.js");
}

function getTonic() {
  let note = random(Tonal.Note.names());
  return addRandomAccidental(note);
}

function addRandomAccidental(note) {
  let accidental = random(["", "#", "b"]);
  if ((accidental === '#' && ["B", "E"].includes(note))
     || (accidental === 'b' && ["C", "F"].includes(note))) {
    return note;
  }
  return note + accidental;
}

function getNiceNotes(tonic) {
  let notes = [1, 3, 5, 8]
    .map(Tonal.Scale.degrees(tonic + " major"));
  
  notes[0] = notes[0] + "3";
  notes[1] = notes[1] + "3";
  notes[2] = notes[2] + "3";
  notes[3] = notes[3] + "4"; // one octave higher
  
  console.log(`niceNotes: ${notes}`);
  return notes;
}

function getMeanNotes(tonic) {
  let notes = [1, 3, 2, 8, 3, 5, 4]
    .map(Tonal.Scale.degrees(tonic + " minor"))
    .map((note) => note + random(["2","3","4"]));
  
  notes = shuffle(notes);

  console.log(`mean notes: ${notes}`)
  return notes;
}
