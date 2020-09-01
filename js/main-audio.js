/*
*  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
*
*  Use of this source code is governed by a BSD-style license
*  that can be found in the LICENSE file in the root of the source
*  tree.
*/

// This code is adapted from
// https://rawgit.com/Miguelao/demos/master/mediarecorder.html

'use strict';

/* globals MediaRecorder */

let mediaRecorder;
let encoderWorker;
let usingMediaRecorder = typeof window.MediaRecorder !== 'undefined';
                         // false;
let config = {
  manualEncoderId: 'wav',
  micGain: 1.0,
  processorBufferSize: 2048,
  stopTracksAndCloseCtxWhenFinished: false,
  usingMediaRecorder: typeof window.MediaRecorder !== 'undefined',
  //userMediaConstraints: { audio: true }
  userMediaConstraints: { audio: { echoCancellation: false } }
};

let myStream;

let micGainNode, micSource, micDestination;

let inputStreamNode;
let processorNode;
let destinationNode;

let encoderMimeType;

// AudioContext is passed to mixing.js
let audioCtx;
// ctxt = new AudioContext();

// 
let mySampleRate;

// 録音生データを格納
let recordedBlobs;

// 再生が有効なaudioへのアクセスを格納
let myPlayList = [];

// トラック番号
let index;
let totalIndex = -1;

//
let buffer;

// ハンドラの設定
const errorMsgElement = document.querySelector('span#errorMsg');
// const recordedAudio = document.querySelector('audio#recorded');
// ではなくリストに格納する
//const recordedTracks = document.querySelector('ol#tracks')
const recordedTracks = document.querySelector('div#tracks')
const recordButton = document.querySelector('button#record');
//
const inputLevelSelector = document.querySelector('select#inSel');
inputLevelSelector.addEventListener('change', changeMicrophoneLevel);
//const inputLevelMonitor = document.querySelector('span#inSel');
//inputLevelSelector.addEventListener('change', monitorValue)
const latencySelector = document.querySelector('select#latency');
latencySelector.addEventListener('change', changeLatencyLevel);
const formInputDelete = document.querySelector('input#index_for_delete');
const formInput = document.querySelector('input#index');


// access your mic
document.querySelector('button#start').addEventListener('click', async () => {
  // const hasEchoCancellation = document.querySelector('#echoCancellation').checked;
  const constraints = {
    audio: true
    /*{
      echoCancellation: {exact: hasEchoCancellation}
    }*/,
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
  //const src = audioCtx.createMediaStreamSource(stream);

  recordButton.disabled = false;
  console.log('getUserMedia() got stream:', stream);

  //
  micSource = audioCtx.createMediaStreamSource(stream);
  micGainNode = audioCtx.createGain();
  micDestination = audioCtx.createMediaStreamDestination();
  micSource.connect(micGainNode).connect(micDestination);
  // micGainNode.gain.value = 1;
  
  myStream = micDestination.stream;

  if (!usingMediaRecorder) {

  };

}

function handleError() {
  console.error('navigator.getUserMedia error:', e);
  errorMsgElement.innerHTML = `navigator.getUserMedia error:${e.toString()}`;
};
// access your mic

// change mic level
function changeMicrophoneLevel(e) {
  var value = e.target.value; 
  if(value && value >= 0 && value <= 2) { 
   micGainNode.gain.value = value; 
  } 
}

// monitor current level
function monitorValue(e) {
  inputLevelMonitor.innerHTML = e.target.value;
};

// レコードボタン
recordButton.addEventListener('click', () => {
  if (recordButton.textContent === '録音') {
    
    let _myPlayList = [];
    if (myPlayList.length > 0) {
      for (var i=0; i<myPlayList.length; i++) {
        if (recordedTracks.children[i].children[1].checked) {
          _myPlayList.push(myPlayList[i]);
        }
      }
    };
    
    
    if (usingMediaRecorder) {
      if (_myPlayList.length > 0) {
        overDub(_myPlayList);
      } else {
        startRecording();
      };
    } else {
      if (_myPlayList.length > 0) {
        overDubIos(_myPlayList);
      } else {
        startRecordingIos();
      };
    } 
  } else if (recordButton.textContent === '停止') {
    if (usingMediaRecorder) {
      stopRecording();
    } else {
      stopRecordingIos();
      // for iOS, have to rewarm getUserMedia
      const constraints = {
        audio: true
        /*{
          echoCancellation: {exact: hasEchoCancellation}
        }*/,
        video: false
      };
      console.log('Using media constraints:', constraints);
      init(constraints);
    };
    if (buffer) {buffer.stop()};
    recordButton.textContent = 'リストに追加';
    playButton.disabled = false;
  } else { // when recordButton.textContent === 'Add Recorded Track'
    const superBuffer = new Blob(recordedBlobs, {type: 'audio/mp3'}); 
    createNewPanel(window.URL.createObjectURL(superBuffer));
    recordButton.textContent = '録音';
  };
});
//recordButton

function startRecording() {
  // 初期化
  recordedBlobs = [];
  // コーデックを推奨順に指定
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

  try {
    mediaRecorder = new MediaRecorder(myStream, options);
  } catch (e) {
    console.error('Exception while creating MediaRecorder:', e);
    errorMsgElement.innerHTML = `Exception while creating MediaRecorder: ${JSON.stringify(e)}`;
    return;
  }

  console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
  recordButton.textContent = '停止';
  playButton.disabled = true;
  downloadButton.disabled = true;
  mediaRecorder.onstop = (event) => {
    console.log('Recorder stopped: ', event);
    console.log('Recorded Blobs: ', recordedBlobs);
  };
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start();
  console.log('MediaRecorder started', mediaRecorder);
};
// startRecording

function startRecordingIos() {
  // 初期化
  recordedBlobs = [];

  recordButton.textContent = '停止';
  playButton.disabled = true;
  downloadButton.disabled = true;
/*      mediaRecorder.onstop = (event) => {
    console.log('Recorder stopped: ', event);
    console.log('Recorded Blobs: ', recordedBlobs);
  };
*/
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


  /* for manipulation
  let micGainNode = audioCtx.createGain();
  let outputGainNode = audioCtx.createGain();

  inputStreamNode.connect(micGainNode);
  micGainNode.gain.setValueAtTime(config.micGain, audioCtx.currentTime);
  outputGainNode.gain.setValueAtTime(0, audioCtx.currentTime);

  micGainNode.connect(processorNode);
  processorNode.connect(outputGainNode);
  outputGainNode.connect(destinationNode);
  */

  inputStreamNode.connect(processorNode);
  processorNode.connect(destinationNode);
  
};

function handleDataAvailable(event) {
  console.log('handleDataAvailable', event);
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
    console.log('event.data: ', event.data);
    // blob
    console.log('event.data.size: ', event.data.size);
    // blob.size
  };
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


function stopRecording() {
    mediaRecorder.stop();
}

function stopRecordingIos() {
  encoderWorker.postMessage(['dump', audioCtx.sampleRate]);
}
//

function readyRecording() {
  return new Promise ((resolve, reject) => {
    // 初期化
    recordedBlobs = [];

    // コーデックを推奨順に指定
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

    try {
      mediaRecorder = new MediaRecorder(myStream, options);
    } catch (e) {
      console.error('Exception while creating MediaRecorder:', e);
      errorMsgElement.innerHTML = `Exception while creating MediaRecorder: ${JSON.stringify(e)}`;
      return;
    }

    console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
    recordButton.textContent = '停止';
    playButton.disabled = true;
    downloadButton.disabled = true;
    mediaRecorder.onstop = (event) => {
      console.log('Recorder stopped: ', event);
      console.log('Recorded Blobs: ', recordedBlobs);
    };
    mediaRecorder.ondataavailable = handleDataAvailable;
    
    resolve(mediaRecorder);
  })
  
}
// readyRecording


function readyRecordingIos() {
  return new Promise ((resolve, reject) => {

      // 初期化
    recordedBlobs = [];

    recordButton.textContent = '停止';
    playButton.disabled = true;
    downloadButton.disabled = true;
  /*      mediaRecorder.onstop = (event) => {
      console.log('Recorder stopped: ', event);
      console.log('Recorded Blobs: ', recordedBlobs);
    };
  */
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


    /* for manipulation
    let micGainNode = audioCtx.createGain();
    let outputGainNode = audioCtx.createGain();

    inputStreamNode.connect(micGainNode);
    micGainNode.gain.setValueAtTime(config.micGain, audioCtx.currentTime);
    outputGainNode.gain.setValueAtTime(0, audioCtx.currentTime);

    micGainNode.connect(processorNode);
    processorNode.connect(outputGainNode);
    outputGainNode.connect(destinationNode);
    */

    resolve(encoderWorker);

  })
  
}
// readyRecordingIos


function launchRecordingIos() {
    // connect nodes to fire encoderWorker
    inputStreamNode.connect(processorNode);
    processorNode.connect(destinationNode);
}




// プレイ（プッシュ）ボタン
const playButton = document.querySelector('button#play');
playButton.addEventListener('click', () => {
  const superBuffer = new Blob(recordedBlobs, {type: 'audio/mp3'}); 
  
  createNewPanel(window.URL.createObjectURL(superBuffer));
  // 再生（任意）
  // newTrack.play();
});
// playButton

//
const popButton = document.querySelector('button#pop');
popButton.addEventListener('click', () => {
  index = formInputDelete.value;
  if (recordedTracks.childElementCount < 1) {
    alert('There is no data to be deleted! (消すデータがありません)');
    popButton.disabled = true;
    return;
  } else if (index > recordedTracks.childElementCount) {
    alert('There is such a data! (そんなデータはありません)')
  } else if (index < 1) {
    return;
  };

  var isYourDecision = confirm(`We delite the track-${index}. (トラック${index}を消してもいいですか)`);
  if (!isYourDecision) {return};

  let deletedDiv = recordedTracks.childNodes[index];
  let deletedTrack = deletedDiv.firstElementChild;
  deletedDiv.removeChild(deletedTrack);
  recordedTracks.removeChild(deletedDiv);
  myPlayList.splice(index-1,1);
  //
  formInputDelete.setAttribute('max', recordedTracks.childElementCount);
  formInput.setAttribute('max', recordedTracks.childElementCount)
})
// popButton


function createNewPanel(audioSrc) {
  /* 
  *  1. create new audio element✔
  *  2. ソースをsuperBufferで与える✔
  *  3. li要素を作り、ビデオをappend✔
  *  4. #tracksにappend✔
  */
  let newTrack = document.createElement('audio');
  let newIdx = totalIndex + 1;
  newTrack.setAttribute('id', `recorded-${newIdx}`);
  newTrack.src = null;
  newTrack.srcObject = null;
  newTrack.src = audioSrc;
  newTrack.controls = true;
  let newPanel = document.createElement('div');
  /* newPanelにnewTrackやミュートスイッチ、
     ダウンロードボタンなどを納めたい */
  
//  newPanel.innerHTML = '<input type = "checkbox", checked></input>'; 
  newPanel.appendChild(newTrack);

  let checkBox = document.createElement('input');
  checkBox.setAttribute('type', 'checkbox');
  checkBox.setAttribute('checked', 'true');
  newPanel.appendChild(checkBox);

  // プレイリストに追加
  myPlayList.push(newTrack.src);
  /*
  *  1. 再生位置指定
  *   a. 開始位置をフォームで指定できるようにする
  *   b. フォームに変更があるたびに
  *      media.currentTimeで代入を行う
  *  2. 有効化ボタン
  *   a. ボタンを設置
  *   b. activeならプレイリストに追加
  *   c. inactiveならプレイリストから削除
  */
  // newPanelごとリストに追加する
  recordedTracks.appendChild(newPanel);
  //
  downloadButton.disabled = false;
  playallButton.disabled = false;
  popButton.disabled = false;
  //
  formInputDelete.setAttribute('max', recordedTracks.childElementCount);
  formInput.setAttribute('max', recordedTracks.childElementCount)
}
// createNewPanel

/*
const newIdx = recordedTracks.childNodes.length + 1;

const newEl = document.createElement('div');
newEl.innerHTML = '<audio id="audio-recording-' + newIdx + '" controls></audio>';
recordedTracks.appendChild(newEl);

const recordingEl = document.getElementById("audio-recording-" + newIdx);
recordingEl.src = null;
recordingEl.srcObject =null;
recordingEl.src = audioSrc;
//recordingEl.type = 'audio/mp3';
*/

//　ダウンロードボタン
/*
*  1. ダウンロードトラックを選択可能にする
*   a. トラック番号を選択させる✔
*   b. 指定されたトラック番号が正当なら、その番号に対応したurlをダウンロード
*      不正な値ならエラーを出力
*/

// 
const downloadButton = document.querySelector('button#download');
downloadButton.addEventListener('click', () => {
//  const blob = new Blob(recordedBlobs, {type: 'audio/mp3'});
  if (recordedTracks.childElementCount < 1) {
    alert('There is no data can be downloaded!');
    downloadButton.disabled = true;
  } else {
    let _myPlayList = [];
    if (myPlayList.length > 0) {
      for (var i=0; i<myPlayList.length; i++) {
        if (recordedTracks.children[i].children[1].checked) {
          _myPlayList.push(myPlayList[i]);
        }
      }
    };

    load(_myPlayList)
          .then(createdBuffers => {console.log(createdBuffers[0].sampleRate); return mixDown(createdBuffers)})
          .then(mixedBuffer => toMp3(mixedBuffer))
          .then(myUrl => {index = 'mixed'; console.log(myUrl); return downloadUrl(myUrl)})
          .catch(console.log('error in downloadUrl'));
    /*
    index = formInput.value;
    console.log(index);
    let url = '';
    if (index === '0') {
      url =
        load(myPlayList)
          .then(createdBuffers => {console.log(createdBuffers[0].sampleRate); return mixDown(createdBuffers)})
          .then(mixedBuffer => toMp3(mixedBuffer))
          .then(myUrl => {index = 'mixed'; console.log(myUrl); return downloadUrl(myUrl)})
          .catch(console.log('error in downloadUrl'));
    } else {
      let targetPanel = recordedTracks.childNodes[index];
      let targetTrack = targetPanel.firstElementChild;
      url = targetTrack.src;
      return downloadUrl(url);
    };
    */
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
  console.log(`url = ${url}`);
  a.href = url;
  console.log(`a.href = ${a.href}`);
  a.download = `test-${index}.mp3`;
  document.body.appendChild(a);
  a.click();
  // メインスレッドが完了したらa要素を取り除く(便宜上100ms指定)
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
};
// downloadButton

// 全部同時に再生, mixing.js
const playallButton = document.querySelector('button#playall');
playallButton.addEventListener('click', () => {
  let _myPlayList = [];
    if (myPlayList.length > 0) {
      for (var i=0; i<myPlayList.length; i++) {
        if (recordedTracks.children[i].children[1].checked) {
          console.log(`track ${i} is active`);

          /*
          var audioEl = document.querySelector(`audio#recorded-${i}`);
          console.log(audioEl);
          console.log(audioEl instanceof HTMLMediaElement);
          if (audioEl instanceof HTMLMediaElement) {
          var trk = audioCtx.createMediaElementSource(audioEl);

          var source = audioCtx.createMediaElementSource(trk);
          var gainNode = audioCtx.createGain();
          var destination = audioCtx.createMediaStreamDestination();
          source.connect(gainNode).connect(destination);

          _myPlayList.push(window.URL.createObjectURL(destination.stream));
          };
          */

          _myPlayList.push(myPlayList[i]);
          //console.log(_myPlayList);
        }
      }
    };
  //console.log(_myPlayList);

  /*
  for (var i=0; i<_myPlayList.length; i++) {
    var source = audioCtx.createMediaElementSource();
    var gainNode = audioCtx.createGain();
    var destination = audioCtx.createMediaStreamDestination();
    source.connect(gainNode).connect(destination);
    // micGainNode.gain.value = 1;

    _myPlayList[i] = window.URL.createObjectURL(destination.stream);
  };
  */

  playAll(_myPlayList);
})
// playallButton

const stopButton = document.querySelector('button#stop');
stopButton.addEventListener('click', () => {
  if (buffer) {buffer.stop();}
})

const overDubButton = document.querySelector('button#overdub');
overDubButton.addEventListener('click', () => {
  if (usingMediaRecorder) {
    overDub(myPlayList);
  } else {
    overDubIos(myPlayList);
  }
});


//
function playAll(playList) {
  if (playList.length > 0) {
    load(playList)
      .then(createdBuffer => mixDown(createdBuffer))
      .then(mixedBuffer => ready(mixedBuffer))
      .then(readyedBuffer => {buffer=readyedBuffer; readyedBuffer.start()})
      .catch(console.log('error in playAll'));
  }
}

function overDub(playList) {
  let readyedBuffer = load(playList).then(createdBuffer => mixDown(createdBuffer))
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
//

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
//

let latency = 100;

const wait = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// change latency level
function changeLatencyLevel(e) {
  var value = e.target.value; 
//  if(value && value >= 0 && value <= 2) { 
   latency = value; 
   console.log(`latency changed: ${latency}`);
//  } 
};

function ready(audioBuffer) {
  // 
  // creat AudioBufferSourceNode instance
  const mix = context.createBufferSource();
  
  mix.buffer = audioBuffer;

  mix.connect(context.destination);

  return mix;
}


// 外部データをアップロード
// まずinputでファイルを取得、
// ソースをcreateNewPanelに与える
const uploadButton = document.querySelector('input#upload');
uploadButton.addEventListener('change', function(e) {
  var file = e.target.files[0]; 
  // Do something with the audio file.
  createNewPanel(URL.createObjectURL(file));
});

/* アップロードしたファイルが含まれていると、playAllできない
   セキュリティ云々 */

