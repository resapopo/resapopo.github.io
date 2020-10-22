
/* This code is based on
*  https://rawgit.com/Miguelao/demos/master/mediarecorder.html
*  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
*
*  Use of the above source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/

'use strict';


// define global variables

let mediaRecorder;
let encoderWorker;
let usingMediaRecorder = typeof window.MediaRecorder !== 'undefined';
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
let myPlayList = [];

// selectedGainsを格納
let myGains = [];

// トラック番号
let index;
let totalIndex = -1;

let buffer;


// set up handlers
const micOn = document.querySelector('button#start');
const recordedTracks = document.querySelector('div#tracks')
const inputLevelSelector = document.querySelector('input#inSel');
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

}

function handleError() {
  console.error('navigator.getUserMedia error:', e);
  errorMsgElement.innerHTML = `navigator.getUserMedia error:${e.toString()}`;
};

// change mic level
inputLevelSelector.addEventListener('change', changeMicrophoneLevel);
function changeMicrophoneLevel(e) {
  var value = e.target.value*0.2; 
  if(value && value >= 0 && value <= 2) { 
   micGainNode.gain.value = value; 
  } 
}

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
  if (recordButton.textContent === '録音') {
    
    let [_myPlayList, _myGains] = pickUp();
    
    if (_myPlayList.length > 0) {
      if (usingMediaRecorder) {
        overDub(_myPlayList, _myGains);
      } else {
        overDubIos(_myPlayList);
      };
    } else {
      if (usingMediaRecorder) {
        startRecording();
      } else {
        startRecordingIos();
      };
    } 
  } else if (recordButton.textContent === '停止') {
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
  let _myPlayList = [];
  let _myGains = [];

  if (myPlayList.length > 0) {
    for (var i=0; i<myPlayList.length; i++) {
      if (recordedTracks.children[i].children[1].checked) {
        _myPlayList.push(myPlayList[i]);
        var g = recordedTracks.children[i].children[2].value*0.01;
        _myGains.push(g);
      }
    }
  };
  return [_myPlayList, _myGains];
}

function startRecording() {
  
  // 初期化
  recordedBlobs = [];

  mediaRecorder = new MediaRecorder(myStream, options);
  
  console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
  recordButton.textContent = '停止';
  //playButton.disabled = true;
  downloadButton.disabled = true;
  mediaRecorder.onstop = (event) => {
    console.log('Recorder stopped: ', event);
    console.log('Recorded Blobs: ', recordedBlobs);
    
    var superBuffer = new Blob(recordedBlobs, {type: 'audio/mp3'}); 
    console.log(superBuffer);
    createNewPanel(window.URL.createObjectURL(superBuffer));
    recordButton.textContent = '録音';
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

function overDub(playList, gains) {
  let readyedBuffer = load(playList).then(createdBuffer => mixDown(createdBuffer, gains))
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

  recordButton.textContent = '停止';
  playButton.disabled = true;
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
  let newIdx = totalIndex + 1;
  newTrack.setAttribute('id', `recorded-${newIdx}`);
  newTrack.src = null;
  newTrack.srcObject = null;
  newTrack.src = audioSrc;
  newTrack.controls = false;

  let checkBox = document.createElement('input');
  checkBox.setAttribute('type', 'checkbox');
  checkBox.setAttribute('checked', 'true');
  checkBox.disabled = false;

  let selectedGain = document.createElement('input');
  selectedGain.setAttribute('type', 'number');
  selectedGain.setAttribute('id', 'selGain');
  selectedGain.setAttribute('value', '100');
  selectedGain.setAttribute('step', '1');
  selectedGain.setAttribute('min', '0');
  selectedGain.setAttribute('max', '100');
  
  let trackName = document.createElement('span');
  trackName.innerText = givenName;

  let checkBoxDelete = document.createElement('input');
  checkBoxDelete.setAttribute('type', 'checkbox');
  checkBoxDelete.setAttribute('id', 'delete');
  checkBoxDelete.hidden = true;

  // プレイリストに追加
  myPlayList.push(newTrack.src);
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
  newPanel.appendChild(selectedGain);
  newPanel.appendChild(trackName);
  newPanel.appendChild(checkBoxDelete);
  
  recordedTracks.appendChild(newPanel);
  
  downloadButton.disabled = false;
  playallButton.disabled = false;
  popButton.disabled = false;
  
}


// delete choosen track
const popButton = document.querySelector('button#pop');
popButton.addEventListener('click', () => {
  if (popButton.textContent === '編集') {
    for (var i=0; i<recordedTracks.childElementCount; i++) {
      recordedTracks.childNodes[i].children[1].disabled = true;
      recordedTracks.childNodes[i].lastElementChild.hidden = false;
    };
    popButton.textContent = '削除';
  } else {
    for (var i=recordedTracks.childElementCount-1; i>-1; i--) {
      if (recordedTracks.childNodes[i].lastElementChild.checked === true) {
        deleteTrack(i);
      };
    };

    for (var i=0; i<recordedTracks.childElementCount; i++) {
      recordedTracks.childNodes[i].children[1].disabled = false;
      recordedTracks.childNodes[i].lastElementChild.hidden = true;
    };
    popButton.textContent = '編集';
  }      
});

function deleteTrack(index) {

  //if (recordedTracks.childNodes[index].childNodes[2] = 'new') {
    var isYourDecision = confirm(`Make sure to delite the track-${index}. (トラック${index}を消してもいいですか)`);
    if (isYourDecision) {
      let deletedDiv = recordedTracks.childNodes[index];
      let deletedTrack = deletedDiv.firstElementChild;
      deletedDiv.removeChild(deletedTrack);
      recordedTracks.removeChild(deletedDiv);
      myPlayList.splice(index,1);
    }
}

/* for recoverly
const popButton = document.querySelector('button#pop');
popButton.addEventListener('click', () => {
  index = formInputDelete.value;
  if (recordedTracks.childElementCount > 0 &&
    index < recordedTracks.childElementCount+1 &&
    index > 0) {

    //if (recordedTracks.childNodes[index].childNodes[2] = 'new') {
      var isYourDecision = confirm(`Make sure to delite the track-${index}. (トラック${index}を消してもいいですか)`);
      if (isYourDecision) {
        let deletedDiv = recordedTracks.childNodes[index-1];
        let deletedTrack = deletedDiv.firstElementChild;
        deletedDiv.removeChild(deletedTrack);
        recordedTracks.removeChild(deletedDiv);
        myPlayList.splice(index-1,1);
        
        formInputDelete.setAttribute('max', recordedTracks.childElementCount);

      }
  }
    
})
*/



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
          .then(createdBuffers => {console.log(createdBuffers[0].sampleRate); return mixDown(createdBuffers, _myGains)})
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

  if (playallButton.textContent === '再生') {
    let [_myPlayList, _myGains] = pickUp();
    playAll(_myPlayList, _myGains);
    playallButton.textContent = '停止';
  } else { // playallButton.textContent === '停止'
    if (buffer) {buffer.stop(); playallButton.textContent = '再生';};
  };

});

function playAll(playList, gains) {
  if (playList.length > 0) {
    load(playList)
      .then(createdBuffer => mixDown(createdBuffer, gains))
      .then(mixedBuffer => ready(mixedBuffer))
      .then(readyedBuffer => 
        {buffer=readyedBuffer; 
          readyedBuffer.addEventListener('ended', () => {playallButton.textContent = '再生'});
          readyedBuffer.start();})
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

  return mix;
}

function readyRecording() {
  return new Promise ((resolve, reject) => {
    // 初期化
    recordedBlobs = [];

    mediaRecorder = new MediaRecorder(myStream, options);

    console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
    recordButton.textContent = '停止';
    //playButton.disabled = true;
    downloadButton.disabled = true;
    mediaRecorder.onstop = (event) => {
      console.log('Recorder stopped: ', event);
      console.log('Recorded Blobs: ', recordedBlobs);
      
      var superBuffer = new Blob(recordedBlobs, {type: 'audio/mp3'}); 
      console.log(superBuffer);
      createNewPanel(window.URL.createObjectURL(superBuffer));
      recordButton.textContent = '録音';
    };
    mediaRecorder.ondataavailable = handleDataAvailable;
    
    resolve(mediaRecorder);
  })
  
}

function overDubIos(playList) {
  let readyedBuffer = load(playList).then(createdBuffer => mixDown(createdBuffer))
                                  .then(mixedBuffer => ready(mixedBuffer))
                                  .catch(console.log('error in overDub'));
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

    recordButton.textContent = '停止';
    playButton.disabled = true;
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
