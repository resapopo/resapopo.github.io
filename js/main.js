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

// 録音生データを格納
let recordedBlobs;

// 再生が有効なvideoへのアクセスを格納
let playlist = [];

// トラック番号
// let index = 0;

// ハンドラの設定
const errorMsgElement = document.querySelector('span#errorMsg');
// const recordedVideo = document.querySelector('video#recorded');
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
    downloadButton.disabled = false;
    playallButton.disabled = false;
  }
});
//recordButton

// プレイ（プッシュ）ボタン
const playButton = document.querySelector('button#play');
playButton.addEventListener('click', () => {
  const superBuffer = new Blob(recordedBlobs, {type: 'video/webm'}); 
  
  createNewPanel(window.URL.createObjectURL(superBuffer));
  // 再生（任意）
  // newTrack.play();
});
// playButton

/* function createNewPanel(src)を外注させる
*  マーク部分を関数として独立
*/

function createNewPanel(audioSrc) {
  /* 
  *  1. create new video element✔
  *  2. ソースをsuperBufferで与える✔
  *  3. li要素を作り、ビデオをappend✔
  *  4. #tracksにappend✔
  */
  let newTrack = document.createElement('video');
  newTrack.setAttribute('id', 'recorded');
  newTrack.src = null;
  newTrack.srcObject = null;
  newTrack.src = audioSrc;
  newTrack.controls = true;
  let newPanel = document.createElement('li');
  /* newPanelにnewTrackやミュートスイッチ、
     ダウンロードボタンなどを納めたい */
  newPanel.appendChild(newTrack);
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

const activationButton = document.querySelectorAll('button#activation');
for (let i = 0; activationButton.length-1; i++) {
  activationButton[i].addEventListener('click', () => {
  console.log('clicked!')
/*  if (this.textContent === 'Active') {
    this.textContent = 'Inactive';
  } else {
    this.textContent = 'Active';
}
*/
});
};

/*
function activate(e) {
  if (e.textContent === 'Active') {
    e.textContent = 'Inactive';
  } else {
    e.textContent = 'Active';
}
};
*/

//　ダウンロードボタン
/*
*  1. ダウンロードトラックを選択可能にする
*   a. トラック番号を選択させる✔
*   b. 指定されたトラック番号が正当なら、その番号に対応したurlをダウンロード
*      不正な値ならエラーを出力
*/
const downloadButton = document.querySelector('button#download');
downloadButton.addEventListener('click', () => {
//  const blob = new Blob(recordedBlobs, {type: 'video/webm'});
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
    a.download = `test-${index}.webm`;
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

// 問題のある実装
const playallButton = document.querySelector('button#playall');
playallButton.addEventListener('click', () => {
  for (let i = 0; recordedTracks.childElementCount-1; i++) {
    if (!(recordedTracks.children[i].firstElementChild.muted)) {
      let playTrack = recordedTracks.children[i].firstElementChild;
      playTrack.play();
    }
  }
})
// playallButton

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

function startRecording() {
  // 初期化
  recordedBlobs = [];
  // コーデックを推奨順に指定
  let options = {mimeType: 'video/webm;codecs=vp9,opus'};
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    console.error(`${options.mimeType} is not supported`);
    options = {mimeType: 'video/webm;codecs=vp8,opus'};
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      console.error(`${options.mimeType} is not supported`);
      options = {mimeType: 'video/webm'};
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

function handleSuccess(stream) {
  recordButton.disabled = false;
  console.log('getUserMedia() got stream:', stream);
  window.stream = stream;

  const gumVideo = document.querySelector('video#gum');
  gumVideo.srcObject = stream;
}

async function init(constraints) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    handleSuccess(stream);
  } catch (e) {
    console.error('navigator.getUserMedia error:', e);
    errorMsgElement.innerHTML = `navigator.getUserMedia error:${e.toString()}`;
  }
}

// start recording
// videoの幅高さをスマホ対応させないとinvalid constraints
document.querySelector('button#start').addEventListener('click', async () => {
  const hasEchoCancellation = document.querySelector('#echoCancellation').checked;
  const constraints = {
    audio: {
      echoCancellation: {exact: hasEchoCancellation}
    },
    video: {
      // original
      // width: 1280, height: 720
      // mini
      width: 320, height: 240
    }
  };
  console.log('Using media constraints:', constraints);
  await init(constraints);
});

