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

let inputStreamNode;
let processorNode;
let destinationNode;

let encoderMimeType;

// AudioContext is passed to mixing.js
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
// ctxt = new AudioContext();

// 
let mySampleRate;

// 録音生データを格納
let recordedBlobs;

// 再生が有効なaudioへのアクセスを格納
let myPlayList = [];

// トラック番号
// let index = 0;

// ハンドラの設定
const errorMsgElement = document.querySelector('span#errorMsg');
// const recordedAudio = document.querySelector('audio#recorded');
// ではなくリストに格納する
const recordedTracks = document.querySelector('ol#tracks')
const recordButton = document.querySelector('button#record');
//
const formInput = document.querySelector('input#index');


// access your mic
document.querySelector('button#start').addEventListener('click', async () => {
  const hasEchoCancellation = document.querySelector('#echoCancellation').checked;
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
  mySampleRate = audioCtx.sampleRate;
  //const src = audioCtx.createMediaStreamSource(stream);

  recordButton.disabled = false;
  console.log('getUserMedia() got stream:', stream);
  window.stream = stream;

  if (!usingMediaRecorder) {

  };

}

function handleError() {
  console.error('navigator.getUserMedia error:', e);
  errorMsgElement.innerHTML = `navigator.getUserMedia error:${e.toString()}`;
};
// access your mic

// レコードボタン
recordButton.addEventListener('click', () => {
  if (recordButton.textContent === 'Start Recording') {
    if (usingMediaRecorder) {
      startRecording();
    } else {
      startRecordingIos();
    }    
  } else {
    if (usingMediaRecorder) {
      stopRecording();
    } else {
      stopRecordingIos();
    };    
    recordButton.textContent = 'Start Recording';
    playButton.disabled = false;
  }
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
    mediaRecorder = new MediaRecorder(window.stream, options);
  } catch (e) {
    console.error('Exception while creating MediaRecorder:', e);
    errorMsgElement.innerHTML = `Exception while creating MediaRecorder: ${JSON.stringify(e)}`;
    return;
  }

  console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
  recordButton.textContent = 'Stop Recording';
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

  recordButton.textContent = 'Stop Recording';
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

  inputStreamNode = audioCtx.createMediaStreamSource(window.stream);

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
      mediaRecorder = new MediaRecorder(window.stream, options);
    } catch (e) {
      console.error('Exception while creating MediaRecorder:', e);
      errorMsgElement.innerHTML = `Exception while creating MediaRecorder: ${JSON.stringify(e)}`;
      return;
    }

    console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
    recordButton.textContent = 'Stop Recording';
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

    recordButton.textContent = 'Stop Recording';
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

    inputStreamNode = audioCtx.createMediaStreamSource(window.stream);

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
  if (recordedTracks.childElementCount === 1) {
    popButton.disabled = true;
  };
  recordedTracks.removeChild(recordedTracks.lastElementChild);
  myPlayList.pop();
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
  newTrack.setAttribute('id', 'recorded');
  newTrack.src = null;
  newTrack.srcObject = null;
  newTrack.src = audioSrc;
  newTrack.controls = true;
  let newPanel = document.createElement('li');
  /* newPanelにnewTrackやミュートスイッチ、
     ダウンロードボタンなどを納めたい */
  newPanel.appendChild(newTrack);
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
  formInput.setAttribute('max', recordedTracks.childElementCount-1)
}
// createNewPanel

//　ダウンロードボタン
/*
*  1. ダウンロードトラックを選択可能にする
*   a. トラック番号を選択させる✔
*   b. 指定されたトラック番号が正当なら、その番号に対応したurlをダウンロード
*      不正な値ならエラーを出力
*/

// 一回しかダウンロードできない
const downloadButton = document.querySelector('button#download');
downloadButton.addEventListener('click', () => {
//  const blob = new Blob(recordedBlobs, {type: 'audio/mp3'});
  if (recordedTracks.childElementCount < 1) {
    alert('There is no data can be downloaded!')
  } else {
    let index = formInput.value;
    console.log(index);
    let url = '';
    if (index === '-1') {
      url =
        load(myPlayList)
          .then(createdBuffers => {console.log(createdBuffers[0].sampleRate); return mixDown(createdBuffers)})
          .then(mixedBuffer => toMp3(mixedBuffer))
          .then(myUrl => {index = 'mixed'; console.log(myUrl); return downloadUrl(myUrl)})
          .catch(console.log('error in downloadUrl'));
    } else {
      let targetPanel = recordedTracks.children[index];
      let targetTrack = targetPanel.firstElementChild;
      url = targetTrack.src;
      return downloadUrl(url);
    };
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
  playAll(myPlayList);
})
// playallButton

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
  load(playList)
    .then(createdBuffer => mixDown(createdBuffer))
    .then(mixedBuffer => ready(mixedBuffer))
    .then(readyedBuffer => readyedBuffer.start())
    .catch(console.log('error in playAll'));
}

function overDub(playList) {
  let readyedBuffer = load(playList).then(createdBuffer => mixDown(createdBuffer))
                                  .then(mixedBuffer => ready(mixedBuffer))
                                  .catch(console.log('error in overDub'));
  let readyMediaRecorder = readyRecording();

  Promise.all([readyedBuffer, readyMediaRecorder])
    .then(result => {
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

