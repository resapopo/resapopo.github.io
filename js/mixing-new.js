// get multiple buffers and mix them
//


// Return decoded audioBuffers as a PromiseOb
function load(playList) {
  return new Promise ((resolve, reject) => {
    // Fix up prefixing
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    context = new AudioContext();
    console.log('AudioContext is created');

    // for return
    var bufferList = [];

    for (var i = 0; i < playList.length; i++) {
      // Load buffer asynchronously
      bufferList[i] = fetch(playList[i])
        .then((response) => response.arrayBuffer())
        .then((arrayBuffer) => context.decodeAudioData(arrayBuffer, succeessHandle, errorHandle))
        .catch(function() {
          console.log('error in fetch')
        });
    };

    function succeessHandle(audioBuffer) {
      if (!audioBuffer) {
        alert('error decoding file data: ' + url);
        return;
      };
      return audioBuffer;
    };

    function errorHandle(e) {
      console.error(e);
    };

    Promise.all(bufferList)
    .then(bufferList => {console.log(bufferList); resolve(bufferList)})
    .catch(e => reject(console.error(e)));
  })  
}


function mixDown(loadedBufferList, givenGains) {

  let maxBufferLength = getSongLength(loadedBufferList);

  let ourNumberOfChannels = 1; // should be automatic!

  return _mixDown(loadedBufferList, maxBufferLength, ourNumberOfChannels, givenGains);

  function getSongLength(arrayOfAudioBuffers) {
    let songLength = 0;

    for(let track of arrayOfAudioBuffers){
        if(track.length > songLength){
            songLength = track.length;
        }
    };

    return songLength
  }

  function _mixDown(bufferList, totalLength, numberOfChannels = 2, gains){

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
                  //multiple gains
                  var _buffer = bufferList[i].getChannelData(channel)[j]*gains[i];
                  buffer[j] += _buffer;
                }

          }
    }

    return finalMix;
  }

}
// core

/*
*  Acknowledgments

*  Linda Keating
*  https://stackoverflow.com/questions/25040735/phonegap-mixing-audio-files

*  KpTheConstructor
*  https://stackoverflow.com/questions/57155167/web-audio-api-playing-synchronized-sounds

*/