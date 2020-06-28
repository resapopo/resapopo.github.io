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

// AudioContext is passed to mixing.js
let ctxt;
// ctxt = new AudioContext();

// 録音生データを格納
let recordedBlobs;

// 再生が有効なaudioへのアクセスを格納
let playlist = [];

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

// レコードボタン
recordButton.addEventListener('click', () => {
  if (recordButton.textContent === 'Start Recording') {
    startRecording();
  } else {
    stopRecording();
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
    console.error(`${options.mimeType} is not supported`);
    options = {mimeType: 'audio/ogg; codecs=vorbis'};
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.error(`${options.mimeType} is not supported`);
      options = {mimeType: 'audio/mpeg'};
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.error(`${options.mimeType} is not supported`);
        options = {mimeType: ''};
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
}
// startRecording

function stopRecording() {
  mediaRecorder.stop();
}

// プレイ（プッシュ）ボタン
const playButton = document.querySelector('button#play');
playButton.addEventListener('click', () => {
  const superBuffer = new Blob(recordedBlobs, {type: 'audio/mp3'}); 
  
  createNewPanel(window.URL.createObjectURL(superBuffer));
  // 再生（任意）
  // newTrack.play();
  downloadButton.disabled = false;
  playallButton.disabled = false;
  popButton.disabled = false;
});
// playButton

//
const popButton = document.querySelector('button#pop');
popButton.addEventListener('click', () => {
  if (recordedTracks.childElementCount === 1) {
    popButton.disabled = true;
  };
  recordedTracks.removeChild(recordedTracks.lastElementChild);
  playlist.pop();
})
// popButton

/* function createNewPanel(src)を外注させる
*  マーク部分を関数として独立
*/

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
  playlist.push(newTrack.src);
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
const downloadButton = document.querySelector('button#download');
downloadButton.addEventListener('click', () => {
//  const blob = new Blob(recordedBlobs, {type: 'audio/mp3'});
  if (recordedTracks.childElementCount < 1) {
    console.log('There is no data can be downloaded!')
  } else {
    let index = formInput.value;
    console.log(formInput.value);
    let targetPanel = recordedTracks.children[index];
    let targetTrack = targetPanel.firstElementChild;
    const url = targetTrack.src;
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `test-${index}.ogg`;
    document.body.appendChild(a);
    a.click();
    // メインスレッドが完了したらa要素を取り除く(便宜上100ms指定)
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  }
});
// downloadButton

// 全部同時に再生, mixing.js
const playallButton = document.querySelector('button#playall');
playallButton.addEventListener('click', () => {
  playAll(playlist);
})
// playallButton


const overDubButton = document.querySelector('button#overdub');
overDubButton.addEventListener('click', () => {
  overDub(playlist, ctxt)  
});

function overDub(playList) {
  // Fix up prefixing
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  ctxt = new AudioContext();
  console.log('AudioContext is created')
  console.log(ctxt)


  bufferLoader = new BufferLoader(
      ctxt,
      playList,
      _finishedLoading
  );

  console.log('proceccing overDub()')
  console.log(ctxt);
  console.log(Date.now());
  //
  bufferLoader.load();

}

function _finishedLoading(bufferList) {
  // Create multiple sources and play them together.
  let sources = [];
  console.log('proccecing _finishedLoading()')
  console.log(ctxt);
  console.log(Date.now());
  for (var i = 0; i < this.urlList.length; i++) {
    sources.push(ctxt.createBufferSource());
    sources[i].buffer = bufferList[i];
    sources[i].connect(ctxt.destination);
  };

  console.log('ready')

  for (var j = 0; j < this.urlList.length; j++) {
    // sources[j].start(ctxt.currentTime);
    sources[j].start(0);
  };
  console.log('play playlist')

  startRecording();

}
//

/*
doSomething().then(function(result) {
  return doSomethingElse(result);
})
.then(function(newResult) {
  return doThirdThing(newResult);
})
.then(function(finalResult) {
  console.log('Got the final result: ' + finalResult);
})
.catch(failureCallback);
*/


// 外部データをアップロード
// まずinputでファイルを取得、
// ソースをcreateNewPanelに与える
const uploadButton = document.querySelector('input#upload');
uploadButton.addEventListener('change', function(e) {
  var file = e.target.files[0]; 
  // Do something with the audio file.
  createNewPanel(URL.createObjectURL(file));
});


function handleDataAvailable(event) {
  console.log('handleDataAvailable', event);
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
  }
}

// access yours mic
document.querySelector('button#start').addEventListener('click', async () => {
  const hasEchoCancellation = document.querySelector('#echoCancellation').checked;
  const constraints = {
    audio: true/*{
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
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const src = audioCtx.createMediaStreamSource(stream);

  recordButton.disabled = false;
  console.log('getUserMedia() got stream:', stream);
  window.stream = stream;

}

function handleError() {
  console.error('navigator.getUserMedia error:', e);
  errorMsgElement.innerHTML = `navigator.getUserMedia error:${e.toString()}`;
};

