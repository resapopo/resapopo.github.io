// play two audio clips simultenously

var context;
var bufferLoader;

function playAll(playList) {
    // Fix up prefixing
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    context = new AudioContext();
    console.log('AudioContext is created')

    bufferLoader = new BufferLoader(
        context,
        playList,
        finishedLoading
    );

    bufferLoader.load();
    console.log('bufferring done')
}
//

function finishedLoading(bufferList) {
    // Create multiple sources and play them together.
    let sources = [];
    for (var i = 0; i < this.urlList.length; i++) {
      sources.push(context.createBufferSource());
      sources[i].buffer = bufferList[i];
      sources[i].connect(context.destination);
    }
    console.log('ready...')
    
    for (var j = 0; j < this.urlList.length; j++) {
      sources[j].start(0);
    }
    console.log('start')
}
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
  console.log(context)
  console.log(Date.now());
  }
}




// create a mixed clip from two audio clips

offline = new webkitOfflineAudioContext(2, voice.buffer.length, 44100);
vocalSource = offline.createBufferSource();
vocalSource.buffer = bufferList[0];
vocalSource.connect(offline.destination);

backing = offline.createBufferSource();
backing.buffer = bufferList[1];
backing.connect(offline.destination);

vocalSource.start(0);
backing.start(0);

offline.oncomplete = function(ev){
    alert(bufferList);
    playBackMix(ev);
    console.log(ev.renderedBuffer);
    sendWaveToPost(ev);
}
offline.startRendering();