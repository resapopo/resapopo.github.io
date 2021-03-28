
/* This code is based on
*  https://rawgit.com/Miguelao/demos/master/mediarecorder.html
*  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
*
*  Use of the above source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/

'use strict';



class MyInputNumber extends HTMLElement {
  constructor() {
    super();

    var shadow = this.attachShadow({mode: 'open'});

    //var maxValue = this.getAttribute('max');
    var initValue = this.getAttribute('value');
    var id = this.getAttribute('id');

    const micGain = document.createElement('input');
    micGain.setAttribute('type', 'number');
    micGain.setAttribute('id', id);
    micGain.value = initValue;
    micGain.readOnly = true;

    const gainUpBtn = document.createElement('button');
    gainUpBtn.setAttribute('class', 'spiner');
    gainUpBtn.setAttribute('id', 'upBtn');
    gainUpBtn.innerHTML = '▲';
    gainUpBtn.addEventListener('click', {gain: micGain, max: this.getAttribute('max'), step: this.getAttribute('step'), handleEvent: gainUp});
    
    const gainDownBtn = document.createElement('button');
    gainDownBtn.setAttribute('class', 'spiner');
    gainDownBtn.setAttribute('id', 'downBtn');
    gainDownBtn.innerHTML = '▼';
    gainDownBtn.addEventListener('click', {gain: micGain, min: this.getAttribute('min'), step:this.getAttribute('step'), handleEvent: gainDown});
    
    shadow.appendChild(gainUpBtn);
    shadow.appendChild(micGain);
    shadow.appendChild(gainDownBtn);

    // Apply external styles to the shadow dom
    const linkElem = document.createElement('link');
    linkElem.setAttribute('rel', 'stylesheet');
    linkElem.setAttribute('href', 'css/custom_class.css');

    // Attach the created element to the shadow dom
    shadow.appendChild(linkElem);
  }

  connectedCallback() {
    updateState(this);
  }
  
  attributeChangedCallback(attrName, oldVal, newVal) {
    updateState(this);
  }
}

customElements.define('my-inputnumber', MyInputNumber);

function updateState(elem) {
  console.log('update');
  const shadow = elem.shadowRoot;
  var val = elem.getAttribute('value');
  var id = elem.getAttribute('id');
  var mx = elem.getAttribute('max');
  var mn = elem.getAttribute('min');
  var step = elem.getAttribute('step');

  var ip = shadow.querySelector('input');
  ip.value = val;
  ip.setAttribute('id', id);
  shadow.querySelector('button#upBtn').addEventListener('click', {gain: ip, max: mx, step: step, handleEvent: gainUp});
  shadow.querySelector('button#downBtn').addEventListener('click', {gain: ip, min: mn, step: step, handleEvent: gainDown});
}

/*
<div class="customInputNumber">
    <button class="spiner" id="upBtn">△</button>
    <input type="number" id="micGain" value="5" readonly>
    <button class="spiner" id="downBtn">▽</button>
</div>
*/

function gainUp() {
  var oldValue = Number(this.gain.value);
  if (oldValue < this.max) {
    var newValue = oldValue + 1*this.step;
    // gain.value = ("0" + newValue).slice(-2);
    this.gain.value = newValue;
  }
}


function gainDown() {
  var oldValue = Number(this.gain.value);
  if (oldValue > this.min) {
    var newValue = oldValue - 1*this.step;
    // gain.value = ("0" + newValue).slice(-2);
    this.gain.value = newValue;
  }
}


class MyCheckBox extends HTMLElement {
  constructor() {
    super();

    var shadow = this.attachShadow({mode: 'open'});

    var num = this.getAttribute('num');

    const dammyCheckBox = document.createElement('input');
    dammyCheckBox.setAttribute('type', 'checkbox');
    dammyCheckBox.setAttribute('id', `checkbox-${num}`);

    const customCheckBox = document.createElement('label');
    customCheckBox.setAttribute('for', `checkbox-${num}`);

    shadow.appendChild(dammyCheckBox);
    shadow.appendChild(customCheckBox);

    // Apply external styles to the shadow dom
    const linkElem = document.createElement('link');
    linkElem.setAttribute('rel', 'stylesheet');
    linkElem.setAttribute('href', 'css/custom_class.css');

    // Attach the created element to the shadow dom
    shadow.appendChild(linkElem);
  }
    
}

customElements.define('my-checkbox', MyCheckBox);

/*
<div id="customInputCheckbox">
      <input type="checkbox" id="check1">
      <label for="check1"></label>
</div>
*/


// define global variables

let mediaRecorder;
let encoderWorker;
let usingMediaRecorder = typeof window.MediaRecorder !== 'undefined';
  //false;
let config = {
  manualEncoderId: 'wav',
  micGain: 1.0,
  processorBufferSize: 2048,
  stopTracksAndCloseCtxWhenFinished: false,
  usingMediaRecorder: typeof window.MediaRecorder !== 'undefined',
  userMediaConstraints: { audio: { echoCancellation: false } }
};

// set codec in recomended order
let options = {mimeType: 'audio/ogg; codecs=opus'};
if (usingMediaRecorder) {
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    console.log(`${options.mimeType} is not supported`);
    options = {mimeType: 'audio/ogg; codecs=vorbis'};
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.log(`${options.mimeType} is not supported`);
      options = {mimeType: 'audio/webm; codecs=opus'};
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.log(`${options.mimeType} is not supported`);
        options = {mimeType: 'audio/mpeg'};
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          console.error(`${options.mimeType} is not supported`);
          options = {mimeType: ''};
        }
      }
    }
  }
}

// define global variables (continued...)

let myStream;

let micGainNode, micSource, micDestination;

let inputStreamNode;
let processorNode;
let destinationNode;

let encoderMimeType;

// AudioContext passed to mixing.js
let audioCtx;

// 
let mySampleRate = 48000; // ad hoc!

// 録音生データを格納
let recordedBlobs;

// 再生が有効なaudioへのアクセスを格納
//let myPlayList = [];

// selectedGainsを格納
let myGains = [];

// トラック番号
let index;
//let totalIndex = -1;

let buffer;


// set up handlers
const micOn = document.querySelector('button#start');
const recordedTracks = document.querySelector('div#tracks');
/*
var micGainRoot;
customElements.whenDefined('my-inputnumber').then(function () {
    micGainRoot = document.querySelector('my-inputnumber').shadowRoot;
    console.log(micGainRoot);
    const inputLevelSelector = micGainRoot.querySelector('input');
    // change mic level
    inputLevelSelector.addEventListener('change', changeMicrophoneLevel);
    function changeMicrophoneLevel(e) {
      console.log('mic gain changed');
      var value = e.target.value*0.2; 
      if(value && value >= 0 && value <= 2) { 
      micGainNode.gain.value = value; 
      }
    }
  });
  */

const micGainMonitor = document.querySelector('my-inputnumber').shadowRoot.querySelector('input');
const inputLevelSelector_0 = document.querySelector('my-inputnumber').shadowRoot.querySelector('button#upBtn');
const inputLevelSelector_1 = document.querySelector('my-inputnumber').shadowRoot.querySelector('button#downBtn');
// change mic level
inputLevelSelector_0.addEventListener('click', {target: micGainMonitor, handleEvent: changeMicrophoneLevel});
inputLevelSelector_1.addEventListener('click', {target: micGainMonitor, handleEvent: changeMicrophoneLevel});
function changeMicrophoneLevel() {
  console.log('mic gain changed');
  var value = this.target.value*0.2; 
  if(value && value >= 0 && value <= 2) { 
  micGainNode.gain.value = value; 
  }
}

// Great help
// https://stackoverflow.com/questions/55704303/event-listener-outside-of-shadow-dom-wont-bind-to-elements-inside-of-shadow-dom

const latencySelector = document.querySelector('input#latency');

// mic
micOn.addEventListener('click', async () => {
  const constraints = {
    audio: true,
    video: false
  };
  console.log('Using media constraints:', constraints);
  await init(constraints);
});

async function init(constraints) {
  navigator.mediaDevices.getUserMedia(constraints)
  .then(handleSuccess)
  .catch(handleError)
};

function handleSuccess(stream) {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  mySampleRate = audioCtx.sampleRate;
  
  recordButton.disabled = false;
  console.log('getUserMedia() got stream:', stream);
  recordButton.hidden = false;

  //
  micSource = audioCtx.createMediaStreamSource(stream);
  micGainNode = audioCtx.createGain();
  micDestination = audioCtx.createMediaStreamDestination();
  micSource.connect(micGainNode).connect(micDestination);
  
  myStream = micDestination.stream;

  if (!usingMediaRecorder) {

  };

  micOn.disabled = true;
  micOn.hidden = true;
  recordButton.hidden = false;
  recordButton.disabled = false;

}

function handleError() {
  console.error('navigator.getUserMedia error:', e);
  errorMsgElement.innerHTML = `navigator.getUserMedia error:${e.toString()}`;
};

// latency level
let latency = 100;

const wait = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

latencySelector.addEventListener('change', changeLatencyLevel);
function changeLatencyLevel(e) {
  var value = e.target.value; 
  latency = value; 
  console.log(`latency changed: ${latency}`);
};


// start recording
const recordButton = document.querySelector('button#record');
recordButton.addEventListener('click', () => {
  if (recordButton.dataset.icon === 'R') {
    
    let [_myPlayList, _myGains, _mySchedules] = pickUp();
    
    if (_myPlayList.length > 0) {
      if (usingMediaRecorder) {
        overDub(_myPlayList, _myGains, _mySchedules);
      } else {
        overDubIos(_myPlayList, _myGains);
      };
    } else {
      if (usingMediaRecorder) {
        startRecording();
      } else {
        startRecordingIos();
      };
    } 
  } else if (recordButton.dataset.icon === 'S') {
    // recordButton.textContent = 'リストに追加';
    if (usingMediaRecorder) {
      stopRecording();
    } else {
      stopRecordingIos();
      // for iOS, have to rewarm getUserMedia
      const constraints = {
        audio: true,
        video: false
      };
      console.log('Using media constraints:', constraints);
      init(constraints);
    };
    if (buffer) {buffer.stop()};
    //playButton.disabled = false;
  }/* else { // when recordButton.textContent === 'Add Recorded Track'
    const superBuffer = new Blob(recordedBlobs, {type: 'audio/mp3'}); 
    createNewPanel(window.URL.createObjectURL(superBuffer));
    recordButton.textContent = '録音';
  }*/;
});

function pickUp() {
  let myPlayList = [];
  let myGains = [];
  let mySchedules = [];

  //if (myPlayList.length > 0) {
    for (var i=0; i<recordedTracks.childElementCount; i++) {
      var panel = recordedTracks.children[i];
      if (panel.querySelector('my-checkBox').shadowRoot.querySelector('input').checked) {
        var src = panel.querySelector('audio').src;
        myPlayList.push(src);
        var g = panel.querySelector('my-inputnumber#selGain').shadowRoot.querySelector('input').value*0.01;
        myGains.push(g);
        var s = panel.querySelector('my-inputnumber#schedule').shadowRoot.querySelector('input').value*0.001;
        mySchedules.push(s);
        
      }
    }
  //};
  console.log(myGains);
  console.log(mySchedules);
  return [myPlayList, myGains, mySchedules];
}


function startRecording() {
  
  // 初期化
  recordedBlobs = [];

  mediaRecorder = new MediaRecorder(myStream, options);
  
  console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
  recordButton.innerHTML = 'Stop</br>';
  recordButton.setAttribute('data-icon','S');
  playallButton.disabled = true;
  downloadButton.disabled = true;
  mediaRecorder.onstop = (event) => {
    console.log('Recorder stopped: ', event);
    console.log('Recorded Blobs: ', recordedBlobs);
    
    var superBuffer = new Blob(recordedBlobs, {type: 'audio/mp3'}); 
    //console.log(superBuffer);
    var objectUrl = window.URL.createObjectURL(superBuffer);
    console.log(objectUrl);
    createNewPanel(objectUrl);
    //window.URL.revokeObjectURL(objectU);
    recordButton.innerHTML = 'Rec</br>';
    recordButton.setAttribute('data-icon','R');
  };
  mediaRecorder.ondataavailable = handleDataAvailable;
  //mediaRecorder = readyRecording();
  mediaRecorder.start();
  console.log('MediaRecorder started', mediaRecorder);
};
// startRecording

function stopRecording() {
  mediaRecorder.stop();
}

function overDub(playList, gains, schedules=0) {
  let readyedBuffer = load(playList).then(createdBuffer => mixDown(createdBuffer, gains, schedules))
                                  .then(mixedBuffer => ready(mixedBuffer))
                                  .catch(console.log('error in overDub'));
  let readyMediaRecorder = readyRecording();

  Promise.all([readyedBuffer, readyMediaRecorder])
    .then(result => {
      buffer = result[0];
      result[0].start();
      wait(latency)
        .then(() => result[1].start())
        .catch(e => console.error(e));
    })
    .catch(console.log('error in overDub'));
}

function handleDataAvailable(event) {
  console.log('handleDataAvailable', event);
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
  };
};

function startRecordingIos() {
  // 初期化
  recordedBlobs = [];

  recordButton.innerHTML = 'Stop</br>';
  recordButton.setAttribute('data-icon','S');
  //recordButton.textContent = '停止';
  downloadButton.disabled = true;

  // for ios, edge
  //
  encoderWorker = new Worker('js/encoder-wav-worker.js')
  encoderMimeType = 'audio/wav'
  // 不要？
  console.log('Created EncoderWorker', encoderWorker, 'with MimeType', encoderMimeType);


  // 'dataavailable'イベントにdataとしてblobを載せる
  encoderWorker.addEventListener('message', (e) => {
    //let event = new Event('dataavailable');
    let blb = new Blob(e.data, { type: encoderMimeType });
    console.log('posted data', e.data);
    handleDataAvailableIos(blb);
    closeWorker();
  });

  inputStreamNode = audioCtx.createMediaStreamSource(myStream);

  processorNode = audioCtx.createScriptProcessor(config.processorBufferSize, 1, 1);

  // we dont use destinationNode, but, it seems to be needed for activation of ScriptProcessor
  // https://github.com/WebAudio/web-audio-api/issues/345
  destinationNode = audioCtx.createMediaStreamDestination();
  // TODO: Get the number of channels from mic

  processorNode.onaudioprocess = (e) =>
  {
    // console.log('buffer to be encoded', e.inputBuffer.getChannelData(0));
    encoderWorker.postMessage(['encode', e.inputBuffer.getChannelData(0)]);
  };

  launchRecordingIos();
  //inputStreamNode.connect(processorNode);
  //processorNode.connect(destinationNode);
  
};

function handleDataAvailableIos(blob) {
  if (blob && blob.size > 0) {
    recordedBlobs.push(blob);
    console.log('blob: ', blob);
    // blob
    console.log('blob.size: ', blob.size);
    // blob.size
  };
    console.log('Recorder stopped: ', blob);
    console.log('Recorded Blobs: ', recordedBlobs);

    const superBuffer = new Blob(recordedBlobs, {type: 'audio/mp3'}); 
    createNewPanel(window.URL.createObjectURL(superBuffer));
    recordButton.innerHTML = 'Rec</br>';
    recordButton.setAttribute('data-icon','R');
    //recordButton.textContent = '録音';
};

function closeWorker() {

  // workerメモリの開放
  
  /*
  if (destinationNode!==null) {
    destinationNode.disconnect()
    destinationNode = null
  }
  */

  /*
  if (outputGainNode!==null) {
    outputGainNode.disconnect()
    outputGainNode = null
  }
  */

  if (processorNode!==null) {
    processorNode.disconnect()
    processorNode = null
  }

  if (encoderWorker!==null) {
    encoderWorker.postMessage(['close'])
    // encoderWorker = null
  }

  /*
  if (micGainNode!==null) {
    micGainNode.disconnect()
    micGainNode = null
  }
  */

  if (inputStreamNode!==null) {
    inputStreamNode.disconnect()
    inputStreamNode = null
  }

  if (config.stopTracksAndCloseCtxWhenFinished) {
    /*
    // This removes the red bar in iOS/Safari
    micAudioStream.getTracks().forEach((track) => track.stop())
    micAudioStream = null
    */

    audioCtx.close()
    audioCtx = null
  }
};
// startRecordingIos

/*
function _onError (evt) {
  console.log('error', evt)
  this.em.dispatchEvent(new Event('error'))
  alert('error:' + evt) // for debugging purposes
};
*/

function stopRecordingIos() {
  encoderWorker.postMessage(['dump', audioCtx.sampleRate]);
}

function createNewPanel(audioSrc, givenName = 'new') {

  let newTrack = document.createElement('audio');
  //let newIdx = totalIndex + 1;
  newTrack.setAttribute('id', 'recorded');
  newTrack.src = null;
  newTrack.srcObject = null;
  newTrack.src = audioSrc;
  newTrack.controls = false;

  let checkBox = new MyCheckBox;
  checkBox.style.width = '4em';
  let dammyCheckBox = checkBox.shadowRoot.querySelector('input');
  dammyCheckBox.setAttribute('checked', 'true');
 
  //let checkBox = document.createElement('input');
  //checkBox.setAttribute('type', 'checkbox');
  //checkBox.setAttribute('checked', 'true');
  dammyCheckBox.addEventListener('click', (e) => {
    console.log(e.target);

    checkBox.parentNode.lastElementChild.disabled = e.target.checked ? true : false;
  });

  /*
  let trackNumber = document.createElement('span');
  trackNumber.setAttribute('id', 'trackNm');
  trackNumber.innerText = newIdx;
  */

  let selectedGain = document.createElement('my-inputnumber');
  //let selectedGain = document.createElement('input');
  //selectedGain.setAttribute('type', 'number');
  selectedGain.setAttribute('id', 'selGain');
  selectedGain.setAttribute('value', 100);
  selectedGain.setAttribute('step', '1');
  selectedGain.setAttribute('min', '1');
  selectedGain.setAttribute('max', 100);


  let selectedSchedule = document.createElement('my-inputnumber');
  //let selectedGain = document.createElement('input');
  //selectedGain.setAttribute('type', 'number');
  selectedSchedule.setAttribute('id', 'schedule');
  selectedSchedule.setAttribute('value', 0);
  selectedSchedule.setAttribute('step', '10');
  selectedSchedule.setAttribute('min', 0);
  selectedSchedule.setAttribute('max', 2000);

  
  //let checkBoxDelete = document.createElement('input');
  //checkBoxDelete.setAttribute('type', 'checkbox');
  //checkBoxDelete.setAttribute('id', 'delete');
  //checkBoxDelete.hidden = true;

  let trackName = document.createElement('input');
  trackName.setAttribute('type', 'text');
  trackName.value = givenName;

  let deleteBtn = document.createElement('button');
  deleteBtn.setAttribute('class', "iconButton");
  deleteBtn.setAttribute('id', "delBtn");
  deleteBtn.setAttribute('data-icon', "T");
  deleteBtn.disabled = true;
  deleteBtn.addEventListener('click', (e) => {
    var _panel = e.target.parentNode;
    deletePanel(_panel);
  });

  /*
  *  1. 再生位置指定
  *   a. 開始位置をフォームで指定できるようにする
  *   b. フォームに変更があるたびに
  *      media.currentTimeで代入を行う
  */

  let newPanel = document.createElement('div');
  newPanel.setAttribute('id', 'panel');
  newPanel.appendChild(newTrack);
  newPanel.appendChild(checkBox);
  //newPanel.appendChild(trackNumber);
  newPanel.appendChild(selectedGain);
  newPanel.appendChild(selectedSchedule);
  newPanel.appendChild(trackName);
  newPanel.appendChild(deleteBtn);
  
  recordedTracks.appendChild(newPanel);
  
  downloadButton.disabled = false;
  playallButton.disabled = false;  
}


function deletePanel(panel) {
  window.URL.revokeObjectURL(panel.querySelector('audio').src);
  while (panel.firstChild) {
    panel.removeChild(panel.firstChild);
  };
  panel.parentNode.removeChild(panel);
}


// download mixed data as mp3
const downloadButton = document.querySelector('button#download');
downloadButton.addEventListener('click', () => {
//  const blob = new Blob(recordedBlobs, {type: 'audio/mp3'});
  if (recordedTracks.childElementCount < 1) {
    alert('There is no data can be downloaded!');
    downloadButton.disabled = true;
  } else {
    let [_myPlayList, _myGains] = pickUp();

    load(_myPlayList)
          .then(createdBuffers => mixDown(createdBuffers, _myGains))
          .then(mixedBuffer => toMp3(mixedBuffer))
          .then(myUrl => {index = 'mixed'; console.log(myUrl); return downloadUrl(myUrl)})
          .catch(console.log('error in downloadUrl'));
  }
});

function toMp3(buffer) {
  var channels = 1; //1 for mono or 2 for stereo
  var sampleRate = mySampleRate; //44.1khz (normal mp3 samplerate)
  var kbps = 128; //encode 128kbps mp3
  var mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
  var mp3Data = [];

  // modification
  // https://github.com/zhuker/lamejs/issues/10
  var rawData = buffer.getChannelData(0);
  var samples = new Int16Array(rawData.length);
  for (var i=0;i<rawData.length;i++) {
    samples[i] = rawData[i]*32767.5;
  };
  var sampleBlockSize = 1152; //can be anything but make it a multiple of 576 to make encoders life easier

  for (var i = 0; i < samples.length; i += sampleBlockSize) {
    var sampleChunk = samples.subarray(i, i + sampleBlockSize);
    var mp3buf = mp3encoder.encodeBuffer(sampleChunk);
    if (mp3buf.length > 0) {
        mp3Data.push(new Int8Array(mp3buf));
    }
  };

  var mp3buf = mp3encoder.flush();   //finish writing mp3

  if (mp3buf.length > 0) {
    mp3Data.push(new Int8Array(mp3buf));
  };

  var blob = new Blob(mp3Data, {type: 'audio/mp3'});
  var url = window.URL.createObjectURL(blob);
  console.log('MP3 URl: ', url);
  return url;

  // from README.md of lamejs

};

function downloadUrl(url) {
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = `mixed.mp3`;
  document.body.appendChild(a);
  a.click();
  // メインスレッドが完了したらa要素を取り除く(便宜上100ms指定)
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
};
//

// play all checked track
// mixing-new.js
const playallButton = document.querySelector('button#playall');
playallButton.addEventListener('click', () => {

  if (playallButton.dataset.icon === 'P') {
    let [_myPlayList, _myGains, _mySchedules] = pickUp();
    if (!(_myPlayList.length===0)) {
      playAll(_myPlayList, _myGains, _mySchedules);
      playallButton.innerHTML = 'Stop</br>';
      playallButton.setAttribute('data-icon','S');
    };
  } else { // playallButton.data-icon === 'S'
    if (buffer) {buffer.stop(); 
      playallButton.innerHTML = 'Play</br>';
      playallButton.setAttribute('data-icon','P');};
  };

});


function playAll(playList, gains, schedules=0) {
  if (playList.length > 0) {
    load(playList)
      .then(createdBuffer => mixDown(createdBuffer, gains, schedules))
      .then(mixedBuffer => ready(mixedBuffer))
      .then(readyedBuffer => 
        {buffer=readyedBuffer; 
         readyedBuffer.addEventListener('ended', () => {playallButton.innerHTML = 'Play</br>';
                                                         playallButton.setAttribute('data-icon','P');});
         readyedBuffer.start()})
      .catch(console.log('error in playAll'));
  }
};

// ready bufferSourceNode
function ready(audioBuffer) {
  // 
  // creat AudioBufferSourceNode instance
  const mix = context.createBufferSource();
  
  mix.buffer = audioBuffer;

  mix.connect(context.destination);

  console.log(mix);
  return mix;
}

function readyRecording() {
  return new Promise ((resolve, reject) => {
    // 初期化
    recordedBlobs = [];

    mediaRecorder = new MediaRecorder(myStream, options);

    console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
    recordButton.innerHTML = 'Stop</br>';
    recordButton.setAttribute('data-icon','S');
    playallButton.disabled = true;
    downloadButton.disabled = true;
    mediaRecorder.onstop = (event) => {
      console.log('Recorder stopped: ', event);
      console.log('Recorded Blobs: ', recordedBlobs);
      
      var superBuffer = new Blob(recordedBlobs, {type: 'audio/mp3'}); 
      //console.log(superBuffer);
      createNewPanel(window.URL.createObjectURL(superBuffer));
      recordButton.innerHTML = 'Rec</br>';
      recordButton.setAttribute('data-icon','R');
    };
    mediaRecorder.ondataavailable = handleDataAvailable;
    
    resolve(mediaRecorder);
  })
  
}

function overDubIos(playList, gains) {
  let readyedBuffer = load(playList).then(createdBuffer => mixDown(createdBuffer, gains))
                                  .then(mixedBuffer => ready(mixedBuffer))
                                  .catch(e => console.error(e));
  let readyEncoderWorker = readyRecordingIos();

  Promise.all([readyedBuffer, readyEncoderWorker])
    .then(result => {
      result[0].start();
      wait(latency)
        .then(() => launchRecordingIos())
        .catch(e => console.error(e));
    })
    .catch(console.log('error in overDub'));
}

function readyRecordingIos() {
  return new Promise ((resolve, reject) => {

      // 初期化
    recordedBlobs = [];

    recordButton.textContent = 'Stop';
    recordButton.setAttribute('data-icon','S');
    //recordButton.textContent = '停止';
    downloadButton.disabled = true;
  
    // for ios, edge
    //
    encoderWorker = new Worker('js/encoder-wav-worker.js')
    encoderMimeType = 'audio/wav'
    // 不要？
    console.log('Created EncoderWorker', encoderWorker, 'with MimeType', encoderMimeType);


    // 'dataavailable'イベントにdataとしてblobを載せる
    encoderWorker.addEventListener('message', (e) => {
      //let event = new Event('dataavailable');
      let blb = new Blob(e.data, { type: encoderMimeType });
      console.log('posted data', e.data);
      handleDataAvailableIos(blb);
      closeWorker();
    });

    inputStreamNode = audioCtx.createMediaStreamSource(myStream);

    processorNode = audioCtx.createScriptProcessor(config.processorBufferSize, 1, 1);

    // we dont use destinationNode, but, it seems to be needed for activation of ScriptProcessor
    // https://github.com/WebAudio/web-audio-api/issues/345
    destinationNode = audioCtx.createMediaStreamDestination();
    // TODO: Get the number of channels from mic

    processorNode.onaudioprocess = (e) =>
    {
      // console.log('buffer to be encoded', e.inputBuffer.getChannelData(0));
      encoderWorker.postMessage(['encode', e.inputBuffer.getChannelData(0)]);
    };

    resolve(encoderWorker);

  })
  
}

function launchRecordingIos() {
    // connect nodes to fire encoderWorker
    inputStreamNode.connect(processorNode);
    processorNode.connect(destinationNode);
}


// upload pre-recorded (local) file
const uploadButton = document.querySelector('input#upload');
uploadButton.addEventListener('change', function(e) {
  var file = e.target.files[0]; 
  createNewPanel(URL.createObjectURL(file), file.name);
});




const ongenNinzu = document.querySelector('input#A');
const konkaiNinzu = document.querySelector('input#B');
const suggestOngenLevel = document.querySelector('span#C');
const suggestKonkaiLevel = document.querySelector('span#D');

ongenNinzu.addEventListener('change', hint);
konkaiNinzu.addEventListener('change', hint);

function hint() {
  suggestOngenLevel.textContent = Math.round(eval(100*eval(ongenNinzu.value/eval(eval(ongenNinzu.value) + eval(konkaiNinzu.value)))));
  suggestKonkaiLevel.textContent = Math.round(eval(100*eval(1/(eval(ongenNinzu.value)+eval(konkaiNinzu.value)))));
};


function SendErrorMsg (methodName,errorMessage) {
	var ut = navigator.userAgent;
	var postData = {"methodName":methodName,"errorMessage":errorMessage,"userAgent":ut};
	$.post("https://prod-12.japaneast.logic.azure.com:443/workflows/4a1b48dd6d9d45e7a4997c21abeacdc7/triggers/manual/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=64EMXa3MMqVk3YAhWG5ghzsHe-Xna6YJvW0l99xbfOk", postData);
} 