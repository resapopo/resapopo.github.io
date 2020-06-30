// get multiple buffers and mix them
//

// class
//
class BufferLoader {
  constructor(context, urlList, callback) {
    this.context = context;
    this.urlList = urlList;
    this.onload = callback;
    this.bufferList = new Array();
    this.loadCount = 0;
  }

  loadBuffer(url, index) {
    // Load buffer asynchronously
    var request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";

    var loader = this;

    request.onload = function () {
      // Asynchronously decode the audio file data in request.response
      loader.context.decodeAudioData(
        request.response,
        function (buffer) {
          if (!buffer) {
            alert('error decoding file data: ' + url);
            return;
          }
          loader.bufferList[index] = buffer;
          if (++loader.loadCount == loader.urlList.length)
            loader.onload(loader.bufferList);
        },
        function (error) {
          console.error('decodeAudioData error', error);
        }
      );
    };

    request.onerror = function () {
      alert('BufferLoader: XHR error');
    };

    request.send();
  }

  load() {
    for (var i = 0; i < this.urlList.length; ++i)
      this.loadBuffer(this.urlList[i], i);
  console.log('Buffering has done');
  // ロードに掛かる時間がthis.currentTimeに上乗せされている
  // console.log(context)
  // console.log(Date.now());
  }
}


// main function
//
function playAll(playList) {
  // Fix up prefixing
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  context = new AudioContext();
  console.log('AudioContext is created')

  bufferLoader = new BufferLoader(
      context,
      playList,
      _playAll
  );

  bufferLoader.load();
  console.log('bufferring done')
}

/* To Do
*  1.Modify BufferLoader class' constructor without callback
*  2.Rename _mixDown = _playAll-start
*  3.Give Promise functionality to the function load()
*  then it will be fine:
*
*  mixDown(playList)
*  = load().then(createdBuffer => _mixDown(createdBuffer));
*                  
*  then, call as
*  playAll(myPlayList) = mixDown(myPlayList).then(result => result.start());
*  and
*  overDub(myPlayList) = mixDown(myPlayList).then(result => {result.start(); startRecording()});
*  from main-audio.js
*/

// core
//
function _playAll(loadedBufferList) {

  // procedure
  //
  const mix = context.createBufferSource();
  let maxBufferLength = getSongLength(loadedBufferList);

  //call our function here
  mix.buffer = mixDown(loadedBufferList, maxBufferLength, 2);

  mix.connect(context.destination);

  //will playback the entire mixdown
  mix.start()

  // functions
  //
  function mixDown(bufferList, totalLength, numberOfChannels = 2){

    //create a buffer using the totalLength and sampleRate of the first buffer node
    let finalMix = context.createBuffer(numberOfChannels, totalLength, bufferList[0].sampleRate);

    //first loop for buffer list
    for(let i = 0; i < bufferList.length; i++){

          // second loop for each channel ie. left and right   
          for(let channel = 0; channel < numberOfChannels; channel++){

            //here we get a reference to the final mix buffer data
            let buffer = finalMix.getChannelData(channel);

                //last is loop for updating/summing the track buffer with the final mix buffer 
                for(let j = 0; j < bufferList[i].length; j++){
                    buffer[j] += bufferList[i].getChannelData(channel)[j];
                }

          }
    }

    return finalMix;
  }

  function getSongLength(arrayOfAudioBuffers) {
    let songLength = 0;

    for(let track of arrayOfAudioBuffers){
        if(track.length > songLength){
            songLength = track.length;
        }
    };

    return songLength
  }
}
// core


// Thanks to Linda Keating
// https://stackoverflow.com/questions/25040735/phonegap-mixing-audio-files

// Thanks to KpTheConstructor
// https://stackoverflow.com/questions/57155167/web-audio-api-playing-synchronized-sounds